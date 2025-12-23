const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");
const https = require("https");

const app = express();

// Configure CORS for production
const allowedOrigins = process.env.FRONTEND_URL 
  ? [process.env.FRONTEND_URL, "http://localhost:3000"]
  : ["http://localhost:3000", "http://127.0.0.1:3000"];

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

const server = http.createServer(app);
const io = new Server(server, {
  cors: { 
    origin: allowedOrigins,
    credentials: true
  },
});

const rooms = {};

// Simple health check
app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

// Simple direct Wikipedia image fetch (most reliable)
app.get("/api/player-image", async (req, res) => {
  const playerName = req.query.name;
  
  if (!playerName) {
    return res.status(400).json({ error: "Player name required" });
  }

  try {
    // Direct Wikipedia API - very reliable for cricket players
    const wikiResponse = await new Promise((resolve, reject) => {
      https.get(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(playerName)}`,
        { headers: { 'User-Agent': 'IPL-Auction-App' } },
        (response) => {
          let data = '';
          response.on('data', chunk => data += chunk);
          response.on('end', () => {
            try {
              const jsonData = JSON.parse(data);
              resolve({ data: jsonData, status: response.statusCode });
            } catch (e) {
              resolve({ data: null, status: response.statusCode });
            }
          });
        }
      ).on('error', reject);
    });

    if (wikiResponse.status === 200 && wikiResponse.data?.thumbnail?.source) {
      const imageUrl = wikiResponse.data.thumbnail.source;
      console.log(`✅ Wikipedia Image Found for: ${playerName}`);
      return res.json({ imageUrl, source: 'wikipedia', success: true });
    }
    
    console.log(`⚠️ Wikipedia - No thumbnail for: ${playerName}`);
  } catch (err) {
    console.log(`❌ Wikipedia Error for ${playerName}:`, err.message);
  }

  try {
    // Fallback: Try Wikimedia Commons (direct image files)
    const wikiCommonsResponse = await new Promise((resolve, reject) => {
      https.get(
        `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(playerName + " cricket")}&format=json&srnamespace=6&srlimit=1`,
        { headers: { 'User-Agent': 'IPL-Auction-App' } },
        (response) => {
          let data = '';
          response.on('data', chunk => data += chunk);
          response.on('end', () => {
            try {
              resolve({ data: JSON.parse(data), status: response.statusCode });
            } catch (e) {
              resolve({ data: null, status: response.statusCode });
            }
          });
        }
      ).on('error', reject);
    });

    if (wikiCommonsResponse.status === 200 && wikiCommonsResponse.data?.query?.search?.length > 0) {
      const fileTitle = wikiCommonsResponse.data.query.search[0].title;
      
      const fileInfoResponse = await new Promise((resolve, reject) => {
        https.get(
          `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(fileTitle)}&prop=imageinfo&iiprop=url&format=json`,
          { headers: { 'User-Agent': 'IPL-Auction-App' } },
          (response) => {
            let data = '';
            response.on('data', chunk => data += chunk);
            response.on('end', () => {
              try {
                resolve({ data: JSON.parse(data), status: response.statusCode });
              } catch (e) {
                resolve({ data: null, status: response.statusCode });
              }
            });
          }
        ).on('error', reject);
      });

      if (fileInfoResponse.status === 200) {
        const pages = fileInfoResponse.data.query.pages;
        const pageKey = Object.keys(pages)[0];
        if (pages[pageKey]?.imageinfo?.[0]?.url) {
          const imageUrl = pages[pageKey].imageinfo[0].url;
          console.log(`✅ Wikimedia Commons Image Found for: ${playerName}`);
          return res.json({ imageUrl, source: 'wikimedia', success: true });
        }
      }
    }
  } catch (err) {
    console.log(`❌ Wikimedia Error for ${playerName}:`, err.message);
  }

  // Final fallback: Colorful avatar with player initials
  const colors = ['FF6B6B', '4ECDC4', '45B7D1', 'FFA07A', 'FFD700', '98D8C8', '7B68EE', 'FF69B4'];
  const randomColor = colors[Math.floor(Math.random() * colors.length)];
  const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(playerName)}&size=400&background=${randomColor}&color=fff&bold=true&font-size=0.4`;
  
  console.log(`⚠️ Using Avatar Fallback for: ${playerName}`);
  return res.json({ imageUrl: avatarUrl, source: 'fallback', success: false });
});

io.on("connection", (socket) => {
  console.log("Connected:", socket.id);

  /* CREATE ROOM */
  socket.on("create-room", ({ auctioneer }) => {
    const roomId = uuidv4().slice(0, 6).toUpperCase();

    rooms[roomId] = {
      auctioneer,
      currentPlayer: null,
      teams: [],
    };

    socket.join(roomId);
    socket.emit("room-created", roomId);
  });

  /* JOIN ROOM */
  socket.on("join-room", ({ roomId, team }) => {
    const room = rooms[roomId];
    if (!room) {
      socket.emit("error", "Room not found");
      return;
    }

    room.teams.push({
      team,
      purse: 120, // 120 Cr
      squad: [], // { name, price, image }
    });

    socket.join(roomId);
    io.to(roomId).emit("update", room);
  });

  /* NEW PLAYER */
  socket.on("new-player", ({ roomId, name, startingPrice, image }) => {
    const room = rooms[roomId];
    if (!room) return;

    room.currentPlayer = {
      name,
      price: startingPrice, // in Cr
      image: image || null,
    };

    io.to(roomId).emit("update", room);
  });

  /* INCREASE PRICE (AMOUNT IS IN CRORES) */
  socket.on("increase-price", ({ roomId, amount }) => {
    const room = rooms[roomId];
    if (!room || !room.currentPlayer) return;

    room.currentPlayer.price =
      Math.round((room.currentPlayer.price + amount) * 100) / 100;

    io.to(roomId).emit("update", room);
  });

  /* SELL PLAYER */
  socket.on("sell", ({ roomId, team }) => {
    const room = rooms[roomId];
    if (!room || !room.currentPlayer) return;

    const t = room.teams.find((x) => x.team === team);
    if (!t) return;

    if (t.purse < room.currentPlayer.price) {
      socket.emit("error", "Not enough purse");
      return;
    }

    t.purse =
      Math.round((t.purse - room.currentPlayer.price) * 100) / 100;
    t.squad.push({
      name: room.currentPlayer.name,
      price: room.currentPlayer.price,
      image: room.currentPlayer.image || null,
    });

    io.to(roomId).emit(
      "sold",
      `${room.currentPlayer.name} SOLD TO ${team} for ₹${room.currentPlayer.price} Cr`
    );

    room.currentPlayer = null;
    io.to(roomId).emit("update", room);
  });

  socket.on("disconnect", () =>
    console.log("Disconnected:", socket.id)
  );
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, "0.0.0.0", () =>
  console.log(`🚀 Backend running on port ${PORT}`)
);

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

const rooms = {};

// Simple health check
app.get("/health", (req, res) => {
  res.status(200).send("OK");
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
      squad: [],
    });

    socket.join(roomId);
    io.to(roomId).emit("update", room);
  });

  /* NEW PLAYER */
  socket.on("new-player", ({ roomId, name, startingPrice }) => {
    const room = rooms[roomId];
    if (!room) return;

    room.currentPlayer = {
      name,
      price: startingPrice, // in Cr
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
    t.squad.push(room.currentPlayer.name);

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

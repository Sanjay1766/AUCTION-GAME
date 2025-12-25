import { useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";
import "./App.css";

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || "http://127.0.0.1:5000";
const socket = io(SOCKET_URL);

// Professional Sound Manager with Web Audio API
const playSound = (() => {
  let audioContext;
  
  const getAudioContext = () => {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    return audioContext;
  };

  const playTone = (frequency, duration, startTime = 0, type = 'sine', volume = 0.2) => {
    try {
      const ctx = getAudioContext();
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      
      oscillator.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      oscillator.type = type;
      oscillator.frequency.value = frequency;
      
      filter.type = 'lowpass';
      filter.frequency.value = frequency * 2;
      
      const now = ctx.currentTime + startTime;
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(volume, now + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);
      
      oscillator.start(now);
      oscillator.stop(now + duration);
    } catch (err) {
      console.log('Audio not supported');
    }
  };

  return (type) => {
    switch(type) {
      case 'bid':
        // Quick ascending chirp
        playTone(600, 0.08, 0, 'sine', 0.15);
        playTone(800, 0.08, 0.06, 'sine', 0.15);
        break;
      case 'sold':
        // Triumphant fanfare
        playTone(523.25, 0.15, 0, 'sine', 0.2);    // C5
        playTone(659.25, 0.15, 0.15, 'sine', 0.2);  // E5
        playTone(783.99, 0.25, 0.3, 'sine', 0.25);  // G5
        playTone(1046.50, 0.4, 0.5, 'triangle', 0.2); // C6
        break;
      case 'notify':
        // Gentle notification
        playTone(880, 0.1, 0, 'sine', 0.12);
        playTone(1174.66, 0.12, 0.08, 'sine', 0.12);
        break;
      case 'start':
        // Attention grabbing start
        playTone(440, 0.12, 0, 'square', 0.15);
        playTone(554.37, 0.12, 0.12, 'square', 0.15);
        playTone(659.25, 0.18, 0.24, 'square', 0.18);
        break;
      case 'error':
        // Error sound
        playTone(200, 0.2, 0, 'sawtooth', 0.15);
        playTone(150, 0.25, 0.15, 'sawtooth', 0.15);
        break;
      default:
        break;
    }
  };
})();

export default function App() {
  const [view, setView] = useState("HOME");
  const [roomId, setRoomId] = useState("");
  const [name, setName] = useState("");
  const [team, setTeam] = useState("");
  const [isAuctioneer, setIsAuctioneer] = useState(false);
  const [room, setRoom] = useState(null);
  const [player, setPlayer] = useState("");
  const [base, setBase] = useState("");
  const [currency, setCurrency] = useState("Cr");
  const [sellUI, setSellUI] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [priceAnimation, setPriceAnimation] = useState(false);
  const [notification, setNotification] = useState(null);
  const [playerImage, setPlayerImage] = useState("");
  const [imageLoading, setImageLoading] = useState(false);
  const [showPurchases, setShowPurchases] = useState(false);
  const [playerMode, setPlayerMode] = useState(null); // null, "free", or "database"
  const [allPlayers, setAllPlayers] = useState([]);
  const [playerPool, setPlayerPool] = useState([]); // Balanced, shuffled player pool
  const [currentPlayerIndex, setCurrentPlayerIndex] = useState(0);
  const prevPriceRef = useRef(null);

  const showNotification = (message, type = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Load players database on mount
  useEffect(() => {
    const loadPlayers = async () => {
      try {
        const response = await fetch('/players.json');
        const data = await response.json();
        setAllPlayers(data.players);
      } catch (err) {
        console.log('Error loading players:', err);
      }
    };
    loadPlayers();
  }, []);

  // Create balanced player pool when database mode is selected
  const createBalancedPlayerPool = () => {
    // Group players by role
    const batsmen = allPlayers.filter(p => p.role === 'Batsman');
    const bowlers = allPlayers.filter(p => p.role === 'Bowler');
    const allRounders = allPlayers.filter(p => p.role === 'All-Rounder');
    const keepers = allPlayers.filter(p => p.role === 'Wicket-Keeper');

    // Shuffle each group
    const shuffle = (arr) => arr.sort(() => Math.random() - 0.5);
    shuffle(batsmen);
    shuffle(bowlers);
    shuffle(allRounders);
    shuffle(keepers);

    // Interleave players for balanced distribution
    const balanced = [];
    const maxLength = Math.max(batsmen.length, bowlers.length, allRounders.length, keepers.length);
    
    for (let i = 0; i < maxLength; i++) {
      if (i < batsmen.length) balanced.push(batsmen[i]);
      if (i < bowlers.length) balanced.push(bowlers[i]);
      if (i < allRounders.length) balanced.push(allRounders[i]);
      if (i < keepers.length) balanced.push(keepers[i]);
    }

    setPlayerPool(balanced);
    setCurrentPlayerIndex(0);
    console.log('✅ Created balanced player pool with', balanced.length, 'players');
    console.log('Distribution:', {
      Batsmen: batsmen.length,
      Bowlers: bowlers.length,
      'All-Rounders': allRounders.length,
      'Wicket-Keepers': keepers.length
    });
  };

  // Get next player from balanced pool
  const getNextPlayer = () => {
    if (currentPlayerIndex >= playerPool.length) {
      showNotification('All players have been auctioned!', 'info');
      return null;
    }
    const nextPlayer = playerPool[currentPlayerIndex];
    setCurrentPlayerIndex(prev => prev + 1);
    return nextPlayer;
  };

  // Auto-load first player after room opens (database mode)
  useEffect(() => {
    if (
      playerMode === 'database' &&
      isAuctioneer &&
      view === 'AUCTION' &&
      playerPool.length > 0 &&
      currentPlayerIndex === 0 &&
      !player
    ) {
      const firstPlayer = playerPool[0];
      setPlayer(firstPlayer.name);
      setCurrentPlayerIndex(1);
      fetchPlayerImage(firstPlayer.name);
      console.log('✅ Auto-loaded first player (guard):', firstPlayer.name, '-', firstPlayer.role);
    }
  }, [playerMode, isAuctioneer, view, playerPool, currentPlayerIndex, player]);

  useEffect(() => {
    socket.off();

    socket.on("room-created", (id) => {
      setRoomId(id);
      setIsAuctioneer(true);
      setView("AUCTION");
      playSound('start');
      showNotification(`Room created! ID: ${id}`, 'success');
      
      // Auto-load first player in database mode
      if (playerMode === "database" && playerPool.length > 0) {
        const firstPlayer = playerPool[0];
        setPlayer(firstPlayer.name);
        setCurrentPlayerIndex(1);
        fetchPlayerImage(firstPlayer.name);
        console.log('✅ Auto-loaded first player:', firstPlayer.name, '-', firstPlayer.role);
      }
    });

    socket.on("update", (data) => {
      const newPrice = data?.currentPlayer?.price;
      const oldPrice = prevPriceRef.current;
      
      if (newPrice && oldPrice && newPrice !== oldPrice) {
        setPriceAnimation(true);
        playSound('bid');
        setTimeout(() => setPriceAnimation(false), 500);
      }
      
      prevPriceRef.current = newPrice;
      if (data?.currentPlayer?.image) {
        setPlayerImage(data.currentPlayer.image);
      }
      setRoom({ ...data });
    });
    
    socket.on("sold", (msg) => {
      playSound('sold');
      setShowConfetti(true);
      showNotification(msg, 'success');
      setTimeout(() => setShowConfetti(false), 4000);
      
      // Auto-load next player in database mode after auction completes
      if (playerMode === "database" && isAuctioneer) {
        setTimeout(() => {
          if (currentPlayerIndex >= playerPool.length) {
            showNotification('All players have been auctioned!', 'info');
            return;
          }
          const nextPlayer = playerPool[currentPlayerIndex];
          setCurrentPlayerIndex(prev => prev + 1);
          setPlayer(nextPlayer.name);
          fetchPlayerImage(nextPlayer.name);
          console.log('✅ Auto-loaded next player:', nextPlayer.name, '-', nextPlayer.role);
        }, 2000); // Wait 2 seconds after sold animation
      }
    });
    
    socket.on("error", (msg) => {
      playSound('error');
      showNotification(msg, 'error');
    });

    return () => socket.off();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerMode, isAuctioneer, playerPool, currentPlayerIndex]);

  const baseToCr = () =>
    currency === "Lakh" ? Number(base) / 100 : Number(base);

  const fetchPlayerImage = async (playerName) => {
    if (!playerName.trim()) {
      setPlayerImage("");
      return;
    }
    
    setImageLoading(true);
    
    // Method 1: Try Wikipedia API directly (most reliable for cricket players)
    try {
      const response = await fetch(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(playerName)}`
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data.thumbnail && data.thumbnail.source) {
          console.log(`✅ Wikipedia image found for ${playerName}`);
          setPlayerImage(data.thumbnail.source);
          setImageLoading(false);
          return;
        }
      }
    } catch (err) {
      console.log('Wikipedia API failed:', err);
    }

    // Method 2: Try Wikimedia Commons for direct cricket player images
    try {
      const response = await fetch(
        `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(playerName + " cricket")}&format=json&srnamespace=6&srlimit=1`
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data.query?.search?.length > 0) {
          const fileTitle = data.query.search[0].title;
          
          const fileResponse = await fetch(
            `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(fileTitle)}&prop=imageinfo&iiprop=url&format=json`
          );
          
          if (fileResponse.ok) {
            const fileData = await fileResponse.json();
            const pages = fileData.query.pages;
            const pageKey = Object.keys(pages)[0];
            
            if (pages[pageKey]?.imageinfo?.[0]?.url) {
              const imageUrl = pages[pageKey].imageinfo[0].url;
              console.log(`✅ Wikimedia Commons image found for ${playerName}`);
              setPlayerImage(imageUrl);
              setImageLoading(false);
              return;
            }
          }
        }
      }
    } catch (err) {
      console.log('Wikimedia Commons failed:', err);
    }

    // Method 3: Unsplash API with free access key
    try {
      const response = await fetch(
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(playerName + " cricket")}&client_id=tVd5F4NeHfLTVKBwj-rczKcb-pzJNxGcNmFrWMXZu64&per_page=1`
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data.results?.length > 0) {
          const imageUrl = data.results[0].urls.regular;
          console.log(`✅ Unsplash image found for ${playerName}`);
          setPlayerImage(imageUrl);
          setImageLoading(false);
          return;
        }
      }
    } catch (err) {
      console.log('Unsplash API failed:', err);
    }

    // Method 4: Google Images search (via placeholder service)
    try {
      const googleImageUrl = `https://www.bing.com/th?q=${encodeURIComponent(playerName + " cricket player")}&w=300&h=400`;
      console.log(`🔍 Using Bing image search for ${playerName}`);
      setPlayerImage(googleImageUrl);
      setImageLoading(false);
      return;
    } catch (err) {
      console.log('Bing image failed:', err);
    }

    // Final fallback: Colorful avatar with player initials
    const colors = ['FF6B6B', '4ECDC4', '45B7D1', 'FFA07A', 'FFD700', '98D8C8', '7B68EE', 'FF69B4'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(playerName)}&size=400&background=${randomColor}&color=fff&bold=true&font-size=0.4`;
    
    console.log(`⚠️ All image APIs failed, using avatar fallback for ${playerName}`);
    setPlayerImage(avatarUrl);
    setImageLoading(false);
  };

  /* HOME */
  if (view === "HOME")
    return (
      <Page title="🏏 IPL Auction">
        <div className="fade-in" style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "20px",
          marginTop: "50px"
        }}>
          <div className="cricket-animation" style={{
            fontSize: "80px",
            marginBottom: "20px"
          }}>🏏</div>
          <PrimaryButton onClick={() => {
            setView("CREATE");
            setPlayerMode(null);
            playSound('notify');
          }}>
            CREATE TEAM (Auctioneer)
          </PrimaryButton>
          <PrimaryButton onClick={() => {
            setView("JOIN");
            setPlayerMode(null);
            playSound('notify');
          }}>
            JOIN USING ROOM ID
          </PrimaryButton>
        </div>
      </Page>
    );

  /* MODE SELECTION (for choosing between free entry or database) */
  if (view === "CREATE" && playerMode === null)
    return (
      <Page title="Choose Player Entry Mode">
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "20px",
          marginTop: "50px"
        }}>
          <div style={{
            fontSize: "16px",
            color: "#475569",
            marginBottom: "20px",
            textAlign: "center"
          }}>
            How would you like to add players?
          </div>
          <PrimaryButton onClick={() => {
            setPlayerMode("free");
            playSound('notify');
          }}>
            📝 FREE ENTRY (Type Any Player Name)
          </PrimaryButton>
          <PrimaryButton onClick={() => {
            setPlayerMode("database");
            playSound('notify');
          }}>
            ⭐ DATABASE (Choose From Popular Players)
          </PrimaryButton>
          <div style={{ marginTop: "10px" }}>
            <PrimaryButton onClick={() => {
              setView("HOME");
              playSound('notify');
            }} style={{ background: "rgba(148, 163, 184, 0.5)" }}>
              ← BACK
            </PrimaryButton>
          </div>
        </div>
      </Page>
    );

  /* CREATE */
  if (view === "CREATE" && playerMode !== null)
    return (
      <Page title="Create Auction Room">
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "15px",
          marginTop: "30px"
        }}>
          <Input value={name} onChange={setName} placeholder="Auctioneer Name" />
          <PrimaryButton
            onClick={() => {
              if (!name.trim()) {
                showNotification("Please enter your name", "error");
                playSound('error');
                return;
              }
              
              // If database mode, create balanced player pool
              if (playerMode === "database") {
                createBalancedPlayerPool();
              }
              
              socket.emit("create-room", { auctioneer: name });
            }}
          >
            CREATE ROOM
          </PrimaryButton>
        </div>
      </Page>
    );

  /* JOIN */
  if (view === "JOIN")
    return (
      <Page title="Join Auction">
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "15px",
          marginTop: "30px"
        }}>
          <Input value={roomId} onChange={setRoomId} placeholder="Room ID" />
          <Input value={team} onChange={setTeam} placeholder="Team Name" />
          <PrimaryButton
            onClick={() => {
              socket.emit("join-room", { roomId, team });
              setIsAuctioneer(false);
              setView("AUCTION");
            }}
          >
            JOIN
          </PrimaryButton>
        </div>
      </Page>
    );

  /* AUCTION */
  return (
    <Page title={`Auction Room: ${roomId}`}>
      {showConfetti && <Confetti />}
      
      {isAuctioneer && (
        <Card highlight>
          <h3 style={{ marginTop: 0, marginBottom: "20px", textAlign: "center" }}>
            {playerMode === "database" ? "🎯 Current Player (Auto-Presented)" : "🎯 Start New Auction"}
          </h3>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
            {playerMode === "free" ? (
              // FREE ENTRY MODE - Manual input
              <Input
                value={player}
                onChange={(val) => {
                  setPlayer(val);
                  if (val.trim().length > 2) {
                    fetchPlayerImage(val);
                  }
                }}
                placeholder="Enter Any Player Name"
              />
            ) : (
              // DATABASE MODE - Auto-present player
              <div style={{
                width: "100%",
                maxWidth: "400px",
                padding: "20px",
                background: "rgba(59, 130, 246, 0.05)",
                borderRadius: "10px",
                border: "2px dashed rgba(59, 130, 246, 0.3)",
                textAlign: "center"
              }}>
                {player ? (
                  <div>
                    <div style={{ fontSize: "24px", fontWeight: "bold", color: "#1e293b", marginBottom: "5px" }}>
                      {player}
                    </div>
                    <div style={{ fontSize: "14px", color: "#64748b", marginBottom: "10px" }}>
                      {playerPool[currentPlayerIndex - 1]?.role || "Unknown Role"}
                    </div>
                  </div>
                ) : (
                  <div style={{ color: "#64748b", fontSize: "14px" }}>
                    Loading first player...
                  </div>
                )}
                <div style={{ marginTop: "15px", fontSize: "12px", color: "#94a3b8" }}>
                  {currentPlayerIndex} / {playerPool.length} players presented
                </div>
              </div>
            )}
            <div style={{ display: "flex", gap: "10px", width: "100%", maxWidth: "400px" }}>
              <Input
                value={base}
                onChange={setBase}
                placeholder="Base Price"
              />
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                style={{
                  padding: "12px",
                  borderRadius: 10,
                  border: "2px solid rgba(59, 130, 246, 0.3)",
                  background: "rgba(255, 255, 255, 0.9)",
                  color: "#1e293b",
                  fontSize: "16px",
                  outline: "none",
                  cursor: "pointer",
                  minWidth: "100px",
                  fontWeight: "500"
                }}
              >
                <option value="Cr">Cr</option>
                <option value="Lakh">Lakh</option>
              </select>
            </div>

            {playerImage && (
              <div style={{
                position: 'relative',
                marginBottom: '10px'
              }}>
                {imageLoading && (
                  <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    zIndex: 10
                  }}>
                    <div style={{
                      width: '30px',
                      height: '30px',
                      border: '3px solid rgba(59, 130, 246, 0.2)',
                      borderTop: '3px solid #3b82f6',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }}></div>
                  </div>
                )}
                <img
                  src={playerImage}
                  alt={player}
                  style={{
                    width: '120px',
                    height: '150px',
                    borderRadius: '10px',
                    objectFit: 'cover',
                    border: '2px solid #3b82f6',
                    opacity: imageLoading ? 0.6 : 1
                  }}
                  onError={(e) => {
                    e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(player)}&size=200&background=random&color=fff&bold=true`;
                  }}
                />
              </div>
            )}

            <PrimaryButton
              onClick={() => {
                // DATABASE MODE: Player is already loaded, just start auction
                if (playerMode === "database") {
                  if (!player.trim()) {
                    showNotification("No player loaded!", "error");
                    playSound('error');
                    return;
                  }
                  
                  if (!base) {
                    showNotification("Please enter base price", "error");
                    playSound('error');
                    return;
                  }
                  
                  playSound('start');
                  const imageUrl = playerImage || `https://ui-avatars.com/api/?name=${encodeURIComponent(player)}&size=400&background=3b82f6&color=fff&bold=true`;
                  socket.emit("new-player", {
                    roomId,
                    name: player,
                    startingPrice: baseToCr(),
                    image: imageUrl,
                  });
                  setBase("");
                  setPlayerImage("");
                  // Player will be auto-loaded after auction completes via 'sold' event
                  return;
                }
                
                // FREE MODE: Validate manual input
                if (!player.trim() || !base) {
                  showNotification("Please enter player name and base price", "error");
                  playSound('error');
                  return;
                }
                playSound('start');
                const imageUrl = playerImage || `https://ui-avatars.com/api/?name=${encodeURIComponent(player)}&size=400&background=3b82f6&color=fff&bold=true`;
                socket.emit("new-player", {
                  roomId,
                  name: player,
                  startingPrice: baseToCr(),
                  image: imageUrl,
                });
                setPlayer("");
                setBase("");
                setPlayerImage("");
              }}
            >
              {playerMode === "database" ? "START AUCTION" : "START AUCTION"}
            </PrimaryButton>
          </div>
        </Card>
      )}

      {room?.currentPlayer && (
        <Card highlight>
          <div style={{ 
            display: "flex", 
            flexDirection: window.innerWidth > 768 ? "row" : "column",
            gap: "20px",
            alignItems: "center"
          }} className="slide-in">
            {room.currentPlayer.image && (
              <div style={{ position: 'relative' }}>
                {imageLoading && (
                  <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    zIndex: 10
                  }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      border: '4px solid rgba(59, 130, 246, 0.2)',
                      borderTop: '4px solid #3b82f6',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }}></div>
                  </div>
                )}
                <img 
                  src={room.currentPlayer.image}
                  alt={room.currentPlayer.name}
                  style={{
                    width: window.innerWidth > 768 ? "200px" : "150px",
                    height: window.innerWidth > 768 ? "250px" : "200px",
                    objectFit: "cover",
                    borderRadius: "15px",
                    boxShadow: "0 10px 30px rgba(0, 0, 0, 0.2)",
                    border: "3px solid rgba(59, 130, 246, 0.5)",
                    opacity: imageLoading ? 0.5 : 1
                  }}
                  onLoad={() => setImageLoading(false)}
                  onError={(e) => {
                    console.log('Image failed to load:', room.currentPlayer.image);
                    e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(room.currentPlayer.name)}&size=400&background=3b82f6&color=fff&bold=true`;
                    setImageLoading(false);
                  }}
                />
              </div>
            )}
            <div style={{ textAlign: "center", flex: 1 }}>
              <h2 style={{ 
                fontSize: "2rem", 
                marginBottom: "10px",
                color: "#1e293b"
              }} className="glow">{room.currentPlayer.name}</h2>
              <h3 style={{ 
                fontSize: "2.5rem", 
                color: "#f59e0b",
                fontWeight: "bold",
                margin: "20px 0",
                textShadow: "0 0 20px rgba(245, 158, 11, 0.5)"
              }} className={priceAnimation ? "price-pulse" : ""}>
                ₹ {room.currentPlayer.price} Cr
              </h3>
            </div>
          </div>

          {isAuctioneer && (
            <>
              {[
                { label: "+20 Lakhs", value: 0.2 },
                { label: "+25 Lakhs", value: 0.25 },
                { label: "+50 Lakhs", value: 0.5 },
              ].map((b) => (
                <PrimaryButton
                  key={b.value}
                  onClick={() => {
                    playSound('bid');
                    socket.emit("increase-price", {
                      roomId,
                      amount: b.value,
                    });
                  }}
                >
                  {b.label}
                </PrimaryButton>
              ))}

              <PrimaryButton onClick={() => setSellUI(true)}>
                SELL
              </PrimaryButton>
            </>
          )}
        </Card>
      )}

      {sellUI &&
        room?.teams.map((t) => (
          <PrimaryButton
            key={t.team}
            onClick={() => {
              playSound('sold');
              socket.emit("sell", { roomId, team: t.team });
              setSellUI(false);
            }}
          >
            SELL TO {t.team}
          </PrimaryButton>
        ))}

      <h3 style={{
        fontSize: "1.8rem",
        marginTop: "40px",
        marginBottom: "20px",
        textAlign: "center",
        color: "#1e293b"
      }} className="glow">🏆 Teams</h3>
      {team && (
        <div style={{ textAlign: "center", marginBottom: "10px" }}>
          <PrimaryButton onClick={() => setShowPurchases(true)}>
            VIEW MY PURCHASES
          </PrimaryButton>
        </div>
      )}
      <div style={{ 
        display: "grid", 
        gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
        gap: "20px"
      }}>
        {room?.teams.map((t, index) => (
          <Card key={t.team} style={{ 
            animation: `fadeInUp 0.5s ease-out ${index * 0.1}s both`
          }}>
            <div style={{
              borderBottom: "2px solid rgba(59, 130, 246, 0.2)",
              paddingBottom: "15px",
              marginBottom: "15px"
            }}>
              <strong style={{ fontSize: "1.3rem", color: "#2563eb" }}>{t.team}</strong>
              <div style={{ 
                fontSize: "1.5rem", 
                color: "#10b981",
                fontWeight: "bold",
                marginTop: "10px"
              }}>
                💰 {t.purse} Cr
              </div>
            </div>
            <ul style={{ 
              listStyle: "none", 
              padding: 0,
              margin: 0
            }}>
              {t.squad.length === 0 ? (
                <li style={{ color: "#94a3b8", fontStyle: "italic" }}>No players yet</li>
              ) : (
                t.squad.map((p, idx) => (
                  <li key={`${p.name || p}-${idx}`} style={{
                    padding: "8px 0",
                    borderBottom: idx < t.squad.length - 1 ? "1px solid rgba(100, 116, 139, 0.1)" : "none",
                    color: "#475569",
                    animation: `slideInLeft 0.3s ease-out ${idx * 0.05}s both`
                  }}>✓ {p.name || p} {p.price ? `— ₹ ${p.price} Cr` : ""}</li>
                ))
              )}
            </ul>
          </Card>
        ))}
      </div>
      {notification && <Notification message={notification.message} type={notification.type} />}
      {showPurchases && (
        <PurchaseModal 
          teamName={team}
          room={room}
          onClose={() => setShowPurchases(false)}
        />
      )}
    </Page>
  );
}

/* UI COMPONENTS */

function Notification({ message, type }) {
  const colors = {
    success: { bg: '#10b981', border: '#059669', icon: '✓' },
    error: { bg: '#ef4444', border: '#dc2626', icon: '✕' },
    info: { bg: '#3b82f6', border: '#2563eb', icon: 'ℹ' }
  };
  
  const color = colors[type] || colors.info;
  
  return (
    <div 
      className="notification-toast"
      style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        backgroundColor: color.bg,
        color: 'white',
        padding: '16px 24px',
        borderRadius: '12px',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
        zIndex: 10000,
        minWidth: '300px',
        maxWidth: '500px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        fontSize: '16px',
        fontWeight: '500',
        border: `2px solid ${color.border}`,
        animation: 'slideInFromRight 0.4s ease-out'
      }}
    >
      <span style={{ 
        fontSize: '24px',
        fontWeight: 'bold'
      }}>{color.icon}</span>
      <span>{message}</span>
    </div>
  );
}

function PurchaseModal({ teamName, room, onClose }) {
  const teamData = room?.teams?.find((t) => t.team === teamName);
  const purchases = teamData?.squad
    ? [...teamData.squad].sort((a, b) => (b.price || 0) - (a.price || 0))
    : [];

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      background: 'rgba(0,0,0,0.3)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 11000,
      padding: '20px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '500px',
        background: 'white',
        borderRadius: '16px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        overflow: 'hidden'
      }}>
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid rgba(148, 163, 184, 0.3)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: '#1e293b' }}>My Purchases</div>
            <div style={{ fontSize: '14px', color: '#475569' }}>{teamName || 'No team selected'}</div>
          </div>
          <button onClick={onClose} style={{
            background: 'transparent',
            border: 'none',
            fontSize: '20px',
            cursor: 'pointer',
            color: '#94a3b8'
          }}>✕</button>
        </div>

        <div style={{ padding: '16px 20px', maxHeight: '60vh', overflowY: 'auto' }}>
          {!teamName && (
            <div style={{ color: '#ef4444', fontWeight: 600 }}>Join a team to view purchases.</div>
          )}
          {teamName && purchases.length === 0 && (
            <div style={{ color: '#475569' }}>No purchases yet.</div>
          )}
          {purchases.map((p, idx) => (
            <div key={idx} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '10px 0',
              borderBottom: idx < purchases.length - 1 ? '1px solid rgba(226, 232, 240, 0.8)' : 'none'
            }}>
              <img
                src={p.image || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.name || '')}&size=200&background=3b82f6&color=fff&bold=true`}
                alt={p.name}
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  objectFit: 'cover',
                  border: '2px solid rgba(59, 130, 246, 0.3)'
                }}
                onError={(e) => {
                  e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(p.name || '')}&size=200&background=3b82f6&color=fff&bold=true`;
                }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: '#0f172a' }}>{p.name}</div>
                <div style={{ color: '#475569', fontSize: '14px' }}>₹ {p.price} Cr</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Confetti() {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: 9999,
      overflow: 'hidden'
    }}>
      {[...Array(50)].map((_, i) => (
        <div
          key={i}
          className="confetti"
          style={{
            left: `${Math.random() * 100}%`,
            backgroundColor: ['#ff6b6b', '#4ecdc4', '#45b7d1', '#fbbf24', '#a78bfa'][Math.floor(Math.random() * 5)],
            animationDelay: `${Math.random() * 0.5}s`,
            animationDuration: `${2 + Math.random() * 2}s`
          }}
        />
      ))}
    </div>
  );
}

function Page({ title, children }) {
  return (
    <div style={{ 
      minHeight: "100vh",
      padding: "30px 20px", 
      background: "linear-gradient(135deg, #e0f2fe 0%, #bae6fd 25%, #fef3c7 50%, #fed7aa 75%, #fce7f3 100%)", 
      color: "#1e293b",
      fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
      backgroundSize: "400% 400%",
      animation: "gradientShift 20s ease infinite"
    }}>
      <h1 style={{
        fontSize: "2.5rem",
        marginBottom: "30px",
        textAlign: "center",
        background: "linear-gradient(to right, #2563eb, #7c3aed, #db2777)",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundSize: "200% auto",
        animation: "shine 3s linear infinite",
        fontWeight: "800",
        textShadow: "2px 2px 4px rgba(0, 0, 0, 0.05)"
      }}>{title}</h1>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        {children}
      </div>
    </div>
  );
}

function Card({ children, highlight, style }) {
  return (
    <div
      style={{
        padding: 25,
        margin: "15px 0",
        borderRadius: 16,
        background: highlight 
          ? "linear-gradient(135deg, #3b82f6 0%, #60a5fa 100%)" 
          : "rgba(255, 255, 255, 0.95)",
        backdropFilter: "blur(10px)",
        border: highlight ? "2px solid #2563eb" : "2px solid rgba(148, 163, 184, 0.2)",
        boxShadow: highlight 
          ? "0 10px 40px rgba(59, 130, 246, 0.3)" 
          : "0 4px 20px rgba(0, 0, 0, 0.08)",
        transition: "all 0.3s ease",
        transform: "translateY(0)",
        ...style
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-5px)";
        e.currentTarget.style.boxShadow = highlight 
          ? "0 15px 50px rgba(59, 130, 246, 0.4)"
          : "0 8px 30px rgba(0, 0, 0, 0.15)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = highlight 
          ? "0 10px 40px rgba(59, 130, 246, 0.3)"
          : "0 4px 20px rgba(0, 0, 0, 0.08)";
      }}
    >
      {children}
    </div>
  );
}

function Input({ value, onChange, placeholder }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{ 
        padding: "12px 16px",
        margin: "8px 0",
        width: "100%",
        maxWidth: "400px",
        borderRadius: 10,
        border: "2px solid rgba(59, 130, 246, 0.3)",
        background: "rgba(255, 255, 255, 0.95)",
        color: "#1e293b",
        fontSize: "16px",
        outline: "none",
        transition: "all 0.3s ease",
        boxSizing: "border-box",
        fontWeight: "500"
      }}
      onFocus={(e) => {
        e.target.style.borderColor = "#3b82f6";
        e.target.style.boxShadow = "0 0 0 3px rgba(59, 130, 246, 0.1)";
      }}
      onBlur={(e) => {
        e.target.style.borderColor = "rgba(59, 130, 246, 0.3)";
        e.target.style.boxShadow = "none";
      }}
    />
  );
}

function PrimaryButton({ children, onClick }) {
  const [isPressed, setIsPressed] = useState(false);
  
  return (
    <button
      onClick={(e) => {
        setIsPressed(true);
        setTimeout(() => setIsPressed(false), 200);
        onClick(e);
      }}
      style={{
        padding: "14px 28px",
        margin: "8px 5px",
        background: isPressed 
          ? "linear-gradient(135deg, #1e40af 0%, #2563eb 100%)"
          : "linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)",
        color: "white",
        border: "none",
        borderRadius: 10,
        cursor: "pointer",
        fontSize: "15px",
        fontWeight: "600",
        boxShadow: isPressed 
          ? "0 2px 10px rgba(37, 99, 235, 0.3)"
          : "0 4px 15px rgba(37, 99, 235, 0.4)",
        transition: "all 0.2s ease",
        textTransform: "uppercase",
        letterSpacing: "0.5px",
        transform: isPressed ? "scale(0.95)" : "scale(1)",
        position: "relative",
        overflow: "hidden"
      }}
      onMouseEnter={(e) => {
        if (!isPressed) {
          e.target.style.transform = "translateY(-2px) scale(1.02)";
          e.target.style.boxShadow = "0 6px 20px rgba(37, 99, 235, 0.6)";
        }
      }}
      onMouseLeave={(e) => {
        if (!isPressed) {
          e.target.style.transform = "translateY(0) scale(1)";
          e.target.style.boxShadow = "0 4px 15px rgba(37, 99, 235, 0.4)";
        }
      }}
    >
      {children}
    </button>
  );
}

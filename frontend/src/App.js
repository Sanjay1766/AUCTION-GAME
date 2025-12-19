import { useEffect, useState } from "react";
import { io } from "socket.io-client";

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || "http://127.0.0.1:5000";
const socket = io(SOCKET_URL);

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

  useEffect(() => {
    socket.off();

    socket.on("room-created", (id) => {
      setRoomId(id);
      setIsAuctioneer(true);
      setView("AUCTION");
    });

    socket.on("update", (data) => setRoom({ ...data }));
    socket.on("sold", (msg) => alert(msg));
    socket.on("error", (msg) => alert(msg));

    return () => socket.off();
  }, []);

  const baseToCr = () =>
    currency === "Lakh" ? Number(base) / 100 : Number(base);

  /* HOME */
  if (view === "HOME")
    return (
      <Page title="🏏 IPL Auction">
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "15px",
          marginTop: "50px"
        }}>
          <PrimaryButton onClick={() => setView("CREATE")}>
            CREATE TEAM (Auctioneer)
          </PrimaryButton>
          <PrimaryButton onClick={() => setView("JOIN")}>
            JOIN USING ROOM ID
          </PrimaryButton>
        </div>
      </Page>
    );

  /* CREATE */
  if (view === "CREATE")
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
              if (!name.trim()) return alert("Enter name");
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
      {isAuctioneer && (
        <Card highlight>
          <h3 style={{ marginTop: 0, marginBottom: "20px", textAlign: "center" }}>🎯 Start New Auction</h3>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
            <Input
              value={player}
              onChange={setPlayer}
              placeholder="Player Name"
            />
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
                  border: "2px solid rgba(100, 116, 139, 0.3)",
                  background: "rgba(30, 41, 59, 0.5)",
                  color: "white",
                  fontSize: "16px",
                  outline: "none",
                  cursor: "pointer",
                  minWidth: "100px"
                }}
              >
                <option value="Cr">Cr</option>
                <option value="Lakh">Lakh</option>
              </select>
            </div>

            <PrimaryButton
              onClick={() => {
                socket.emit("new-player", {
                  roomId,
                  name: player,
                  startingPrice: baseToCr(),
                });
                setPlayer("");
                setBase("");
              }}
            >
              START AUCTION
            </PrimaryButton>
          </div>
        </Card>
      )}

      {room?.currentPlayer && (
        <Card highlight>
          <div style={{ textAlign: "center" }}>
            <h2 style={{ 
              fontSize: "2rem", 
              marginBottom: "10px",
              color: "#fff"
            }}>{room.currentPlayer.name}</h2>
            <h3 style={{ 
              fontSize: "2.5rem", 
              color: "#fbbf24",
              fontWeight: "bold",
              margin: "20px 0",
              textShadow: "0 0 20px rgba(251, 191, 36, 0.5)"
            }}>₹ {room.currentPlayer.price} Cr</h3>
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
                  onClick={() =>
                    socket.emit("increase-price", {
                      roomId,
                      amount: b.value, // ✅ CORRECT
                    })
                  }
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
        color: "#e2e8f0"
      }}>🏆 Teams</h3>
      <div style={{ 
        display: "grid", 
        gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
        gap: "20px"
      }}>
        {room?.teams.map((t) => (
          <Card key={t.team}>
            <div style={{
              borderBottom: "2px solid rgba(59, 130, 246, 0.3)",
              paddingBottom: "15px",
              marginBottom: "15px"
            }}>
              <strong style={{ fontSize: "1.3rem", color: "#60a5fa" }}>{t.team}</strong>
              <div style={{ 
                fontSize: "1.5rem", 
                color: "#34d399",
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
                  <li key={p} style={{
                    padding: "8px 0",
                    borderBottom: idx < t.squad.length - 1 ? "1px solid rgba(100, 116, 139, 0.2)" : "none",
                    color: "#e2e8f0"
                  }}>✓ {p}</li>
                ))
              )}
            </ul>
          </Card>
        ))}
      </div>
    </Page>
  );
}

/* UI COMPONENTS */

function Page({ title, children }) {
  return (
    <div style={{ 
      minHeight: "100vh",
      padding: "30px 20px", 
      background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)", 
      color: "white",
      fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
    }}>
      <h1 style={{
        fontSize: "2.5rem",
        marginBottom: "30px",
        textAlign: "center",
        background: "linear-gradient(to right, #3b82f6, #8b5cf6)",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        textShadow: "0 0 30px rgba(59, 130, 246, 0.3)"
      }}>{title}</h1>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        {children}
      </div>
    </div>
  );
}

function Card({ children, highlight }) {
  return (
    <div
      style={{
        padding: 25,
        margin: "15px 0",
        borderRadius: 16,
        background: highlight 
          ? "linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)" 
          : "rgba(30, 41, 59, 0.8)",
        backdropFilter: "blur(10px)",
        border: highlight ? "2px solid #60a5fa" : "1px solid rgba(100, 116, 139, 0.3)",
        boxShadow: highlight 
          ? "0 10px 40px rgba(59, 130, 246, 0.3)" 
          : "0 4px 20px rgba(0, 0, 0, 0.3)",
        transition: "all 0.3s ease",
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
        border: "2px solid rgba(100, 116, 139, 0.3)",
        background: "rgba(30, 41, 59, 0.5)",
        color: "white",
        fontSize: "16px",
        outline: "none",
        transition: "all 0.3s ease",
        boxSizing: "border-box"
      }}
      onFocus={(e) => e.target.style.borderColor = "#3b82f6"}
      onBlur={(e) => e.target.style.borderColor = "rgba(100, 116, 139, 0.3)"}
    />
  );
}

function PrimaryButton({ children, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "14px 28px",
        margin: "8px 5px",
        background: "linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)",
        color: "white",
        border: "none",
        borderRadius: 10,
        cursor: "pointer",
        fontSize: "15px",
        fontWeight: "600",
        boxShadow: "0 4px 15px rgba(37, 99, 235, 0.4)",
        transition: "all 0.3s ease",
        textTransform: "uppercase",
        letterSpacing: "0.5px"
      }}
      onMouseEnter={(e) => {
        e.target.style.transform = "translateY(-2px)";
        e.target.style.boxShadow = "0 6px 20px rgba(37, 99, 235, 0.6)";
      }}
      onMouseLeave={(e) => {
        e.target.style.transform = "translateY(0)";
        e.target.style.boxShadow = "0 4px 15px rgba(37, 99, 235, 0.4)";
      }}
    >
      {children}
    </button>
  );
}

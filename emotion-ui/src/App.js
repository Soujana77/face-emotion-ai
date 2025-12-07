import { useEffect, useState } from "react";
import Summary from "./Summary";

const API = "http://127.0.0.1:5000";

export default function App() {
  const [emotion, setEmotion] = useState("Detecting...");
  const [confidence, setConfidence] = useState(0);
  const [sessionId, setSessionId] = useState(null);
  const [viewMode, setViewMode] = useState("live"); // live | summary
  const [loading, setLoading] = useState(false);

  // Realtime emotion polling
  useEffect(() => {
    let stop = false;
    async function poll() {
      while (!stop) {
        if (!sessionId) break;

        try {
          const res = await fetch(`${API}/emotion`);
          const data = await res.json();

          const label = data?.emotion ?? "unknown";
          const conf =
            typeof data?.confidence === "number" ? data.confidence * 100 : 0;

          setEmotion(label);
          setConfidence(conf.toFixed(1));
        } catch {
          setEmotion("backend_offline");
          setConfidence(0);
        }

        await new Promise((r) => setTimeout(r, 800));
      }
    }

    if (sessionId) poll();
    return () => (stop = true);
  }, [sessionId]);

  // 🔘 START SESSION
  async function startSession() {
    setLoading(true);
    try {
      const res = await fetch(`${API}/sessions/start`, { method: "POST" });
      const data = await res.json();
      setSessionId(data.id);
      setViewMode("live");
    } catch {
      alert("Backend offline / API failed");
    }
    setLoading(false);
  }

  // 🛑 STOP SESSION
  async function stopSession() {
    if (!sessionId) return alert("Session not active!");
    await fetch(`${API}/sessions/stop`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: sessionId }),
    });
    alert("Session Stopped ✔");
  }

  return viewMode === "summary" ? (
    <Summary sessionId={sessionId} goHome={() => setViewMode("live")} />
  ) : (
    <div style={styles.page}>
      <h1 style={styles.heading}>Emotion Detection – Live</h1>

      {/* Camera Stream */}
      <div style={styles.videoBox}>
        <img
          src={`${API}/video_feed`}
          alt="Live Camera"
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>

      {/* Live Stats */}
      <div style={styles.card}>
        <h2>Emotion: <b style={{color:"#4dd0ff"}}>{emotion}</b></h2>
        <p style={{ opacity: 0.8 }}>Confidence: {confidence}%</p>
      </div>

      {/* Buttons */}
      <div style={styles.btnRow}>
        <button style={styles.start} onClick={startSession} disabled={loading}>
          ▶ Start Session
        </button>

        <button style={styles.stop} onClick={stopSession}>
          ⏹ Stop Session
        </button>

        <button style={styles.summary} onClick={() => setViewMode("summary")}>
          📊 View Summary
        </button>
      </div>

      <p style={{ opacity: 0.5 }}>Session ID: {sessionId || "None"}</p>
    </div>
  );
}

// ======= CSS in JS =======
const styles = {
  page: {
    background: "#0d1117",
    color: "#fff",
    minHeight: "100vh",
    textAlign: "center",
    paddingTop: 30,
  },
  heading: { fontSize: "2.8rem", fontWeight: 800, marginBottom: 25 },
  videoBox: {
    width: 640,
    height: 480,
    borderRadius: 14,
    border: "3px solid #ffffff3a",
    margin: "auto",
    overflow: "hidden",
    marginBottom: 20,
  },
  card: {
    background: "#151b2c",
    padding: "14px",
    width: 300,
    margin: "auto",
    borderRadius: 12,
    marginBottom: 20,
    border: "1px solid #4dd0ff22",
  },
  btnRow: { display: "flex", gap: 10, justifyContent: "center" },
  start: { background: "#00c853", padding: "10px 20px", borderRadius: 8 },
  stop: { background: "#ff1744", padding: "10px 20px", borderRadius: 8 },
  summary: { background: "#2979ff", padding: "10px 20px", borderRadius: 8 },
};

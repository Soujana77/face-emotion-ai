import { useEffect, useState, useRef } from "react";

const API = "http://127.0.0.1:5000";

export default function App() {
  const [emotion, setEmotion] = useState("idle");
  const [confidence, setConfidence] = useState(0);
  const [capturing, setCapturing] = useState(false);

  const pollRef = useRef(null);

  // ------------ Emotion Polling Handler ------------
  const startCapture = () => {
    if (capturing) return;
    setCapturing(true);

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API}/emotion`);
        const data = await res.json();

        setEmotion(data?.emotion ?? "unknown");
        setConfidence(Math.max(0, Math.min(100, (data?.confidence ?? 0) * 100)));
      } catch {
        setEmotion("backend_offline");
        setConfidence(0);
      }
    }, 1200);
  };

  const stopCapture = () => {
    setCapturing(false);
    clearInterval(pollRef.current);
    pollRef.current = null;
    setEmotion("stopped");
    setConfidence(0);
  };

  useEffect(() => () => clearInterval(pollRef.current), []);

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>Emotion Monitoring Dashboard</h1>

      {/* Emotion Box */}
      <div style={styles.card}>
        <div style={{ fontSize: "1.9rem" }}>Current Emotion:</div>
        <div style={styles.emotionTxt}>{emotion}</div>

        {/* Confidence Bar */}
        <div style={styles.barBox}>
          <div style={{ ...styles.barFill, width: `${confidence}%` }} />
        </div>
        <p style={{ marginTop: 5, opacity: 0.7 }}>
          Confidence: <b>{confidence.toFixed(1)}%</b>
        </p>
      </div>

      {/* Live Camera Feed */}
      <div style={styles.camBox}>
        <img src={`${API}/video_feed`} alt="Live feed" style={styles.cam} />
      </div>

      {/* Control Buttons */}
      <div style={{ display: "flex", gap: 20 }}>
        <button style={styles.btnStart} onClick={startCapture}>Start</button>
        <button style={styles.btnStop} onClick={stopCapture}>Stop</button>
      </div>

      {/* Future Section: Graph UI */}
      <div style={styles.graphCard}>
        📊 <b>Real-Time Graph</b> will appear here soon!
        <p style={{ opacity: 0.6, marginTop: 4 }}>This is Step C — next upgrade.</p>
      </div>

      <p style={{ marginTop: 15, opacity: 0.4 }}>* Make sure server.py is running *</p>
    </div>
  );
}

// ---------- STYLES ----------
const styles = {
  page: {
    background: "#0D1321",
    minHeight: "100vh",
    color: "white",
    padding: 40,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 30,
  },
  title: { fontSize: "3rem", fontWeight: 800 },

  card: {
    background: "#151b2c",
    padding: "26px 40px",
    borderRadius: 16,
    border: "2px solid #ffffff22",
    textAlign: "center",
    minWidth: 350,
  },
  emotionTxt: {
    fontSize: "2.2rem",
    color: "#4fd1ff",
    textTransform: "capitalize",
    fontWeight: "bold",
    marginTop: 8,
  },

  // Confidence Bar
  barBox: {
    width: "100%",
    height: 10,
    background: "#333",
    borderRadius: 10,
    marginTop: 15,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    background: "#4fd1ff",
    transition: "0.4s",
  },

  camBox: {
    marginTop: 10,
    border: "4px solid #ffffff33",
    borderRadius: 14,
    overflow: "hidden",
    width: 640,
    height: 480,
    background: "#000000",
  },
  cam: { width: "100%", height: "100%", objectFit: "cover" },

  // Buttons
  btnStart: {
    background: "#00e676",
    padding: "12px 26px",
    borderRadius: 10,
    border: "none",
    fontSize: 18,
    fontWeight: 700,
    cursor: "pointer",
  },
  btnStop: {
    background: "#ff5252",
    padding: "12px 26px",
    borderRadius: 10,
    border: "none",
    fontSize: 18,
    fontWeight: 700,
    cursor: "pointer",
  },

  graphCard: {
    background: "#1b1f30",
    marginTop: 15,
    padding: 25,
    borderRadius: 14,
    border: "1px dashed #ffffff33",
    width: 640,
    textAlign: "center",
  },
};

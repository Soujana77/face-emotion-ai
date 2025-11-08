import { useEffect, useState } from "react";

const API = "http://127.0.0.1:5000";

export default function App() {
  const [emotion, setEmotion] = useState("Detecting...");
  const [confidence, setConfidence] = useState(0);

  // Poll backend every 1.2s for emotion
  useEffect(() => {
    let stop = false;

    async function poll() {
      while (!stop) {
        try {
          const res = await fetch(`${API}/emotion`, { cache: "no-store" });
          const data = await res.json();

          const label = data?.emotion ?? "unknown";
          const confNum =
            typeof data?.confidence === "number" && !Number.isNaN(data.confidence)
              ? data.confidence
              : 0;

          setEmotion(label);
          setConfidence(Math.max(0, Math.min(100, confNum * 100)));
        } catch {
          setEmotion("backend_offline");
          setConfidence(0);
        }
        await new Promise((r) => setTimeout(r, 1200));
      }
    }

    poll();
    return () => {
      stop = true;
    };
  }, []);

  return (
    <div
      style={{
        background: "#0D1321",
        minHeight: "100vh",
        color: "white",
        padding: "40px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "28px",
      }}
    >
      <h1 style={{ fontSize: "3rem", fontWeight: "800", marginTop: "8px" }}>
        Emotion Detection
      </h1>

      <div
        style={{
          background: "#151b2c",
          padding: "24px 36px",
          borderRadius: "16px",
          border: "2px solid #ffffff22",
          textAlign: "center",
          minWidth: 320,
        }}
      >
        <div style={{ fontSize: "1.8rem" }}>
          Emotion:{" "}
          <b style={{ color: "#4fd1ff", textTransform: "lowercase" }}>
            {emotion}
          </b>
        </div>
        <div style={{ marginTop: 10, opacity: 0.85, fontSize: "1.1rem" }}>
          Confidence: {confidence.toFixed(1)}%
        </div>
      </div>

      {/* Live camera stream from Flask (MJPEG) */}
      <div
        style={{
          marginTop: "6px",
          border: "4px solid #ffffff33",
          borderRadius: "14px",
          overflow: "hidden",
          width: 640,
          height: 480,
          background: "#0b0f1d",
        }}
      >
        <img
          src={`${API}/video_feed`}
          alt="Live camera"
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>

      <div style={{ marginTop: 8, opacity: 0.6 }}>
        *Make sure <b>server.py</b> is running*
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";

const API = "http://127.0.0.1:5000";

export default function App() {
  const [emotion, setEmotion] = useState("Detecting...");
  const [confidence, setConfidence] = useState(0);
  const [sessionId, setSessionId] = useState(null);
  const [summary, setSummary] = useState(null);

  // ---- LIVE POLLING (unchanged & safe) ----
  useEffect(() => {
    let stop = false;
    async function poll() {
      while (!stop) {
        try {
          const res = await fetch(`${API}/emotion`);
          const data = await res.json();
          const label = data?.emotion ?? "unknown";
          const conf = data?.confidence ?? 0;

          setEmotion(label);
          setConfidence((conf * 100).toFixed(1));
        } catch {
          setEmotion("backend_offline");
          setConfidence(0);
        }
        await new Promise(r => setTimeout(r, 1200));
      }
    }
    poll();
    return () => { stop = true; };
  }, []);

  // ---- START SESSION ----
  async function startSession() {
    const res = await fetch(`${API}/sessions/start`, { method: "POST" });
    const data = await res.json();
    setSessionId(data.id);
    setSummary(null);
    alert("Session recording started!");
  }

  // ---- STOP SESSION ----
  async function stopSession() {
    if (!sessionId) return alert("Start a session first!");

    await fetch(`${API}/sessions/stop`, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ id: sessionId })
    });

    alert("Session stopped & data saved.");
  }

  // ---- FETCH SUMMARY ----
  async function fetchSummary() {
    if (!sessionId) return alert("No session ID found!");

    const res = await fetch(`${API}/sessions/${sessionId}/summary`);
    const data = await res.json();
    setSummary(data);
  }

  return (
    <div style={{
      background:"#0D1321", color:"white", minHeight:"100vh",
      padding:"40px", textAlign:"center"
    }}>

      <h1 style={{fontSize:"2.8rem", fontWeight:"800"}}>Emotion Detection</h1>

      {/* Emotion UI */}
      <div style={{
        background:"#151b2c", width:350, margin:"auto",
        padding:"20px", borderRadius:"12px", border:"1px solid #444"
      }}>
        <h2>Emotion: <span style={{color:"#4fd1ff"}}>{emotion}</span></h2>
        <p>Confidence: {confidence}%</p>
      </div>

      {/* Camera Stream */}
      <div style={{
        width:640, height:480, border:"3px solid #fff3",
        margin:"30px auto", borderRadius:"10px", overflow:"hidden"
      }}>
        <img src={`${API}/video_feed`} style={{width:"100%", height:"100%"}} />
      </div>

      {/* BUTTONS */}
      <div style={{marginTop:20}}>
        <button onClick={startSession} style={btn}>Start Session</button>
        <button onClick={stopSession} style={btn}>Stop Session</button>
        <button onClick={fetchSummary} style={btn}>View Summary</button>
      </div>

      {/* SUMMARY BOX */}
      {summary && (
        <div style={{
          background:"#151b2c", marginTop:20, padding:15,
          width:450, marginLeft:"auto", marginRight:"auto",
          borderRadius:10
        }}>
          <h3>📊 Session Summary</h3>
          <p>Total Samples: {summary.total_samples}</p>
          <p>Top Emotion: {summary.top_emotion}</p>
          <pre style={{textAlign:"left", fontSize:"14px", whiteSpace:"pre-wrap"}}>
            {JSON.stringify(summary.percentages, null, 2)}
          </pre>
        </div>
      )}

    </div>
  );
}

const btn = {
  background:"#4fd1ff", padding:"10px 18px", margin:"8px",
  border:"none", borderRadius:"6px", color:"#000", fontWeight:"700",
  cursor:"pointer"
};

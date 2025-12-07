import { useState, useEffect } from "react";
import { Bar } from "react-chartjs-2";
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from "chart.js";
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const API = "http://127.0.0.1:5000";

export default function Summary({ sessionId, goHome }) {
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    async function load() {
      const res = await fetch(`${API}/sessions/${sessionId}/summary`);
      const data = await res.json();
      setSummary(data);
    }
    load();
  }, []);

  if (!summary) return <center><h2>Loading Summary...</h2></center>;

  const labels = Object.keys(summary.counts);
  const values = Object.values(summary.counts);

  return (
    <div style={{ textAlign:"center", background:"#0d1117", color:"#fff", minHeight:"100vh", paddingTop:40 }}>
      <h1>📊 Session Summary</h1>

      <div style={{ width:600, margin:"auto", marginTop:40 }}>
        <Bar
          data={{
            labels,
            datasets: [
              {
                label: "Emotion Frequency",
                data: values,
                backgroundColor: [ "#ff5252", "#ffca28", "#4dd0e1", "#9575cd", "#66bb6a", "#ef5350" ]
              }
            ]
          }}
        />
      </div>

      <button style={{ marginTop:50, padding:"10px 28px", background:"#2979ff", borderRadius:8 }}
        onClick={goHome}>
        🔙 Back to Live
      </button>
    </div>
  );
}

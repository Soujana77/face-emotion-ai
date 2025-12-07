import { useEffect, useState } from "react";

const API = "http://127.0.0.1:5000";

//==================== EMOJI RAIN FUNCTION ====================//
function rainEmoji() {
  let i = 40;
  while(i--){
    const e=document.createElement("div");
    e.innerText="😄";
    e.style.position="fixed";
    e.style.fontSize="35px";
    e.style.left=Math.random()*100+"vw";
    e.style.top="-20px";
    e.style.transition="6s linear";
    document.body.appendChild(e);
    setTimeout(()=> e.style.top="100vh",100);
    setTimeout(()=> e.remove(),6000);
  }
}

export default function Summary({ sessionId, goHome }) {
  const [summary,setSummary]=useState(null);

  useEffect(() => {
    async function load() {
      const res = await fetch(`${API}/sessions/${sessionId}/summary`);
      const data = await res.json();
      setSummary(data);

      const top = data?.top_emotion;
      if(top === "happy") rainEmoji(); // 🎉
    }
    load();
  }, []);

  if(!summary) return <h2 style={{color:"white",marginTop:50}}>Loading Summary...</h2>;

  const emotions = summary.percentages || {};

  // COLOR MAP
  const color = {
    angry:"#ff2e2e",
    sad:"#4f6bff",
    happy:"#00e676",
    surprised:"#ffea00",
    neutral:"#9e9e9e",
    disgust:"#b000b5",
    fear:"#ef6c00",
    none:"#666"
  };

  return (
    <div style={page}>
      <h1>📊 Session Summary</h1>

      {/* BAR CHART */}
      <div style={chartBox}>
        {Object.entries(emotions).map(([emo,val])=>(
          <div key={emo} style={{textAlign:"center"}}>
            <div style={{
              height: val*4+"px",
              width:"58px",
              background:color[emo]||"#999",
              borderRadius:6,
              margin:"0 auto"
            }}></div>
            <p style={{marginTop:8,fontSize:14}}>{emo} ({val.toFixed(1)}%)</p>
          </div>
        ))}
      </div>

      <button style={backBtn} onClick={goHome}>⬅ Return to Live</button>
    </div>
  );
}

//==================== STYLE BLOCK ====================//
const page={background:"#0d1117",color:"white",minHeight:"100vh",paddingTop:40,textAlign:"center"};
const chartBox={display:"flex",justifyContent:"center",gap:25,marginTop:35};
const backBtn={
  marginTop:40,padding:"10px 25px",background:"#34b7ff",border:"none",
  fontSize:"1.2rem",borderRadius:10,cursor:"pointer"
};

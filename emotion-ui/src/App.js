import { useState } from "react";

function App() {
  const [started, setStarted] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 flex items-center justify-center p-6">
      <div className="backdrop-blur-xl bg-white/10 border border-white/20 shadow-xl rounded-2xl p-10 max-w-lg w-full text-center">
        <h1 className="text-4xl font-extrabold text-white tracking-wide drop-shadow-sm">
          EmotionSense AI
        </h1>

        <p className="text-white/80 mt-3 text-sm">
          Real-time facial emotion recognition, powered by AI.
        </p>

        {!started && (
          <button
            onClick={() => setStarted(true)}
            className="mt-8 px-6 py-3 bg-white/20 hover:bg-white/30 text-white font-semibold rounded-xl backdrop-blur-md transition-all duration-300"
          >
            Start Camera
          </button>
        )}

        {started && (
          <div className="mt-8">
            <div className="bg-black/30 rounded-xl h-64 flex items-center justify-center text-white/70">
              <p>Webcam feed will appear here...</p>
            </div>
            <button
              onClick={() => setStarted(false)}
              className="mt-6 px-6 py-2 bg-white/20 hover:bg-white/30 text-white font-medium rounded-xl transition-all"
            >
              Stop
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;

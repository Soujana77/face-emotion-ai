from flask import Flask, jsonify, Response
from flask_cors import CORS
import cv2
from fer import FER
import threading
import atexit

app = Flask(__name__)
CORS(app)

# ---------------- Camera & Detector ----------------
_lock = threading.Lock()
_cap = None
_detector = None

def _open_camera():
    """Open webcam with a stable backend; try DSHOW then MSMF."""
    cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)
    if not cap or not cap.isOpened():
        cap = cv2.VideoCapture(0, cv2.CAP_MSMF)
    return cap

def _ensure_ready():
    """Lazy-init camera and detector once."""
    global _cap, _detector
    if _detector is None:
        # mtcnn=False keeps deps light and is faster on CPU
        _detector = FER(mtcnn=False)
    if _cap is None or not _cap.isOpened():
        _cap = _open_camera()

def _read_frame():
    """Thread-safe frame read with one retry + reopen."""
    global _cap
    with _lock:
        _ensure_ready()
        ok, frame = _cap.read()
        if not ok or frame is None:
            # try reopen once
            try:
                if _cap is not None:
                    _cap.release()
            except Exception:
                pass
            _cap = _open_camera()
            ok, frame = _cap.read()
        return ok, frame

# ---------------- Routes ----------------
@app.route("/health")
def health():
    return jsonify({"ok": True})

@app.route("/emotion")
def emotion():
    try:
        ok, frame = _read_frame()
        if not ok or frame is None:
            return jsonify({"ok": True, "emotion": "camera_error", "confidence": 0.0})

        # FER expects RGB
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

        # returns (label, score) or None
        result = _detector.top_emotion(rgb)
        if not result:
            return jsonify({"ok": True, "emotion": "no_face", "confidence": 0.0})

        label, score = result
        # Guard: score can be None sometimes
        conf = float(score) if isinstance(score, (int, float)) else 0.0
        label = label or "unknown"

        return jsonify({"ok": True, "emotion": label, "confidence": conf})

    except Exception as e:
        # Never crash the server; return a safe payload
        return jsonify({"ok": False, "error": str(e), "emotion": "server_error", "confidence": 0.0}), 200

# -------- MJPEG video stream so React can show the camera --------
def _generate_frames():
    while True:
        ok, frame = _read_frame()
        if not ok or frame is None:
            continue
        ret, buffer = cv2.imencode(".jpg", frame)
        if not ret:
            continue
        jpg = buffer.tobytes()
        yield (b"--frame\r\n"
               b"Content-Type: image/jpeg\r\n\r\n" + jpg + b"\r\n")

@app.route("/video_feed")
def video_feed():
    # Stream as multipart/x-mixed-replace (Motion JPEG)
    return Response(_generate_frames(),
                    mimetype="multipart/x-mixed-replace; boundary=frame")

@app.route("/release")
def release():
    """Optional: manually release camera if it gets stuck."""
    global _cap
    with _lock:
        try:
            if _cap is not None:
                _cap.release()
        finally:
            _cap = None
    return jsonify({"ok": True, "released": True})

# Ensure camera is released on exit
def _cleanup():
    global _cap
    try:
        if _cap is not None:
            _cap.release()
    except Exception:
        pass
atexit.register(_cleanup)

# ---------------- Main ----------------
if __name__ == "__main__":
    # debug=True enables hot-reload; if it bothers the camera on your machine,
    # you can set debug=False.
    app.run(debug=True)

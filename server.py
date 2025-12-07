from flask import Flask, jsonify, Response, request, send_file
from flask_cors import CORS
import cv2
from fer.fer import FER
import threading
import atexit
import uuid
import time
import json
import os
import logging
from datetime import datetime

app = Flask(__name__)
CORS(app)
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

# ---------------- Camera & Detector ----------------
_lock = threading.Lock()
_cap = None
_detector = None
_sessions_lock = threading.Lock()
_sessions = {}  # id -> metadata (not full data)
RECORDINGS_DIR = os.path.join(os.path.dirname(__file__), "recordings")
os.makedirs(RECORDINGS_DIR, exist_ok=True)

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


# ---------------- Session recorder ----------------
def _save_report(session_id, meta, data):
    result = {
        "id": session_id,
        "meta": meta,
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "data": data,
    }
    path = os.path.join(RECORDINGS_DIR, f"{session_id}.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    return path


def _recorder_worker(session_id, duration_s, interval_s):
    """Background worker that samples emotion and records timestamped entries."""
    start_ts = time.time()
    data = []
    meta = {"start_ts": start_ts, "duration_requested": duration_s, "interval_s": interval_s}
    logger.info("session %s started: duration=%s interval=%s", session_id, duration_s, interval_s)
    try:
        while True:
            now = time.time()
            elapsed = now - start_ts
            # check stop requested
            with _sessions_lock:
                s = _sessions.get(session_id)
                if not s or s.get("stop_requested"):
                    break
            if duration_s and elapsed >= duration_s:
                break

            ok, frame = _read_frame()
            if ok and frame is not None:
                try:
                    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                    res = _detector.top_emotion(rgb)
                    if res:
                        label, score = res
                        conf = float(score) if isinstance(score, (int, float)) else 0.0
                        label = label or "unknown"
                    else:
                        label, conf = None, 0.0
                except Exception as e:
                    label, conf = None, 0.0
                record = {"ts": datetime.utcnow().isoformat() + "Z", "label": label, "confidence": conf}
                data.append(record)

            # sleep until next sample; keep responsive to stop flag
            for _ in range(max(1, int(interval_s * 10))):
                time.sleep(interval_s / max(1, int(interval_s * 10)))
                with _sessions_lock:
                    s = _sessions.get(session_id)
                    if not s or s.get("stop_requested"):
                        break
    finally:
        # finalize
        meta["end_ts"] = time.time()
        meta["samples"] = len(data)
        path = _save_report(session_id, meta, data)
        logger.info("session %s finished: samples=%s report=%s", session_id, meta["samples"], path)
        with _sessions_lock:
            if session_id in _sessions:
                _sessions[session_id]["status"] = "stopped"
                _sessions[session_id]["report_path"] = path



# ---------------- Routes ----------------
@app.route("/health")
def health():
    return jsonify({"ok": True})


# ---- Session APIs ----
@app.route("/sessions/start", methods=["POST"])
def sessions_start():
    body = request.get_json(silent=True) or {}
    duration = float(body.get("duration", 600))  # seconds; default 10 minutes
    interval = float(body.get("interval", 1.0))  # sampling interval seconds
    sid = uuid.uuid4().hex
    meta = {"id": sid, "created_at": datetime.utcnow().isoformat() + "Z", "status": "running", "duration": duration, "interval": interval}
    with _sessions_lock:
        _sessions[sid] = {**meta, "stop_requested": False}
    t = threading.Thread(target=_recorder_worker, args=(sid, duration, interval), daemon=True)
    t.start()
    return jsonify({"ok": True, "id": sid, "meta": meta}), 201


@app.route("/sessions/stop", methods=["POST"])
def sessions_stop():
    body = request.get_json(silent=True) or {}
    sid = body.get("id")
    if not sid:
        return jsonify({"ok": False, "error": "missing id"}), 400
    with _sessions_lock:
        s = _sessions.get(sid)
        if not s:
            return jsonify({"ok": False, "error": "unknown id"}), 404
        s["stop_requested"] = True
    return jsonify({"ok": True, "id": sid}), 200


@app.route("/sessions", methods=["GET"])
def sessions_list():
    with _sessions_lock:
        items = [{k: v for k, v in s.items() if k != "stop_requested"} for s in _sessions.values()]
    return jsonify({"ok": True, "sessions": items})


@app.route("/sessions/<sid>/report", methods=["GET"])
def sessions_report(sid):
    path = os.path.join(RECORDINGS_DIR, f"{sid}.json")
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return jsonify(json.load(f))
    # if running, return partial data if available
    with _sessions_lock:
        s = _sessions.get(sid)
        if s and s.get("status") == "running":
            return jsonify({"ok": True, "meta": s})
    return jsonify({"ok": False, "error": "not found"}), 404


@app.route("/sessions/<sid>/summary", methods=["GET"])
def sessions_summary(sid):
    """Return a summarized report for a session: counts, percentages, top emotion, and per-minute buckets."""
    path = os.path.join(RECORDINGS_DIR, f"{sid}.json")
    if not os.path.exists(path):
        return jsonify({"ok": False, "error": "not found"}), 404

    with open(path, "r", encoding="utf-8") as f:
        report = json.load(f)

    data = report.get("data", [])
    total = len(data)
    counts = {}
    # collect timestamps as epoch seconds for bucketing
    times = []
    for r in data:
        label = r.get("label") or "none"
        counts[label] = counts.get(label, 0) + 1
        try:
            ts = datetime.fromisoformat(r.get("ts".replace("Z", "")))
        except Exception:
            ts = None
        if ts:
            times.append(ts.timestamp())

    percentages = {k: (v / total * 100.0) if total else 0.0 for k, v in counts.items()}
    top = None
    if counts:
        top = max(counts.items(), key=lambda x: x[1])[0]

    # per-minute buckets relative to start
    timeline = []
    if times:
        start = min(times)
        buckets = {}
        for r in data:
            try:
                ts = datetime.fromisoformat(r.get("ts").replace("Z", ""))
                minute = int((ts.timestamp() - start) // 60)
            except Exception:
                minute = 0
            label = r.get("label") or "none"
            buckets.setdefault(minute, {})
            buckets[minute][label] = buckets[minute].get(label, 0) + 1
        # convert to list sorted by minute
        for minute in sorted(buckets.keys()):
            timeline.append({"minute": minute, "counts": buckets[minute]})

    summary = {
        "ok": True,
        "id": sid,
        "total_samples": total,
        "counts": counts,
        "percentages": percentages,
        "top_emotion": top,
        "timeline": timeline,
    }
    return jsonify(summary)


@app.route("/sessions/<sid>/download", methods=["GET"])
def sessions_download(sid):
    path = os.path.join(RECORDINGS_DIR, f"{sid}.json")
    if os.path.exists(path):
        return send_file(path, as_attachment=True)
    return jsonify({"ok": False, "error": "not found"}), 404

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
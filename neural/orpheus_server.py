"""Optional neural Hmong backend: Orpheus-Hmong (GGUF served by Ollama) + SNAC decoder -> WAV over HTTP.

Setup (once):
  ollama pull hf.co/mradermacher/Orpheus-TTS-hmong-3b-GGUF:Q4_K_M
  python -m venv venv && venv/bin/pip install torch snac numpy soundfile requests   (CPU torch is fine)
Run:   python neural/orpheus_server.py        (listens on 127.0.0.1:8765; override with ORPHEUS_PORT)
The Node server proxies /api/tts/neural to it; if it is not running the app falls back to recorded-word playback.
CPU-only: roughly 10-15x slower than real time. Use a GPU build of Ollama for interactive use.
"""
import io, json, os, re, threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import numpy as np, requests, soundfile as sf, torch
from snac import SNAC

MODEL = os.environ.get("ORPHEUS_MODEL", "hf.co/mradermacher/Orpheus-TTS-hmong-3b-GGUF:Q4_K_M")
OLLAMA = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434")
PORT = int(os.environ.get("ORPHEUS_PORT", "8765"))
MAX_CHARS = 300

snac = SNAC.from_pretrained("hubertsiuzdak/snac_24khz").eval()
lock = threading.Lock()  # one generation at a time


def synthesize(text: str, voice: str = "") -> bytes:
    prompt = "<|begin_of_text|><custom_token_3>" + (f"{voice}: " if voice else "") + text + "<|eot_id|><custom_token_4>"
    r = requests.post(f"{OLLAMA}/api/generate", timeout=1800, json={
        "model": MODEL, "prompt": prompt, "raw": True, "stream": False,
        "options": {"temperature": 0.6, "top_p": 0.8, "repeat_penalty": 1.1, "num_predict": 2400, "num_ctx": 4096},
    })
    r.raise_for_status()
    codes = []
    for n in (int(m) for m in re.findall(r"<custom_token_(\d+)>", r.json()["response"])):
        c = n - 10 - (len(codes) % 7) * 4096
        if 0 <= c < 4096:
            codes.append(c)
    frames = len(codes) // 7
    if frames == 0:
        raise ValueError("model produced no audio tokens")
    l1, l2, l3 = [], [], []
    for i in range(frames):
        c = codes[7 * i:7 * i + 7]
        l1.append(c[0]); l2 += [c[1], c[4]]; l3 += [c[2], c[3], c[5], c[6]]
    with torch.inference_mode():
        audio = snac.decode([torch.tensor([l1]), torch.tensor([l2]), torch.tensor([l3])])
    buf = io.BytesIO()
    sf.write(buf, audio.squeeze().numpy().astype(np.float32), 24000, format="WAV", subtype="PCM_16")
    return buf.getvalue()


class Handler(BaseHTTPRequestHandler):
    def _send(self, code, body, ctype="application/json"):
        self.send_response(code); self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body))); self.end_headers(); self.wfile.write(body)

    def do_GET(self):
        if self.path == "/health":
            self._send(200, b'{"status":"ok"}')
        else:
            self._send(404, b"{}")

    def do_POST(self):
        if self.path != "/synthesize":
            return self._send(404, b"{}")
        try:
            body = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))))
            text = str(body.get("text", "")).strip()
            if not text or len(text) > MAX_CHARS:
                return self._send(400, b'{"error":"text must be 1-300 characters"}')
            with lock:
                wav = synthesize(text, str(body.get("voice", "")))
            self._send(200, wav, "audio/wav")
        except Exception as e:  # reported to the Node proxy, which hides details from the browser
            self._send(500, json.dumps({"error": str(e)}).encode())

    def log_message(self, *a):
        pass


if __name__ == "__main__":
    print(f"Orpheus-Hmong server on 127.0.0.1:{PORT} (model {MODEL})")
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()

# Hmong-TTS

Hmong (White Hmong / Mong Leng) text-to-speech studio: React + Vite front end, Express API, PWA.
Speech is stitched from native-speaker word recordings, with a formant-synth fallback for missing words.

```bash
bun install            # or npm install
cp .env.example .env   # GEMINI_API_KEY only needed for transcription
bun run dev            # http://localhost:3000 (PORT overrides)
```

Scripts: `dev`/`start` (server), `build` (Vite), `lint` (tsc --noEmit).

## Optional: neural Hmong voice (Orpheus-Hmong)

Pick "Neural Hmong (Orpheus, experimental)" in the voice source list. It needs a local sidecar; without it the app silently falls back to recorded words.

```bash
ollama pull hf.co/mradermacher/Orpheus-TTS-hmong-3b-GGUF:Q4_K_M
python -m venv venv && venv/bin/pip install torch snac numpy soundfile requests
venv/bin/python neural/orpheus_server.py     # 127.0.0.1:8765 (ORPHEUS_PORT, ORPHEUS_URL to change)
```

Model: [Pakorn2112/Orpheus-TTS-hmong-3b](https://huggingface.co/Pakorn2112/Orpheus-TTS-hmong-3b) (Apache-2.0; the card limits it to research/educational use and says commercial use may need dataset rights). CPU-only generation is roughly 10-15x slower than real time. Word highlighting is estimated, and the speed/pitch sliders do not apply to this voice.

## Optional: NouAI cloud voice

[nouai.app](https://nouai.app) offers a paid Hmong TTS REST API (`POST /api/v1/tts/speak`, flat 30 credits per call, 60 req/min; its terms grant commercial rights to generated audio). Pick "NouAI Cloud Voice" in the voice-source list after adding to `.env`:

```
NOUAI_API_KEY=nk_...        # from nouai.app/developers; stays on the server
NOUAI_VOICE=                # optional preset name; omit for the default voice
```

The whole text goes in one request (v2 up to 1,500 chars, v1 up to 4,000). Responses are cached under `data/nouai-cache/`, so replaying the same text costs nothing. Your text is sent to NouAI. If the key is missing, credits run out, or the call fails, the app falls back to recorded words. White vs. Green Hmong dialect handling is not documented by NouAI; check by ear.

# Hmong-TTS

Hmong (White Hmong / Mong Leng) text-to-speech studio: React + Vite front end, Express API, PWA.
Speech is stitched from native-speaker word recordings, with a formant-synth fallback for missing words.

```bash
bun install            # or npm install
cp .env.example .env   # GEMINI_API_KEY only needed for transcription
bun run dev            # http://localhost:3000 (PORT overrides)
```

Scripts: `dev`/`start` (server), `build` (Vite), `lint` (tsc --noEmit).

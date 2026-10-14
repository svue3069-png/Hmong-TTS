import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { parseHmongText, HmongDialect } from './src/engine/hmongPhonology.ts';
import { detectLanguage } from './src/engine/languageDetector.ts';

function apiPlugin(): Plugin {
  return {
    name: 'api-routes',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next();

        // GET /api/health
        if (req.url === '/api/health' && req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            status: 'healthy',
            engine: 'HmongTTS Core Engine v2.4.0',
            dialects: ['dawb', 'leeg'],
            offlineEnabled: true,
            timestamp: new Date().toISOString(),
          }));
          return;
        }

        // GET /api/voices
        if (req.url === '/api/voices' && req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            voices: [
              { id: 'paj_dawb_female', name: 'Paj', dialect: 'dawb', language: 'Hmoob Dawb (White Hmong)', gender: 'female', sampleRate: 44100, offlineReady: true },
              { id: 'ntxoov_dawb_male', name: 'Ntxoov', dialect: 'dawb', language: 'Hmoob Dawb (White Hmong)', gender: 'male', sampleRate: 44100, offlineReady: true },
              { id: 'mee_leeg_female', name: 'Mee', dialect: 'leeg', language: 'Moob Leeg (Green/Mong Leng)', gender: 'female', sampleRate: 44100, offlineReady: true },
              { id: 'koob_leeg_male', name: 'Koob', dialect: 'leeg', language: 'Moob Leeg (Green/Mong Leng)', gender: 'male', sampleRate: 44100, offlineReady: true },
              { id: 'kaub_storyteller', name: 'Yawg Kaub', dialect: 'dawb', language: 'Hmoob Dawb (Elder Storyteller)', gender: 'male', sampleRate: 44100, offlineReady: true },
            ],
          }));
          return;
        }

        // POST requests
        if (req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => { body += chunk; });
          req.on('end', () => {
            try {
              const data = body ? JSON.parse(body) : {};

              if (req.url === '/api/tts/detect') {
                const result = detectLanguage(data.text || '');
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({
                  language: result.language,
                  confidence: result.confidence,
                  detectedDialect: result.detectedDialect,
                  hmongScore: result.hmongScore,
                  englishScore: result.englishScore,
                  details: result.details,
                  recommendedEngine: result.language === 'english' ? 'web_speech' : 'hmong_dsp',
                  tokens: result.tokens,
                }));
                return;
              }

              if (req.url === '/api/tts/phonemize') {
                const syllables = parseHmongText(data.text || '', (data.dialect || 'dawb') as HmongDialect);
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({
                  dialect: data.dialect || 'dawb',
                  syllablesCount: syllables.filter(s => !s.isPunctuation).length,
                  alignment: syllables.map((s, index) => ({
                    index,
                    raw: s.raw,
                    clean: s.clean,
                    onset: s.onset,
                    vowel: s.vowel,
                    tone: s.toneLetter || 'none',
                    toneName: s.tone.name,
                    chaoNumber: s.tone.chaoNumber,
                    ipa: s.ipa,
                    durationMs: s.durationMs,
                    isPunctuation: s.isPunctuation,
                  })),
                }));
                return;
              }

              if (req.url === '/api/tts/synthesize') {
                const syllables = parseHmongText(data.text || '', (data.dialect || 'dawb') as HmongDialect);
                const sampleRate = 44100;
                const baseF0 = (data.voiceId?.includes('male') || data.voiceId?.includes('kaub')) ? 135 : 225;
                const validSyllables = syllables.filter(s => !s.isPunctuation);
                const durPerSyl = Math.floor((sampleRate * 0.22) / (data.rate || 1.0));
                const totalSamples = 2000 + validSyllables.length * durPerSyl + 4000;
                const buffer = Buffer.alloc(44 + totalSamples * 2);

                buffer.write('RIFF', 0);
                buffer.writeUInt32LE(36 + totalSamples * 2, 4);
                buffer.write('WAVE', 8);
                buffer.write('fmt ', 12);
                buffer.writeUInt32LE(16, 16);
                buffer.writeUInt16LE(1, 20);
                buffer.writeUInt16LE(1, 22);
                buffer.writeUInt32LE(sampleRate, 24);
                buffer.writeUInt32LE(sampleRate * 2, 28);
                buffer.writeUInt16LE(2, 32);
                buffer.writeUInt16LE(16, 34);
                buffer.write('data', 36);
                buffer.writeUInt32LE(totalSamples * 2, 40);

                let sampleOffset = 44;
                let phase = 0;
                for (const syl of validSyllables) {
                  const contour = syl.pitchTrajectory;
                  for (let i = 0; i < durPerSyl; i++) {
                    if (sampleOffset >= buffer.length - 2) break;
                    const progress = i / durPerSyl;
                    const cIdx = progress * (contour.length - 1);
                    const cLower = Math.floor(cIdx);
                    const cUpper = Math.min(cLower + 1, contour.length - 1);
                    const cFrac = cIdx - cLower;
                    const toneFactor = 1.0 + ((contour[cLower] * (1 - cFrac) + contour[cUpper] * cFrac) - 0.5) * 0.7;
                    const curF0 = baseF0 * toneFactor * (data.pitch || 1.0);
                    phase += curF0 / sampleRate;
                    if (phase >= 1.0) phase -= 1.0;
                    let val = Math.sin(phase * 2 * Math.PI) * 0.5 + Math.sin(phase * 4 * Math.PI) * 0.25;
                    val *= Math.sin(progress * Math.PI);
                    const pcm16 = Math.floor(Math.max(-1, Math.min(1, val)) * 32767);
                    buffer.writeInt16LE(pcm16, sampleOffset);
                    sampleOffset += 2;
                  }
                }

                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({
                  status: 'success',
                  dialect: data.dialect || 'dawb',
                  voiceId: data.voiceId || 'paj_dawb_female',
                  format: data.format || 'wav',
                  sampleRate,
                  audioBase64: buffer.toString('base64'),
                  totalDurationMs: Math.round((totalSamples / sampleRate) * 1000),
                  alignment: syllables.map((s, index) => ({
                    index,
                    token: s.clean,
                    tone: s.toneLetter || 'mid',
                    chao: s.tone.chaoNumber,
                    ipa: s.ipa,
                  })),
                }));
                return;
              }

              next();
            } catch (err: any) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      apiPlugin(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icon.svg'],
        manifest: {
          id: '/',
          name: 'HmongTTS - Mobile Voice Synthesis',
          short_name: 'HmongTTS',
          description: 'High-quality Hmong text-to-speech synthesis supporting White and Green Hmong dialects with offline mode.',
          theme_color: '#060b14',
          background_color: '#060b14',
          display: 'standalone',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/icon.svg',
              sizes: '192x192 512x512',
              type: 'image/svg+xml',
              purpose: 'any',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
          maximumFileSizeToCacheInBytes: 4 * 1024 * 1024, // kokoro-js chunk is ~2.2 MB
        },
        devOptions: {
          enabled: false,
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve('.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

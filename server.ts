/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * HmongTTS Unified Server & API Service
 * Express server providing developer endpoints & mounting Vite in development.
 */

import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { parseHmongText, HmongDialect, HMONG_TONES, HMONG_VOWELS, DIALECT_MAPPINGS } from './src/engine/hmongPhonology.ts';
import { detectLanguage } from './src/engine/languageDetector.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const isDev = process.env.NODE_ENV !== 'production';

app.use(express.json({ limit: '50mb' }));

const ai = new GoogleGenAI();

// Health check endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    engine: 'HmongTTS Core Engine v2.4.0',
    dialects: ['dawb', 'leeg'],
    offlineEnabled: true,
    timestamp: new Date().toISOString(),
  });
});

// Voice catalogue endpoint
app.get('/api/voices', (_req: Request, res: Response) => {
  res.json({
    voices: [
      {
        id: 'paj_dawb_female',
        name: 'Paj',
        dialect: 'dawb',
        language: 'Hmoob Dawb (White Hmong)',
        gender: 'female',
        sampleRate: 44100,
        offlineReady: true,
      },
      {
        id: 'ntxoov_dawb_male',
        name: 'Ntxoov',
        dialect: 'dawb',
        language: 'Hmoob Dawb (White Hmong)',
        gender: 'male',
        sampleRate: 44100,
        offlineReady: true,
      },
      {
        id: 'mee_leeg_female',
        name: 'Mee',
        dialect: 'leeg',
        language: 'Moob Leeg (Green/Mong Leng)',
        gender: 'female',
        sampleRate: 44100,
        offlineReady: true,
      },
      {
        id: 'koob_leeg_male',
        name: 'Koob',
        dialect: 'leeg',
        language: 'Moob Leeg (Green/Mong Leng)',
        gender: 'male',
        sampleRate: 44100,
        offlineReady: true,
      },
      {
        id: 'kaub_storyteller',
        name: 'Yawg Kaub',
        dialect: 'dawb',
        language: 'Hmoob Dawb (Elder Storyteller)',
        gender: 'male',
        sampleRate: 44100,
        offlineReady: true,
      },
    ],
  });
});

// Cache for native Hmong spoken audio MP3s from HmongDictionary.com
const nativeAudioCache = new Map<string, Buffer>();
const inFlightAudioRequests = new Map<string, Promise<Buffer | null>>();

function getHmongCharCodes(str: string): string {
  const upper = str.toUpperCase();
  let codes = '';
  for (let i = 0; i < upper.length; i++) {
    codes += upper.charCodeAt(i).toString();
  }
  return codes;
}

async function fetchNativeAudioBuffer(cleanWord: string, retries = 1): Promise<Buffer | null> {
  const key = cleanWord.toLowerCase().trim();
  if (!key) return null;

  if (nativeAudioCache.has(key)) {
    return nativeAudioCache.get(key)!;
  }

  // De-duplicate parallel in-flight requests for the exact same word
  if (inFlightAudioRequests.has(key)) {
    return inFlightAudioRequests.get(key)!;
  }

  const fetchPromise = (async (): Promise<Buffer | null> => {
    const charCodes = getHmongCharCodes(key);
    if (!charCodes) return null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      let timeoutId: NodeJS.Timeout | null = null;
      try {
        const url = `https://www.hmongdictionary.com/suab/${charCodes}`;
        const controller = new AbortController();
        timeoutId = setTimeout(() => controller.abort(), 10000);

        const resp = await fetch(url, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'audio/mpeg, audio/*;q=0.9, */*;q=0.8',
            'Referer': 'https://www.hmongdictionary.com/mobile/',
          },
        });

        if (resp.ok) {
          const arrayBuf = await resp.arrayBuffer();
          // Ensure valid audio buffer
          if (arrayBuf.byteLength > 100) {
            const buffer = Buffer.from(arrayBuf);
            nativeAudioCache.set(key, buffer);
            return buffer;
          }
        }
      } catch (err: any) {
        // If aborted or transient error and retries left, wait briefly and retry
        if (attempt < retries) {
          await new Promise((resolve) => setTimeout(resolve, 250));
          continue;
        }
        // Graceful fallback to acoustic synthesis without throwing unhandled exceptions
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }
    }

    return null;
  })();

  inFlightAudioRequests.set(key, fetchPromise);
  try {
    return await fetchPromise;
  } finally {
    inFlightAudioRequests.delete(key);
  }
}

// Background pre-warming of most essential Hmong words to make playback instantaneous
const COMMON_PREWARM_WORDS = [
  'nyob', 'zoo', 'sawv', 'daws', 'kuv', 'koj', 'peb', 'nej', 'siab', 'heev',
  'tau', 'ntsib', 'hnub', 'no', 'ua', 'tsaug', 'yog', 'mas', 'ces', 'mus',
  'tuaj', 'los', 'rau', 'cov', 'tus', 'lub', 'yam', 'txog', 'ntawm', 'suav',
  'lawv', 'txaus', 'li', 'os', 'thov', 'nrog', 'txoj', 'kev', 'pab', 'zoo',
  // Moob Leeg (Green Hmong) high-frequency equivalents
  'moog', 'lug', 'nub', 'nua', 'mej', 'paab', 'rua', 'txuj', 'hab', 'dleev', 'dlaag'
];

async function prewarmCommonAudio() {
  for (const word of COMMON_PREWARM_WORDS) {
    if (!nativeAudioCache.has(word)) {
      try {
        await fetchNativeAudioBuffer(word, 0);
      } catch {
        // ignore background pre-warm failures
      }
    }
  }
}

// Pre-warm non-blockingly
setTimeout(() => {
  prewarmCommonAudio().catch(() => {});
}, 1000);

// Native Hmong Audio Proxy: Stream single word MP3
app.get('/api/audio/hmong-word/:word', async (req: Request, res: Response) => {
  try {
    const rawWord = req.params.word || '';
    const cleanWord = rawWord.replace(/[^a-zA-Z0-9]/g, '').trim();
    if (!cleanWord) {
      return res.status(400).json({ error: 'Invalid word parameter' });
    }

    const buffer = await fetchNativeAudioBuffer(cleanWord);
    if (!buffer) {
      return res.status(404).json({ error: 'Audio not found in native Hmong dictionary', word: cleanWord });
    }

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    res.setHeader('Content-Length', buffer.length.toString());
    return res.send(buffer);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Native Hmong Audio Batch Endpoint: Retrieve multiple word recordings with pool throttling
app.post('/api/audio/hmong-batch', async (req: Request, res: Response) => {
  try {
    const { words } = req.body;
    if (!Array.isArray(words) || words.length === 0) {
      return res.status(400).json({ error: 'Field "words" must be a non-empty array' });
    }

    // Limit batch size to 100 words per call
    const uniqueWords = Array.from(new Set(
      words.map(w => (typeof w === 'string' ? w.replace(/[^a-zA-Z0-9]/g, '').trim().toLowerCase() : '')).filter(Boolean)
    )).slice(0, 100);

    const results: Record<string, { found: boolean; audioBase64?: string; byteLength?: number; source?: string }> = {};

    // Process in controlled concurrency chunks of 5 words to prevent connection saturation
    const CHUNK_SIZE = 5;
    for (let i = 0; i < uniqueWords.length; i += CHUNK_SIZE) {
      const chunk = uniqueWords.slice(i, i + CHUNK_SIZE);
      await Promise.all(
        chunk.map(async (word) => {
          const buf = await fetchNativeAudioBuffer(word);
          if (buf) {
            results[word] = {
              found: true,
              audioBase64: buf.toString('base64'),
              byteLength: buf.length,
              source: 'HmongDictionary.com (Native Recorded Audio)',
            };
          } else {
            results[word] = {
              found: false,
            };
          }
        })
      );
    }

    return res.json({
      status: 'success',
      totalRequested: uniqueWords.length,
      foundCount: Object.values(results).filter(r => r.found).length,
      cachedTotal: nativeAudioCache.size,
      results,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Native Audio Status Endpoint
app.get('/api/audio/status', (_req: Request, res: Response) => {
  res.json({
    engine: 'Hmong Native Speech Service',
    provider: 'HmongDictionary.com Native Voice Repository & Hmong Voice Agent',
    format: 'MPEG Layer-3 44.1kHz Monaural Native Human Speech',
    cachedWordCount: nativeAudioCache.size,
    status: 'online',
  });
});

// Phonemize & linguistic tone analysis endpoint
app.post('/api/tts/phonemize', (req: Request, res: Response) => {
  try {
    const { text, dialect = 'dawb' } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Field "text" is required' });
    }

    const syllables = parseHmongText(text, dialect as HmongDialect);
    return res.json({
      dialect,
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
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Full Timing and Phonetic IPA & Tone Alignment Metadata Export endpoint
app.post('/api/tts/metadata', (req: Request, res: Response) => {
  try {
    const { text, dialect = 'dawb', voiceId = 'paj_dawb_female', rate = 1.0, pitch = 1.0, toneEmphasis = 1.1, prosody = 1.1 } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Field "text" is required' });
    }

    const syllables = parseHmongText(text, dialect as HmongDialect);
    const sampleRate = 44100;
    let runningTime = 0.05;
    let sampleOffset = Math.floor(sampleRate * 0.05);

    const alignment = syllables.map((s, index) => {
      const durationSec = s.isPunctuation ? 0.20 : (s.durationMs / 1000) / rate;
      const startSec = runningTime;
      const endSec = runningTime + durationSec;
      const startSample = sampleOffset;
      const lengthSamples = Math.floor(sampleRate * durationSec);
      const endSample = startSample + lengthSamples;

      runningTime += durationSec + (s.isPunctuation ? 0.08 : 0.018);
      sampleOffset += lengthSamples + Math.floor(sampleRate * (s.isPunctuation ? 0.08 : 0.018));

      return {
        index,
        token: s.raw,
        clean: s.clean,
        isPunctuation: s.isPunctuation,
        timeStartSec: parseFloat(startSec.toFixed(4)),
        timeEndSec: parseFloat(endSec.toFixed(4)),
        durationMs: Math.round(durationSec * 1000),
        sampleStart: startSample,
        sampleEnd: endSample,
        phonetics: {
          onset: s.onset,
          onsetIpa: s.onset ? `[${s.onset}]` : '∅',
          vowel: s.vowel,
          vowelIpa: `[${s.vowel}]`,
          toneLetter: s.toneLetter || 'unmarked',
          toneName: s.tone.name,
          chaoNumber: s.tone.chaoNumber,
          toneIpa: s.tone.ipaDiacritic,
          fullIpa: s.ipa,
          isNasal: s.formants.isNasal,
          isDiphthong: s.formants.isDiphthong,
        },
        acoustics: {
          f1StartHz: Math.round(s.formants.f1Start),
          f2StartHz: Math.round(s.formants.f2Start),
          f3StartHz: Math.round(s.formants.f3Start),
          f1EndHz: Math.round(s.formants.f1End),
          f2EndHz: Math.round(s.formants.f2End),
          f3EndHz: Math.round(s.formants.f3End),
          pitchContour: s.pitchTrajectory,
        },
      };
    });

    const totalDurationSec = parseFloat(runningTime.toFixed(4));

    return res.json({
      app: 'HmongTTS Native Speech Studio',
      version: '1.2.0',
      generatedAt: new Date().toISOString(),
      text,
      dialect,
      dialectName: dialect === 'dawb' ? 'Hmoob Dawb (White Hmong)' : 'Moob Leeg (Green Hmong)',
      voice: {
        id: voiceId,
        gender: voiceId.includes('male') ? 'male' : 'female',
      },
      acousticSettings: {
        rate,
        pitch,
        toneEmphasis,
        prosody,
      },
      audioMetrics: {
        totalDurationSec,
        totalDurationMs: Math.round(totalDurationSec * 1000),
        sampleRate,
        channels: 1,
        totalSamples: Math.round(totalDurationSec * sampleRate),
        syllableCount: syllables.filter((s) => !s.isPunctuation).length,
      },
      alignment,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Auto-Detect Language (Hmong vs English vs Mixed) endpoint
app.post('/api/tts/detect', (req: Request, res: Response) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Field "text" is required' });
    }

    const result = detectLanguage(text);
    return res.json({
      language: result.language,
      confidence: result.confidence,
      detectedDialect: result.detectedDialect,
      hmongScore: result.hmongScore,
      englishScore: result.englishScore,
      details: result.details,
      recommendedEngine: result.language === 'english' ? 'web_speech' : 'hmong_dsp',
      tokens: result.tokens,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Server-side synthesis endpoint
app.post('/api/tts/synthesize', (req: Request, res: Response) => {
  try {
    const { text, dialect = 'dawb', voiceId = 'paj_dawb_female', rate = 1.0, pitch = 1.0, format = 'wav' } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Field "text" is required' });
    }

    const syllables = parseHmongText(text, dialect as HmongDialect);

    // Synthesize WAV in memory on Node.js using our pure acoustic DSP pipeline
    const sampleRate = 44100;
    const baseF0 = (voiceId.includes('male') || voiceId.includes('kaub')) ? 135 : 225;
    
    // Estimate samples
    let totalSamples = Math.floor(sampleRate * 0.05);
    const validSyllables = syllables.filter(s => !s.isPunctuation);
    const durPerSyl = Math.floor((sampleRate * 0.22) / rate);
    totalSamples += validSyllables.length * durPerSyl + Math.floor(sampleRate * 0.1);

    const buffer = Buffer.alloc(44 + totalSamples * 2);

    // Write standard RIFF WAV header
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + totalSamples * 2, 4);
    buffer.write('WAVE', 8);
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20); // PCM
    buffer.writeUInt16LE(1, 22); // Mono
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(sampleRate * 2, 28);
    buffer.writeUInt16LE(2, 32);
    buffer.writeUInt16LE(16, 34); // 16-bit
    buffer.write('data', 36);
    buffer.writeUInt32LE(totalSamples * 2, 40);

    // Generate harmonic samples with Hmong tone pitch trajectory
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

        const curF0 = baseF0 * toneFactor * pitch;
        phase += curF0 / sampleRate;
        if (phase >= 1.0) phase -= 1.0;

        // Glottal harmonic wave + vowel envelope
        let val = Math.sin(phase * 2 * Math.PI) * 0.5 + Math.sin(phase * 4 * Math.PI) * 0.25;
        // Window envelope
        const env = Math.sin(progress * Math.PI);
        val *= env;

        const pcm16 = Math.floor(Math.max(-1, Math.min(1, val)) * 32767);
        buffer.writeInt16LE(pcm16, sampleOffset);
        sampleOffset += 2;
      }
    }

    const audioBase64 = buffer.toString('base64');

    return res.json({
      status: 'success',
      dialect,
      voiceId,
      format,
      sampleRate,
      audioBase64,
      totalDurationMs: Math.round((totalSamples / sampleRate) * 1000),
      alignment: syllables.map((s, index) => ({
        index,
        token: s.clean,
        tone: s.toneLetter || 'mid',
        chao: s.tone.chaoNumber,
        ipa: s.ipa,
      })),
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// AI Audio Transcription endpoint (Hmong RPA & English speech-to-text)
app.post('/api/tts/transcribe', async (req: Request, res: Response) => {
  try {
    const { audioData, mimeType = 'audio/webm', dialectHint = 'dawb' } = req.body;

    if (!audioData || typeof audioData !== 'string') {
      return res.status(400).json({ error: 'Field "audioData" (base64 string) is required' });
    }

    const cleanBase64 = audioData.replace(/^data:(audio|video)\/[a-zA-Z0-9.-]+;base64,/, '');

    const dialectContext = dialectHint === 'leeg'
      ? 'Focus on Moob Leeg (Green/Mong Leng) or Hmoob Dawb (White Hmong) vocabulary and RPA spelling.'
      : 'Focus on Hmoob Dawb (White Hmong) or Moob Leeg (Green Hmong) vocabulary and RPA spelling.';

    const promptText = `You are an expert bilingual speech recognition assistant specializing in Hmong RPA (Romanized Popular Alphabet) and English.
Transcribe the speech in this audio clip accurately into text.
Rules:
1. If the speech is Hmong, write the transcription strictly using standard Hmong RPA orthography (incorporating tone markers -b, -m, -d, -j, -v, -s, -g or bare vowel for mid tone). ${dialectContext}
2. If the speech is English, transcribe in standard English spelling.
3. If the audio is code-switched / bilingual (both Hmong and English), transcribe each word in its authentic orthography.
4. Output ONLY the raw transcribed text. Do not output conversational preamble, markdown headers, explanations, or quotes.`;

    let transcript = '';
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-transcribe',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: mimeType || 'audio/webm',
                data: cleanBase64,
              },
            },
            {
              text: promptText,
            },
          ],
        },
      });
      transcript = response.text ? response.text.trim() : '';
    } catch (modelErr: any) {
      console.warn('gemini-3.5-transcribe attempt note, trying gemini-3.8-flash fallback:', modelErr.message);
      const fallbackResponse = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: mimeType || 'audio/webm',
                data: cleanBase64,
              },
            },
            {
              text: promptText,
            },
          ],
        },
      });
      transcript = fallbackResponse.text ? fallbackResponse.text.trim() : '';
    }

    const detection = detectLanguage(transcript);

    return res.json({
      status: 'success',
      transcript,
      detection,
    });
  } catch (err: any) {
    console.error('Transcription error in /api/tts/transcribe:', err);
    return res.status(500).json({
      error: err.message || 'Failed to transcribe audio clip',
    });
  }
});

// Mount Vite or serve static dist
async function startServer() {
  if (isDev) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`HmongTTS Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * HmongTTS Unified Server & API Service
 * Express server providing developer endpoints & mounting Vite in development.
 */

import express, { ErrorRequestHandler, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { parseHmongText, getOnsetIpa, getPunctuationPauseSeconds, HmongDialect, HMONG_VOWELS } from './src/engine/hmongPhonology.ts';
import { detectLanguage } from './src/engine/languageDetector.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const isDev = process.env.NODE_ENV !== 'production';

app.use(express.json({ limit: '15mb' }));

// Minimal per-IP rate limiter (in-memory) for expensive / write endpoints
// ponytail: single-process only; use a shared store if scaled out
// Every rateLimit() call owns its own bucket, so traffic on one route never spends another route's budget
// (a shared bucket would let cheap, frequent routes starve the strict ones such as the 10/min batch route).
const rateLimitBuckets: Array<{ hits: Map<string, number[]>; windowMs: number }> = [];
const rateLimit = (max: number, windowMs = 60_000) => {
  const hits = new Map<string, number[]>();
  rateLimitBuckets.push({ hits, windowMs });
  return (req: Request, res: Response, next: () => void) => {
    const now = Date.now();
    const recent = (hits.get(req.ip || '') || []).filter((t) => now - t < windowMs);
    if (recent.length >= max) return res.status(429).json({ error: 'Too many requests, slow down.' });
    recent.push(now);
    hits.set(req.ip || '', recent);
    next();
  };
};

// Sweep stale rate-limit entries so the maps can't grow without bound
setInterval(() => {
  const now = Date.now();
  for (const { hits, windowMs } of rateLimitBuckets) {
    for (const [ip, times] of hits) {
      if (times.every((t) => now - t >= windowMs)) hits.delete(ip);
    }
  }
}, 300_000).unref();

const MAX_TTS_TEXT_LENGTH = 5_000;

function readTtsText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text.length > 0 && text.length <= MAX_TTS_TEXT_LENGTH ? text : null;
}

function normalizeRate(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(2, Math.max(0.5, value))
    : 1;
}

// Voice gender and base pitch come from the voice id ("paj_dawb_female", "ntxoov_dawb_male", "kaub_storyteller").
// "female" contains "male", so an id is only male when it is not female. The female pitch matches the
// client voice profiles (~225 Hz).
function resolveVoiceProfile(voiceId: string): { gender: 'male' | 'female'; baseF0: number } {
  const id = voiceId.toLowerCase();
  const isMale = !id.includes('female') && (id.includes('male') || id.includes('kaub'));
  return isMale ? { gender: 'male', baseF0: 135 } : { gender: 'female', baseF0: 225 };
}

const TTS_LEAD_IN_SEC = 0.05;
const TTS_TAIL_SEC = 0.1;
const TTS_SYLLABLE_GAP_SEC = 0.018;

type ParsedSyllable = ReturnType<typeof parseHmongText>[number];

interface TimelineSegment {
  syllable: ParsedSyllable;
  /** First sample of the token: its voiced span for a syllable, its silent pause for punctuation. */
  startSample: number;
  /** Voiced samples (always 0 for punctuation). */
  voicedSamples: number;
  /** Trailing silence: the punctuation pause, or the short gap between syllables. */
  gapSamples: number;
}

/**
 * Single source of truth for the server-side timeline. /api/tts/synthesize renders its audio from this plan
 * and /api/tts/metadata reports it, so the reported alignment cannot drift from the rendered audio.
 * Layout: 50 ms lead-in; per token a voiced span (tone-specific duration / rate) followed by either the
 * getPunctuationPauseSeconds() pause (punctuation) or an 18 ms inter-syllable gap; 100 ms tail.
 */
function planTimeline(syllables: ParsedSyllable[], sampleRate: number, rate: number) {
  const interSyllableGapSamples = Math.floor(sampleRate * TTS_SYLLABLE_GAP_SEC);
  let cursor = Math.floor(sampleRate * TTS_LEAD_IN_SEC);
  const segments: TimelineSegment[] = syllables.map((syllable) => {
    const voicedSamples = syllable.isPunctuation
      ? 0
      : Math.floor((sampleRate * (syllable.durationMs / 1000)) / rate);
    const gapSamples = syllable.isPunctuation
      ? Math.floor(sampleRate * getPunctuationPauseSeconds(syllable.raw.trim()))
      : interSyllableGapSamples;
    const segment: TimelineSegment = { syllable, startSample: cursor, voicedSamples, gapSamples };
    cursor += voicedSamples + gapSamples;
    return segment;
  });
  return { segments, totalSamples: cursor + Math.floor(sampleRate * TTS_TAIL_SEC) };
}

// User recordings and successfully fetched HmongDictionary audio are persisted separately.
const CUSTOM_DIR = path.resolve(__dirname, 'data', 'custom-words');
const NATIVE_DIR = path.resolve(__dirname, 'data', 'native-words');
fs.mkdirSync(CUSTOM_DIR, { recursive: true });
fs.mkdirSync(NATIVE_DIR, { recursive: true });
// Lowercase first: the character class only matches lowercase letters, so stripping before lowercasing
// would silently delete every uppercase letter of a mixed-case word.
const normalizedAudioKey = (word: string) => word.toLowerCase().replace(/[^a-z0-9]/g, '');
const customPath = (word: string) => path.join(CUSTOM_DIR, `${normalizedAudioKey(word)}.bin`);
const nativePath = (word: string) => path.join(NATIVE_DIR, `${normalizedAudioKey(word)}.bin`);

// Longest word accepted by the audio routes: bounds file names, upstream URLs and cache keys.
const MAX_AUDIO_WORD_LENGTH = 64;

const ai = process.env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })
  : null;

function detectAudioMime(buffer: Buffer): string {
  if (buffer.subarray(0, 4).toString('ascii') === 'RIFF') return 'audio/wav';
  if (buffer.subarray(0, 4).toString('ascii') === 'OggS') return 'audio/ogg';
  if (buffer.subarray(0, 4).toString('ascii') === 'fLaC') return 'audio/flac';
  if (buffer.length >= 4 && buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) return 'audio/webm';
  if (buffer.subarray(4, 8).toString('ascii') === 'ftyp') return 'audio/mp4';
  return 'audio/mpeg';
}

/**
 * Magic-byte sniff for the audio containers we accept: WAV, Ogg, FLAC, WebM/Matroska, MP4/M4A,
 * MP3 (ID3 tag or bare MPEG frame sync) and ADTS AAC. An HTML/JSON error page never matches.
 */
function looksLikeAudio(buffer: Buffer): boolean {
  if (buffer.length < 12) return false;
  const head = buffer.subarray(0, 4).toString('latin1');
  if (head === 'RIFF') return buffer.subarray(8, 12).toString('latin1') === 'WAVE';
  if (head === 'OggS' || head === 'fLaC') return true;
  if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) return true;
  if (buffer.subarray(4, 8).toString('latin1') === 'ftyp') return true;
  if (head.startsWith('ID3')) return true;
  return buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0;
}

type FetchResponse = Awaited<ReturnType<typeof fetch>>;

/** Release the connection of a response whose body is not needed (undici holds the socket until the body is read or cancelled). */
async function discardBody(resp: FetchResponse): Promise<void> {
  try {
    await resp.body?.cancel();
  } catch {
    // body already consumed or errored: nothing left to release
  }
}

function readFileIfExists(file: string): Buffer | null {
  try {
    return fs.readFileSync(file);
  } catch (err: any) {
    if (err?.code === 'ENOENT') return null;
    throw err;
  }
}

// Health check endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    engine: 'HmongTTS Core Engine v2.4.0',
    dialects: ['dawb', 'leeg'],
    offlineEnabled: true,
    geminiConfigured: Boolean(ai),
    neuralBackendUrl: ORPHEUS_URL,
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

// Words the dictionary does not have (upstream 404 / non-audio reply), remembered for a while so every
// request and the prewarm don't refetch known-missing words. word -> expiry (epoch ms), oldest first.
const NEGATIVE_CACHE_TTL_MS = 10 * 60_000;
const NEGATIVE_CACHE_MAX_ENTRIES = 5_000;
const missingNativeWords = new Map<string, number>();

function isKnownMissingWord(key: string): boolean {
  const expiresAt = missingNativeWords.get(key);
  if (expiresAt === undefined) return false;
  if (expiresAt <= Date.now()) {
    missingNativeWords.delete(key);
    return false;
  }
  return true;
}

function rememberMissingWord(key: string): void {
  missingNativeWords.delete(key); // re-insert so Map order stays oldest-first
  if (missingNativeWords.size >= NEGATIVE_CACHE_MAX_ENTRIES) {
    const oldest = missingNativeWords.keys().next().value;
    if (oldest !== undefined) missingNativeWords.delete(oldest);
  }
  missingNativeWords.set(key, Date.now() + NEGATIVE_CACHE_TTL_MS);
}

// Upstream replies that declare themselves as text/markup/JSON are error pages, not audio.
const NON_AUDIO_CONTENT_TYPE = /^(text\/|application\/(json|xml|xhtml\+xml|javascript))/i;

async function fetchNativeAudioBuffer(cleanWord: string, retries = 1): Promise<Buffer | null> {
  const key = normalizedAudioKey(cleanWord);
  if (!key || key.length > MAX_AUDIO_WORD_LENGTH) return null;

  // A user recording always wins over the dictionary clip. It is checked before the in-memory cache so a
  // native clip cached earlier (or by a fetch that was still in flight when the recording was uploaded)
  // can never shadow it.
  const customBuffer = readFileIfExists(customPath(key));
  if (customBuffer) return customBuffer;

  if (nativeAudioCache.has(key)) {
    return nativeAudioCache.get(key)!;
  }

  const persistedNative = nativePath(key);
  const persistedBuffer = readFileIfExists(persistedNative);
  if (persistedBuffer) {
    if (looksLikeAudio(persistedBuffer)) {
      nativeAudioCache.set(key, persistedBuffer);
      return persistedBuffer;
    }
    // Persisted by an older run that cached a non-audio reply (e.g. an HTML error page): drop it and refetch.
    try {
      fs.unlinkSync(persistedNative);
    } catch {
      // best effort
    }
  }

  if (isKnownMissingWord(key)) return null;

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

        // 404/410 is the dictionary's definitive "no recording for this word": don't retry, remember it.
        if (resp.status === 404 || resp.status === 410) {
          await discardBody(resp);
          rememberMissingWord(key);
          return null;
        }

        // Other non-OK statuses (5xx, 429, ...) are treated as transient: release the socket and retry.
        if (!resp.ok) {
          await discardBody(resp);
          continue;
        }

        // The dictionary serves its MP3s without a Content-Type header, so audio/* is not required;
        // what must hold is that the reply is not declared text/markup and that the bytes sniff as audio.
        // Anything else (e.g. an HTML error page sent with 200) is a failed fetch and is never cached,
        // persisted or served as audio.
        const contentType = resp.headers.get('content-type') || '';
        if (NON_AUDIO_CONTENT_TYPE.test(contentType)) {
          await discardBody(resp);
          rememberMissingWord(key);
          return null;
        }

        const buffer = Buffer.from(await resp.arrayBuffer());
        if (buffer.length > 100 && looksLikeAudio(buffer)) {
          nativeAudioCache.set(key, buffer);
          try {
            fs.writeFileSync(nativePath(key), buffer);
          } catch (persistError) {
            console.warn(`Fetched HmongDictionary audio for "${key}" but could not persist it:`, persistError);
          }
          return buffer;
        }

        rememberMissingWord(key);
        return null;
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
  'lawv', 'txaus', 'li', 'os', 'thov', 'nrog', 'txoj', 'kev', 'pab',
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

// A single spoken word is a few seconds of audio; anything outside this window is not a plausible recording.
// (The 2 MB ceiling is also the body-parser limit below, so oversized uploads are cut off while streaming.)
const MIN_CUSTOM_AUDIO_BYTES = 100;
const MAX_CUSTOM_AUDIO_BYTES = 2 * 1024 * 1024;

// body-parser rejects an oversized upload with an HTML error page; answer in JSON like the rest of the API.
const customAudioUploadErrors: ErrorRequestHandler = (err, _req, res, next) => {
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: `Audio must be at most ${MAX_CUSTOM_AUDIO_BYTES} bytes` });
  }
  return next(err);
};

// ponytail: no auth on this route (product decision); the validation below only keeps junk out of data/custom-words
app.post('/api/audio/custom/:word', rateLimit(30), express.raw({ type: '*/*', limit: MAX_CUSTOM_AUDIO_BYTES }), (req: Request, res: Response) => {
  const word = normalizedAudioKey(req.params.word || '');
  if (!word || word.length > MAX_AUDIO_WORD_LENGTH) {
    return res.status(400).json({ error: 'Invalid word' });
  }

  const audio = req.body;
  if (!Buffer.isBuffer(audio)) {
    return res.status(400).json({ error: 'Request body must be raw audio bytes' });
  }
  if (audio.length < MIN_CUSTOM_AUDIO_BYTES) {
    return res.status(400).json({ error: `Audio must be at least ${MIN_CUSTOM_AUDIO_BYTES} bytes` });
  }
  if (audio.length > MAX_CUSTOM_AUDIO_BYTES) {
    return res.status(413).json({ error: `Audio must be at most ${MAX_CUSTOM_AUDIO_BYTES} bytes` });
  }
  if (!looksLikeAudio(audio)) {
    return res.status(415).json({ error: 'Unrecognized audio format (expected WAV, Ogg, WebM, MP4, MP3 or FLAC)' });
  }

  try {
    fs.writeFileSync(customPath(word), audio);
  } catch (err) {
    console.error(`Could not save custom recording for "${word}":`, err);
    return res.status(500).json({ error: 'Could not save recording' });
  }
  // fetchNativeAudioBuffer consults the custom file before this cache, so a native clip cached (or
  // fetched concurrently) for this word can no longer shadow the recording; dropping it just frees memory.
  nativeAudioCache.delete(word);
  return res.json({ status: 'saved', word });
}, customAudioUploadErrors);

// Optional neural Hmong backend: proxy to the local Orpheus sidecar (neural/orpheus_server.py)
const ORPHEUS_URL = process.env.ORPHEUS_URL || 'http://127.0.0.1:8765';

app.get('/api/tts/neural/status', async (_req: Request, res: Response) => {
  try {
    const r = await fetch(`${ORPHEUS_URL}/health`, { signal: AbortSignal.timeout(1500) });
    await discardBody(r);
    return res.json({ available: r.ok });
  } catch {
    return res.json({ available: false });
  }
});

app.post('/api/tts/neural', rateLimit(20), async (req: Request, res: Response) => {
  const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
  if (!text || text.length > 300) return res.status(400).json({ error: 'text must be 1-300 characters' });
  try {
    const r = await fetch(`${ORPHEUS_URL}/synthesize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(10 * 60_000), // CPU generation is slow
    });
    if (!r.ok) {
      await discardBody(r);
      return res.status(502).json({ error: 'Neural backend failed' });
    }
    res.setHeader('Content-Type', 'audio/wav');
    return res.send(Buffer.from(await r.arrayBuffer()));
  } catch {
    return res.status(503).json({ error: 'Neural backend not running' });
  }
});

// Native Hmong Audio Proxy: Stream single word MP3
// Each unknown word can cost an upstream fetch, so this is rate limited (responses are browser-cacheable).
app.get('/api/audio/hmong-word/:word', rateLimit(120), async (req: Request, res: Response) => {
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

    res.setHeader('Content-Type', detectAudioMime(buffer));
    res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    res.setHeader('Content-Length', buffer.length.toString());
    return res.send(buffer);
  } catch (err: any) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Most distinct words one /api/audio/hmong-batch call will process (clients chunk larger lists)
const MAX_BATCH_WORDS = 100;

// Native Hmong Audio Batch Endpoint: Retrieve multiple word recordings with pool throttling
app.post('/api/audio/hmong-batch', rateLimit(10), async (req: Request, res: Response) => {
  try {
    const { words } = req.body;
    if (!Array.isArray(words) || words.length === 0) {
      return res.status(400).json({ error: 'Field "words" must be a non-empty array' });
    }

    // Limit batch size to MAX_BATCH_WORDS per call; the response says when words were left out
    const requestedWords = Array.from(new Set(
      words.map(w => (typeof w === 'string' ? normalizedAudioKey(w) : '')).filter(Boolean)
    ));
    const uniqueWords = requestedWords.slice(0, MAX_BATCH_WORDS);
    const truncated = requestedWords.length > uniqueWords.length;

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
      // totalRequested is the number of words processed (kept as-is for existing callers); requested is how
      // many distinct words were asked for, so truncated/processed/requested let callers detect dropped words.
      totalRequested: uniqueWords.length,
      requested: requestedWords.length,
      processed: uniqueWords.length,
      truncated,
      foundCount: Object.values(results).filter(r => r.found).length,
      cachedTotal: nativeAudioCache.size,
      results,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Internal server error' });
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
    const text = readTtsText(req.body?.text);
    const dialect = req.body?.dialect === 'leeg' ? 'leeg' : 'dawb';
    if (!text) {
      return res.status(400).json({ error: `Field "text" is required and must be 1-${MAX_TTS_TEXT_LENGTH} characters` });
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
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Full Timing and Phonetic IPA & Tone Alignment Metadata Export endpoint
app.post('/api/tts/metadata', (req: Request, res: Response) => {
  try {
    const text = readTtsText(req.body?.text);
    const dialect = req.body?.dialect === 'leeg' ? 'leeg' : 'dawb';
    const voiceId = typeof req.body?.voiceId === 'string' ? req.body.voiceId : 'paj_dawb_female';
    const rate = normalizeRate(req.body?.rate);
    const pitch = typeof req.body?.pitch === 'number' && Number.isFinite(req.body.pitch)
      ? Math.min(1.5, Math.max(0.7, req.body.pitch))
      : 1;
    const toneEmphasis = typeof req.body?.toneEmphasis === 'number' && Number.isFinite(req.body.toneEmphasis)
      ? Math.min(1.6, Math.max(0.8, req.body.toneEmphasis))
      : 1.1;
    const prosody = typeof req.body?.prosody === 'number' && Number.isFinite(req.body.prosody)
      ? Math.min(2, Math.max(0, req.body.prosody))
      : 1.1;
    if (!text) {
      return res.status(400).json({ error: `Field "text" is required and must be 1-${MAX_TTS_TEXT_LENGTH} characters` });
    }

    const syllables = parseHmongText(text, dialect as HmongDialect);
    const sampleRate = 44100;

    // Same plan /api/tts/synthesize renders from: the timeline below is the timeline of the audio.
    const { segments, totalSamples } = planTimeline(syllables, sampleRate, rate);

    const alignment = syllables.map((s, index) => {
      const { startSample, voicedSamples, gapSamples } = segments[index];
      // A syllable spans its voiced samples; punctuation is silent and spans its whole pause.
      const spanSamples = s.isPunctuation ? gapSamples : voicedSamples;
      const endSample = startSample + spanSamples;

      return {
        index,
        token: s.raw,
        clean: s.clean,
        isPunctuation: s.isPunctuation,
        timeStartSec: parseFloat((startSample / sampleRate).toFixed(4)),
        timeEndSec: parseFloat((endSample / sampleRate).toFixed(4)),
        durationMs: Math.round((spanSamples / sampleRate) * 1000),
        sampleStart: startSample,
        sampleEnd: endSample,
        phonetics: {
          onset: s.onset,
          onsetIpa: s.onset ? `[${getOnsetIpa(s.onset, dialect as HmongDialect)}]` : '∅',
          vowel: s.vowel,
          vowelIpa: `[${HMONG_VOWELS[s.vowel]?.ipa ?? s.vowel}]`,
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

    // Includes the lead-in and the 100 ms tail, exactly like the rendered WAV.
    const totalDurationSec = parseFloat((totalSamples / sampleRate).toFixed(4));

    return res.json({
      app: 'HmongTTS Native Speech Studio',
      version: '1.2.0',
      generatedAt: new Date().toISOString(),
      text,
      dialect,
      dialectName: dialect === 'dawb' ? 'Hmoob Dawb (White Hmong)' : 'Moob Leeg (Green Hmong)',
      voice: {
        id: voiceId,
        gender: resolveVoiceProfile(voiceId).gender,
      },
      acousticSettings: {
        rate,
        pitch,
        toneEmphasis,
        prosody,
      },
      audioMetrics: {
        totalDurationSec,
        totalDurationMs: Math.round((totalSamples / sampleRate) * 1000),
        sampleRate,
        channels: 1,
        totalSamples,
        syllableCount: syllables.filter((s) => !s.isPunctuation).length,
      },
      alignment,
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Auto-Detect Language (Hmong vs English vs Mixed) endpoint
app.post('/api/tts/detect', (req: Request, res: Response) => {
  try {
    const text = readTtsText(req.body?.text);
    if (!text) {
      return res.status(400).json({ error: `Field "text" is required and must be 1-${MAX_TTS_TEXT_LENGTH} characters` });
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
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Server-side synthesis endpoint (CPU-bound and synchronous, so rate limited like the other expensive routes)
app.post('/api/tts/synthesize', rateLimit(30), (req: Request, res: Response) => {
  try {
    const text = readTtsText(req.body?.text);
    const dialect = req.body?.dialect === 'leeg' ? 'leeg' : 'dawb';
    const voiceId = typeof req.body?.voiceId === 'string' ? req.body.voiceId : 'paj_dawb_female';
    const rate = normalizeRate(req.body?.rate);
    const pitch = typeof req.body?.pitch === 'number' && Number.isFinite(req.body.pitch)
      ? Math.min(1.5, Math.max(0.7, req.body.pitch))
      : 1;
    const format = 'wav';

    if (!text) {
      return res.status(400).json({ error: `Field "text" is required and must be 1-${MAX_TTS_TEXT_LENGTH} characters` });
    }

    const syllables = parseHmongText(text, dialect as HmongDialect);

    // Synthesize WAV in memory on Node.js using our pure acoustic DSP pipeline
    const sampleRate = 44100;
    const { baseF0 } = resolveVoiceProfile(voiceId);

    // Per-syllable segment plan: honors tone-specific durations (clipped -m, long -d), punctuation
    // pauses, and inter-syllable gaps. /api/tts/metadata reports this same planTimeline() result,
    // so its alignment matches the audio rendered here.
    const { segments, totalSamples } = planTimeline(syllables, sampleRate, rate);

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
    let phase = 0;

    for (const seg of segments) {
      const { syllable: syl, voicedSamples } = seg;
      let sampleOffset = 44 + seg.startSample * 2;
      const contour = syl.pitchTrajectory;
      for (let i = 0; i < voicedSamples; i++) {
        if (sampleOffset >= buffer.length - 2) break;
        const progress = i / voicedSamples;
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
      // The gap after each segment is silence: the buffer is zero-filled, so there is nothing to write.
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
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// AI Audio Transcription endpoint (Hmong RPA & English speech-to-text)
app.post('/api/tts/transcribe', rateLimit(10), async (req: Request, res: Response) => {
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

    if (!ai) {
      return res.status(503).json({ error: 'Gemini API is not configured for audio transcription.' });
    }

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
      error: 'Failed to transcribe audio clip',
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

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`HmongTTS Server running on http://0.0.0.0:${PORT}`);
  });
  // Listen failures (e.g. EADDRINUSE) are emitted on the server, not thrown from startServer()
  server.on('error', (err) => {
    console.error(`HmongTTS Server could not listen on port ${PORT}:`, err);
    process.exit(1);
  });
}

startServer().catch((err) => {
  console.error('HmongTTS Server failed to start:', err);
  process.exit(1);
});

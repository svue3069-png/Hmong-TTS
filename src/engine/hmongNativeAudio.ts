/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Hmong Native Audio Service
 * Fetches, decodes, and seamlessly stitches authentic native spoken Hmong audio
 * recordings from HmongDictionary.com and Hmong Voice Agent archives into high-fidelity
 * continuous speech tracks with millisecond-exact syllable alignment.
 */

import { HmongDialect, parseHmongText, SyllableDecomposition } from './hmongPhonology';
import { SyllableAlignmentMetadata } from './hmongAudioSynthesizer';
import { getWordRecording } from './customWordRecordings';
import { resampleLinear, timeStretch } from './timeStretch';

export interface NativeAudioBatchResult {
  found: boolean;
  audioBase64?: string;
  byteLength?: number;
  source?: string;
}

export interface NativeTrackAssemblyResult {
  buffer: AudioBuffer;
  alignment: SyllableAlignmentMetadata[];
  totalDuration: number;
  nativeCount: number;
  totalCount: number;
  coverageRatio: number;
}

// Client-side in-memory AudioBuffer cache for decoded native word recordings
const decodedBufferCache = new Map<string, AudioBuffer>();

/**
 * Encodes a Hmong word into ASCII character codes matching HmongDictionary.com archive URLs
 * Example: "NYOB" -> 'N'(78) + 'Y'(89) + 'O'(79) + 'B'(66) -> "78897966"
 */
export function getHmongCharCodes(str: string): string {
  const upper = str.toUpperCase().trim();
  let codes = '';
  for (let i = 0; i < upper.length; i++) {
    codes += upper.charCodeAt(i).toString();
  }
  return codes;
}

/**
 * Base64 string to ArrayBuffer helper
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Fetches and decodes a single native Hmong word recording from the server proxy
 */
export async function fetchAndDecodeNativeWord(
  word: string,
  audioCtx: AudioContext
): Promise<AudioBuffer | null> {
  const clean = word.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().trim();
  if (!clean) return null;

  if (decodedBufferCache.has(clean)) {
    return decodedBufferCache.get(clean)!;
  }

  try {
    const res = await fetch(`/api/audio/hmong-word/${encodeURIComponent(clean)}`);
    if (res.ok) {
      const arrayBuf = await res.arrayBuffer();
      if (arrayBuf.byteLength > 100) {
        const decoded = await audioCtx.decodeAudioData(arrayBuf.slice(0));
        decodedBufferCache.set(clean, decoded);
        return decoded;
      }
    }
  } catch {
    // Graceful fallback to acoustic synthesis
  }

  return null;
}

/**
 * Preloads a batch of native Hmong words in a single HTTP request and decodes them into AudioBuffers
 */
export async function preloadNativeWordsBatch(
  words: string[],
  audioCtx: AudioContext
): Promise<Map<string, AudioBuffer>> {
  const cleanWords = Array.from(new Set(
    words.map((w) => w.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().trim()).filter(Boolean)
  ));

  const neededWords = cleanWords.filter((w) => !decodedBufferCache.has(w));
  const resultMap = new Map<string, AudioBuffer>();

  // Add already cached words
  for (const w of cleanWords) {
    if (decodedBufferCache.has(w)) {
      resultMap.set(w, decodedBufferCache.get(w)!);
    }
  }

  // User-recorded words take priority (and cover words the dictionary lacks)
  for (const w of [...neededWords]) {
    try {
      const blob = await getWordRecording(w);
      if (blob) {
        const decoded = await audioCtx.decodeAudioData(await blob.arrayBuffer());
        decodedBufferCache.set(w, decoded);
        resultMap.set(w, decoded);
        neededWords.splice(neededWords.indexOf(w), 1);
      }
    } catch {
      // IndexedDB unavailable or undecodable recording: fall through to the dictionary
    }
  }

  if (neededWords.length === 0) {
    return resultMap;
  }

  try {
    const res = await fetch('/api/audio/hmong-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ words: neededWords }),
    });

    if (res.ok) {
      const data = await res.json();
      const results: Record<string, NativeAudioBatchResult> = data.results || {};

      await Promise.all(
        Object.entries(results).map(async ([w, info]) => {
          if (info.found && info.audioBase64) {
            try {
              const arrayBuf = base64ToArrayBuffer(info.audioBase64);
              const decoded = await audioCtx.decodeAudioData(arrayBuf);
              decodedBufferCache.set(w, decoded);
              resultMap.set(w, decoded);
            } catch {
              // Graceful fallback for decoding
            }
          }
        })
      );
    }
  } catch {
    // Graceful fallback to acoustic synthesis
  }

  return resultMap;
}

/**
 * Common Hmong 2-syllable compound collocations that form tightly connected rhythmic feet
 */
const HMONG_COMMON_COMPOUNDS = new Set([
  'nyob_zoo', 'sawv_daws', 'suav_daws', 'zoo_siab', 'ua_tsaug',
  'hnub_no', 'nub_nua', 'hmoob_dawb', 'moob_leeg', 'tau_ntsib',
  'sau_ntawv', 'nyeem_ntawv', 'hais_lus', 'has_lug', 'tuaj_txog',
  'mus_txog', 'moog_txog', 'ntau_ntau', 'pab_cuam', 'paab_cuam',
  'txiv_neej', 'poj_niam', 'quas_puj', 'quas_yawg', 'me_nyuam',
  'nam_txiv', 'niam_txiv', 'noj_mov', 'haus_dej', 'hawv_dlej',
  'nkag_siab', 'tsis_tau', 'tsi_tau', 'yuav_tau', 'muaj_peev_xwm',
]);

/**
 * Dictionary recordings are slow citation-form words (~2.5 words/s), which is what makes stitched speech
 * sound choppy. Connected speech is faster and reduces small grammar words, so each word is sped up with a
 * pitch-preserving time stretch (tones are pitch contours and must not move). Sentence-final words stay slow.
 */
const FUNCTION_WORDS = new Set([
  'lub', 'tus', 'cov', 'uas', 'yog', 'tsis', 'tau', 'yuav', 'los', 'rau', 'ntawm', 'li', 'hu', 'ua', 'thiab',
  'mas', 'ces', 'thiaj', 'kom', 'vim', 'kuv', 'koj', 'nws', 'peb', 'nej', 'lawv', 'no', 'ntawd', 'tuaj', 'mus',
]);
const FLOW_CONTENT = 1.3;
const FLOW_FUNCTION = 1.5;
const FLOW_FINAL = 1.1;

function flowFactor(word: string, isSentenceFinal: boolean): number {
  if (isSentenceFinal) return FLOW_FINAL;
  return FUNCTION_WORDS.has(word) ? FLOW_FUNCTION : FLOW_CONTENT;
}

/** Active part of a recording, converted to the output rate and stretched (pitch-preserving) to targetLen. */
function prepareWord(buffer: AudioBuffer, b: AudioTrimBounds, outRate: number, targetLen: number): Float32Array {
  const region = buffer.getChannelData(0).subarray(b.startSample, b.endSample);
  const atRate = resampleLinear(region, buffer.sampleRate, outRate);
  return timeStretch(atRate, targetLen / Math.max(1, atRate.length), outRate);
}

interface AudioTrimBounds {
  startSample: number;
  endSample: number;
  activeLength: number;
}

const trimBoundsCache = new WeakMap<AudioBuffer, AudioTrimBounds>();

/**
 * Measures the active vocalization bounds of a recorded word buffer,
 * trimming leading microphone delay and trailing ambient room noise so
 * words can connect with natural human liaison instead of choppy pauses.
 */
function getActiveSpeechBounds(buffer: AudioBuffer): AudioTrimBounds {
  if (trimBoundsCache.has(buffer)) {
    return trimBoundsCache.get(buffer)!;
  }

  const data = buffer.getChannelData(0);
  const len = data.length;
  const sampleRate = buffer.sampleRate;

  let peak = 0;
  for (let i = 0; i < len; i++) {
    const abs = Math.abs(data[i]);
    if (abs > peak) peak = abs;
  }

  if (peak < 0.005) {
    const fallback = { startSample: 0, endSample: len, activeLength: len };
    trimBoundsCache.set(buffer, fallback);
    return fallback;
  }

  // Energy threshold: 4% of peak or min 0.008
  const threshold = Math.max(0.004, peak * 0.015);

  // 16ms protective onset pre-roll to preserve soft consonants (voiceless nasals hm/hn, fricatives s/x/z)
  const onsetMargin = Math.floor(sampleRate * 0.010);
  // 30ms protective release post-roll to preserve vowel off-glides, nasal tails, and tones
  const releaseMargin = Math.floor(sampleRate * 0.016);

  let firstActive = 0;
  for (let i = 0; i < len; i++) {
    if (Math.abs(data[i]) >= threshold) {
      firstActive = i;
      break;
    }
  }

  let lastActive = len - 1;
  for (let i = len - 1; i >= 0; i--) {
    if (Math.abs(data[i]) >= threshold) {
      lastActive = i;
      break;
    }
  }

  const startSample = Math.max(0, firstActive - onsetMargin);
  const endSample = Math.min(len, lastActive + releaseMargin + 1);
  const activeLength = Math.max(Math.floor(sampleRate * 0.08), endSample - startSample);

  const bounds: AudioTrimBounds = { startSample, endSample, activeLength };
  trimBoundsCache.set(buffer, bounds);
  return bounds;
}

const wordGainCache = new WeakMap<AudioBuffer, number>();

/** Gain that levels each recorded word to a common RMS so stitched speech sounds like one speaker/session. */
function getWordLoudnessGain(buffer: AudioBuffer, b: AudioTrimBounds): number {
  const hit = wordGainCache.get(buffer);
  if (hit !== undefined) return hit;
  const d = buffer.getChannelData(0);
  let sum = 0;
  for (let i = b.startSample; i < b.endSample; i++) sum += d[i] * d[i];
  const rms = Math.sqrt(sum / Math.max(1, b.endSample - b.startSample));
  const gain = rms > 1e-4 ? Math.max(0.4, Math.min(2.5, 0.1 / rms)) : 1;
  wordGainCache.set(buffer, gain);
  return gain;
}

interface SyllableProsodyContext {
  sentenceIndex: number;
  wordIndexInSentence: number;
  totalWordsInSentence: number;
  isSentenceStart: boolean;
  isPrePeriodWord: boolean;
  isClauseEnd: boolean;
  terminalPunctuation: string;
  isCompoundWithNext: boolean;
  f0ShiftSemitones: number;
  durationScale: number;
}

/**
 * Assembles a complete native Hmong audio track by stitching authentic recordings
 * with natural continuous phrasing, whole-sentence intonation, and dedicated stops at periods.
 * Modeled after conversational Hmong prosody observed in YouTube news, stories, and native speakers.
 */
export async function assembleNativeHmongTrack(
  text: string,
  dialect: HmongDialect,
  audioCtx: AudioContext,
  options: {
    rate?: number;
    prosody?: number;
    fallbackSynthesizer?: (syl: SyllableDecomposition, sampleRate: number) => Float32Array;
  } = {}
): Promise<NativeTrackAssemblyResult> {
  const rate = options.rate || 1.0;
  const prosody = options.prosody !== undefined ? options.prosody : 1.0;
  const sampleRate = audioCtx.sampleRate;
  const parsedSyllables = parseHmongText(text, dialect);

  // Extract all valid words for batch preloading
  const wordsToFetch = parsedSyllables
    .filter((s) => !s.isPunctuation)
    .map((s) => s.clean || s.raw);

  await preloadNativeWordsBatch(wordsToFetch, audioCtx);

  // Phase 1: Analyze Sentence Boundaries & Prosodic Cadence
  // Sentences are bounded by periods ('.'), exclamation marks ('!'), or question marks ('?').
  // Commas (','), semicolons (';'), and colons (':') mark minor clause boundaries.
  const prosodyMap = new Map<number, SyllableProsodyContext>();

  let currentSentenceWords: number[] = [];
  let currentSentenceIndex = 0;

  for (let i = 0; i < parsedSyllables.length; i++) {
    const syl = parsedSyllables[i];
    if (!syl.isPunctuation) {
      currentSentenceWords.push(i);
    } else {
      const punct = syl.raw;
      const isTerminal = punct === '.' || punct === '!' || punct === '?';
      if (isTerminal && currentSentenceWords.length > 0) {
        const totalInSent = currentSentenceWords.length;
        for (let k = 0; k < totalInSent; k++) {
          const sylIdx = currentSentenceWords[k];
          const isStart = k === 0;
          const isPrePeriod = k === totalInSent - 1;
          const progress = totalInSent > 1 ? k / (totalInSent - 1) : 0;

          // Intonational pitch curve across sentence (YouTube Hmong news/speech style):
          // - Sentence start: elevated register (+1.1 semitones)
          // - Body: gentle declination downwards
          // - Pre-period: terminal lowering (-1.6 semitones) for period/exclamation, or lift (+1.2 semitones) for question
          let f0Shift = 0;
          if (punct === '?') {
            f0Shift = isPrePeriod ? 1.2 * prosody : (1.1 - 0.9 * progress) * prosody;
          } else {
            f0Shift = (1.1 - 2.7 * progress) * prosody;
          }

          // Compound pair detection with next word
          let isCompound = false;
          if (k < totalInSent - 1) {
            const nextIdx = currentSentenceWords[k + 1];
            const pairKey = `${(parsedSyllables[sylIdx].clean || '').toLowerCase()}_${(parsedSyllables[nextIdx].clean || '').toLowerCase()}`;
            isCompound = HMONG_COMMON_COMPOUNDS.has(pairKey);
          }

          // Phrase-final lengthening: words right before period sustain +18% longer for natural resolution
          let durationScale = isPrePeriod ? 1.18 : isCompound ? 0.94 : 1.0;

          prosodyMap.set(sylIdx, {
            sentenceIndex: currentSentenceIndex,
            wordIndexInSentence: k,
            totalWordsInSentence: totalInSent,
            isSentenceStart: isStart,
            isPrePeriodWord: isPrePeriod,
            isClauseEnd: false,
            terminalPunctuation: punct,
            isCompoundWithNext: isCompound,
            f0ShiftSemitones: f0Shift,
            durationScale,
          });
        }
        currentSentenceWords = [];
        currentSentenceIndex++;
      }
    }
  }

  // Handle trailing sentence if text did not end with punctuation
  if (currentSentenceWords.length > 0) {
    const totalInSent = currentSentenceWords.length;
    for (let k = 0; k < totalInSent; k++) {
      const sylIdx = currentSentenceWords[k];
      const isStart = k === 0;
      const isPrePeriod = k === totalInSent - 1;
      const progress = totalInSent > 1 ? k / (totalInSent - 1) : 0;
      const f0Shift = (1.0 - 2.4 * progress) * prosody;

      let isCompound = false;
      if (k < totalInSent - 1) {
        const nextIdx = currentSentenceWords[k + 1];
        const pairKey = `${(parsedSyllables[sylIdx].clean || '').toLowerCase()}_${(parsedSyllables[nextIdx].clean || '').toLowerCase()}`;
        isCompound = HMONG_COMMON_COMPOUNDS.has(pairKey);
      }

      const durationScale = isPrePeriod ? 1.16 : isCompound ? 0.94 : 1.0;

      prosodyMap.set(sylIdx, {
        sentenceIndex: currentSentenceIndex,
        wordIndexInSentence: k,
        totalWordsInSentence: totalInSent,
        isSentenceStart: isStart,
        isPrePeriodWord: isPrePeriod,
        isClauseEnd: false,
        terminalPunctuation: '.',
        isCompoundWithNext: isCompound,
        f0ShiftSemitones: f0Shift,
        durationScale,
      });
    }
  }

  // Phase 2: Compute Segment Placements with Legato Liaison & Period Stops
  interface WordSegment {
    syllable: SyllableDecomposition;
    audioBuffer: AudioBuffer | null;
    isNative: boolean;
    trimBounds: AudioTrimBounds | null;
    startSample: number;
    lengthSamples: number;
    durationSec: number;
    f0ShiftSemitones: number;
    isPrePeriodWord: boolean;
    terminalPunctuation: string;
  }

  const segments: WordSegment[] = [];
  let currentSampleOffset = Math.floor(sampleRate * 0.05); // 50ms initial room acoustic head
  let nativeCount = 0;
  let totalWordsCount = 0;

  // Connected conversational Hmong pacing: measured, clear, and articulate
  // Prevents rushing while keeping natural sentence liaison
  const naturalFlowRate = rate;

  for (let i = 0; i < parsedSyllables.length; i++) {
    const syl = parsedSyllables[i];

    if (syl.isPunctuation) {
      const punct = syl.raw;
      let pauseSec = 0.22; // Default comma / clause pause (340ms)

      if (punct === '.' || punct === '。') {
        // STOP AT PERIOD: 780ms clear breath pause for complete sentence closure
        pauseSec = 0.45;
      } else if (punct === '?' || punct === '？') {
        // QUESTION STOP: 750ms interrogative sentence pause
        pauseSec = 0.45;
      } else if (punct === '!' || punct === '！') {
        // EXCLAMATION STOP: 720ms sentence pause
        pauseSec = 0.45;
      } else if (punct === ',' || punct === '，' || punct === ';' || punct === ':') {
        // Minor clause pause
        pauseSec = 0.22;
      } else if (punct === '-') {
        pauseSec = 0.20;
      }

      const pauseSamples = Math.floor(sampleRate * (pauseSec / rate));

      segments.push({
        syllable: syl,
        audioBuffer: null,
        isNative: false,
        trimBounds: null,
        startSample: currentSampleOffset,
        lengthSamples: pauseSamples,
        durationSec: pauseSec / rate,
        f0ShiftSemitones: 0,
        isPrePeriodWord: false,
        terminalPunctuation: punct,
      });

      currentSampleOffset += pauseSamples;
      continue;
    }

    totalWordsCount++;
    const cleanWord = (syl.clean || syl.raw).toLowerCase();
    const cached = decodedBufferCache.get(cleanWord) || null;
    const prosodyCtx = prosodyMap.get(i);

    const f0Shift = prosodyCtx ? prosodyCtx.f0ShiftSemitones : 0;
    const durationScale = prosodyCtx ? prosodyCtx.durationScale : 1.0;
    const isPrePeriod = prosodyCtx ? prosodyCtx.isPrePeriodWord : false;
    const terminalPunct = prosodyCtx ? prosodyCtx.terminalPunctuation : '.';

    let segLengthSamples = 0;
    let segDurationSec = 0;
    let isNative = false;
    let trimBounds: AudioTrimBounds | null = null;

    if (cached) {
      isNative = true;
      nativeCount++;
      trimBounds = getActiveSpeechBounds(cached);

      // Resampling speed factor considering sample rate conversion, conversational rate, and duration scaling
      // Recordings play at native speed: stretching by resampling would shift the pitch and
      // distort the tone contour. Only the user's explicit rate (and sample-rate conversion) applies.
      segLengthSamples = Math.floor(trimBounds.activeLength * (sampleRate / cached.sampleRate) / (rate * flowFactor(cleanWord, isPrePeriod)));
      segDurationSec = segLengthSamples / sampleRate;
    } else {
      // Missing from dictionary: fallback to acoustic syllable duration estimate
      segDurationSec = (syl.durationMs / 1000) / (naturalFlowRate / durationScale);
      segLengthSamples = Math.floor(sampleRate * segDurationSec);
    }

    segments.push({
      syllable: syl,
      audioBuffer: cached,
      isNative,
      trimBounds,
      startSample: currentSampleOffset,
      lengthSamples: segLengthSamples,
      durationSec: segDurationSec,
      f0ShiftSemitones: f0Shift,
      isPrePeriodWord: isPrePeriod,
      terminalPunctuation: terminalPunct,
    });

    currentSampleOffset += segLengthSamples;

    // Intra-Sentence Legato Connection (eliminates robotic word-by-word choppiness):
    // Words within the same sentence connect seamlessly with a 14ms - 18ms coarticulation crossfade
    // rather than artificial dead silence.
    const nextSyl = parsedSyllables[i + 1];
    if (nextSyl && !nextSyl.isPunctuation) {
      const isCompound = prosodyCtx?.isCompoundWithNext;
      // Overlap adjacent words by 14ms to 18ms so human voice flows continuously like one breath stream
      const crossfadeOverlapSec = (isCompound ? 0.030 : 0.028) / rate;
      const overlapSamples = Math.floor(sampleRate * crossfadeOverlapSec);
      currentSampleOffset = Math.max(0, currentSampleOffset - overlapSamples);
    }
  }

  // 120ms trailing room reverberation
  currentSampleOffset += Math.floor(sampleRate * 0.12);

  // Phase 3: Synthesize and Crossfade Audio Waveforms
  const masterBuffer = audioCtx.createBuffer(1, currentSampleOffset, sampleRate);
  const outData = masterBuffer.getChannelData(0);

  for (const seg of segments) {
    if (seg.syllable.isPunctuation) continue;

    if (seg.isNative && seg.audioBuffer && seg.trimBounds) {
      const bounds = seg.trimBounds;

      // High-fidelity speech interpolation that preserves natural human vocal tract formants:
      // Advances through the complete active speech bounds without premature cutoffs or truncation
      const numSamplesToWrite = seg.lengthSamples;
      const proc = prepareWord(seg.audioBuffer, bounds, sampleRate, numSamplesToWrite);
      const wordGain = getWordLoudnessGain(seg.audioBuffer, bounds);

      // Sentence intonational dynamics: sentence starts with higher projection (+1.2 dB), decays smoothly
      const sentDynamics = Math.max(0.78, Math.min(1.15, 1.0 + seg.f0ShiftSemitones * 0.045));

      // Raised-cosine windowing for smooth legato inter-word liaison without clicks
      const attackSamples = Math.max(48, Math.min(Math.floor(sampleRate * 0.028), Math.floor(numSamplesToWrite * 0.14)));
      const releaseSamples = attackSamples; // equal ramps sum to unity across the word overlap

      for (let j = 0; j < numSamplesToWrite; j++) {
        const outIdx = seg.startSample + j;
        if (outIdx >= outData.length) break;

        let sample = proc[j] ?? 0;

        // Anti-click raised-cosine smoothing (Hanning curves for zero-derivative continuity)
        if (j < attackSamples) {
          const t = j / attackSamples;
          sample *= 0.5 * (1 - Math.cos(Math.PI * t));
        } else if (j > numSamplesToWrite - releaseSamples) {
          const t = (numSamplesToWrite - j) / releaseSamples;
          sample *= 0.5 * (1 - Math.cos(Math.PI * t));
        }

        // Terminal Decrescendo before period: gentle settling volume envelope
        if (seg.isPrePeriodWord && seg.terminalPunctuation === '.') {
          const decrescendoStart = Math.floor(numSamplesToWrite * 0.65);
          if (j > decrescendoStart) {
            const decrescendoRatio = 1.0 - 0.28 * ((j - decrescendoStart) / (numSamplesToWrite - decrescendoStart));
            sample *= decrescendoRatio;
          }
        }

        outData[outIdx] += sample * 0.92 * sentDynamics * wordGain;
      }
    } else if (options.fallbackSynthesizer) {
      // Synthesize missing syllable via fallback DSP
      const dspSamples = options.fallbackSynthesizer(seg.syllable, sampleRate);
      const copyLen = Math.min(seg.lengthSamples, dspSamples.length);
      for (let j = 0; j < copyLen; j++) {
        const outIdx = seg.startSample + j;
        if (outIdx < outData.length) {
          outData[outIdx] += dspSamples[j] * 0.75;
        }
      }
    }
  }

  // Phase 3.5: Master Audio Conditioning (DC Removal, High-pass Filter & Distortion-Free Normalization)
  // 1. Remove DC bias across the entire stitched track
  let dcSum = 0;
  for (let i = 0; i < outData.length; i++) dcSum += outData[i];
  const dcOffset = dcSum / (outData.length || 1);
  for (let i = 0; i < outData.length; i++) outData[i] -= dcOffset;

  // 2. High-pass DC-blocking filter (~35Hz) to strip rumble and prevent speaker popping
  let prevIn = 0;
  let prevOut = 0;
  const hpR = 0.995;
  for (let i = 0; i < outData.length; i++) {
    const curIn = outData[i];
    const curOut = curIn - prevIn + hpR * prevOut;
    prevIn = curIn;
    prevOut = curOut;
    outData[i] = curOut;
  }

  // 3. Distortion-free studio mastering: linear peak scaling to -1.0 dBFS (0.891)
  let maxPeak = 0;
  for (let i = 0; i < outData.length; i++) {
    const abs = Math.abs(outData[i]);
    if (abs > maxPeak) maxPeak = abs;
  }

  if (maxPeak > 0.0001) {
    const targetPeak = 0.891;
    const cleanGain = Math.min(3.0, targetPeak / maxPeak);
    for (let i = 0; i < outData.length; i++) {
      let s = outData[i] * cleanGain;
      // Transparent soft knee only at the extreme ceiling to avoid harsh square clipping
      if (s > 0.92) {
        s = 0.92 + 0.08 * Math.tanh((s - 0.92) / 0.08);
      } else if (s < -0.92) {
        s = -0.92 + 0.08 * Math.tanh((s + 0.92) / 0.08);
      }
      outData[i] = s;
    }
  }

  // Phase 4: Build Exact Syllable Alignment Metadata for Live Reading & Karaoke Display
  const alignment: SyllableAlignmentMetadata[] = segments.map((seg, index) => {
    const syl = seg.syllable;
    const startSec = seg.startSample / sampleRate;
    const endSec = (seg.startSample + seg.lengthSamples) / sampleRate;
    const durationMs = Math.round(seg.durationSec * 1000);

    return {
      index,
      token: syl.raw,
      clean: syl.clean,
      isPunctuation: Boolean(syl.isPunctuation),
      timeStartSec: parseFloat(startSec.toFixed(4)),
      timeEndSec: parseFloat(endSec.toFixed(4)),
      durationMs,
      sampleStart: seg.startSample,
      sampleEnd: seg.startSample + seg.lengthSamples,
      phonetics: {
        onset: syl.onset,
        onsetIpa: syl.onset ? `[${syl.onset}]` : '∅',
        vowel: syl.vowel,
        vowelIpa: `[${syl.vowel}]`,
        toneLetter: syl.toneLetter || 'unmarked',
        toneName: syl.tone.name,
        chaoNumber: syl.tone.chaoNumber,
        toneIpa: syl.tone.ipaDiacritic,
        fullIpa: syl.ipa,
        isNasal: syl.formants.isNasal,
        isDiphthong: syl.formants.isDiphthong,
      },
      acoustics: {
        f1StartHz: Math.round(syl.formants.f1Start),
        f2StartHz: Math.round(syl.formants.f2Start),
        f3StartHz: Math.round(syl.formants.f3Start),
        f1EndHz: Math.round(syl.formants.f1End),
        f2EndHz: Math.round(syl.formants.f2End),
        f3EndHz: Math.round(syl.formants.f3End),
        pitchContour: syl.pitchTrajectory,
        declinationSemitones: seg.f0ShiftSemitones,
      },
    };
  });

  const totalDuration = currentSampleOffset / sampleRate;
  const coverageRatio = totalWordsCount > 0 ? nativeCount / totalWordsCount : 1.0;

  return {
    buffer: masterBuffer,
    alignment,
    totalDuration,
    nativeCount,
    totalCount: totalWordsCount,
    coverageRatio,
  };
}

/** Words in `text` that have neither a dictionary recording nor a user recording. */
export async function findMissingWords(text: string, dialect: HmongDialect, audioCtx: AudioContext): Promise<string[]> {
  const words = parseHmongText(text, dialect)
    .filter((s) => !s.isPunctuation)
    .map((s) => (s.clean || s.raw).replace(/[^a-zA-Z0-9]/g, '').toLowerCase())
    .filter(Boolean);
  const found = await preloadNativeWordsBatch(words, audioCtx);
  return Array.from(new Set(words)).filter((w) => !found.has(w));
}

/** Decode and cache a freshly recorded word so the next synthesis uses it immediately. */
export async function registerRecordedWord(word: string, blob: Blob, audioCtx: AudioContext) {
  decodedBufferCache.set(word.replace(/[^a-zA-Z0-9]/g, '').toLowerCase(), await audioCtx.decodeAudioData(await blob.arrayBuffer()));
}

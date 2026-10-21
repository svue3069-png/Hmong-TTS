/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Optional neural Hmong backend (Orpheus-Hmong via the local neural/orpheus_server.py sidecar).
 * Returns null when the sidecar is unavailable so callers fall back to recorded-word playback.
 */

import { HmongDialect, parseHmongText, SyllableDecomposition } from './hmongPhonology';
import type { SyllableAlignmentMetadata } from './hmongAudioSynthesizer';

export async function isOrpheusAvailable(): Promise<boolean> {
  try {
    const r = await fetch('/api/tts/neural/status');
    return r.ok && (await r.json()).available === true;
  } catch {
    return false;
  }
}

const MAX_NEURAL_REQUEST_LENGTH = 300;
const INTER_SENTENCE_PAUSE_SEC = 0.62;

function splitNeuralText(text: string): string[] {
  if (text.length <= MAX_NEURAL_REQUEST_LENGTH) return [text];

  const sentences = text.match(/[^.!?。！？]+[.!?。！？]*/g) ?? [text];
  const chunks: string[] = [];
  let current = '';
  for (const sentence of sentences) {
    const candidate = current ? `${current} ${sentence.trim()}` : sentence.trim();
    if (candidate.length > MAX_NEURAL_REQUEST_LENGTH && current) {
      chunks.push(current);
      current = sentence.trim();
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

export async function renderOrpheus(
  text: string,
  dialect: HmongDialect,
  ctx: AudioContext
): Promise<{
  buffer: AudioBuffer;
  syllables: SyllableDecomposition[];
  alignment: SyllableAlignmentMetadata[];
  totalDuration: number;
} | null> {
  const chunks = splitNeuralText(text);
  if (chunks.length === 0) return null;

  const parts: { data: Float32Array; syllables: SyllableDecomposition[] }[] = [];
  for (const chunk of chunks) {
    const res = await fetch('/api/tts/neural', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: chunk }),
    });
    if (!res.ok) return null; // sidecar down or failed: caller falls back
    // decodeAudioData resamples the model's 24 kHz output to the context rate
    const decoded = await ctx.decodeAudioData(await res.arrayBuffer());
    parts.push({ data: decoded.getChannelData(0).slice(), syllables: parseHmongText(chunk, dialect) });
  }

  const sr = ctx.sampleRate;
  const gap = Math.floor(sr * INTER_SENTENCE_PAUSE_SEC);
  const total = parts.reduce((n, p, i) => n + p.data.length + (i < parts.length - 1 ? gap : 0), 0);
  const buffer = ctx.createBuffer(1, total, sr);
  const out = buffer.getChannelData(0);

  const alignment: SyllableAlignmentMetadata[] = [];
  const syllables: SyllableDecomposition[] = [];
  let pos = 0;
  for (let partIndex = 0; partIndex < parts.length; partIndex++) {
    const p = parts[partIndex];
    const partGap = partIndex < parts.length - 1 ? gap : 0;
    const partLength = p.data.length + partGap;
    out.set(p.data, pos);
    // Per-word timings are estimated (no aligner): split the clip by token length.
    const weights = p.syllables.map((s) => (s.isPunctuation ? 0.5 : Math.max(1, s.raw.length)));
    const wsum = weights.reduce((a, b) => a + b, 0) || 1;
    let t = pos;
    p.syllables.forEach((syl, i) => {
      const len = Math.floor((weights[i] / wsum) * partLength);
      alignment.push({
        index: alignment.length,
        token: syl.raw,
        clean: syl.clean,
        isPunctuation: Boolean(syl.isPunctuation),
        timeStartSec: t / sr,
        timeEndSec: (t + len) / sr,
        durationMs: Math.round((len / sr) * 1000),
        sampleStart: t,
        sampleEnd: t + len,
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
          declinationSemitones: 0,
        },
      });
      syllables.push(syl);
      t += len;
    });
    pos += partLength;
  }
  return { buffer, syllables, alignment, totalDuration: total / sr };
}

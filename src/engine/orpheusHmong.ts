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

const PAUSE_SEC = 0.3;

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
  const sentences = (text.match(/[^.!?]+[.!?]*/g) ?? []).map((s) => s.trim()).filter(Boolean);
  if (sentences.length === 0) return null;

  const parts: { data: Float32Array; syllables: SyllableDecomposition[] }[] = [];
  for (const s of sentences) {
    const res = await fetch('/api/tts/neural', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: s }),
    });
    if (!res.ok) return null; // sidecar down or failed: caller falls back
    // decodeAudioData resamples the model's 24 kHz output to the context rate
    const decoded = await ctx.decodeAudioData(await res.arrayBuffer());
    parts.push({ data: decoded.getChannelData(0).slice(), syllables: parseHmongText(s, dialect) });
  }

  const sr = ctx.sampleRate;
  const gap = Math.floor(sr * PAUSE_SEC);
  const total = parts.reduce((n, p) => n + p.data.length + gap, 0);
  const buffer = ctx.createBuffer(1, total, sr);
  const out = buffer.getChannelData(0);

  const alignment: SyllableAlignmentMetadata[] = [];
  const syllables: SyllableDecomposition[] = [];
  let pos = 0;
  for (const p of parts) {
    out.set(p.data, pos);
    // Per-word timings are estimated (no aligner): split the clip by token length.
    const weights = p.syllables.map((s) => (s.isPunctuation ? 0.5 : Math.max(1, s.raw.length)));
    const wsum = weights.reduce((a, b) => a + b, 0) || 1;
    let t = pos;
    p.syllables.forEach((syl, i) => {
      const len = Math.floor((weights[i] / wsum) * (p.data.length + gap));
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
    pos += p.data.length + gap;
  }
  return { buffer, syllables, alignment, totalDuration: total / sr };
}

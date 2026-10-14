/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Mixed-language rendering: even when a Hmong dialect is selected, English words/phrases are
 * auto-detected and spoken with the neural English voice, then stitched into one track.
 */

import { classifyWord, detectLanguage } from './languageDetector';
import { renderEnglish } from './neuralEnglish';

export interface AlignItem { index: number; token: string; clean: string; timeStartSec: number; timeEndSec: number; durationMs: number }
export interface Rendered { buffer: AudioBuffer; alignment: AlignItem[]; totalDuration: number }

/**
 * Split text into consecutive runs of English vs. Hmong. Each sentence is classified as a whole first
 * (more reliable than single words); only sentences detected as mixed fall back to word-level routing.
 */
export function splitLanguageRuns(text: string): { lang: 'english' | 'hmong'; text: string }[] {
  const runs: { lang: 'english' | 'hmong'; text: string }[] = [];
  const push = (lang: 'english' | 'hmong', t: string) => {
    if (runs.at(-1)?.lang === lang) runs.at(-1)!.text += ' ' + t;
    else runs.push({ lang, text: t });
  };
  for (const sentence of text.match(/[^.!?]+[.!?]*/g) ?? []) {
    const sent = sentence.trim();
    if (!sent) continue;
    const d = detectLanguage(sent).language;
    if (d === 'english' || d === 'hmong') {
      push(d, sent);
      continue;
    }
    for (const tok of sent.split(/\s+/)) {
      const c = classifyWord(tok.replace(/[^\p{L}\p{N}]/gu, '')).lang;
      push(c === 'english' ? 'english' : c === 'hmong' ? 'hmong' : runs.at(-1)?.lang ?? 'hmong', tok);
    }
  }
  return runs;
}

function resample(src: Float32Array, from: number, to: number): Float32Array {
  if (from === to) return src;
  const out = new Float32Array(Math.floor((src.length * to) / from));
  for (let i = 0; i < out.length; i++) {
    const p = (i * from) / to, k = Math.floor(p), f = p - k;
    out[i] = src[k] * (1 - f) + (src[k + 1] ?? src[k]) * f;
  }
  return out;
}

export async function renderMixed(
  text: string,
  rate: number,
  renderHmong: (t: string) => Promise<Rendered>
): Promise<Rendered | null> {
  const runs = splitLanguageRuns(text);
  if (!runs.some((r) => r.lang === 'english')) return null; // pure Hmong: caller uses the normal path

  const parts: { data: Float32Array; sr: number; alignment: AlignItem[] }[] = [];
  for (const run of runs) {
    if (run.lang === 'english') {
      const r = await renderEnglish(run.text, rate);
      parts.push({ data: r.buffer.getChannelData(0), sr: r.buffer.sampleRate, alignment: r.alignment });
    } else {
      const r = await renderHmong(run.text);
      parts.push({ data: r.buffer.getChannelData(0), sr: r.buffer.sampleRate, alignment: r.alignment });
    }
  }

  const sr = Math.max(...parts.map((p) => p.sr));
  const gap = new Float32Array(Math.floor(sr * 0.12)); // short breath between language switches
  const chunks: Float32Array[] = [];
  const alignment: AlignItem[] = [];
  let offset = 0;
  for (const p of parts) {
    const data = resample(p.data, p.sr, sr);
    for (const a of p.alignment) {
      alignment.push({ ...a, index: alignment.length, timeStartSec: a.timeStartSec + offset, timeEndSec: a.timeEndSec + offset });
    }
    chunks.push(data, gap);
    offset += (data.length + gap.length) / sr;
  }
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const buffer = new AudioBuffer({ length: total, sampleRate: sr, numberOfChannels: 1 });
  const out = new Float32Array(total);
  let pos = 0;
  for (const c of chunks) { out.set(c, pos); pos += c.length; }
  buffer.copyToChannel(out, 0);
  return { buffer, alignment, totalDuration: total / sr };
}

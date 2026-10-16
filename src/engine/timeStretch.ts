/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Pitch-preserving time-scale modification (WSOLA) and linear sample-rate conversion.
 * Resampling to change duration also shifts pitch, which corrupts Hmong tones; WSOLA changes duration only.
 */

/** Linear resample (pitch-neutral when the output is played at the new rate). */
export function resampleLinear(x: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) return x;
  const out = new Float32Array(Math.max(1, Math.round((x.length * toRate) / fromRate)));
  const step = fromRate / toRate;
  for (let i = 0; i < out.length; i++) {
    const p = i * step;
    const k = Math.floor(p);
    const f = p - k;
    out[i] = x[k] * (1 - f) + (x[k + 1] ?? x[k]) * f;
  }
  return out;
}

/**
 * Waveform-similarity overlap-add. ratio = outputLength / inputLength (<1 speeds up, >1 slows down).
 * Pitch and formants are unchanged.
 */
export function timeStretch(x: Float32Array, ratio: number, sampleRate: number): Float32Array {
  const target = Math.max(1, Math.round(x.length * ratio));
  const frame = Math.max(64, Math.floor(sampleRate * 0.03)) & ~1; // 30 ms
  if (Math.abs(ratio - 1) < 0.01 || x.length < frame * 3) return fit(x, target);

  const hopOut = frame >> 1;
  const hopIn = hopOut / ratio;
  const search = Math.floor(sampleRate * 0.008); // +/- 8 ms alignment search
  const win = new Float32Array(frame);
  for (let i = 0; i < frame; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * (i + 0.5)) / frame);

  const out = new Float32Array(target + frame);
  const norm = new Float32Array(target + frame);
  let prev = 0;
  for (let k = 0; ; k++) {
    const outPos = k * hopOut;
    if (outPos >= target) break;
    let pos = Math.round(k * hopIn);
    if (k > 0) {
      const nat = prev + hopOut; // where the previous frame would continue naturally
      let best = pos;
      let bestC = -Infinity;
      for (let d = -search; d <= search; d += 2) {
        const c = pos + d;
        if (c < 0 || c + frame > x.length || nat + frame > x.length) continue;
        let s = 0;
        for (let i = 0; i < frame; i += 4) s += x[c + i] * x[nat + i];
        if (s > bestC) { bestC = s; best = c; }
      }
      pos = best;
    }
    if (pos + frame > x.length) pos = Math.max(0, x.length - frame);
    for (let i = 0; i < frame; i++) {
      out[outPos + i] += x[pos + i] * win[i];
      norm[outPos + i] += win[i];
    }
    prev = pos;
  }
  for (let i = 0; i < out.length; i++) if (norm[i] > 1e-3) out[i] /= norm[i];
  return fit(out, target);
}

function fit(x: Float32Array, len: number): Float32Array {
  if (x.length === len) return x;
  const out = new Float32Array(len);
  out.set(x.subarray(0, Math.min(len, x.length)));
  return out;
}

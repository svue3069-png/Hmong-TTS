// Run: npx tsx src/engine/timeStretch.test.ts
import assert from 'node:assert/strict';
import { timeStretch } from './timeStretch';

const sr = 44100;

/** Dominant period via autocorrelation (samples) in the 70-400 Hz range. */
function period(x: Float32Array): number {
  let best = 0, bestC = -Infinity;
  for (let lag = Math.floor(sr / 400); lag <= Math.floor(sr / 70); lag++) {
    let s = 0;
    for (let i = 0; i + lag < x.length; i++) s += x[i] * x[i + lag];
    if (s > bestC) { bestC = s; best = lag; }
  }
  return best;
}

// Voiced-like signal: 150 Hz fundamental + harmonics, 0.5 s
const x = new Float32Array(sr / 2);
for (let i = 0; i < x.length; i++) for (let h = 1; h <= 5; h++) x[i] += Math.sin((2 * Math.PI * 150 * h * i) / sr) / h;

for (const ratio of [0.65, 0.8, 1.25]) {
  const y = timeStretch(x, ratio, sr);
  assert.equal(y.length, Math.round(x.length * ratio), `length for ratio ${ratio}`);
  const p0 = period(x), p1 = period(y.subarray(2000, y.length - 2000));
  assert.ok(Math.abs(p1 - p0) <= 2, `pitch preserved at ratio ${ratio}: period ${p0} -> ${p1}`);
  assert.ok(y.every(Number.isFinite), 'no NaN');
}
console.log('timeStretch OK: length and pitch preserved');

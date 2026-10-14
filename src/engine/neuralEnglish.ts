/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Neural English TTS (Kokoro-82M, runs in the browser via ONNX/WASM; model is cached after first load,
 * so it works offline). Replaces the Hmong formant synthesizer for English text.
 */

type Kokoro = { generate: (t: string, o: { voice: string; speed: number }) => Promise<{ audio: Float32Array; sampling_rate: number }> };

let loading: Promise<Kokoro> | null = null;

function load(): Promise<Kokoro> {
  loading ??= import('kokoro-js')
    .then(({ KokoroTTS }) =>
      KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', { dtype: 'q8', device: 'wasm' })
    )
    .catch((e) => {
      loading = null; // allow retry after a failed download
      throw e;
    }) as Promise<Kokoro>;
  return loading;
}

export interface EnglishRender {
  buffer: AudioBuffer;
  durationSec: number;
  alignment: { index: number; token: string; clean: string; timeStartSec: number; timeEndSec: number; durationMs: number }[];
}

export async function renderEnglish(text: string, rate = 1.0, voice = 'af_heart'): Promise<EnglishRender> {
  const tts = await load();
  const { audio, sampling_rate } = await tts.generate(text, { voice, speed: rate });
  const buffer = new AudioBuffer({ length: audio.length, sampleRate: sampling_rate, numberOfChannels: 1 });
  buffer.copyToChannel(audio as Float32Array<ArrayBuffer>, 0);
  const durationSec = audio.length / sampling_rate;

  // Word timings: Kokoro gives no alignment, so split the real duration by word length (+ pause weight at punctuation)
  const words = text.split(/\s+/).filter(Boolean);
  const weights = words.map((w) => w.length + (/[.!?]$/.test(w) ? 4 : /[,;:]$/.test(w) ? 2 : 0));
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  let t = 0;
  const alignment = words.map((w, index) => {
    const start = t;
    t += (weights[index] / total) * durationSec;
    return { index, token: w, clean: w.replace(/[^a-zA-Z]/g, ''), timeStartSec: start, timeEndSec: t, durationMs: Math.round((t - start) * 1000) };
  });
  return { buffer, durationSec, alignment };
}

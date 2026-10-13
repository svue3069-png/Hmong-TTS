/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Hmong Acoustic Speech Synthesizer (Pure Client-Side DSP)
 * Low-latency (<15ms), 100% offline, cross-platform Web Audio API synthesis.
 */

import {
  HmongDialect,
  parseHmongText,
  SyllableDecomposition,
  getOnsetIpa,
  HMONG_VOWELS,
} from './hmongPhonology';
import { applyNativeProsody } from './nativePronunciation';
import { assembleNativeHmongTrack } from './hmongNativeAudio';

export interface SyllableAlignmentMetadata {
  index: number;
  token: string;
  clean: string;
  isPunctuation: boolean;
  timeStartSec: number;
  timeEndSec: number;
  durationMs: number;
  sampleStart: number;
  sampleEnd: number;
  phonetics: {
    onset: string;
    onsetIpa: string;
    vowel: string;
    vowelIpa: string;
    toneLetter: string;
    toneName: string;
    chaoNumber: string;
    toneIpa: string;
    fullIpa: string;
    isNasal: boolean;
    isDiphthong: boolean;
  };
  acoustics: {
    f1StartHz: number;
    f2StartHz: number;
    f3StartHz: number;
    f1EndHz: number;
    f2EndHz: number;
    f3EndHz: number;
    pitchContour: number[];
    declinationSemitones: number;
  };
}

export interface SynthesisMetadataExport {
  app: string;
  version: string;
  generatedAt: string;
  text: string;
  dialect: HmongDialect;
  dialectName: string;
  voice: {
    id: string;
    name: string;
    gender: string;
    baseF0Hz: number;
    vocalTractLength: number;
    description: string;
  };
  acousticSettings: {
    rate: number;
    pitch: number;
    toneEmphasis: number;
    prosody: number;
  };
  audioMetrics: {
    totalDurationSec: number;
    totalDurationMs: number;
    sampleRate: number;
    channels: number;
    totalSamples: number;
    syllableCount: number;
    wordCount: number;
  };
  alignment: SyllableAlignmentMetadata[];
}

export interface VoiceProfile {
  id: string;
  name: string;
  dialect: HmongDialect;
  gender: 'female' | 'male';
  baseF0: number; // Hz (e.g., 220 for female, 135 for male)
  pitchMultiplier: number;
  speedMultiplier: number;
  creakIntensity: number;
  breathyIntensity: number;
  toneExaggeration: number; // 1.0 = natural, 1.5 = learner/exaggerated
  vocalTractLength: number; // formant scaling factor (0.9 = higher, 1.1 = deeper)
  description: string;
}

export const HMONG_VOICE_PROFILES: VoiceProfile[] = [
  {
    id: 'paj_dawb_female',
    name: 'Paj (Hmoob Dawb)',
    dialect: 'dawb',
    gender: 'female',
    baseF0: 225,
    pitchMultiplier: 1.0,
    speedMultiplier: 1.0,
    creakIntensity: 0.85,
    breathyIntensity: 0.8,
    toneExaggeration: 1.0,
    vocalTractLength: 0.95,
    description: 'Clear, melodic natural female voice in standard White Hmong.',
  },
  {
    id: 'ntxoov_dawb_male',
    name: 'Ntxoov (Hmoob Dawb)',
    dialect: 'dawb',
    gender: 'male',
    baseF0: 135,
    pitchMultiplier: 1.0,
    speedMultiplier: 1.0,
    creakIntensity: 0.9,
    breathyIntensity: 0.75,
    toneExaggeration: 1.0,
    vocalTractLength: 1.08,
    description: 'Deep, resonant natural male voice in standard White Hmong.',
  },
  {
    id: 'mee_leeg_female',
    name: 'Mee (Moob Leeg)',
    dialect: 'leeg',
    gender: 'female',
    baseF0: 230,
    pitchMultiplier: 1.0,
    speedMultiplier: 1.0,
    creakIntensity: 0.85,
    breathyIntensity: 0.8,
    toneExaggeration: 1.0,
    vocalTractLength: 0.96,
    description: 'Crisp, articulate female voice speaking authentic Green/Mong Leng.',
  },
  {
    id: 'koob_leeg_male',
    name: 'Koob (Moob Leeg)',
    dialect: 'leeg',
    gender: 'male',
    baseF0: 130,
    pitchMultiplier: 1.0,
    speedMultiplier: 1.0,
    creakIntensity: 0.9,
    breathyIntensity: 0.8,
    toneExaggeration: 1.0,
    vocalTractLength: 1.1,
    description: 'Authoritative male voice with native Green Hmong lateral phonology.',
  },
  {
    id: 'kaub_storyteller',
    name: 'Yawg Kaub (Txwj Laug)',
    dialect: 'dawb',
    gender: 'male',
    baseF0: 120,
    pitchMultiplier: 0.92,
    speedMultiplier: 0.88,
    creakIntensity: 1.1,
    breathyIntensity: 0.9,
    toneExaggeration: 1.2,
    vocalTractLength: 1.12,
    description: 'Elder storyteller voice tuned for traditional Hmong kwv txhiaj & dab neeg.',
  },
];

export interface SynthesisOptions {
  voice?: VoiceProfile;
  rate?: number; // 0.5 - 2.0
  pitch?: number; // 0.7 - 1.5
  volume?: number; // 0.0 - 1.0
  toneEmphasis?: number; // 0.8 - 1.6
  prosody?: number; // 0.0 (rigid metronome) to 2.0 (expressive human rubato & pitch micro-variation)
  audioSource?: 'hmongdictionary_native' | 'hmong_dsp';
  onStart?: () => void;
  onSyllable?: (index: number, syllable: SyllableDecomposition) => void;
  onEnd?: () => void;
  onError?: (err: Error) => void;
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export class HmongAcousticEngine {
  private ctx: AudioContext | null = null;
  private isSpeaking = false;
  private currentSource: AudioBufferSourceNode | null = null;
  private currentGainNode: GainNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private animationFrameId: number | null = null;
  private activeTimers: number[] = [];

  constructor() {
    // Lazy AudioContext initialization on first user interaction
  }

  private getAudioContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx({ sampleRate: 44100 });
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  public getAnalyser(): AnalyserNode | null {
    return this.analyserNode;
  }

  public stop(): void {
    this.activeTimers.forEach(id => clearTimeout(id));
    this.activeTimers = [];

    // Smooth gain ramp-down (15ms) prevents popping clicks when stopping
    if (this.currentGainNode && this.ctx) {
      try {
        const curTime = this.ctx.currentTime;
        this.currentGainNode.gain.cancelScheduledValues(curTime);
        this.currentGainNode.gain.setValueAtTime(this.currentGainNode.gain.value, curTime);
        this.currentGainNode.gain.linearRampToValueAtTime(0, curTime + 0.015);
      } catch (_) {}
    }

    if (this.currentSource) {
      const src = this.currentSource;
      window.setTimeout(() => {
        try {
          src.stop();
          src.disconnect();
        } catch (_) {}
      }, 18);
      this.currentSource = null;
    }
    this.currentGainNode = null;
    this.isSpeaking = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  public isBusy(): boolean {
    return this.isSpeaking;
  }

  /**
   * Synthesizes Hmong text to an in-memory AudioBuffer completely offline with zero network calls.
   */
  public async renderToAudioBuffer(
    text: string,
    dialect: HmongDialect = 'dawb',
    options: SynthesisOptions = {}
  ): Promise<{
    buffer: AudioBuffer;
    syllables: SyllableDecomposition[];
    alignment: SyllableAlignmentMetadata[];
    totalDuration: number;
  }> {
    const ctx = this.getAudioContext();
    const voice = options.voice || HMONG_VOICE_PROFILES[0];
    const rate = (options.rate || 1.0) * voice.speedMultiplier;
    const pitch = (options.pitch || 1.0) * voice.pitchMultiplier;
    const toneScale = (options.toneEmphasis || 1.0) * voice.toneExaggeration;

    const prosody = options.prosody !== undefined ? options.prosody : 1.0;

    const rawSyllables = parseHmongText(text, dialect);
    const validCount = rawSyllables.filter(s => !s.isPunctuation).length;
    let wordCounter = 0;
    const syllables = rawSyllables.map((s) => {
      if (s.isPunctuation) return s;
      const opt = applyNativeProsody(s, dialect, wordCounter, validCount);
      wordCounter++;
      return opt;
    });

    // 1. Primary Engine: Authentic Native Recorded Audio from HmongDictionary.com & Hmong Voice Archives
    if (options.audioSource !== 'hmong_dsp') {
      try {
        const nativeResult = await assembleNativeHmongTrack(text, dialect, ctx, {
          rate,
          prosody,
          fallbackSynthesizer: (syl, sr) => {
            const tempBuffer = new Float32Array(Math.floor((sr * (syl.durationMs / 1000)) / rate));
            this.synthesizeSyllableAudio(
              tempBuffer,
              0,
              tempBuffer.length,
              syl,
              voice.baseF0 * pitch,
              sr,
              voice,
              toneScale,
              voice.vocalTractLength,
              0,
              prosody
            );
            return tempBuffer;
          },
        });

        if (nativeResult.nativeCount > 0 || nativeResult.totalCount === 0) {
          return {
            buffer: nativeResult.buffer,
            syllables,
            alignment: nativeResult.alignment,
            totalDuration: nativeResult.totalDuration,
          };
        }
      } catch (nativeErr) {
        console.warn('Native speech assembly note, using DSP fallback:', nativeErr);
      }
    }

    const sampleRate = ctx.sampleRate;

    // Calculate total duration in samples with dynamic prosody variations
    let totalSamples = Math.floor(sampleRate * 0.05); // 50ms initial silence
    const syllableSampleRanges: Array<{
      start: number;
      length: number;
      syllable: SyllableDecomposition;
      declination: number;
    }> = [];

    const totalValid = syllables.filter(s => !s.isPunctuation).length;
    let activeSylIdx = 0;

    for (let i = 0; i < syllables.length; i++) {
      const syl = syllables[i];
      const nextSyl = syllables[i + 1];
      const isClauseBoundary = !nextSyl || nextSyl.isPunctuation;

      let durationSec = 0;
      if (syl.isPunctuation) {
        const punct = syl.raw;
        let pauseSec = 0.34;
        if (punct === '.' || punct === '。') {
          pauseSec = 0.78; // STOP AT PERIOD
        } else if (punct === '?' || punct === '？') {
          pauseSec = 0.75; // QUESTION STOP
        } else if (punct === '!' || punct === '！') {
          pauseSec = 0.72; // EXCLAMATION STOP
        } else if (punct === ',' || punct === ';' || punct === ':') {
          pauseSec = 0.34;
        } else if (punct === '-') {
          pauseSec = 0.20;
        }
        durationSec = pauseSec / rate;
      } else {
        durationSec = (syl.durationMs / 1000) / rate;
      }
      let pitchInflection = 0;

      if (!syl.isPunctuation) {
        const wordHash = hashString(syl.clean || syl.raw);
        const pseudoRand = ((wordHash + activeSylIdx * 19) % 100) / 100 - 0.5; // -0.5 to +0.5

        // 1. Per-Syllable Timing Micro-Variations:
        // Pre-pausal lengthening (+18% * prosody at boundary)
        let timingMod = 1.0;
        if (isClauseBoundary) {
          timingMod += 0.18 * prosody;
        }

        // Syllable weight adjustments (diphthongs & consonant clusters take more human articulatory time)
        if (syl.formants.isDiphthong) {
          timingMod += 0.09 * prosody;
        }
        if (syl.onset.length >= 2) {
          timingMod += 0.06 * prosody;
        }

        // Natural elastic tempo rubato (+/- 14% * prosody)
        timingMod += pseudoRand * 0.28 * prosody;
        durationSec *= Math.max(0.65, Math.min(1.45, timingMod));

        // 2. Per-Syllable Pitch Micro-Variations:
        // Subtle micro-pitch inflection (+/- 0.85 semitones * prosody) mimicking vocal cord micro-adjustments
        pitchInflection = (((wordHash * 37 + activeSylIdx * 13) % 100) / 100 - 0.5) * 1.7 * prosody;
      }

      const sylSamples = Math.floor(sampleRate * durationSec);
      
      // Phrase-level declination (-1.5 semitones downward slope across long clauses) + micro-inflection
      const baseDeclination = totalValid > 1
        ? 1.2 - (activeSylIdx / (totalValid - 1)) * 2.2
        : 0;
      const declinationSemitones = baseDeclination * Math.min(1.5, prosody) + pitchInflection;

      syllableSampleRanges.push({
        start: totalSamples,
        length: sylSamples,
        syllable: syl,
        declination: declinationSemitones,
      });

      if (!syl.isPunctuation) activeSylIdx++;

      totalSamples += sylSamples;

      // Fluid co-articulation gap between words with organic micro-timing fluctuations
      const wordGapRand = (((hashString(syl.raw) + activeSylIdx * 7) % 50) / 50 - 0.5);
      const gapSeconds = syl.isPunctuation
        ? 0.08
        : Math.max(0.008, 0.016 + wordGapRand * 0.014 * prosody);
      totalSamples += Math.floor(sampleRate * gapSeconds);
    }
    totalSamples += Math.floor(sampleRate * 0.1); // trailing padding

    // Create offline audio buffer
    const audioBuffer = ctx.createBuffer(1, totalSamples, sampleRate);
    const channelData = audioBuffer.getChannelData(0);

    const baseF0 = voice.baseF0 * pitch;
    const vtl = voice.vocalTractLength;

    // Synthesize each syllable into the buffer
    for (const range of syllableSampleRanges) {
      const syl = range.syllable;
      if (syl.isPunctuation) continue;

      this.synthesizeSyllableAudio(
        channelData,
        range.start,
        range.length,
        syl,
        baseF0,
        sampleRate,
        voice,
        toneScale,
        vtl,
        range.declination,
        prosody
      );
    }

    // Master Audio Conditioning: DC bias removal, 35Hz rumble filter, and distortion-free linear normalization
    let dcSum = 0;
    for (let i = 0; i < channelData.length; i++) dcSum += channelData[i];
    const dcMean = dcSum / (channelData.length || 1);
    for (let i = 0; i < channelData.length; i++) channelData[i] -= dcMean;

    let prevIn = 0;
    let prevOut = 0;
    const hpR = 0.995;
    for (let i = 0; i < channelData.length; i++) {
      const curIn = channelData[i];
      const curOut = curIn - prevIn + hpR * prevOut;
      prevIn = curIn;
      prevOut = curOut;
      channelData[i] = curOut;
    }

    let maxPeak = 0;
    for (let i = 0; i < channelData.length; i++) {
      const absVal = Math.abs(channelData[i]);
      if (absVal > maxPeak) maxPeak = absVal;
    }
    if (maxPeak > 0.0001) {
      const targetGain = Math.min(3.0, 0.891 / maxPeak);
      for (let i = 0; i < channelData.length; i++) {
        let s = channelData[i] * targetGain;
        if (s > 0.92) {
          s = 0.92 + 0.08 * Math.tanh((s - 0.92) / 0.08);
        } else if (s < -0.92) {
          s = -0.92 + 0.08 * Math.tanh((s + 0.92) / 0.08);
        }
        channelData[i] = s;
      }
    }

    // Accurate sample & timing alignment calculation for developer verification
    const alignment: SyllableAlignmentMetadata[] = syllableSampleRanges.map((range, index) => {
      const syl = range.syllable;
      const startSec = range.start / sampleRate;
      const endSec = (range.start + range.length) / sampleRate;
      const durationMs = Math.round((range.length / sampleRate) * 1000);
      const onsetIpa = getOnsetIpa(syl.onset, dialect);
      const vowelIpa = HMONG_VOWELS[syl.vowel]?.ipa || syl.vowel;

      return {
        index,
        token: syl.raw,
        clean: syl.clean,
        isPunctuation: Boolean(syl.isPunctuation),
        timeStartSec: parseFloat(startSec.toFixed(4)),
        timeEndSec: parseFloat(endSec.toFixed(4)),
        durationMs,
        sampleStart: range.start,
        sampleEnd: range.start + range.length,
        phonetics: {
          onset: syl.onset,
          onsetIpa,
          vowel: syl.vowel,
          vowelIpa,
          toneLetter: syl.toneLetter || 'unmarked',
          toneName: syl.tone.name,
          chaoNumber: syl.tone.chaoNumber,
          toneIpa: syl.tone.ipaDiacritic,
          fullIpa: syl.ipa || (syl.isPunctuation ? '' : `[${onsetIpa}${vowelIpa}${syl.tone.ipaDiacritic}]`),
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
          declinationSemitones: parseFloat(range.declination.toFixed(2)),
        },
      };
    });

    return {
      buffer: audioBuffer,
      syllables,
      alignment,
      totalDuration: totalSamples / sampleRate,
    };
  }

  /**
   * Internal Acoustic DSP synthesizer for a single Hmong syllable with authentic native phonetics
   */
  private synthesizeSyllableAudio(
    output: Float32Array,
    startSample: number,
    numSamples: number,
    syllable: SyllableDecomposition,
    baseF0: number,
    sampleRate: number,
    voice: VoiceProfile,
    toneScale: number,
    vtl: number,
    declinationSemitones = 0,
    prosody = 1.0
  ) {
    const toneInfo = syllable.tone;
    const formants = syllable.formants;
    const onset = syllable.onset;

    // Filter states for formants
    let s1 = 0, s2 = 0; // r1
    let s3 = 0, s4 = 0; // r2
    let s5 = 0, s6 = 0; // r3
    let s7 = 0, s8 = 0; // r4
    let sn1 = 0, sn2 = 0; // nasal resonator
    let lpState = 0; // lowpass smoothing
    let hpState = 0; // aspiration highpass

    // Nasal pole resonator for nasal vowels or prenasalized onsets
    const isNasal = formants.isNasal || onset.startsWith('n') || onset.startsWith('m');
    const rNasal = isNasal ? this.calculateResonatorCoeffs(260 / vtl, 65, sampleRate) : null;

    // Onset consonant classification
    const isAspirated = onset.endsWith('h') || onset === 'ch' || onset === 'txh' || onset === 'tsh';
    const isFricative = onset === 's' || onset === 'x' || onset === 'z' || onset === 'f' || onset === 'v';
    const isStop = onset === 'p' || onset === 't' || onset === 'k' || onset === 'q' || onset === 'c' || onset === 'dl';
    const hasPrenasal = onset.startsWith('n') || onset.startsWith('m');

    // Consonant duration timing (in samples)
    const prevoicingSamples = hasPrenasal ? Math.floor(sampleRate * 0.045) : 0; // 45ms prenasal murmur
    const votSamples = isAspirated ? Math.floor(sampleRate * 0.055) : (isStop ? Math.floor(sampleRate * 0.012) : 0);
    const fricativeSamples = isFricative ? Math.floor(sampleRate * 0.065) : 0;
    const consonantDuration = Math.max(prevoicingSamples + votSamples, fricativeSamples);

    let phase = 0;
    let jitterWalk = 0;
    let prevPeriodCount = 0;

    // Cache resonator coefficients per block of 16 samples for dynamic formant transitions
    let curR1 = this.calculateResonatorCoeffs((formants.f1Start || 500) / vtl, 80, sampleRate);
    let curR2 = this.calculateResonatorCoeffs((formants.f2Start || 1500) / vtl, 110, sampleRate);
    let curR3 = this.calculateResonatorCoeffs((formants.f3Start || 2500) / vtl, 140, sampleRate);
    const curR4 = this.calculateResonatorCoeffs(3600 / vtl, 200, sampleRate);

    for (let i = 0; i < numSamples; i++) {
      const outIdx = startSample + i;
      if (outIdx >= output.length) break;

      const progress = i / numSamples;

      // 1. Dynamic Formant Trajectory Interpolation (Gliding Diphthongs)
      if (i % 16 === 0) {
        const vProgress = Math.min(1.0, Math.max(0.0, (i - consonantDuration) / Math.max(1, numSamples - consonantDuration)));
        const curF1 = (formants.f1Start * (1 - vProgress) + formants.f1End * vProgress) / vtl;
        const curF2 = (formants.f2Start * (1 - vProgress) + formants.f2End * vProgress) / vtl;
        const curF3 = (formants.f3Start * (1 - vProgress) + formants.f3End * vProgress) / vtl;
        curR1 = this.calculateResonatorCoeffs(curF1, 85, sampleRate);
        curR2 = this.calculateResonatorCoeffs(curF2, 115, sampleRate);
        curR3 = this.calculateResonatorCoeffs(curF3, 145, sampleRate);
      }

      // 2. Logarithmic Semitone F0 Pitch Contour Calculation
      const contour = syllable.pitchTrajectory;
      const cIdx = progress * (contour.length - 1);
      const cLower = Math.floor(cIdx);
      const cUpper = Math.min(cLower + 1, contour.length - 1);
      const cFrac = cIdx - cLower;
      const baseContour = contour[cLower] * (1 - cFrac) + contour[cUpper] * cFrac;

      // Apply Hmong tone exaggeration & micro-prosody jitter
      jitterWalk += (Math.random() - 0.5) * 0.003 * Math.max(0.2, prosody);
      jitterWalk = Math.max(-0.015, Math.min(0.015, jitterWalk));

      // Authentic Hmong Chao Tone Semitone Scale (~10.5 semitone dynamic pitch span)
      const toneSemitones = (baseContour - 0.5) * 9.8 * toneScale + declinationSemitones;

      // Physiological vocal micro-tremor (~5.2 Hz natural human vibrato modulation)
      const secElapsed = i / sampleRate;
      const microTremor = Math.sin(secElapsed * Math.PI * 2 * 5.2) * 0.009 * prosody;

      let curF0 = baseF0 * Math.pow(2, toneSemitones / 12) * (1 + jitterWalk + microTremor);

      // Phonation Modeling:
      // -m tone (Low creaky / vocal fry with abrupt glottal closure):
      let isCreakPeriod = false;
      if (toneInfo.letter === 'm' && progress > 0.35) {
        // Subharmonic period doubling for vocal fry
        const fryMod = Math.sin(phase * Math.PI) > 0 ? 0.88 : 1.12;
        curF0 *= (0.85 * fryMod);
        isCreakPeriod = true;
      }

      // -g tone (Falling breathy):
      if (toneInfo.letter === 'g') {
        curF0 *= (1.0 - progress * 0.18);
      }

      // Phase accumulation
      phase += curF0 / sampleRate;
      if (phase >= 1.0) {
        phase -= 1.0;
        prevPeriodCount++;
      }

      // 3. Glottal Pulse Generator (Liljencrants-Fant human vocal tract derivative)
      let glottalPulse = 0;
      if (i >= prevoicingSamples || hasPrenasal) {
        if (phase < 0.65) {
          // Open phase with smooth glottal flow
          const tRel = phase / 0.65;
          glottalPulse = Math.sin(tRel * Math.PI) * (1.0 - 0.3 * Math.cos(tRel * Math.PI * 2));
        } else {
          // Closing return phase with exponential recovery
          const tRel = (phase - 0.65) / 0.35;
          glottalPulse = -Math.sin(tRel * Math.PI) * 0.3 * Math.exp(-tRel * 3.5);
        }

        // Apply amplitude shimmer (natural vocal fold irregularity scaled with prosody)
        const shimmer = 1.0 + (Math.random() - 0.5) * 0.028 * Math.max(0.2, prosody);
        glottalPulse *= shimmer;

        // Breathy murmur for -g tone or breathy phonation
        if (toneInfo.letter === 'g') {
          const breathNoise = (Math.random() * 2 - 1) * 0.32 * voice.breathyIntensity;
          glottalPulse = glottalPulse * 0.68 + breathNoise;
        }
      }

      // 4. Consonant Articulation (Prenasal lead, Stop burst, Aspiration, Fricatives)
      let consonantSound = 0;

      // A. Prenasalized onset lead (e.g., 'nt', 'np', 'nk', 'nq')
      if (hasPrenasal && i < prevoicingSamples) {
        const prenasalProgress = i / prevoicingSamples;
        // Low muffled nasal vibration preceding the stop burst
        const nasalHum = Math.sin(phase * 2 * Math.PI) * 0.45;
        consonantSound = nasalHum * Math.sin(prenasalProgress * Math.PI * 0.5);
        glottalPulse *= 0.3; // dampen oral cavity before release
      }

      // B. Stop burst transient
      if (isStop && i >= prevoicingSamples && i < prevoicingSamples + Math.floor(sampleRate * 0.015)) {
        const burstProgress = (i - prevoicingSamples) / Math.floor(sampleRate * 0.015);
        const burstFreqFactor = onset.includes('k') || onset.includes('q') ? 0.7 : 1.2;
        const rawNoise = (Math.random() * 2 - 1);
        consonantSound += rawNoise * Math.exp(-burstProgress * 12) * 0.75 * burstFreqFactor;
      }

      // C. Aspiration noise (ph, th, kh, qh, tsh, ch)
      if (isAspirated && i >= prevoicingSamples && i < prevoicingSamples + votSamples) {
        const aspirProgress = (i - prevoicingSamples) / votSamples;
        const noise = (Math.random() * 2 - 1);
        // High-pass filter for aspiration turbulence
        hpState = 0.8 * hpState + 0.2 * noise;
        const shapedAspiration = (noise - hpState) * (1 - aspirProgress) * 0.65;
        consonantSound += shapedAspiration;
        glottalPulse *= aspirProgress; // Voicing fades in as aspiration ends
      }

      // D. Fricatives (s, x, z, f, v)
      if (isFricative && i < fricativeSamples) {
        const fricProgress = i / fricativeSamples;
        const noise = (Math.random() * 2 - 1);
        const fricEnv = Math.sin(fricProgress * Math.PI);
        consonantSound += noise * fricEnv * 0.55;
        if (onset !== 'v' && onset !== 'z') {
          glottalPulse *= 0.15; // Voiceless fricatives suppress glottis
        }
      }

      // 5. Syllable Envelope (Natural attack, sustain, and release)
      let env = 1.0;
      const attackSamples = Math.floor(sampleRate * 0.018);
      const decaySamples = Math.floor(sampleRate * 0.045);

      if (i < attackSamples) {
        env = Math.sin((i / attackSamples) * (Math.PI / 2));
      } else if (i > numSamples - decaySamples) {
        const d = (numSamples - i) / decaySamples;
        env = Math.sin(d * (Math.PI / 2));
      }

      // Special Hmong Glottal Stop Termination for -m tone (21ˀ):
      if (toneInfo.letter === 'm' && progress > 0.80) {
        // Fast exponential glottal cutoff simulating abrupt vocal fold closure [ʔ]
        env *= Math.max(0, 1 - (progress - 0.80) * 8.5);
      }

      // 6. Resonator Cascade Filtering
      const excitation = glottalPulse * 0.72 + consonantSound * 0.55;

      // Resonator 1 (F1)
      const y1 = curR1.a * excitation - curR1.b1 * s1 - curR1.b2 * s2;
      s2 = s1; s1 = y1;

      // Resonator 2 (F2)
      const y2 = curR2.a * excitation - curR2.b1 * s3 - curR2.b2 * s4;
      s4 = s3; s3 = y2;

      // Resonator 3 (F3)
      const y3 = curR3.a * excitation - curR3.b1 * s5 - curR3.b2 * s6;
      s6 = s5; s5 = y3;

      // Resonator 4 (F4)
      const y4 = curR4.a * excitation - curR4.b1 * s7 - curR4.b2 * s8;
      s8 = s7; s7 = y4;

      let combined = y1 * 0.95 + y2 * 0.68 + y3 * 0.38 + y4 * 0.18;

      if (rNasal) {
        const yn = rNasal.a * excitation - rNasal.b1 * sn1 - rNasal.b2 * sn2;
        sn2 = sn1; sn1 = yn;
        combined += yn * 0.42;
      }

      // 7. Warm Vocal Tract Lowpass Filter & Soft Saturation
      lpState = lpState * 0.82 + combined * 0.18;
      const warmedSignal = combined * 0.7 + lpState * 0.3;

      // Clean acoustic vocal tract output with transparent headroom
      let finalSample = warmedSignal * 0.92 * env;
      if (finalSample > 0.85) {
        finalSample = 0.85 + 0.15 * Math.tanh((finalSample - 0.85) / 0.15);
      } else if (finalSample < -0.85) {
        finalSample = -0.85 + 0.15 * Math.tanh((finalSample + 0.85) / 0.15);
      }
      output[outIdx] += finalSample;
    }
  }

  /**
   * Resonator 2-pole filter coefficients
   */
  private calculateResonatorCoeffs(freq: number, bandwidth: number, sampleRate: number) {
    const r = Math.exp(-Math.PI * (bandwidth / sampleRate));
    const theta = (2 * Math.PI * freq) / sampleRate;
    const b1 = -2 * r * Math.cos(theta);
    const b2 = r * r;
    const a = (1 - r) * Math.sin(theta);
    return { a, b1, b2 };
  }

  /**
   * Speaks Hmong text with real-time word highlighting and analyser connection.
   */
  public async speak(
    text: string,
    dialect: HmongDialect = 'dawb',
    options: SynthesisOptions = {}
  ): Promise<void> {
    this.stop();
    const ctx = this.getAudioContext();
    this.isSpeaking = true;

    if (options.onStart) options.onStart();

    try {
      const { buffer, syllables, alignment, totalDuration } = await this.renderToAudioBuffer(text, dialect, options);

      // Create audio nodes
      const source = ctx.createBufferSource();
      source.buffer = buffer;

      const startTime = ctx.currentTime;
      const gainNode = ctx.createGain();
      const targetVolume = options.volume !== undefined ? options.volume : 1.0;
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(targetVolume, startTime + 0.010);

      // Set up analyser node for real-time waveform visualizers
      if (!this.analyserNode) {
        this.analyserNode = ctx.createAnalyser();
        this.analyserNode.fftSize = 512;
        this.analyserNode.smoothingTimeConstant = 0.8;
      }

      source.connect(gainNode);
      gainNode.connect(this.analyserNode);
      this.analyserNode.connect(ctx.destination);

      this.currentSource = source;
      this.currentGainNode = gainNode;

      // Schedule exact real-time syllable events using calculated alignment
      if (options.onSyllable) {
        alignment.forEach((item) => {
          if (!item.isPunctuation) {
            const timerId = window.setTimeout(() => {
              if (this.isSpeaking && options.onSyllable) {
                const foundSyl = syllables[item.index] || {
                  raw: item.token,
                  clean: item.clean,
                } as any;
                options.onSyllable(item.index, foundSyl);
              }
            }, Math.max(0, item.timeStartSec * 1000));
            this.activeTimers.push(timerId);
          }
        });
      }

      source.onended = () => {
        this.activeTimers.forEach(id => clearTimeout(id));
        this.activeTimers = [];
        this.isSpeaking = false;
        this.currentSource = null;
        this.currentGainNode = null;
        if (options.onEnd) options.onEnd();
      };

      source.start(startTime);
    } catch (err) {
      this.isSpeaking = false;
      this.currentSource = null;
      if (options.onError) {
        options.onError(err instanceof Error ? err : new Error(String(err)));
      } else {
        console.error('Hmong TTS Speech Error:', err);
      }
    }
  }

  /**
   * Encodes an AudioBuffer into a downloadable standard RIFF WAV Blob.
   */
  public encodeWav(buffer: AudioBuffer): Blob {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;

    const data = buffer.getChannelData(0);
    const dataSize = data.length * bytesPerSample;
    const bufferSize = 44 + dataSize;
    const arrayBuffer = new ArrayBuffer(bufferSize);
    const view = new DataView(arrayBuffer);

    // Write WAV header
    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true); // SubChunk1Size (16 for PCM)
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true); // ByteRate
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    writeString(36, 'data');
    view.setUint32(40, dataSize, true);

    // Write PCM 16-bit audio samples
    let offset = 44;
    for (let i = 0; i < data.length; i++) {
      let s = Math.max(-1, Math.min(1, data[i]));
      const sample16 = s < 0 ? s * 0x8000 : s * 0x7FFF;
      view.setInt16(offset, sample16, true);
      offset += 2;
    }

    return new Blob([arrayBuffer], { type: 'audio/wav' });
  }

  /**
   * Generates sample-accurate timing and phonetic metadata (IPA and tone alignment).
   */
  public async generateMetadata(
    text: string,
    dialect: HmongDialect = 'dawb',
    options: SynthesisOptions = {}
  ): Promise<SynthesisMetadataExport> {
    const { alignment, totalDuration } = await this.renderToAudioBuffer(text, dialect, options);
    const voice = options.voice || (dialect === 'leeg' ? HMONG_VOICE_PROFILES[2] : HMONG_VOICE_PROFILES[0]);
    const rate = options.rate !== undefined ? options.rate : 1.0;
    const pitch = options.pitch !== undefined ? options.pitch : 1.0;
    const toneEmphasis = options.toneEmphasis !== undefined ? options.toneEmphasis : 1.1;
    const prosody = options.prosody !== undefined ? options.prosody : 1.1;

    return {
      app: 'HmongTTS Native Speech Studio',
      version: '1.2.0',
      generatedAt: new Date().toISOString(),
      text,
      dialect,
      dialectName: dialect === 'dawb' ? 'Hmoob Dawb (White Hmong)' : 'Moob Leeg (Green Hmong)',
      voice: {
        id: voice.id,
        name: voice.name,
        gender: voice.gender,
        baseF0Hz: voice.baseF0,
        vocalTractLength: voice.vocalTractLength,
        description: voice.description,
      },
      acousticSettings: {
        rate,
        pitch,
        toneEmphasis,
        prosody,
      },
      audioMetrics: {
        totalDurationSec: parseFloat(totalDuration.toFixed(4)),
        totalDurationMs: Math.round(totalDuration * 1000),
        sampleRate: 44100,
        channels: 1,
        totalSamples: Math.round(totalDuration * 44100),
        syllableCount: alignment.filter((a) => !a.isPunctuation).length,
        wordCount: text.trim().split(/\s+/).filter(Boolean).length,
      },
      alignment,
    };
  }

  /**
   * Encodes metadata object into a downloadable pretty-printed JSON Blob.
   */
  public encodeMetadataJson(metadata: SynthesisMetadataExport): Blob {
    const jsonString = JSON.stringify(metadata, null, 2);
    return new Blob([jsonString], { type: 'application/json' });
  }
}

// Global Singleton Instance
export const hmongTTS = new HmongAcousticEngine();

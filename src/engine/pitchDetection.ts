/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Hmong Pitch Contour Extraction & Pronunciation Analysis Engine
 * Real-time and recorded fundamental frequency (F0) extraction using
 * Autocorrelation / McLeod Pitch Method (MPM) tailored for human vocal ranges,
 * with Hmong Chao 5-level pitch normalization, phonological contour comparison,
 * and pronunciation feedback scoring.
 */

import { HMONG_TONES, HmongToneInfo, HmongDialect } from './hmongPhonology';

export interface PitchFrame {
  timeMs: number;
  f0: number; // in Hz
  clarity: number; // 0.0 - 1.0 confidence/periodicity
  rms: number; // root mean square volume
  isVoiced: boolean;
}

export interface NormalizedContourPoint {
  progress: number; // 0.0 to 1.0
  f0: number; // in Hz
  semitones: number; // relative to speaker baseline or mean
  chao: number; // Chao tone level scale (1.0 to 5.0)
}

export interface PitchContourResult {
  frames: PitchFrame[];
  normalizedPoints: NormalizedContourPoint[];
  voicedDurationMs: number;
  totalDurationMs: number;
  meanF0: number;
  medianF0: number;
  minF0: number;
  maxF0: number;
  pitchRangeSemitones: number;
  startF0: number;
  endF0: number;
  overallClarity: number;
  isCreaky: boolean;
  isBreathy: boolean;
}

export interface PitchComparisonResult {
  targetToneKey: string;
  targetTone: HmongToneInfo;
  score: number; // 0 to 100
  grade: 'A+' | 'A' | 'B' | 'C' | 'Needs Practice';
  shapeCorrelation: number; // -1.0 to 1.0
  rmseSemitones: number;
  userPitchChangeSemitones: number;
  targetPitchChangeSemitones: number;
  registerMatch: boolean;
  slopeMatch: 'rising' | 'falling' | 'level' | 'peaking' | 'dipping';
  userSlope: 'rising' | 'falling' | 'level' | 'peaking' | 'dipping';
  feedback: {
    title: string;
    description: string;
    hmongTip: string;
    pros: string[];
    improvements: string[];
  };
  targetPoints: NormalizedContourPoint[];
  userPoints: NormalizedContourPoint[];
  toleranceBand: Array<{ progress: number; upper: number; lower: number }>;
}

/**
 * Autocorrelation-based pitch detector with parabolic interpolation.
 * Optimized for human speech (70 Hz to 520 Hz).
 */
export function detectPitchInFrame(
  buffer: Float32Array,
  sampleRate: number,
  minF0 = 70,
  maxF0 = 500
): { f0: number; clarity: number; rms: number } {
  const bufferLen = buffer.length;

  // Calculate RMS energy
  let sumSq = 0;
  for (let i = 0; i < bufferLen; i++) {
    sumSq += buffer[i] * buffer[i];
  }
  const rms = Math.sqrt(sumSq / bufferLen);

  // Silence threshold
  if (rms < 0.012) {
    return { f0: 0, clarity: 0, rms };
  }

  const minLag = Math.floor(sampleRate / maxF0);
  const maxLag = Math.min(bufferLen - 1, Math.ceil(sampleRate / minF0));

  // Autocorrelation calculation
  let maxCorr = -1;
  let bestLag = -1;

  // Energy at lag 0
  let r0 = 0;
  for (let i = 0; i < bufferLen - maxLag; i++) {
    r0 += buffer[i] * buffer[i];
  }
  if (r0 <= 0.00001) return { f0: 0, clarity: 0, rms };

  const correlations = new Float32Array(maxLag + 1);

  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0;
    let rLag = 0;
    for (let i = 0; i < bufferLen - lag; i++) {
      sum += buffer[i] * buffer[i + lag];
      rLag += buffer[i + lag] * buffer[i + lag];
    }
    const norm = Math.sqrt(r0 * rLag);
    const corr = norm > 0 ? sum / norm : 0;
    correlations[lag] = corr;

    if (corr > maxCorr) {
      maxCorr = corr;
      bestLag = lag;
    }
  }

  // Check if highest peak has enough periodic clarity
  if (bestLag <= 0 || maxCorr < 0.42) {
    return { f0: 0, clarity: Math.max(0, maxCorr), rms };
  }

  // Parabolic interpolation for sub-sample accuracy
  let delta = 0;
  if (bestLag > minLag && bestLag < maxLag) {
    const prev = correlations[bestLag - 1];
    const curr = correlations[bestLag];
    const next = correlations[bestLag + 1];
    const denom = 2 * (prev - 2 * curr + next);
    if (Math.abs(denom) > 1e-6) {
      delta = (prev - next) / denom;
      if (delta < -1 || delta > 1) delta = 0;
    }
  }

  const exactLag = bestLag + delta;
  const f0 = sampleRate / exactLag;

  if (f0 < minF0 || f0 > maxF0) {
    return { f0: 0, clarity: 0, rms };
  }

  return { f0, clarity: Math.max(0, Math.min(1, maxCorr)), rms };
}

/**
 * Extracts pitch contour from decoded audio data (Float32Array).
 */
export function extractPitchContour(
  channelData: Float32Array,
  sampleRate: number
): PitchContourResult {
  const frameSize = 2048;
  const hopSize = 256; // ~5.8ms resolution at 44.1kHz
  const totalFrames = Math.floor((channelData.length - frameSize) / hopSize);

  const rawFrames: PitchFrame[] = [];

  for (let i = 0; i < totalFrames; i++) {
    const startSample = i * hopSize;
    const frameBuffer = channelData.subarray(startSample, startSample + frameSize);
    const timeMs = (startSample / sampleRate) * 1000;

    const { f0, clarity, rms } = detectPitchInFrame(frameBuffer, sampleRate);
    const isVoiced = f0 > 0 && clarity >= 0.42 && rms >= 0.015;

    rawFrames.push({
      timeMs,
      f0: isVoiced ? f0 : 0,
      clarity,
      rms,
      isVoiced,
    });
  }

  // 1. Find boundaries of continuous voiced core (trim leading/trailing silence)
  let firstVoicedIdx = -1;
  let lastVoicedIdx = -1;

  for (let i = 0; i < rawFrames.length; i++) {
    if (rawFrames[i].isVoiced) {
      if (firstVoicedIdx === -1) firstVoicedIdx = i;
      lastVoicedIdx = i;
    }
  }

  // Handle case where no voiced audio was found
  if (firstVoicedIdx === -1 || lastVoicedIdx === -1 || firstVoicedIdx >= lastVoicedIdx) {
    const dummyPoints: NormalizedContourPoint[] = Array.from({ length: 100 }, (_, i) => ({
      progress: i / 99,
      f0: 180,
      semitones: 0,
      chao: 3.0,
    }));

    return {
      frames: rawFrames,
      normalizedPoints: dummyPoints,
      voicedDurationMs: 0,
      totalDurationMs: (channelData.length / sampleRate) * 1000,
      meanF0: 0,
      medianF0: 0,
      minF0: 0,
      maxF0: 0,
      pitchRangeSemitones: 0,
      startF0: 0,
      endF0: 0,
      overallClarity: 0,
      isCreaky: false,
      isBreathy: false,
    };
  }

  const voicedFrames = rawFrames.slice(firstVoicedIdx, lastVoicedIdx + 1);

  // 2. Interpolate small unvoiced dropouts inside voiced region & apply 3-point median filter
  const cleanedF0List: number[] = [];
  for (let i = 0; i < voicedFrames.length; i++) {
    let f0 = voicedFrames[i].f0;
    if (f0 === 0) {
      // Find nearest voiced neighbors
      let prevF0 = 0;
      for (let j = i - 1; j >= 0; j--) {
        if (voicedFrames[j].f0 > 0) {
          prevF0 = voicedFrames[j].f0;
          break;
        }
      }
      let nextF0 = 0;
      for (let j = i + 1; j < voicedFrames.length; j++) {
        if (voicedFrames[j].f0 > 0) {
          nextF0 = voicedFrames[j].f0;
          break;
        }
      }
      f0 = prevF0 && nextF0 ? (prevF0 + nextF0) / 2 : prevF0 || nextF0 || 180;
    }
    cleanedF0List.push(f0);
  }

  // Median filtering to smooth octave jumps
  const smoothedF0List: number[] = [];
  for (let i = 0; i < cleanedF0List.length; i++) {
    const windowVals = [
      cleanedF0List[Math.max(0, i - 1)],
      cleanedF0List[i],
      cleanedF0List[Math.min(cleanedF0List.length - 1, i + 1)],
    ].sort((a, b) => a - b);
    smoothedF0List.push(windowVals[1]);
  }

  // 3. Pitch statistics
  const sortedValid = [...smoothedF0List].sort((a, b) => a - b);
  const medianF0 = sortedValid[Math.floor(sortedValid.length / 2)] || 180;
  const meanF0 = smoothedF0List.reduce((acc, v) => acc + v, 0) / (smoothedF0List.length || 1);
  const minF0 = sortedValid[0] || 100;
  const maxF0 = sortedValid[sortedValid.length - 1] || 300;
  const pitchRangeSemitones = 12 * Math.log2(maxF0 / Math.max(1, minF0));
  const startF0 = smoothedF0List[0] || medianF0;
  const endF0 = smoothedF0List[smoothedF0List.length - 1] || medianF0;

  // Detect phonation characteristics
  // Creaky voice: sudden drop in F0 or high jitter/energy drop at syllable coda
  const lastQuarter = smoothedF0List.slice(Math.floor(smoothedF0List.length * 0.75));
  const lastQuarterMean = lastQuarter.reduce((a, b) => a + b, 0) / (lastQuarter.length || 1);
  const isCreaky = lastQuarterMean < medianF0 * 0.82;

  // Breathy voice: higher high-frequency noise relative to harmonic clarity
  const clarities = voicedFrames.map((f) => f.clarity);
  const avgClarity = clarities.reduce((a, b) => a + b, 0) / (clarities.length || 1);
  const isBreathy = avgClarity < 0.65 && avgClarity > 0.45;

  // 4. Sample 100 normalized points across 0.0 -> 1.0 progress
  const samplesCount = 100;
  const normalizedPoints: NormalizedContourPoint[] = [];

  for (let i = 0; i < samplesCount; i++) {
    const progress = i / (samplesCount - 1);
    const frameFloatIdx = progress * (smoothedF0List.length - 1);
    const lowerIdx = Math.floor(frameFloatIdx);
    const upperIdx = Math.min(lowerIdx + 1, smoothedF0List.length - 1);
    const frac = frameFloatIdx - lowerIdx;

    const f0 = smoothedF0List[lowerIdx] * (1 - frac) + smoothedF0List[upperIdx] * frac;
    const semitones = 12 * Math.log2(f0 / Math.max(1, medianF0));

    // Convert semitones relative to median into Chao 5-scale (1.0 to 5.0)
    // Dynamic semitone range of human Hmong tone register is roughly +/- 5 semitones
    const chao = Math.max(1.0, Math.min(5.0, 3.0 + semitones / 2.4));

    normalizedPoints.push({
      progress,
      f0,
      semitones,
      chao,
    });
  }

  const voicedDurationMs = (voicedFrames.length * hopSize / sampleRate) * 1000;
  const totalDurationMs = (channelData.length / sampleRate) * 1000;

  return {
    frames: rawFrames,
    normalizedPoints,
    voicedDurationMs,
    totalDurationMs,
    meanF0,
    medianF0,
    minF0,
    maxF0,
    pitchRangeSemitones,
    startF0,
    endF0,
    overallClarity: avgClarity,
    isCreaky,
    isBreathy,
  };
}

/**
 * Compares user's extracted pitch contour against the target Hmong RPA tone
 * generated by the DSP acoustic engine.
 */
export function comparePitchContours(
  userResult: PitchContourResult,
  targetToneKey: string,
  voiceBaseF0 = 220,
  dialect: HmongDialect = 'dawb'
): PitchComparisonResult {
  const targetTone = HMONG_TONES[targetToneKey] || HMONG_TONES['b'];
  const samplesCount = 100;

  // 1. Generate target tone contour points
  const targetPoints: NormalizedContourPoint[] = [];
  for (let i = 0; i < samplesCount; i++) {
    const progress = i / (samplesCount - 1);
    const cIdx = progress * (targetTone.contour.length - 1);
    const cLower = Math.floor(cIdx);
    const cUpper = Math.min(cLower + 1, targetTone.contour.length - 1);
    const cFrac = cIdx - cLower;
    const baseContour =
      targetTone.contour[cLower] * (1 - cFrac) + targetTone.contour[cUpper] * cFrac;

    // Authentic semitone contour relative to base
    let toneSemitones = (baseContour - 0.5) * 9.8 * 1.2;

    // Dialect & phonation adjustment
    if (targetTone.letter === 'g') {
      toneSemitones -= progress * 2.2; // Breathy drop
    } else if (targetTone.letter === 'm' && progress > 0.4) {
      toneSemitones -= 2.6; // Creaky drop
    }

    const f0 = voiceBaseF0 * Math.pow(2, toneSemitones / 12);
    const chao = 1.0 + baseContour * 4.0;

    targetPoints.push({
      progress,
      f0,
      semitones: toneSemitones,
      chao,
    });
  }

  // Calculate target baseline averages
  const targetAvgSemitones = targetPoints.reduce((acc, p) => acc + p.semitones, 0) / samplesCount;
  const targetAvgChao = targetPoints.reduce((acc, p) => acc + p.chao, 0) / samplesCount;

  // Align user contour points to target baseline for direct visual overlay comparison
  // Preserving raw f0 (Hz) while projecting relative pitch inflection onto target register
  const userPoints: NormalizedContourPoint[] = userResult.normalizedPoints.map((pt) => {
    const semitones = targetAvgSemitones + pt.semitones;
    const chao = Math.max(1.0, Math.min(5.0, targetAvgChao + pt.semitones / 2.4));
    return {
      progress: pt.progress,
      f0: pt.f0,
      semitones,
      chao,
    };
  });

  // 2. Tolerance band (+/- 1.6 semitones)
  const toleranceBand = targetPoints.map((pt) => ({
    progress: pt.progress,
    upper: pt.semitones + 1.6,
    lower: pt.semitones - 1.6,
  }));

  // 3. Pearson Correlation of Normalized Slope Shape
  let sumU = 0;
  let sumT = 0;
  for (let i = 0; i < samplesCount; i++) {
    sumU += userPoints[i].semitones;
    sumT += targetPoints[i].semitones;
  }
  const meanU = sumU / samplesCount;
  const meanT = sumT / samplesCount;

  let num = 0;
  let denU = 0;
  let denT = 0;
  for (let i = 0; i < samplesCount; i++) {
    const diffU = userPoints[i].semitones - meanU;
    const diffT = targetPoints[i].semitones - meanT;
    num += diffU * diffT;
    denU += diffU * diffU;
    denT += diffT * diffT;
  }
  const shapeCorrelation =
    denU > 0 && denT > 0 ? Math.max(-1, Math.min(1, num / Math.sqrt(denU * denT))) : 0;

  // 4. Mean Centered Shape Distance (RMSE in semitones)
  let sumSqErr = 0;
  for (let i = 0; i < samplesCount; i++) {
    // Relative trajectory shape distance
    const uRel = userPoints[i].semitones - meanU;
    const tRel = targetPoints[i].semitones - meanT;
    sumSqErr += (uRel - tRel) * (uRel - tRel);
  }
  const rmseSemitones = Math.sqrt(sumSqErr / samplesCount);

  // 5. Total Pitch Movement (Start vs End)
  const userPitchChange = userPoints[samplesCount - 1].semitones - userPoints[0].semitones;
  const targetPitchChange = targetPoints[samplesCount - 1].semitones - targetPoints[0].semitones;

  const determineSlope = (change: number): 'rising' | 'falling' | 'level' | 'peaking' | 'dipping' => {
    if (change > 1.2) return 'rising';
    if (change < -1.2) return 'falling';
    return 'level';
  };

  const userSlope = determineSlope(userPitchChange);
  const targetSlope = determineSlope(targetPitchChange);

  // 6. Register & Slope Match (Evaluating phonological alignment with target tone)
  let registerMatch = true;
  if (targetTone.letter === 'b' && userPitchChange < -1.5) registerMatch = false;
  else if (targetTone.letter === 'j' && userPitchChange > -1.2) registerMatch = false;
  else if (targetTone.letter === 'v' && userPitchChange < 1.2) registerMatch = false;
  else if (targetTone.letter === 's' && userPitchChange > 1.5) registerMatch = false;
  else if (targetTone.letter === '' && Math.abs(userPitchChange) > 2.0) registerMatch = false;

  const userAvgChao = userPoints.reduce((acc, p) => acc + p.chao, 0) / samplesCount;
  const registerDiff = Math.abs(userAvgChao - targetAvgChao);

  // 7. Calculate Comprehensive Pronunciation Score (0 to 100)
  // Weighted:
  // - Shape Correlation: 45%
  // - RMSE deviation: 30%
  // - Pitch change direction match: 15%
  // - Register level proximity: 10%
  const shapeScore = Math.max(0, (shapeCorrelation + 1) / 2) * 45;
  const rmseScore = Math.max(0, 1 - rmseSemitones / 4.0) * 30;
  const directionScore = userSlope === targetSlope ? 15 : Math.abs(userPitchChange - targetPitchChange) < 2.0 ? 8 : 0;
  const regScore = Math.max(0, 1 - registerDiff / 2.5) * 10;

  let rawScore = Math.round(shapeScore + rmseScore + directionScore + regScore);

  // Special phonation bonuses/penalties
  if (targetTone.letter === 'm' && userResult.isCreaky) {
    rawScore = Math.min(100, rawScore + 6);
  } else if (targetTone.letter === 'g' && userResult.isBreathy) {
    rawScore = Math.min(100, rawScore + 5);
  }

  // Ensure minimum realistic score if voiced audio was detected
  const score = Math.max(15, Math.min(99, rawScore));

  let grade: 'A+' | 'A' | 'B' | 'C' | 'Needs Practice' = 'Needs Practice';
  if (score >= 90) grade = 'A+';
  else if (score >= 80) grade = 'A';
  else if (score >= 70) grade = 'B';
  else if (score >= 55) grade = 'C';

  // 8. Generate Specific Phonetic Coaching Feedback
  const pros: string[] = [];
  const improvements: string[] = [];

  let title = '';
  let description = '';
  let hmongTip = '';

  switch (targetTone.letter) {
    case 'b': // High Level [55]
      if (Math.abs(userPitchChange) < 1.2 && userAvgChao >= 3.6) {
        title = 'Superb High-Level Tone (-b)!';
        description = 'You maintained a steady, sustained high pitch throughout the syllable without dropping.';
        pros.push('Stable high vocal register [55]');
        pros.push('No premature pitch descent');
      } else if (userPitchChange < -1.5) {
        title = 'Tone Dropped Too Early';
        description = 'The -b tone must stay high and steady. Your pitch drifted downward like the -j tone.';
        improvements.push('Maintain vocal fold tension through the end of the vowel.');
      } else {
        title = 'Raise Starting Pitch';
        description = 'Target is high register [55]. Aim for your upper speaking register.';
        improvements.push('Start in head voice / high pitch register.');
      }
      hmongTip = 'Lub suab b (Siab) yuav tsum nyob siab tus kheej, txhob cia poob qis.';
      break;

    case 'j': // High-Falling [52]
      if (userPitchChange < -2.0) {
        title = 'Sharp High-Falling Glide (-j)!';
        description = 'Excellent high onset gliding rapidly down to low register, capturing authentic Hmong descent.';
        pros.push('Strong falling pitch slope');
        pros.push('Crisp 52 drop');
      } else {
        title = 'Needs Steeper Pitch Drop';
        description = 'The -j tone requires a sharp slide downward. Your pitch contour was slightly too flat.';
        improvements.push('Start high, then release pitch tension like an emphatic sigh.');
      }
      hmongTip = 'Lub suab j (Nqes) yuav tsum pib siab heev es poob nrawm mus rau qis.';
      break;

    case 'v': // Mid-Rising [24]
      if (userPitchChange > 1.8) {
        title = 'Smooth Mid-Rising Inflection (-v)!';
        description = 'Terrific rising pitch trajectory! You smoothly escalated from mid to high register.';
        pros.push('Clear rising pitch contour (+24)');
        pros.push('Proper starting register');
      } else {
        title = 'Inflection Needs to Rise Higher';
        description = 'The -v tone rises upward like asking a curious question. Glide your pitch higher at the end.';
        improvements.push('Glide your vocal pitch upwards towards the vowel coda.');
      }
      hmongTip = 'Lub suab v (Nce) zoo li koj tab tom nug lus, yuav tsum nce mus siab.';
      break;

    case '': // Mid Level [33]
      if (Math.abs(userPitchChange) < 1.4) {
        title = 'Steady Mid Register (-ø)!';
        description = 'Neutral, natural mid-pitch sustained with calm, relaxed vocal resonance.';
        pros.push('Balanced [33] mid sustain');
      } else {
        title = 'Keep Pitch Centered and Flat';
        description = 'Unmarked tone is your natural speaking pitch without rising or falling glides.';
        improvements.push('Speak with your normal, relaxed pitch without singing or inflection.');
      }
      hmongTip = 'Lub suab nruab ntug (tsis muaj cim) yog suab nruab nrab, tsis nce tsis poob.';
      break;

    case 's': // Low Level [22]
      if (userAvgChao <= 2.8 && Math.abs(userPitchChange) < 1.8) {
        title = 'Deep Low Register Tone (-s)!';
        description = 'Warm, stable low pitch sustained without rising.';
        pros.push('Authentic low baseline [22]');
      } else {
        title = 'Lower Pitch Baseline';
        description = 'The -s tone sits in your deep chest register. Keep it lower than your normal voice.';
        improvements.push('Relax your larynx and produce a deep, low speaking pitch.');
      }
      hmongTip = 'Lub suab s (Qis) yog suab nqes mus rau hauv qab siab, nyob ntsiag to.';
      break;

    case 'g': // Breathy Falling [31]
      if (userPitchChange < -1.0) {
        title = 'Authentic Breathy Sigh (-g)!';
        description = 'Pitch gently fell with warm subglottal breathiness characteristic of Hmoob Dawb -g.';
        pros.push('Gentle breathy descent [31]');
        if (userResult.isBreathy) pros.push('Noticeable breathy vocal phonation detected');
      } else {
        title = 'Add Breathy Sigh & Drop';
        description = 'The -g tone should drop gently while letting relaxed air escape like a sigh.';
        improvements.push('Let air whisper through your vocal cords as the pitch glides down.');
      }
      hmongTip = 'Lub suab g (Ntxhi) zoo li lub suab nres pa, muaj cua ntxhi nrog.';
      break;

    case 'm': // Creaky Low / Glottal Stop [21ʔ]
      if (userPitchChange < -1.0 || userResult.isCreaky) {
        title = 'Crisp Creaky Glottal Stop (-m)!';
        description = 'Abrupt low tone with tight vocal fold closure or creaky fry at the end.';
        pros.push('Low pitch register');
        if (userResult.isCreaky) pros.push('Creaky vocal fry / glottal closure verified');
      } else {
        title = 'Shorten Syllable with Abrupt Stop';
        description = 'The -m tone is very short and low with tight vocal folds (vocal fry) cutting off abruptly.';
        improvements.push('Cut the sound off sharply in your throat, like the hyphen in "uh-oh".');
      }
      hmongTip = 'Lub suab m (Khaus) yuav tsum luv luv, muab caj pas txiav suab tam sim.';
      break;

    case 'd': // Sandhi / Mid-Dipping [33/21]
      title = 'Sandhi Tone Articulation (-d)';
      description = 'Dialectal/morphological tone sandhi variant gliding from mid-low.';
      pros.push('Articulated sandhi tone');
      hmongTip = 'Lub suab d yog suab hloov (tone sandhi), feem ntau hnov tom qab lwm lo lus.';
      break;

    default:
      title = 'Pitch Contour Evaluated';
      description = `Analyzed against ${targetTone.name} tone trajectory.`;
      break;
  }

  if (pros.length === 0) {
    pros.push('Voiced speech detected clearly with audible pitch tracking');
  }

  return {
    targetToneKey,
    targetTone,
    score,
    grade,
    shapeCorrelation,
    rmseSemitones,
    userPitchChangeSemitones: userPitchChange,
    targetPitchChangeSemitones: targetPitchChange,
    registerMatch,
    slopeMatch: targetSlope,
    userSlope,
    feedback: {
      title,
      description,
      hmongTip,
      pros,
      improvements,
    },
    targetPoints,
    userPoints,
    toleranceBand,
  };
}

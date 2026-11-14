/**
 * Phonology engine regression tests. Run: npm test (or: bun scripts/test-phonology.ts)
 */
import {
  parseHmongSyllable,
  parseHmongText,
  convertDialectText,
  getOnsetIpa,
  numberToHmong,
  classifyRpaShape,
  HMONG_VOWELS,
  HMONG_TONES,
  ONSET_RESPELLING,
  RIME_RESPELLING,
} from '../src/engine/hmongPhonology.ts';
import { hmongPronunciationStore } from '../src/engine/hmongPronunciationOverrides.ts';
import {
  extractPitchContour,
  comparePitchContours,
  MIN_VOICED_DURATION_MS,
} from '../src/engine/pitchDetection.ts';
import type { PitchContourResult, PitchFrame } from '../src/engine/pitchDetection.ts';
import { applyNativeProsody } from '../src/engine/nativePronunciation.ts';
import { detectLanguage, classifyWord, classifyWords } from '../src/engine/languageDetector.ts';
import { HMONG_PHRASES } from '../src/engine/hmongPhrasebookData.ts';

let failures = 0;
function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) {
    failures++;
    console.log(`FAIL ${name}: got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`);
  } else {
    console.log(`ok   ${name}`);
  }
}

/** Boolean check that reports `detail` on failure (used where the expected value is a range or a property). */
function checkTrue(name: string, condition: boolean, detail?: unknown) {
  if (condition) {
    console.log(`ok   ${name}`);
  } else {
    failures++;
    console.log(`FAIL ${name}${detail === undefined ? '' : `: ${JSON.stringify(detail)}`}`);
  }
}

function throws(fn: () => unknown): boolean {
  try {
    fn();
    return false;
  } catch {
    return true;
  }
}

/** Runs `fn`, returning `fallback` if it throws, so one broken call reports a FAIL instead of aborting the whole run. */
function attempt<T, F>(fn: () => T, fallback: F): T | F {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

// --- Onset decomposition for common White Hmong words ---
const cases: Array<[word: string, onset: string, vowel: string, tone: string]> = [
  ['xyoo', 'xy', 'oo', ''],      // year — xy onset
  ['xya', 'xy', 'a', ''],        // seven
  ['dhau', 'dh', 'au', ''],      // to pass — dh onset
  ['dhia', 'dh', 'ia', ''],      // to jump
  ['dej', 'd', 'e', 'j'],        // water
  ['hmoob', 'hm', 'oo', 'b'],    // Hmong
  ['ntxawg', 'ntx', 'aw', 'g'],  // youngest son
  ['nplooj', 'npl', 'oo', 'j'],  // leaf
  ['tsev', 'ts', 'e', 'v'],      // house
  ['ib', '', 'i', 'b'],          // one
  ['kuv', 'k', 'u', 'v'],        // I/me
];
for (const [word, onset, vowel, tone] of cases) {
  const s = parseHmongSyllable(word);
  check(`parse(${word})`, [s.onset, s.vowel, s.toneLetter], [onset, vowel, tone]);
}

// Green Hmong onsets
const dl = parseHmongSyllable('dlej', 'leeg');
check('parse(dlej, leeg)', [dl.onset, dl.vowel, dl.toneLetter], ['dl', 'e', 'j']);

// --- IPA map covers every onset in both dialect lists ---
check('getOnsetIpa(xy) defined', getOnsetIpa('xy', 'dawb') !== 'xy', true);
check('getOnsetIpa(dh) defined', getOnsetIpa('dh', 'dawb') !== 'dh', true);

// --- aaw vowel has its own formants (not the "a" fallback) ---
check('HMONG_VOWELS.aaw exists', Boolean(HMONG_VOWELS['aaw']), true);
const aaw = parseHmongSyllable('tsaawb', 'leeg');
check('parse(tsaawb, leeg) vowel', aaw.vowel, 'aaw');

// --- Tone sandhi ---
const sandhi = parseHmongText('ob tus menyuam');
check('sandhi ob tus -> tug', [sandhi[1].isToneSandhi === true, sandhi[1].toneLetter], [true, 'g']);

// --- Dialect conversion must never emit multi-variant strings like "dlaag / dleeg" ---
const converted = convertDialectText('dej thiab aub', 'dawb', 'leeg');
check('convertDialectText no slash', converted.includes('/'), false);
check('convertDialectText no spaces added', converted.split(/\s+/).length, 3);

// ===========================================================================
// 1. Prototype-unsafe lookups: words like "constructor" must behave as ordinary unknown words
// ===========================================================================
check('parseHmongText("ib constructor") does not throw', throws(() => parseHmongText('ib constructor')), false);
const ibCtor = attempt(() => parseHmongText('ib constructor'), []);
check('"constructor" after -b trigger is not tone sandhi', [ibCtor.length, ibCtor[1]?.clean, ibCtor[1]?.isToneSandhi === true], [2, 'constructor', false]);
check('parseHmongSyllable("constructor") does not throw', throws(() => parseHmongSyllable('constructor')), false);
check('getOnsetIpa("constructor") is a string', typeof getOnsetIpa('constructor', 'dawb'), 'string');

// Pronunciation store: set + delete of a prototype-named word must not corrupt the cache
hmongPronunciationStore.set({ word: 'constructor', respelling: 'kon-struk-ter', ipa: '', toneLetter: '' });
check('store.delete("constructor") removes the user entry', hmongPronunciationStore.delete('constructor'), true);
check('store.getAll() survives after set+delete of "constructor"', throws(() => hmongPronunciationStore.getAll()), false);
check('store.get("constructor") is gone', hmongPronunciationStore.get('constructor') === undefined, true);
check(
  'store.getAll() entries all have a word',
  attempt(() => hmongPronunciationStore.getAll().every((item) => typeof item.word === 'string' && item.word.length > 0), false),
  true
);
// A corrupted entry (no word) must be skipped and purged instead of poisoning getAll() forever
const storeCache = (hmongPronunciationStore as unknown as { cache: Map<string, unknown> }).cache;
storeCache.set('broken-entry', { id: 'x', respelling: 'x', ipa: '', toneLetter: '', source: 'user' });
check('store.getAll() skips entries without a word', throws(() => hmongPronunciationStore.getAll()), false);
check('store.getAll() purges entries without a word', storeCache.has('broken-entry'), false);
check('deleting a preset-backed override reverts to the preset', (() => {
  hmongPronunciationStore.set({ word: 'zoo', respelling: 'custom', ipa: '', toneLetter: 's' });
  hmongPronunciationStore.delete('zoo');
  return hmongPronunciationStore.get('zoo')?.source;
})(), 'preset');

// Native lexicon lookup must ignore prototype members
const ctorSyllable = parseHmongSyllable('constructor');
const ctorProsody = applyNativeProsody(ctorSyllable, 'dawb', 0, 1);
check('applyNativeProsody("constructor") ignores Object.prototype', throws(() => applyNativeProsody(ctorSyllable, 'dawb', 0, 1)), false);
check('applyNativeProsody("constructor") keeps the syllable duration', ctorProsody.durationMs, ctorSyllable.durationMs);

// ===========================================================================
// 2. Mid-tone override: '' is an explicit override, and tone/ipa/duration/trajectory must agree
// ===========================================================================
const tubParsed = parseHmongSyllable('tub');
check('tub parses as -b (baseline)', [tubParsed.toneLetter, tubParsed.tone.chaoNumber, tubParsed.durationMs], ['b', '55', 185]);

hmongPronunciationStore.set({ word: 'tub', respelling: 'too', ipa: '', toneLetter: '' });
const tubMid = parseHmongSyllable('tub');
check('mid-tone override: tone object is Mid-Level (33)', tubMid.tone.chaoNumber, '33');
check('mid-tone override: toneLetter is the unmarked mid ""', tubMid.toneLetter, '');
checkTrue('mid-tone override: ipa uses the mid tone marks', tubMid.ipa.endsWith(`${HMONG_TONES[''].ipaDiacritic}]`), tubMid.ipa);
check('mid-tone override: duration has no -b clipping', tubMid.durationMs, 210);
check('mid-tone override: pitch trajectory is the mid contour', tubMid.pitchTrajectory, HMONG_TONES[''].contour);
hmongPronunciationStore.delete('tub');
check('tub reverts to -b once the override is deleted', parseHmongSyllable('tub').toneLetter, 'b');

hmongPronunciationStore.set({ word: 'pob', respelling: 'paw', ipa: '', toneLetter: 'g' });
const pobBreathy = parseHmongSyllable('pob');
check('-g override: tone object, letter and trajectory agree', [pobBreathy.tone.chaoNumber, pobBreathy.toneLetter, pobBreathy.pitchTrajectory], ['42', 'g', HMONG_TONES.g.contour]);
checkTrue('-g override: ipa uses the -g tone marks', pobBreathy.ipa.endsWith(`${HMONG_TONES.g.ipaDiacritic}]`), pobBreathy.ipa);
check('-g override: duration uses the -g adjustment', pobBreathy.durationMs, 225);
hmongPronunciationStore.delete('pob');

hmongPronunciationStore.set({ word: 'dab', respelling: 'dah', ipa: '[custom]', toneLetter: 'x' });
const dabBadTone = parseHmongSyllable('dab');
check('unrecognised override tone letter falls back to the parsed tone consistently', [dabBadTone.toneLetter, dabBadTone.tone.chaoNumber], ['b', '55']);
check('custom override IPA is preserved verbatim', dabBadTone.ipa, '[custom]');
hmongPronunciationStore.delete('dab');

// ===========================================================================
// 3. Sandhi only through the explicit table (no generic -s -> -g rewrite)
// ===========================================================================
for (const phrase of ['koj lus', 'koj mas', 'ib lus', 'peb nws']) {
  const second = parseHmongText(phrase)[1];
  check(`"${phrase}" is not rewritten`, [second.isToneSandhi === true, second.clean, second.toneLetter], [false, phrase.split(' ')[1], 's']);
}
check('table pair still applies: ob tus -> tug', parseHmongText('ob tus').map((s) => s.clean), ['ob', 'tug']);
check('table pair still applies: koj tus -> tug', parseHmongText('koj tus')[1].isToneSandhi === true, true);
check('table pair still applies: ib lub -> lug', [parseHmongText('ib lub')[1].isToneSandhi === true, parseHmongText('ib lub')[1].toneLetter], [true, 'g']);

// ===========================================================================
// 4. Respelling: no raw RPA clusters or rimes leak into the English-reader spelling
// ===========================================================================
const respellCases: Array<[word: string, dialect: 'dawb' | 'leeg', respelling: string, rawLeak: string, tone: string]> = [
  ['hnyav', 'dawb', 'nyah', 'hny', 'v'],
  ['hmlaj', 'dawb', 'mlah', 'hml', 'j'],
  ['mlaj', 'dawb', 'mlah', 'mlaj', 'j'],
  ['tsaawb', 'leeg', 'tsah-uh', 'aaw', 'b'],
];
for (const [word, dialect, respelling, rawLeak, tone] of respellCases) {
  const s = parseHmongSyllable(word, dialect);
  check(`respelling(${word}, ${dialect})`, s.englishRespelling, respelling);
  checkTrue(`respelling(${word}) has no raw RPA leak "${rawLeak}"`, !(s.englishRespelling ?? '').includes(rawLeak), s.englishRespelling);
  checkTrue(`respelling(${word}) does not end in the raw tone letter "${tone}"`, !(s.englishRespelling ?? '').endsWith(tone), s.englishRespelling);
}
// Every rime with formants, and every RPA onset of either dialect, must have an English respelling
check(
  'RIME_RESPELLING covers every vowel in HMONG_VOWELS',
  Object.keys(HMONG_VOWELS).filter((rime) => !Object.prototype.hasOwnProperty.call(RIME_RESPELLING, rime)),
  []
);
const ALL_ONSETS = [
  'ndlh', 'ntsh', 'ntxh', 'nplh', 'hml', 'hny', 'ndl', 'nch', 'nkh', 'nph', 'nqh', 'nrh', 'nth',
  'dlh', 'plh', 'tsh', 'txh', 'npl', 'nts', 'ntx', 'nc', 'nk', 'np', 'nq', 'nr', 'nt',
  'dl', 'ch', 'dh', 'kh', 'ph', 'qh', 'rh', 'th', 'ts', 'tx', 'xy', 'hl', 'hm', 'hn', 'ml', 'ny', 'pl',
  'c', 'd', 'f', 'h', 'k', 'l', 'm', 'n', 'p', 'q', 'r', 's', 't', 'v', 'x', 'y', 'z',
];
check(
  'ONSET_RESPELLING covers every RPA onset',
  ALL_ONSETS.filter((onset) => !Object.prototype.hasOwnProperty.call(ONSET_RESPELLING, onset)),
  []
);

// ===========================================================================
// 5. Vowel resolution: exact match, then longest known prefix, never an invented vowel
// ===========================================================================
for (const [word, dialect, rime] of [
  ['tsaawb', 'leeg', 'aaw'], ['xaawb', 'leeg', 'aaw'], ['paab', 'leeg', 'aa'], ['tsaug', 'dawb', 'au'],
  ['hais', 'dawb', 'ai'], ['thiab', 'dawb', 'ia'], ['hmoob', 'dawb', 'oo'], ['ib', 'dawb', 'i'],
] as Array<[string, 'dawb' | 'leeg', string]>) {
  const s = parseHmongSyllable(word, dialect);
  check(`exact/longest-first rime for ${word}`, [s.vowel, s.vowelApproximated], [rime, false]);
}
const iai = parseHmongSyllable('iai');
check('"iai" is not a known rime: longest prefix + approximated flag', [iai.vowel, iai.vowelApproximated], ['ia', true]);
const loneB = parseHmongSyllable('b');
check('"b" keeps its letters as written and is flagged', [loneB.vowel, loneB.vowelApproximated], ['b', true]);
checkTrue('"b" ipa does not claim an /a/ vowel', !loneB.ipa.includes('a'), loneB.ipa);
check('"b" keeps the /a/ acoustic fallback so synthesis still works', [loneB.formants.f1Start, loneB.formants.isDiphthong], [HMONG_VOWELS.a.f1Start, false]);
const onsetOnly = parseHmongSyllable('th');
check('onset-only "th" has no invented vowel and is flagged', [onsetOnly.onset, onsetOnly.vowel, onsetOnly.vowelApproximated], ['th', '', true]);
checkTrue('onset-only "th" ipa does not claim an /a/ vowel', !onsetOnly.ipa.includes('a'), onsetOnly.ipa);
check('classifyRpaShape distinguishes syllables, compounds and non-RPA words', [
  classifyRpaShape('tshiab'), classifyRpaShape('menyuam'), classifyRpaShape('askiv'), classifyRpaShape('hand'), classifyRpaShape('plan'),
], ['syllable', 'compound', 'compound', 'none', 'none']);

// ===========================================================================
// 6. Pitch comparison: silence is not scored, unknown tones do not throw, tone text matches HMONG_TONES
// ===========================================================================
/** Harmonic test tone following a tone contour (same recipe as the trainer's demo voice), optionally padded with silence. */
function synthTone(contour: number[], opts: { seconds?: number; lead?: number; trail?: number } = {}) {
  const sampleRate = 44100;
  const seconds = opts.seconds ?? 0.42;
  const lead = Math.floor((opts.lead ?? 0) * sampleRate);
  const total = Math.floor(sampleRate * seconds);
  const data = new Float32Array(lead + total + Math.floor((opts.trail ?? 0) * sampleRate));
  let phase = 0;
  for (let i = 0; i < total; i++) {
    const progress = i / total;
    const idx = progress * (contour.length - 1);
    const lo = Math.floor(idx);
    const hi = Math.min(lo + 1, contour.length - 1);
    const value = contour[lo] * (1 - (idx - lo)) + contour[hi] * (idx - lo);
    phase += (2 * Math.PI * 220 * Math.pow(2, ((value - 0.5) * 9.8 * 1.15) / 12)) / sampleRate;
    const wave = 0.6 * Math.sin(phase) + 0.3 * Math.sin(2 * phase) + 0.15 * Math.sin(3 * phase) + 0.08 * Math.sin(4 * phase);
    data[lead + i] = wave * Math.sin(progress * Math.PI) * 0.75;
  }
  return { data, sampleRate };
}

/** Hand-built contour for exercising comparePitchContours without audio. */
function syntheticContour(voicedDurationMs: number, semitoneAt: (progress: number) => number, frames: PitchFrame[] = []): PitchContourResult {
  const normalizedPoints = Array.from({ length: 100 }, (_, i) => {
    const progress = i / 99;
    const semitones = semitoneAt(progress);
    return { progress, f0: 220 * Math.pow(2, semitones / 12), semitones, chao: Math.max(1, Math.min(5, 3 + semitones / 2.4)) };
  });
  return {
    frames, normalizedPoints, voicedDurationMs, totalDurationMs: voicedDurationMs + 100,
    meanF0: 220, medianF0: 220, minF0: 200, maxF0: 240, pitchRangeSemitones: 3, startF0: 220, endF0: 220,
    overallClarity: 0.8, isCreaky: false, isBreathy: false,
  };
}
const frameTrain = (voicedFrames: number): PitchFrame[] =>
  Array.from({ length: 100 }, (_, i) => ({ timeMs: i * 5.8, f0: i < voicedFrames ? 200 : 0, clarity: 0.9, rms: 0.1, isVoiced: i < voicedFrames }));

const silentClip = extractPitchContour(new Float32Array(44100), 44100);
const silentResult = comparePitchContours(silentClip, 'b');
check('silent clip: insufficientAudio is set', silentResult.insufficientAudio, true);
check('silent clip: score is 0, not a dummy-contour grade', silentResult.score, 0);
check('silent clip: no user points, but the target overlay is kept', [silentResult.userPoints.length, silentResult.targetPoints.length], [0, 100]);
check('long all-zero clip is not scored either', comparePitchContours(extractPitchContour(new Float32Array(44100 * 3), 44100), 'j').insufficientAudio, true);

const blip = synthTone(HMONG_TONES.b.contour, { seconds: 0.08, lead: 0.4, trail: 0.5 });
check('80 ms voiced blip in silence is not scored', comparePitchContours(extractPitchContour(blip.data, blip.sampleRate), 'b').insufficientAudio, true);

for (const toneKey of Object.keys(HMONG_TONES)) {
  const clip = synthTone(HMONG_TONES[toneKey].contour, { lead: 0.2, trail: 0.2 });
  const result = comparePitchContours(extractPitchContour(clip.data, clip.sampleRate), toneKey, 220);
  checkTrue(`voiced clip of tone -${toneKey || 'mid'} is scored normally`, !result.insufficientAudio && result.score >= 70, { score: result.score, insufficient: result.insufficientAudio });
}
const fallingClip = synthTone(HMONG_TONES.j.contour);
const crossTone = comparePitchContours(extractPitchContour(fallingClip.data, fallingClip.sampleRate), 'b', 220);
checkTrue('a falling clip scored against the level -b tone is not a top grade', crossTone.score < 90, crossTone.score);

const flatLong = syntheticContour(380, () => 0);
check('synthetic contour with 380 ms voiced span is scorable', comparePitchContours(flatLong, 'b').insufficientAudio, undefined);
check(`synthetic contour below ${MIN_VOICED_DURATION_MS} ms is not scorable`, comparePitchContours(syntheticContour(100, () => 0), 'b').insufficientAudio, true);
check('long voiced SPAN made of only 3 voiced frames is not scorable', comparePitchContours(syntheticContour(400, () => 0, frameTrain(3)), 'b').insufficientAudio, true);
check('frames present but none voiced is not scorable', comparePitchContours(syntheticContour(400, () => 0, frameTrain(0)), 'b').insufficientAudio, true);
check('plenty of genuinely voiced frames is scorable', comparePitchContours(syntheticContour(400, () => 0, frameTrain(100)), 'b').insufficientAudio, undefined);

for (const badTone of ['constructor', 'toString', 'hasOwnProperty', '__proto__', 'zzz']) {
  check(`comparePitchContours(tone "${badTone}") does not throw`, throws(() => comparePitchContours(flatLong, badTone)), false);
  const result = attempt(() => comparePitchContours(flatLong, badTone), undefined);
  check(`comparePitchContours(tone "${badTone}") returns a safe error result`, [result?.unknownTone, result?.score, result?.insufficientAudio], [true, 0, undefined]);
}

// Feedback text must quote the same Chao numbers as HMONG_TONES (-g is 42, -d is 23)
const rising = syntheticContour(400, (p) => -3 + 6 * p);
const falling = syntheticContour(400, (p) => 3 - 6 * p);
const flat = syntheticContour(400, () => 0);
const feedbackText = (toneKey: string) =>
  [rising, falling, flat]
    .map((contour) => {
      const f = comparePitchContours(contour, toneKey, 220).feedback;
      return [f.title, f.description, f.hmongTip, ...f.pros, ...f.improvements].join(' | ');
    })
    .join(' || ');
let allFeedback = '';
for (const toneKey of Object.keys(HMONG_TONES)) {
  const text = feedbackText(toneKey);
  allFeedback += text;
  const quoted = Array.from(text.matchAll(/\[(\d{2})\]/g), (m) => m[1]);
  checkTrue(`feedback for -${toneKey || 'mid'} only quotes Chao [${HMONG_TONES[toneKey].chaoNumber}]`, quoted.every((n) => n === HMONG_TONES[toneKey].chaoNumber), quoted);
}
checkTrue('-g feedback cites [42] (not [31])', feedbackText('g').includes('[42]') && !feedbackText('g').includes('[31]'));
checkTrue('-d feedback cites [23] (not [33/21])', feedbackText('d').includes('[23]') && !feedbackText('d').includes('33/21'));
checkTrue('no feedback anywhere still says [31] or [33/21]', !/\[31\]|33\/21/.test(allFeedback));
check('-d target: a rising contour matches the register', comparePitchContours(rising, 'd').registerMatch, true);
check('-d target: a falling contour does not', comparePitchContours(falling, 'd').registerMatch, false);

// ===========================================================================
// 8. Language detection
// ===========================================================================
check('"The dog and the cat is big" is English, not mixed', detectLanguage('The dog and the cat is big').language, 'english');
check('"hnub no zoo heev" is Hmong', detectLanguage('hnub no zoo heev').language, 'hmong');
check('"no" inside Hmong text is resolved as Hmong', detectLanguage('hnub no zoo heev').tokens[1].lang, 'hmong');
check('"no" inside English text is resolved as English', [detectLanguage('no problem').language, detectLanguage('no problem').tokens[0].lang], ['english', 'english']);
check('"no" alone (no context) defaults to Hmong', [classifyWord('no').lang, classifyWords(['no'])[0].lang], ['hmong', 'hmong']);
check('classifyWord("no", "english") honours the supplied context', classifyWord('no', 'english').lang, 'english');
check(
  'nearby words outrank the global majority for an ambiguous word',
  classifyWords('Kuv nyob zoo tsev lub I have no phone'.split(' ')).map((c) => c.lang)[7],
  'english'
);
for (const word of ['nthuav', 'tshiab']) {
  check(`classifyWord(${word}) is Hmong`, classifyWord(word).lang, 'hmong');
  check(`detectLanguage(${word}) is Hmong`, detectLanguage(word).language, 'hmong');
}
check('a Hmong-only onset keeps a long word Hmong regardless of length', classifyWord('tshiabtshiabtshiab').lang, 'hmong');
check('valid -b syllable containing "th" is Hmong, not caught by the English "th" length rule', classifyWord('thoob').lang, 'hmong');
for (const word of ['plan', 'change', 'phone', 'chair', 'thin']) {
  check(`classifyWord(${word}) is English`, classifyWord(word).lang, 'english');
  check(`detectLanguage(${word}) is English`, detectLanguage(word).language, 'english');
}
for (const word of ['hand', 'bags', 'dog']) {
  checkTrue(`a tone-letter ending alone no longer makes "${word}" Hmong`, classifyWord(word).lang !== 'hmong', classifyWord(word));
}
for (const word of ['tub', 'kuv', 'nyob', 'ntxhais', 'tshuaj', 'dlaag']) {
  check(`valid RPA syllable "${word}" stays Hmong`, classifyWord(word).lang, 'hmong');
}
check('Hmong compounds and loan adaptations are not forced to English', [classifyWord('menyuam').lang, classifyWord('Askiv').lang], ['unknown', 'hmong']);
check('Leeg-specific onset still hints the Green dialect', classifyWord('dlej').dialectHint, 'leeg');
check('no phrasebook phrase is routed to English', HMONG_PHRASES.filter((p) => detectLanguage(p.hmong).language === 'english').map((p) => p.id), []);

// ===========================================================================
// 9. Number text and phrasebook spoken text
// ===========================================================================
check('numberToHmong(100) === "ib puas"', numberToHmong(100), 'ib puas');
const numberPhrases: Array<[id: string, value: number]> = [
  ['n_01', 1], ['n_02', 2], ['n_03', 3], ['n_04', 4], ['n_05', 5], ['n_06', 6], ['n_07', 7], ['n_08', 8], ['n_09', 9],
  ['n_10', 10], ['n_11', 11], ['n_12', 20], ['n_13', 30], ['n_14', 100], ['n_15', 1000],
];
for (const [id, value] of numberPhrases) {
  check(`phrasebook ${id} matches numberToHmong(${value})`, HMONG_PHRASES.find((p) => p.id === id)?.hmong, numberToHmong(value));
}
check('no phrasebook entry contains a spoken "/"', HMONG_PHRASES.filter((p) => p.hmong.includes('/')).map((p) => p.id), []);
check('grandmother terms are separate spoken records', HMONG_PHRASES.filter((p) => p.id === 'f_12' || p.id === 'f_13').map((p) => p.hmong), ['puj', 'niam tais']);
check('phrasebook ids are unique', new Set(HMONG_PHRASES.map((p) => p.id)).size, HMONG_PHRASES.length);

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);

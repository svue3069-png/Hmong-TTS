/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Hmong Phonological Engine & Orthographic Parser (RPA - Romanized Popular Alphabet)
 * Supporting Hmoob Dawb (White Hmong) and Moob Leeg (Green/Mong Leng) dialects.
 */

export type HmongDialect = 'dawb' | 'leeg';

export interface HmongToneInfo {
  letter: string;
  name: string;
  hmoobName: string;
  contour: number[]; // Pitch contour 0.0 to 1.0 relative scale
  chaoNumber: string; // e.g., "55", "52", "24", "33", "22", "42", "21", "22"
  ipaDiacritic: string;
  description: string;
  phonation: 'modal' | 'breathy' | 'creaky' | 'glottal';
  audioEffect: 'flat_high' | 'falling_high' | 'rising_mid' | 'flat_mid' | 'flat_low' | 'falling_breathy' | 'low_creaky' | 'low_rising';
}

export interface SyllableDecomposition {
  raw: string;
  clean: string;
  onset: string;
  vowel: string;
  toneLetter: string;
  tone: HmongToneInfo;
  ipa: string;
  formants: {
    f1: number;
    f2: number;
    f3: number;
    f1Start: number;
    f2Start: number;
    f3Start: number;
    f1End: number;
    f2End: number;
    f3End: number;
    isDiphthong: boolean;
    isNasal: boolean;
  };
  durationMs: number;
  pitchTrajectory: number[]; // F0 multiplier values across syllable duration
  isPunctuation?: boolean;
}

export interface VowelFormantProfile {
  f1Start: number;
  f2Start: number;
  f3Start: number;
  f1End: number;
  f2End: number;
  f3End: number;
  ipa: string;
  isDiphthong: boolean;
  isNasal: boolean;
}

// 8 Primary Hmong Tones in RPA Orthography based on native acoustic field studies
export const HMONG_TONES: Record<string, HmongToneInfo> = {
  b: {
    letter: 'b',
    name: 'High-Level (55)',
    hmoobName: 'Siab',
    contour: [1.0, 1.0, 0.99, 0.98],
    chaoNumber: '55',
    ipaDiacritic: '˥˥',
    description: 'High, clear, sustained pitch. Crisp modal phonation.',
    phonation: 'modal',
    audioEffect: 'flat_high',
  },
  j: {
    letter: 'j',
    name: 'High-Falling (52)',
    hmoobName: 'Nqes Siab',
    contour: [1.0, 0.95, 0.68, 0.38],
    chaoNumber: '52',
    ipaDiacritic: '˥˨',
    description: 'Starts at high ceiling and drops steeply into low register.',
    phonation: 'modal',
    audioEffect: 'falling_high',
  },
  v: {
    letter: 'v',
    name: 'Mid-Rising (24)',
    hmoobName: 'Nce Nruab Ntug',
    contour: [0.50, 0.44, 0.68, 0.88],
    chaoNumber: '24',
    ipaDiacritic: '˨˦',
    description: 'Dips slightly in mid-low register then sweeps upward.',
    phonation: 'modal',
    audioEffect: 'rising_mid',
  },
  '': {
    letter: '',
    name: 'Mid-Level (33)',
    hmoobName: 'Nruab Ntug',
    contour: [0.60, 0.60, 0.58, 0.56],
    chaoNumber: '33',
    ipaDiacritic: '˧˧',
    description: 'Unmarked neutral tone. Steady relaxed mid pitch.',
    phonation: 'modal',
    audioEffect: 'flat_mid',
  },
  s: {
    letter: 's',
    name: 'Low-Level (22)',
    hmoobName: 'Qis',
    contour: [0.35, 0.33, 0.32, 0.30],
    chaoNumber: '22',
    ipaDiacritic: '˨˨',
    description: 'Low, relaxed flat tone with lax vocal fold posture.',
    phonation: 'modal',
    audioEffect: 'flat_low',
  },
  g: {
    letter: 'g',
    name: 'Falling Breathy (42)',
    hmoobName: 'Ntxhi / Ua Pa',
    contour: [0.80, 0.68, 0.46, 0.28],
    chaoNumber: '42',
    ipaDiacritic: '˦˨̤',
    description: 'High-falling tone with audible glottal murmur and continuous breathiness.',
    phonation: 'breathy',
    audioEffect: 'falling_breathy',
  },
  m: {
    letter: 'm',
    name: 'Low Creaky Glottal (21ˀ)',
    hmoobName: 'Khaus / Tu Siab',
    contour: [0.38, 0.32, 0.22, 0.16],
    chaoNumber: '21ˀ',
    ipaDiacritic: '˨˩̰',
    description: 'Low-falling tone with vocal fry, period jitter, and abrupt glottal stop [ʔ].',
    phonation: 'creaky',
    audioEffect: 'low_creaky',
  },
  d: {
    letter: 'd',
    name: 'Low-Rising Sandhi (23)',
    hmoobName: 'Nce Qis',
    contour: [0.32, 0.30, 0.44, 0.56],
    chaoNumber: '23',
    ipaDiacritic: '˨˧',
    description: 'Low rising tone, common variant in compound tone sandhi.',
    phonation: 'modal',
    audioEffect: 'low_rising',
  },
};

// Vowel Formant mappings calibrated with dynamic diphthong transitions
export const HMONG_VOWELS: Record<string, VowelFormantProfile> = {
  // Monophthongs
  a: { f1Start: 850, f2Start: 1250, f3Start: 2600, f1End: 850, f2End: 1250, f3End: 2600, ipa: 'a', isDiphthong: false, isNasal: false },
  e: { f1Start: 520, f2Start: 1880, f3Start: 2550, f1End: 520, f2End: 1880, f3End: 2550, ipa: 'e', isDiphthong: false, isNasal: false },
  i: { f1Start: 280, f2Start: 2280, f3Start: 2950, f1End: 280, f2End: 2280, f3End: 2950, ipa: 'i', isDiphthong: false, isNasal: false },
  o: { f1Start: 510, f2Start: 870, f3Start: 2400, f1End: 510, f2End: 870, f3End: 2400, ipa: 'ɔ', isDiphthong: false, isNasal: false },
  u: { f1Start: 320, f2Start: 820, f3Start: 2320, f1End: 320, f2End: 820, f3End: 2320, ipa: 'u', isDiphthong: false, isNasal: false },
  w: { f1Start: 340, f2Start: 1420, f3Start: 2380, f1End: 340, f2End: 1420, f3End: 2380, ipa: 'ɨ', isDiphthong: false, isNasal: false }, // high back unrounded
  
  // Diphthongs (Dynamic gliding formant targets)
  ia: { f1Start: 280, f2Start: 2250, f3Start: 2900, f1End: 560, f2End: 1520, f3End: 2550, ipa: 'iə', isDiphthong: true, isNasal: false },
  ua: { f1Start: 320, f2Start: 820, f3Start: 2300, f1End: 580, f2End: 1420, f3End: 2500, ipa: 'uə', isDiphthong: true, isNasal: false },
  ai: { f1Start: 820, f2Start: 1250, f3Start: 2600, f1End: 300, f2End: 2200, f3End: 2850, ipa: 'ai', isDiphthong: true, isNasal: false },
  au: { f1Start: 820, f2Start: 1250, f3Start: 2600, f1End: 340, f2End: 850, f3End: 2350, ipa: 'au', isDiphthong: true, isNasal: false },
  aw: { f1Start: 780, f2Start: 1250, f3Start: 2600, f1End: 340, f2End: 1420, f3End: 2380, ipa: 'aɨ', isDiphthong: true, isNasal: false },
  
  // Nasalized Vowels
  ee: { f1Start: 500, f2Start: 1850, f3Start: 2650, f1End: 420, f2End: 2100, f3End: 2600, ipa: 'ẽŋ', isDiphthong: false, isNasal: true },
  oo: { f1Start: 480, f2Start: 950, f3Start: 2350, f1End: 380, f2End: 1050, f3End: 2300, ipa: 'õŋ', isDiphthong: false, isNasal: true },
};

// Dialect lexical and phonological cross-references
export const DIALECT_MAPPINGS: Array<{
  dawb: string;
  leeg: string;
  english: string;
  notes: string;
}> = [
  { dawb: 'mus', leeg: 'moog', english: 'to go', notes: 'White "mus" (u-vowel + s tone) vs Green "moog" (nasalized oo + breathy g tone)' },
  { dawb: 'lus', leeg: 'lug', english: 'word / language', notes: 'White "lus" vs Green "lug"' },
  { dawb: 'aub', leeg: 'dleev', english: 'dog', notes: 'Lexical shift: White "aub" vs Green unique "dleev" with pre-lateral stop' },
  { dawb: 'ntawm', leeg: 'ntawd', english: 'at / by', notes: 'Tone variation' },
  { dawb: 'peb', leeg: 'peb', english: 'we / three', notes: 'Shared core vocabulary' },
  { dawb: 'koj', leeg: 'koj', english: 'you', notes: 'High falling tone j' },
  { dawb: 'nyob zoo', leeg: 'nyob zoo', english: 'hello / greetings', notes: 'Universal formal Hmong greeting' },
  { dawb: 'ua tsaug', leeg: 'ua tsaug', english: 'thank you', notes: 'Universal expression of gratitude' },
  { dawb: 'tus', leeg: 'tug', english: 'classifier for persons/living things', notes: 'White s tone vs Green g tone' },
  { dawb: 'dej', leeg: 'dlaag / dleeg', english: 'water', notes: 'Phonological glide shift dl- in Green Hmong' },
  { dawb: 'tsev', leeg: 'tsev', english: 'house / home', notes: 'Shared tone v' },
  { dawb: 'hmoob', leeg: 'moob', english: 'Hmong people', notes: 'White retains voiceless aspirate hm-, Green simplifies to m-' },
];

// All valid RPA onset consonants ordered by longest match first
const ONSET_CONSONANTS_DAWB = [
  'ntsh', 'ntxh', 'nplh', 'hml', 'hny',
  'nch', 'nkh', 'nph', 'nqh', 'nrh', 'nth',
  'plh', 'tsh', 'txh',
  'npl', 'nts', 'ntx',
  'nc', 'nk', 'np', 'nq', 'nr', 'nt',
  'ch', 'kh', 'ph', 'qh', 'rh', 'th', 'ts', 'tx',
  'hl', 'hm', 'hn', 'ml', 'ny', 'pl',
  'c', 'd', 'f', 'h', 'k', 'l', 'm', 'n', 'p', 'q', 'r', 's', 't', 'v', 'x', 'y', 'z', ''
];

const ONSET_CONSONANTS_LEEG = [
  'ndlh', 'ntsh', 'ntxh', 'nplh', 'hml', 'hny',
  'ndl', 'nch', 'nkh', 'nph', 'nqh', 'nrh', 'nth',
  'dlh', 'plh', 'tsh', 'txh',
  'npl', 'nts', 'ntx',
  'nc', 'nk', 'np', 'nq', 'nr', 'nt',
  'dl', 'ch', 'kh', 'ph', 'qh', 'rh', 'th', 'ts', 'tx',
  'hl', 'hm', 'hn', 'ml', 'ny', 'pl',
  'c', 'd', 'f', 'h', 'k', 'l', 'm', 'n', 'p', 'q', 'r', 's', 't', 'v', 'x', 'y', 'z', ''
];

const VOWEL_KEYS = ['aaw', 'ai', 'au', 'aw', 'ee', 'oo', 'ia', 'ua', 'a', 'e', 'i', 'o', 'u', 'w'];
const TONE_KEYS = ['b', 'j', 'v', 's', 'g', 'm', 'd'];

/**
 * Decomposes a single Hmong RPA token into onset, nucleus vowel, and tone.
 */
export function parseHmongSyllable(token: string, dialect: HmongDialect = 'dawb'): SyllableDecomposition {
  const clean = token.toLowerCase().trim();

  // If token is punctuation or symbol
  if (/^[.,!?;:–—\s]+$/.test(clean) || clean.length === 0) {
    return {
      raw: token,
      clean: '',
      onset: '',
      vowel: '',
      toneLetter: '',
      tone: HMONG_TONES[''],
      ipa: '',
      formants: {
        f1: 500, f2: 1500, f3: 2500,
        f1Start: 500, f2Start: 1500, f3Start: 2500,
        f1End: 500, f2End: 1500, f3End: 2500,
        isDiphthong: false, isNasal: false,
      },
      durationMs: 150,
      pitchTrajectory: [0.5, 0.5],
      isPunctuation: true,
    };
  }

  // Remove any trailing punctuation from clean string
  const pureWord = clean.replace(/[^a-zA-Z]/g, '');
  if (!pureWord) {
    return {
      raw: token,
      clean: '',
      onset: '',
      vowel: '',
      toneLetter: '',
      tone: HMONG_TONES[''],
      ipa: '',
      formants: {
        f1: 500, f2: 1500, f3: 2500,
        f1Start: 500, f2Start: 1500, f3Start: 2500,
        f1End: 500, f2End: 1500, f3End: 2500,
        isDiphthong: false, isNasal: false
      },
      durationMs: 100,
      pitchTrajectory: [0.5, 0.5],
      isPunctuation: true,
    };
  }

  const onsetList = dialect === 'leeg' ? ONSET_CONSONANTS_LEEG : ONSET_CONSONANTS_DAWB;

  let identifiedOnset = '';
  let remainder = pureWord;

  // Greedily match longest onset
  for (const onset of onsetList) {
    if (onset.length > 0 && pureWord.startsWith(onset)) {
      identifiedOnset = onset;
      remainder = pureWord.slice(onset.length);
      break;
    }
  }

  // Check tone letter at end (must be single consonant from TONE_KEYS)
  let toneLetter = '';
  if (remainder.length > 1) {
    const lastChar = remainder.slice(-1);
    if (TONE_KEYS.includes(lastChar)) {
      toneLetter = lastChar;
      remainder = remainder.slice(0, -1);
    }
  }

  // Remaining string is the nucleus vowel
  let vowel = remainder;
  // Fallback if vowel wasn't cleanly captured
  if (!VOWEL_KEYS.includes(vowel)) {
    // Attempt match with known vowels
    const match = VOWEL_KEYS.find(v => vowel.startsWith(v));
    vowel = match || (vowel.length > 0 ? vowel[0] : 'a');
  }

  const toneInfo = HMONG_TONES[toneLetter] || HMONG_TONES[''];
  const formantInfo = HMONG_VOWELS[vowel] || HMONG_VOWELS['a'];

  // Base syllable duration calculation based on acoustic studies:
  // -m tone (creaky glottal cut) and -b tone are significantly shorter (~150-170ms)
  // -v tone (rising) and diphthongs are held longer (~240-280ms)
  let durationMs = 210;
  if (formantInfo.isDiphthong || formantInfo.isNasal) durationMs += 45;
  if (toneLetter === 'm') durationMs -= 45; // crisp glottal stop cutoff
  if (toneLetter === 'b') durationMs -= 25; // crisp high tone
  if (toneLetter === 'v') durationMs += 35; // elongated rising contour

  // Build IPA transcription
  const onsetIpa = getOnsetIpa(identifiedOnset, dialect);
  const vowelIpa = formantInfo.ipa;
  const ipa = `[${onsetIpa}${vowelIpa}${toneInfo.ipaDiacritic}]`;

  return {
    raw: token,
    clean: pureWord,
    onset: identifiedOnset,
    vowel,
    toneLetter,
    tone: toneInfo,
    ipa,
    formants: {
      f1: formantInfo.f1Start,
      f2: formantInfo.f2Start,
      f3: formantInfo.f3Start,
      f1Start: formantInfo.f1Start,
      f2Start: formantInfo.f2Start,
      f3Start: formantInfo.f3Start,
      f1End: formantInfo.f1End,
      f2End: formantInfo.f2End,
      f3End: formantInfo.f3End,
      isDiphthong: formantInfo.isDiphthong,
      isNasal: formantInfo.isNasal,
    },
    durationMs,
    pitchTrajectory: toneInfo.contour,
    isPunctuation: false,
  };
}

/**
 * Phonetic IPA mapping for Hmong onsets in Dawb & Leeg dialects
 */
export function getOnsetIpa(onset: string, dialect: HmongDialect): string {
  if (!onset) return '';
  const map: Record<string, string> = {
    p: 'p',
    ph: 'pʰ',
    b: 'ᵐb',
    m: 'm',
    hm: 'm̥',
    ml: 'mˡ',
    hml: 'm̥ˡ',
    f: 'f',
    v: 'v',
    pl: 'pˡ',
    plh: 'pʰˡ',
    npl: 'ᵐbˡ',
    nplh: 'ᵐpʰˡ',
    t: 't',
    th: 'tʰ',
    d: 'd',
    n: 'n',
    hn: 'n̥',
    nt: 'ⁿd',
    nth: 'ⁿtʰ',
    l: 'l',
    hl: 'l̥',
    ts: 'ʈʂ',
    tsh: 'ʈʂʰ',
    nts: 'ᶯɖʐ',
    ntsh: 'ᶯʈʂʰ',
    tx: 'ts',
    txh: 'tsʰ',
    ntx: 'ⁿdz',
    ntxh: 'ⁿtsʰ',
    c: 'c',
    ch: 'cʰ',
    nc: 'ᶮɟ',
    nch: 'ᶮcʰ',
    ny: 'ɲ',
    hny: 'ɲ̥',
    k: 'k',
    kh: 'kʰ',
    nk: 'ᵑɡ',
    nkh: 'ᵑkʰ',
    q: 'q',
    qh: 'qʰ',
    nq: 'ᶰɢ',
    nqh: 'ᶰqʰ',
    h: 'h',
    r: 'ʐ',
    rh: 'ʂ',
    nr: 'ᶯʐ',
    nrh: 'ᶯʂ',
    s: 's',
    x: 's',
    y: 'j',
    z: 'ʑ',
    // Moob Leeg unique onsets
    dl: 'tˡ',
    dlh: 'tʰˡ',
    ndl: 'ⁿdˡ',
    ndlh: 'ⁿtʰˡ',
  };

  if (dialect === 'leeg') {
    if (onset === 'hm') return 'm';
    if (onset === 'hn') return 'n';
  }

  return map[onset] || onset;
}

/**
 * Parses full Hmong sentences into structured syllables with tone sandhi rules applied.
 */
export function parseHmongText(text: string, dialect: HmongDialect = 'dawb'): SyllableDecomposition[] {
  // Normalize whitespace
  const tokens = text.replace(/([.,!?;:])/g, ' $1 ').trim().split(/\s+/).filter(Boolean);
  const results: SyllableDecomposition[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const syllable = parseHmongSyllable(token, dialect);

    // Apply Hmong Tone Sandhi:
    // If previous word had -b (55) or -j (52) tone, and current word has unmarked mid (33) or -s (22),
    // then current word shifts to -g or -d in certain grammatical compounds.
    if (i > 0 && !syllable.isPunctuation && !results[i - 1].isPunctuation) {
      const prev = results[i - 1];
      if ((prev.toneLetter === 'b' || prev.toneLetter === 'j') && (syllable.toneLetter === '' || syllable.toneLetter === 's')) {
        // Subtle Sandhi pitch adjustment for natural fluency
        if (syllable.toneLetter === '') {
          // Slight inflection lift
          syllable.pitchTrajectory = [0.68, 0.64, 0.55, 0.42];
        }
      }
    }

    results.push(syllable);
  }

  return results;
}

/**
 * Automatically converts or suggests dialect vocabulary between Hmoob Dawb and Moob Leeg
 */
export function convertDialectText(text: string, from: HmongDialect, to: HmongDialect): string {
  if (from === to) return text;

  let converted = text;
  for (const item of DIALECT_MAPPINGS) {
    const src = from === 'dawb' ? item.dawb : item.leeg;
    const tgt = to === 'dawb' ? item.dawb : item.leeg;
    if (src !== tgt) {
      const regex = new RegExp(`\\b${src}\\b`, 'gi');
      converted = converted.replace(regex, (match) => {
        // preserve case
        if (match[0] === match[0].toUpperCase()) {
          return tgt.charAt(0).toUpperCase() + tgt.slice(1);
        }
        return tgt;
      });
    }
  }

  // Dialect-specific morphological replacements
  if (from === 'dawb' && to === 'leeg') {
    // White Hmong 'hmoob' -> Green 'moob'
    converted = converted.replace(/\bHmoob\b/g, 'Moob').replace(/\bhmoob\b/g, 'moob');
    // White 'ntawm' -> Green 'ntawd'
    converted = converted.replace(/\bntawm\b/g, 'ntawd').replace(/\bNtawm\b/g, 'Ntawd');
  } else if (from === 'leeg' && to === 'dawb') {
    converted = converted.replace(/\bMoob\b/g, 'Hmoob').replace(/\bmoob\b/g, 'hmoob');
    converted = converted.replace(/\bntawd\b/g, 'ntawm').replace(/\bNtawd\b/g, 'Ntawm');
  }

  return converted;
}

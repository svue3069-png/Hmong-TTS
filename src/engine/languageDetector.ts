/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Hmong & English Multilingual Language Detector
 * Fast, accurate heuristics for Hmong RPA vs English classification & code-switching detection.
 */

import { HmongDialect } from './hmongPhonology';

export type DetectedLanguage = 'hmong' | 'english' | 'mixed';

export interface DetectionResult {
  language: DetectedLanguage;
  confidence: number; // 0.0 to 1.0
  detectedDialect?: HmongDialect;
  hmongScore: number;
  englishScore: number;
  details: string;
  tokens: Array<{
    word: string;
    lang: 'hmong' | 'english' | 'unknown';
    dialectHint?: HmongDialect;
  }>;
}

// Common Hmong words and particles
const HMONG_CORE_VOCAB_DAWB = new Set([
  'nyob', 'zoo', 'sawv', 'daws', 'hnub', 'no', 'nej', 'puas', 'kuv', 'koj', 'peb', 'lawv',
  'mus', 'tsev', 'lub', 'tus', 'daim', 'txoj', 'thiab', 'rau', 'los', 'yog', 'muaj',
  'tsaug', 'ntau', 'heev', 'dab', 'tsis', 'qhov', 'twg', 'thaum', 'mob', 'kws', 'kho',
  'noj', 'haus', 'mov', 'dej', 'hmoob', 'lus', 'hais', 'hnov', 'pom', 'paub', 'ntawm',
  'siab', 'nco', 'hlub', 'pab', 'cuam', 'txais', 'qhua', 'tuaj', 'koom', 'ua', 'neeg',
]);

const HMONG_CORE_VOCAB_LEEG = new Set([
  'nyob', 'zoo', 'suav', 'daws', 'nub', 'nua', 'mej', 'puas', 'kuv', 'koj', 'peb', 'puab',
  'moog', 'tsev', 'lub', 'tug', 'daim', 'txuj', 'hab', 'rua', 'los', 'yog', 'muaj',
  'tsaug', 'ntau', 'heev', 'dlaab', 'tsis', 'qhov', 'twg', 'thau', 'mob', 'kws', 'kho',
  'noj', 'haus', 'moov', 'dleeg', 'moob', 'lug', 'has', 'hnov', 'pum', 'paub', 'ntawd',
  'sab', 'ncu', 'hlub', 'paab', 'cuam', 'txais', 'qhua', 'tuaj', 'koom', 'ua', 'neeg',
  'dleev', 'dlaag',
]);

// Common English words
const ENGLISH_CORE_VOCAB = new Set([
  'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i', 'it', 'for', 'not', 'on',
  'with', 'he', 'as', 'you', 'do', 'at', 'this', 'but', 'his', 'by', 'from', 'they', 'we',
  'say', 'her', 'she', 'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their',
  'what', 'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me', 'when',
  'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know', 'take', 'people', 'into',
  'year', 'your', 'good', 'some', 'could', 'them', 'see', 'other', 'than', 'then', 'now',
  'look', 'only', 'come', 'its', 'over', 'think', 'also', 'back', 'after', 'use', 'two',
  'how', 'our', 'work', 'first', 'well', 'way', 'even', 'new', 'want', 'because', 'any',
  'these', 'give', 'day', 'most', 'us', 'hello', 'welcome', 'thank', 'thanks', 'please',
  'doctor', 'hospital', 'medicine', 'today', 'everyone', 'speech', 'voice', 'sound',
]);

// Characteristic Hmong RPA consonant clusters
const HMONG_UNIQUE_PATTERNS = [
  /^(hmoob|moob)$/i,
  /^(ntsh|ntxh|nplh|hml|hny|nch|nkh|nph|nqh|nrh|nth|plh|tsh|txh|npl|nts|ntx|nc|nk|np|nq|nr|nt|dlh|ndlh|ndl|dl|ch|kh|ph|qh|rh|th|ts|tx|hl|hm|hn|ml|ny|pl)/i,
];

// Typical Hmong monosyllable tone endings: b, j, v, s, g, m, d
const HMONG_TONE_LETTERS = new Set(['b', 'j', 'v', 's', 'g', 'm', 'd']);

/**
 * Classifies whether an individual word is Hmong or English
 */
export function classifyWord(token: string): { lang: 'hmong' | 'english' | 'unknown'; dialectHint?: HmongDialect } {
  const clean = token.toLowerCase().replace(/[^a-z]/g, '');
  if (!clean || clean.length < 2) return { lang: 'unknown' };

  if (ENGLISH_CORE_VOCAB.has(clean)) {
    return { lang: 'english' };
  }

  if (HMONG_CORE_VOCAB_DAWB.has(clean)) {
    const isLeegSpecific = clean === 'moog' || clean === 'lug' || clean === 'dleeg' || clean === 'dleev' || clean === 'hab' || clean === 'mej';
    return { lang: 'hmong', dialectHint: isLeegSpecific ? 'leeg' : 'dawb' };
  }

  if (HMONG_CORE_VOCAB_LEEG.has(clean)) {
    return { lang: 'hmong', dialectHint: 'leeg' };
  }

  // English morphological patterns
  if (
    clean.endsWith('tion') ||
    clean.endsWith('ing') ||
    clean.endsWith('ly') ||
    clean.endsWith('ed') ||
    clean.endsWith('ment') ||
    clean.endsWith('able') ||
    clean.endsWith('ness') ||
    clean.includes('th') && clean.length > 4 ||
    clean.includes('sh') && clean.length > 5
  ) {
    return { lang: 'english' };
  }

  // Hmong onset patterns
  const matchesHmongCluster = HMONG_UNIQUE_PATTERNS.some(re => re.test(clean));
  const endsWithTone = HMONG_TONE_LETTERS.has(clean.slice(-1));
  const isShortMonosyllable = clean.length <= 5;

  if (matchesHmongCluster || (endsWithTone && isShortMonosyllable)) {
    const dialectHint: HmongDialect = (clean.startsWith('dl') || clean.startsWith('ndl') || clean.endsWith('oog') || clean.endsWith('aaw')) ? 'leeg' : 'dawb';
    return { lang: 'hmong', dialectHint };
  }

  return { lang: 'unknown' };
}

/**
 * Detects the overall language of a text string with dialect scoring and confidence.
 */
export function detectLanguage(text: string): DetectionResult {
  const words = text
    .trim()
    .split(/\s+/)
    .map(w => w.replace(/^[^\w]+|[^\w]+$/g, ''))
    .filter(w => w.length > 0);

  if (words.length === 0) {
    return {
      language: 'hmong',
      confidence: 0.5,
      detectedDialect: 'dawb',
      hmongScore: 0.5,
      englishScore: 0.5,
      details: 'Empty text; defaulting to Hmong.',
      tokens: [],
    };
  }

  let hmongCount = 0;
  let englishCount = 0;
  let unknownCount = 0;
  let dawbVotes = 0;
  let leegVotes = 0;

  const tokensResult: DetectionResult['tokens'] = [];

  for (const w of words) {
    const res = classifyWord(w);
    tokensResult.push({ word: w, lang: res.lang, dialectHint: res.dialectHint });

    if (res.lang === 'hmong') {
      hmongCount++;
      if (res.dialectHint === 'leeg') leegVotes++;
      else dawbVotes++;
    } else if (res.lang === 'english') {
      englishCount++;
    } else {
      unknownCount++;
    }
  }

  const totalClassified = hmongCount + englishCount;

  // Calculate scores
  let hmongScore = totalClassified > 0 ? hmongCount / totalClassified : 0.5;
  let englishScore = totalClassified > 0 ? englishCount / totalClassified : 0.5;

  // Tone frequency heuristic across all words (Hmong text has >70% words ending in tone consonants b,j,v,s,g,m,d)
  const toneEndingCount = words.filter(w => {
    const clean = w.toLowerCase().replace(/[^a-z]/g, '');
    return clean.length >= 2 && clean.length <= 6 && HMONG_TONE_LETTERS.has(clean.slice(-1));
  }).length;
  const toneRatio = toneEndingCount / words.length;

  if (toneRatio > 0.45) {
    hmongScore = Math.max(hmongScore, 0.85);
  }

  // Dialect resolution
  const detectedDialect: HmongDialect = leegVotes > dawbVotes ? 'leeg' : 'dawb';

  // Overall classification
  let language: DetectedLanguage = 'hmong';
  let confidence = 0.5;
  let details = '';

  if (hmongCount > 0 && englishCount > 0 && Math.abs(hmongCount - englishCount) <= Math.max(2, words.length * 0.35)) {
    language = 'mixed';
    confidence = Math.min(1.0, 0.6 + (hmongCount + englishCount) / words.length * 0.4);
    details = `Code-switched bilingual text: ${hmongCount} Hmong words, ${englishCount} English words.`;
  } else if (englishCount > hmongCount && toneRatio < 0.25) {
    language = 'english';
    confidence = Math.min(0.99, Math.max(0.65, englishScore * 0.95));
    details = `Classified as English (${Math.round(confidence * 100)}% confidence).`;
  } else {
    language = 'hmong';
    confidence = Math.min(0.99, Math.max(0.7, (hmongScore * 0.7 + toneRatio * 0.3)));
    details = `Classified as Hmong (${detectedDialect === 'dawb' ? 'Hmoob Dawb' : 'Moob Leeg'}, ${Math.round(confidence * 100)}% confidence).`;
  }

  return {
    language,
    confidence: Math.round(confidence * 100) / 100,
    detectedDialect,
    hmongScore: Math.round(hmongScore * 100) / 100,
    englishScore: Math.round(englishScore * 100) / 100,
    details,
    tokens: tokensResult,
  };
}

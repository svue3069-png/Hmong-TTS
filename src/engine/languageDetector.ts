/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Hmong & English Multilingual Language Detector
 * Fast, accurate heuristics for Hmong RPA vs English classification & code-switching detection.
 */

import { HmongDialect, classifyRpaShape, isValidRpaSyllable } from './hmongPhonology.ts';

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

/** Classification of a single word. */
export interface WordClassification {
  lang: 'hmong' | 'english' | 'unknown';
  dialectHint?: HmongDialect;
}

// Common Hmong words and particles
const HMONG_CORE_VOCAB_DAWB = new Set([
  'nyob', 'zoo', 'sawv', 'daws', 'hnub', 'no', 'nej', 'puas', 'kuv', 'koj', 'peb', 'lawv',
  'mus', 'tsev', 'lub', 'tus', 'daim', 'txoj', 'thiab', 'rau', 'los', 'yog', 'muaj',
  'tsaug', 'ntau', 'heev', 'dab', 'tsis', 'qhov', 'twg', 'thaum', 'mob', 'kws', 'kho',
  'noj', 'haus', 'mov', 'dej', 'hmoob', 'lus', 'hais', 'hnov', 'pom', 'paub', 'ntawm',
  'siab', 'nco', 'hlub', 'pab', 'cuam', 'txais', 'qhua', 'tuaj', 'koom', 'ua', 'neeg',
  'tsiab', 'caug', 'taub', 'hau', 'tos', 'vim', 'ntxhais', 'tub', 'txiv', 'niam',
  // Loanword whose spelling is not a single RPA syllable ("Askiv" = English language/people).
  'askiv',
]);

const HMONG_CORE_VOCAB_LEEG = new Set([
  'nyob', 'zoo', 'suav', 'daws', 'nub', 'nua', 'mej', 'puas', 'kuv', 'koj', 'peb', 'puab',
  'moog', 'tsev', 'lub', 'tug', 'daim', 'txuj', 'hab', 'rua', 'los', 'yog', 'muaj',
  'tsaug', 'ntau', 'heev', 'dlaab', 'tsis', 'qhov', 'twg', 'thau', 'mob', 'kws', 'kho',
  'noj', 'haus', 'moov', 'dleeg', 'moob', 'lug', 'has', 'hnov', 'pum', 'paub', 'ntawd',
  'sab', 'ncu', 'hlub', 'paab', 'cuam', 'txais', 'qhua', 'tuaj', 'koom', 'ua', 'neeg',
  'dleev', 'dlaag', 'tsiab', 'caug', 'taub', 'hau', 'tos', 'vim', 'nam', 'txiv',
  'askiv',
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
  'love', 'speak', 'learn', 'am', 'is', 'are', 'was', 'were', 'need', 'help', 'english',
  'home', 'school', 'friend', 'family', 'name', 'language', 'word', 'sentence', 'read',
  'write', 'understand', 'hmong',
  // Common words whose spelling happens to fit RPA structure ("dog" is d+o+g, "phone" is pho+ne),
  // so the structural checks below cannot recognise them as non-Hmong.
  'dog', 'phone',
]);

// Words listed in BOTH an English and a Hmong vocabulary (e.g. "no": English "no", Hmong "no" = this/cold).
// They cannot be classified in isolation; classifyWords()/detectLanguage() resolve them from the
// surrounding words.
const AMBIGUOUS_WORDS = new Set(
  [...ENGLISH_CORE_VOCAB].filter((word) => HMONG_CORE_VOCAB_DAWB.has(word) || HMONG_CORE_VOCAB_LEEG.has(word))
);

// RPA onsets that never begin an ordinary English word. A word that opens with one of these followed by a
// vowel letter ("nthuav", "tshiab") is Hmong whatever its length, so the English length/suffix rules never
// apply to it. Onsets shared with English ("pl", "ch", "ph", "th", "kh", "rh", "ts", "ny", "hm", ...) prove
// nothing on their own and are deliberately absent: "plan", "change", "phone", "chair" and "thin" are English.
const HMONG_ONLY_ONSET_PATTERN =
  /^(?:ndlh|ntsh|ntxh|nplh|nch|nkh|nph|nqh|nrh|nth|plh|dlh|tsh|txh|hml|hny|npl|nts|ntx|ndl|nc|nk|np|nq|nr|nt|dl|qh|tx|hl|hn|ml)[aeiouw]/;

// Typical Hmong monosyllable tone endings: b, j, v, s, g, m, d
const HMONG_TONE_LETTERS = new Set(['b', 'j', 'v', 's', 'g', 'm', 'd']);

/** Maximum distance (in words) at which neighbouring words vote on an ambiguous word. */
const AMBIGUITY_WINDOW = 3;

interface RawClassification extends WordClassification {
  /** The word is in both vocabularies; its language must come from context. */
  ambiguous?: boolean;
}

function cleanToken(token: string): string {
  return token.toLowerCase().replace(/[^a-z]/g, '');
}

function dialectHintForCluster(clean: string): HmongDialect {
  return clean.startsWith('dl') || clean.startsWith('ndl') || clean.endsWith('oog') || clean.endsWith('aaw')
    ? 'leeg'
    : 'dawb';
}

function classifyClean(clean: string): RawClassification {
  if (!clean) return { lang: 'unknown' };

  // Words present in both vocabularies are decided by context, not by which set is consulted first.
  if (AMBIGUOUS_WORDS.has(clean)) {
    return { lang: 'hmong', dialectHint: 'dawb', ambiguous: true };
  }

  // Check the English lexicon before the length guard so valid words like "I" and "a"
  // are not sent through the Hmong fallback.
  if (ENGLISH_CORE_VOCAB.has(clean)) {
    return { lang: 'english' };
  }

  if (clean.length < 2) return { lang: 'unknown' };

  if (HMONG_CORE_VOCAB_DAWB.has(clean)) {
    const isLeegSpecific = clean === 'moog' || clean === 'lug' || clean === 'dleeg' || clean === 'dleev' || clean === 'hab' || clean === 'mej';
    return { lang: 'hmong', dialectHint: isLeegSpecific ? 'leeg' : 'dawb' };
  }

  if (HMONG_CORE_VOCAB_LEEG.has(clean)) {
    return { lang: 'hmong', dialectHint: 'leeg' };
  }

  // A Hmong-only onset (anchored to the START of the word) followed by a vowel keeps the word Hmong
  // regardless of length or of English-looking substrings such as the "th" inside "nthuav".
  if (HMONG_ONLY_ONSET_PATTERN.test(clean)) {
    return { lang: 'hmong', dialectHint: dialectHintForCluster(clean) };
  }

  // English morphological patterns that no RPA syllable can produce (plus "-ed")
  if (
    clean.endsWith('tion') ||
    clean.endsWith('ing') ||
    clean.endsWith('ly') ||
    clean.endsWith('ed') ||
    clean.endsWith('ment') ||
    clean.endsWith('able') ||
    clean.endsWith('ness')
  ) {
    return { lang: 'english' };
  }

  // A tone-letter ending alone proves nothing ("hand", "bags", "cat" all end in one): the WHOLE word
  // must be a well-formed RPA syllable, i.e. valid onset + known rime + tone letter.
  if (HMONG_TONE_LETTERS.has(clean.slice(-1)) && isValidRpaSyllable(clean)) {
    return { lang: 'hmong', dialectHint: dialectHintForCluster(clean) };
  }

  // Weaker English cues; Hmong words they could hit were already claimed above.
  if ((clean.includes('th') && clean.length > 4) || (clean.includes('sh') && clean.length > 5)) {
    return { lang: 'english' };
  }

  // Not buildable from RPA syllables at all (final or internal consonants such as "plan", "chair",
  // "change", "thin"): it cannot be Hmong, and the only other language here is English. Open-syllable
  // compounds ("menyuam") and loan adaptations stay unknown rather than being forced to either side.
  if (classifyRpaShape(clean) === 'none') {
    return { lang: 'english' };
  }

  return { lang: 'unknown' };
}

function resolveAmbiguous(lang: 'hmong' | 'english'): WordClassification {
  return lang === 'english' ? { lang: 'english' } : { lang: 'hmong', dialectHint: 'dawb' };
}

/**
 * Classifies whether an individual word is Hmong or English.
 *
 * Words that exist in both vocabularies (such as "no") cannot be decided from the word alone: pass the
 * language of the surrounding text as `context`, or omit it to default to Hmong. Use classifyWords()
 * to classify a whole sequence with automatic context resolution.
 */
export function classifyWord(token: string, context?: 'hmong' | 'english'): WordClassification {
  const raw = classifyClean(cleanToken(token));
  if (raw.ambiguous) return resolveAmbiguous(context ?? 'hmong');
  return raw.dialectHint ? { lang: raw.lang, dialectHint: raw.dialectHint } : { lang: raw.lang };
}

/**
 * Classifies a sequence of words. Words that appear in both vocabularies are resolved by the majority
 * language of the unambiguous words around them (within AMBIGUITY_WINDOW words, then the whole
 * sequence), defaulting to Hmong when there is no context.
 */
export function classifyWords(tokens: string[]): WordClassification[] {
  const raw = tokens.map((token) => classifyClean(cleanToken(token)));

  const tally = (from: number, to: number) => {
    let hmong = 0;
    let english = 0;
    for (let i = Math.max(0, from); i <= Math.min(raw.length - 1, to); i++) {
      if (raw[i].ambiguous) continue;
      if (raw[i].lang === 'hmong') hmong++;
      else if (raw[i].lang === 'english') english++;
    }
    return { hmong, english };
  };
  const overall = tally(0, raw.length - 1);

  return raw.map((item, i) => {
    if (!item.ambiguous) {
      return item.dialectHint ? { lang: item.lang, dialectHint: item.dialectHint } : { lang: item.lang };
    }
    const nearby = tally(i - AMBIGUITY_WINDOW, i + AMBIGUITY_WINDOW);
    // Local evidence first; a local tie falls back to the whole text; a full tie (or no evidence) is Hmong.
    const votes = nearby.hmong !== nearby.english ? nearby : overall;
    return resolveAmbiguous(votes.english > votes.hmong ? 'english' : 'hmong');
  });
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
  const classified = classifyWords(words);

  for (let i = 0; i < words.length; i++) {
    const res = classified[i];
    tokensResult.push({ word: words[i], lang: res.lang, dialectHint: res.dialectHint });

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

  // Tone frequency heuristic: Hmong text has many words ending in the tone consonants b,j,v,s,g,m,d.
  // Only words actually classified as Hmong count, so English words that merely end in one of those
  // letters ("and", "is", "big") do not inflate the ratio.
  const toneEndingCount = words.filter((w, i) => {
    const clean = cleanToken(w);
    return classified[i].lang === 'hmong' && clean.length >= 2 && HMONG_TONE_LETTERS.has(clean.slice(-1));
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

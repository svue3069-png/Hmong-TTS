/**
 * Phonology engine regression tests. Run: bun scripts/test-phonology.ts
 */
import {
  parseHmongSyllable,
  parseHmongText,
  convertDialectText,
  getOnsetIpa,
  HMONG_VOWELS,
} from '../src/engine/hmongPhonology.ts';

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

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);

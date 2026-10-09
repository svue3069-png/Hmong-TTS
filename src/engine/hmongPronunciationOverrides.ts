/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Hmong Pronunciation Overrides & Lexicon Dictionary
 * Inspired by and compatible with Hmoob TTS Studio (https://lwazkaev.gensparkspace.com/)
 * 
 * Allows users to inspect, fix, and customize the pronunciation of any Hmong RPA word:
 * - Custom English-friendly phonetic respelling
 * - Custom IPA transcription
 * - Tone letter and Chao pitch contour number
 * - English gloss / meaning and cultural notes
 * - Persistent storage across sessions with instant audio synthesis overrides
 */

export interface PronunciationOverride {
  id: string;
  word: string; // Clean lowercase RPA word
  respelling: string; // English-friendly pronunciation respelling
  ipa: string; // International Phonetic Alphabet string
  toneLetter: string; // b, j, v, s, g, m, d, or '' (unmarked)
  chaoNumber?: string; // e.g. '55', '52', '24', '33', '11', '42', '34'
  gloss?: string; // English translation or grammatical role
  note?: string; // Etymological or usage note
  source: 'preset' | 'user';
  updatedAt: string;
}

const STORAGE_KEY = 'hmong.tts.pronunciation.corrections.v2';

/**
 * High-frequency verified Hmong RPA words with native IPA and English-friendly respellings
 * from Hmoob TTS Studio lexicon and Hmong Dictionary archives
 */
export const DEFAULT_PRONUNCIATION_OVERRIDES: Record<string, Omit<PronunciationOverride, 'id' | 'source' | 'updatedAt'>> = {
  nyob: {
    word: 'nyob',
    respelling: 'nyaw',
    ipa: '[ɲɔ˥]',
    toneLetter: 'b',
    chaoNumber: '55',
    gloss: 'to live, to stay, to be at',
    note: 'In "Nyob zoo" (hello), pronounced with high level tone.',
  },
  zoo: {
    word: 'zoo',
    respelling: 'zhaw',
    ipa: '[ʑɔ˧˧]',
    toneLetter: '',
    chaoNumber: '33',
    gloss: 'good, well, fine',
    note: 'Unmarked mid-level tone with voiced alveolo-palatal onset.',
  },
  kuv: {
    word: 'kuv',
    respelling: 'koo',
    ipa: '[ku˨˦]',
    toneLetter: 'v',
    chaoNumber: '24',
    gloss: 'I, me, my',
    note: 'High-rising tone. Common mistake is saying "koov" with a v consonant.',
  },
  koj: {
    word: 'koj',
    respelling: 'kaw',
    ipa: '[kɔ˥˨]',
    toneLetter: 'j',
    chaoNumber: '52',
    gloss: 'you, your (singular)',
    note: 'High-falling tone starting high and dropping sharply.',
  },
  nws: {
    word: 'nws',
    respelling: 'nuh',
    ipa: '[nɨ˨˦]',
    toneLetter: 's',
    chaoNumber: '24',
    gloss: 'he, she, it; him, her',
    note: 'Mid-rising tone with central close unrounded vowel /ɨ/.',
  },
  peb: {
    word: 'peb',
    respelling: 'pay',
    ipa: '[pe˥˥]',
    toneLetter: 'b',
    chaoNumber: '55',
    gloss: 'we, us; three (3)',
    note: 'High-level tone. Distinct from pe (to bow/worship).',
  },
  lawv: {
    word: 'lawv',
    respelling: 'lah',
    ipa: '[la˨˦]',
    toneLetter: 'v',
    chaoNumber: '24',
    gloss: 'they, them, their',
    note: 'Rising tone on low central vowel /a/.',
  },
  yog: {
    word: 'yog',
    respelling: 'yaw',
    ipa: '[jɔ˦˨]',
    toneLetter: 'g',
    chaoNumber: '42',
    gloss: 'to be, is, yes',
    note: 'Breathy murmur tone with downward inflection.',
  },
  tsis: {
    word: 'tsis',
    respelling: 'chee',
    ipa: '[tsʰi˨˦]',
    toneLetter: 's',
    chaoNumber: '24',
    gloss: 'not, no (standard negation marker)',
    note: 'Aspirated affricate /tsʰ/ with mid-rising tone.',
  },
  ua: {
    word: 'ua',
    respelling: 'oo-uh',
    ipa: '[uə˧˧]',
    toneLetter: '',
    chaoNumber: '33',
    gloss: 'to do, to make, to act',
    note: 'Diphthong glide /uə/ with unmarked mid pitch.',
  },
  tsaug: {
    word: 'tsaug',
    respelling: 'chow',
    ipa: '[tsʰau˦˨]',
    toneLetter: 'g',
    chaoNumber: '42',
    gloss: 'to thank; blessing, shadow',
    note: 'In "Ua tsaug" (thank you). Breathy falling diphthong /au/.',
  },
  sawv: {
    word: 'sawv',
    respelling: 'shah',
    ipa: '[ʂa˨˦]',
    toneLetter: 'v',
    chaoNumber: '24',
    gloss: 'to stand, wake up, arise',
    note: 'Retroflex voiceless fricative /ʂ/ with rising tone.',
  },
  daws: {
    word: 'daws',
    respelling: 'dah',
    ipa: '[da˨˦]',
    toneLetter: 's',
    chaoNumber: '24',
    gloss: 'all, together (in sawv daws)',
    note: 'In "Sawv daws" (everyone / all of you).',
  },
  siab: {
    word: 'siab',
    respelling: 'shah',
    ipa: '[ʃa˥˥]',
    toneLetter: 'b',
    chaoNumber: '55',
    gloss: 'liver (seat of emotions); high; mind',
    note: 'In "zoo siab" (happy / glad). High-level tone.',
  },
  heev: {
    word: 'heev',
    respelling: 'hay',
    ipa: '[he˨˦]',
    toneLetter: 'v',
    chaoNumber: '24',
    gloss: 'very, extremely, intensely',
    note: 'Intensifier following adjectives.',
  },
  tau: {
    word: 'tau',
    respelling: 'tow',
    ipa: '[tau˧˧]',
    toneLetter: '',
    chaoNumber: '33',
    gloss: 'to get, obtain, can, past tense marker',
    note: 'Unmarked mid-tone diphthong.',
  },
  ntsib: {
    word: 'ntsib',
    respelling: 'unjee',
    ipa: '[ntsi˥˥]',
    toneLetter: 'b',
    chaoNumber: '55',
    gloss: 'to meet, encounter, see each other',
    note: 'Prenasalized affricate with high-level tone.',
  },
  nej: {
    word: 'nej',
    respelling: 'nay',
    ipa: '[ne˥˨]',
    toneLetter: 'j',
    chaoNumber: '52',
    gloss: 'you (plural / all of you)',
    note: 'High-falling tone.',
  },
  hnub: {
    word: 'hnub',
    respelling: 'noo',
    ipa: '[n̥u˥˥]',
    toneLetter: 'b',
    chaoNumber: '55',
    gloss: 'day, sun, date',
    note: 'Devoiced whispered nasal onset /n̥/ with high tone.',
  },
  no: {
    word: 'no',
    respelling: 'naw',
    ipa: '[nɔ˧˧]',
    toneLetter: '',
    chaoNumber: '33',
    gloss: 'this, here, now; cold',
    note: 'In "hnub no" (today).',
  },
  mov: {
    word: 'mov',
    respelling: 'maw',
    ipa: '[mɔ˨˦]',
    toneLetter: 'v',
    chaoNumber: '24',
    gloss: 'cooked rice; general food/meal',
    note: 'The foundational staple of Hmong dining.',
  },
  dej: {
    word: 'dej',
    respelling: 'day',
    ipa: '[de˥˨]',
    toneLetter: 'j',
    chaoNumber: '52',
    gloss: 'water, stream, river',
    note: 'In "haus dej" (drink water).',
  },
  noj: {
    word: 'noj',
    respelling: 'naw',
    ipa: '[nɔ˥˨]',
    toneLetter: 'j',
    chaoNumber: '52',
    gloss: 'to eat, consume, celebrate',
    note: 'In "noj mov" (eat food / meal).',
  },
  haus: {
    word: 'haus',
    respelling: 'how',
    ipa: '[hau˨˦]',
    toneLetter: 's',
    chaoNumber: '24',
    gloss: 'to drink, inhale',
    note: 'Rising tone diphthong.',
  },
  mus: {
    word: 'mus',
    respelling: 'moo',
    ipa: '[mu˨˦]',
    toneLetter: 's',
    chaoNumber: '24',
    gloss: 'to go, depart, travel',
    note: 'In "mus zoo" (goodbye / go well).',
  },
  los: {
    word: 'los',
    respelling: 'law',
    ipa: '[lɔ˨˦]',
    toneLetter: 's',
    chaoNumber: '24',
    gloss: 'to come, return, arrive; or',
    note: 'Mid-rising tone.',
  },
  tsev: {
    word: 'tsev',
    respelling: 'jay',
    ipa: '[tse˨˦]',
    toneLetter: 'v',
    chaoNumber: '24',
    gloss: 'house, home, building',
    note: 'In "tsev kawm ntawv" (school) and "tsev kho mob" (hospital).',
  },
  ntawv: {
    word: 'ntawv',
    respelling: 'untuh',
    ipa: '[ntɨ˨˦]',
    toneLetter: 'v',
    chaoNumber: '24',
    gloss: 'book, paper, letter, writing',
    note: 'Prenasalized /nt/ with central vowel.',
  },
  hmoob: {
    word: 'hmoob',
    respelling: 'hmong',
    ipa: '[m̥ɔ˥˥]',
    toneLetter: 'b',
    chaoNumber: '55',
    gloss: 'Hmong person / language',
    note: 'The ethnonym of the Hmong people in White Hmong.',
  },
  moob: {
    word: 'moob',
    respelling: 'mong',
    ipa: '[mɔ˥˥]',
    toneLetter: 'b',
    chaoNumber: '55',
    gloss: 'Mong Leng / Green Hmong ethnonym',
    note: 'Green Hmong dialect counterpart to Hmoob.',
  },
  txiv: {
    word: 'txiv',
    respelling: 'tsee',
    ipa: '[tsi˨˦]',
    toneLetter: 'v',
    chaoNumber: '24',
    gloss: 'father, husband, male; fruit',
    note: 'In "niam txiv" (parents).',
  },
  niam: {
    word: 'niam',
    respelling: 'nee-uh',
    ipa: '[niə˨˩]',
    toneLetter: 'm',
    chaoNumber: '21',
    gloss: 'mother, wife, woman; primary',
    note: 'Low-creaky glottalized tone.',
  },
  hlub: {
    word: 'hlub',
    respelling: 'loo',
    ipa: '[l̥u˥˥]',
    toneLetter: 'b',
    chaoNumber: '55',
    gloss: 'to love, care for, cherish',
    note: 'Voiceless alveolar lateral fricative onset.',
  },
  nyiam: {
    word: 'nyiam',
    respelling: 'nyee-uh',
    ipa: '[ɲiə˨˩]',
    toneLetter: 'm',
    chaoNumber: '21',
    gloss: 'to like, appreciate, favor',
    note: 'Palatal nasal /ɲ/ with creaky low tone.',
  },
  txim: {
    word: 'txim',
    respelling: 'tsee',
    ipa: '[tsi˨˩]',
    toneLetter: 'm',
    chaoNumber: '21',
    gloss: 'fault, crime, blame; punishment',
    note: 'In "Thov txim" (excuse me / I am sorry).',
  },
  thov: {
    word: 'thov',
    respelling: 'taw',
    ipa: '[tʰɔ˨˦]',
    toneLetter: 'v',
    chaoNumber: '24',
    gloss: 'to ask, beg, please, pray',
    note: 'Aspirated dental stop /tʰ/.',
  },
  pab: {
    word: 'pab',
    respelling: 'pah',
    ipa: '[pa˥˥]',
    toneLetter: 'b',
    chaoNumber: '55',
    gloss: 'to help, assist; a group/team',
    note: 'In "Pab kuv" (Help me).',
  },
  kev: {
    word: 'kev',
    respelling: 'kay',
    ipa: '[ke˨˦]',
    toneLetter: 'v',
    chaoNumber: '24',
    gloss: 'way, road, path, matter, custom',
    note: 'Nominalizer for abstract concepts (e.g., kev hlub = love).',
  },
};

class PronunciationOverrideStore {
  private cache: Map<string, PronunciationOverride> = new Map();
  private isLoaded = false;

  constructor() {
    this.load();
  }

  private load(): void {
    this.cache.clear();

    // 1. Load verified defaults
    Object.entries(DEFAULT_PRONUNCIATION_OVERRIDES).forEach(([k, item]) => {
      this.cache.set(k.toLowerCase(), {
        ...item,
        id: `preset_${k}`,
        source: 'preset',
        updatedAt: '2026-01-01T00:00:00.000Z',
      });
    });

    // 2. Load user overrides from localStorage
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            parsed.forEach((item: PronunciationOverride) => {
              if (item && item.word) {
                this.cache.set(item.word.toLowerCase().trim(), {
                  ...item,
                  source: 'user',
                });
              }
            });
          }
        }
      } catch (err) {
        console.warn('Failed to parse user pronunciation overrides from localStorage:', err);
      }
    }

    this.isLoaded = true;
  }

  private saveUserOverrides(): void {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      const userItems = Array.from(this.cache.values()).filter((item) => item.source === 'user');
      localStorage.setItem(STORAGE_KEY, JSON.stringify(userItems));
    } catch (err) {
      console.warn('Failed to save pronunciation overrides to localStorage:', err);
    }
  }

  /**
   * Retrieves all overrides (both system presets and user fixes)
   */
  public getAll(): PronunciationOverride[] {
    if (!this.isLoaded) this.load();
    return Array.from(this.cache.values()).sort((a, b) => a.word.localeCompare(b.word));
  }

  /**
   * Retrieves user-customized overrides only
   */
  public getUserOverrides(): PronunciationOverride[] {
    if (!this.isLoaded) this.load();
    return Array.from(this.cache.values()).filter((i) => i.source === 'user');
  }

  /**
   * Retrieves override for a specific clean Hmong word
   */
  public get(word: string): PronunciationOverride | undefined {
    if (!this.isLoaded) this.load();
    const clean = word.toLowerCase().replace(/[^a-zA-Z]/g, '').trim();
    return this.cache.get(clean);
  }

  /**
   * Saves or updates a pronunciation override
   */
  public set(
    override: Omit<PronunciationOverride, 'id' | 'source' | 'updatedAt'> & { id?: string; source?: 'preset' | 'user' }
  ): PronunciationOverride {
    const cleanWord = override.word.toLowerCase().replace(/[^a-zA-Z]/g, '').trim();
    const item: PronunciationOverride = {
      id: override.id || `user_${cleanWord}_${Date.now()}`,
      word: cleanWord,
      respelling: override.respelling.trim(),
      ipa: override.ipa.trim(),
      toneLetter: override.toneLetter ?? '',
      chaoNumber: override.chaoNumber,
      gloss: override.gloss?.trim(),
      note: override.note?.trim(),
      source: 'user',
      updatedAt: new Date().toISOString(),
    };

    this.cache.set(cleanWord, item);
    this.saveUserOverrides();
    return item;
  }

  /**
   * Removes a user override (reverting back to system default if one exists)
   */
  public delete(word: string): boolean {
    const clean = word.toLowerCase().replace(/[^a-zA-Z]/g, '').trim();
    if (!this.cache.has(clean)) return false;

    if (DEFAULT_PRONUNCIATION_OVERRIDES[clean]) {
      // Revert to preset
      this.cache.set(clean, {
        ...DEFAULT_PRONUNCIATION_OVERRIDES[clean],
        id: `preset_${clean}`,
        source: 'preset',
        updatedAt: '2026-01-01T00:00:00.000Z',
      });
    } else {
      this.cache.delete(clean);
    }

    this.saveUserOverrides();
    return true;
  }

  /**
   * Resets all user overrides back to system baseline defaults
   */
  public resetToDefaults(): void {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem(STORAGE_KEY);
    }
    this.load();
  }

  /**
   * Export corrections dictionary to JSON string
   */
  public exportJson(): string {
    return JSON.stringify(this.getAll(), null, 2);
  }

  /**
   * Import corrections dictionary from JSON string
   */
  public importJson(jsonStr: string): number {
    try {
      const data = JSON.parse(jsonStr);
      if (!Array.isArray(data)) return 0;
      let count = 0;
      data.forEach((item) => {
        if (item && item.word && item.respelling) {
          this.set({
            word: item.word,
            respelling: item.respelling,
            ipa: item.ipa || '',
            toneLetter: item.toneLetter || '',
            chaoNumber: item.chaoNumber,
            gloss: item.gloss,
            note: item.note,
          });
          count++;
        }
      });
      return count;
    } catch {
      return 0;
    }
  }
}

export const hmongPronunciationStore = new PronunciationOverrideStore();

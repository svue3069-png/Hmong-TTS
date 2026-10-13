/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Tone Guide Modal
 * Educational guide detailing the full set of 8 Hmong RPA tones, their IPA equivalents,
 * Chao tone numbers, phonation types, acoustic mechanics, and example words with instant audio audition.
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Volume2,
  Square,
  Play,
  BookOpen,
  Search,
  Sparkles,
  Info,
  Activity,
  Layers,
  ArrowRight,
  Sliders,
  Check,
} from 'lucide-react';
import { HmongDialect, HMONG_TONES } from '../engine/hmongPhonology';
import { hmongTTS, HMONG_VOICE_PROFILES } from '../engine/hmongAudioSynthesizer';
import { taskCoordinator } from '../engine/taskCoordinator';
import { TONE_COLORS } from './InteractivePitchContourVisualizer';

export interface ToneGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  dialect?: HmongDialect;
  onSelectTone?: (toneKey: string) => void;
}

export interface ToneGuideEntry {
  key: string;
  letterLabel: string;
  hmoobName: string;
  englishName: string;
  chaoNumber: string;
  ipaDiacritic: string;
  fullIpa: string;
  pitchTrajectoryDescription: string;
  phonationType: 'modal' | 'breathy' | 'creaky' | 'sandhi';
  phonationBadge: string;
  minimalPairWord: string;
  minimalPairMeaning: string;
  acousticMechanics: string;
  commonExamples: Array<{
    word: string;
    meaning: string;
    ipa: string;
  }>;
}

export const TONE_GUIDE_DATA: ToneGuideEntry[] = [
  {
    key: 'b',
    letterLabel: '-b',
    hmoobName: 'Siab',
    englishName: 'High-Level',
    chaoNumber: '55',
    ipaDiacritic: '˥˥',
    fullIpa: '[pɔ˥˥]',
    pitchTrajectoryDescription: 'High, clear, sustained pitch held steadily at the top level 5 throughout the entire syllable duration.',
    phonationType: 'modal',
    phonationBadge: 'Modal (Clean Vibration)',
    minimalPairWord: 'pob',
    minimalPairMeaning: 'ball, lump, rock, pocket',
    acousticMechanics: 'Vocal folds are stretched taut and thin with elevated subglottal pressure (~+3.8 semitones above base pitch), producing a crisp, resonant tone that does not decline.',
    commonExamples: [
      { word: 'siab', meaning: 'high, liver, heart, mind', ipa: '[ʃiə˥˥]' },
      { word: 'hnub', meaning: 'sun, day', ipa: '[n̥u˥˥]' },
      { word: 'tib', meaning: 'one, single, strike', ipa: '[ti˥˥]' },
      { word: 'tub', meaning: 'son, boy, student', ipa: '[tu˥˥]' },
    ],
  },
  {
    key: 'j',
    letterLabel: '-j',
    hmoobName: 'Nqes Siab',
    englishName: 'High-Falling',
    chaoNumber: '52',
    ipaDiacritic: '˥˨',
    fullIpa: '[pɔ˥˨]',
    pitchTrajectoryDescription: 'Starts at the high ceiling (level 5) and drops steeply downward into the lower-mid register (level 2).',
    phonationType: 'modal',
    phonationBadge: 'Modal (Steep Down-Glide)',
    minimalPairWord: 'poj',
    minimalPairMeaning: 'female, grandmother, old woman',
    acousticMechanics: 'A rapid relaxation of the cricothyroid muscle causes a steep fundamental frequency descent across the vowel nucleus and coda, shedding ~6 to 7 semitones.',
    commonExamples: [
      { word: 'koj', meaning: 'you (singular)', ipa: '[kɔ˥˨]' },
      { word: 'nej', meaning: 'you all (plural)', ipa: '[ne˥˨]' },
      { word: 'ntsej', meaning: 'ear', ipa: '[ᶯd͡ʒe˥˨]' },
      { word: 'tuaj', meaning: 'to come, arrive', ipa: '[tua˥˨]' },
    ],
  },
  {
    key: 'v',
    letterLabel: '-v',
    hmoobName: 'Nce Nruab Ntug',
    englishName: 'Mid-Rising',
    chaoNumber: '24',
    ipaDiacritic: '˨˦',
    fullIpa: '[pɔ˨˦]',
    pitchTrajectoryDescription: 'Dips initially in the lower-mid register (level 2), then sweeps upward with a melodic rising scoop to level 4.',
    phonationType: 'modal',
    phonationBadge: 'Modal (Rising Scoop)',
    minimalPairWord: 'pov',
    minimalPairMeaning: 'to throw, cast away, fling',
    acousticMechanics: 'Vocal folds begin in a lax posture before increasing tension during the latter half of the vowel, creating an articulate scoop upward of +3.5 semitones.',
    commonExamples: [
      { word: 'kuv', meaning: 'I, me, my', ipa: '[ku˨˦]' },
      { word: 'sawv', meaning: 'to stand up, rise', ipa: '[saɨ˨˦]' },
      { word: 'mov', meaning: 'cooked rice, meal', ipa: '[mɔ˨˦]' },
      { word: 'kev', meaning: 'way, road, path', ipa: '[ke˨˦]' },
    ],
  },
  {
    key: '',
    letterLabel: '-ø (unmarked)',
    hmoobName: 'Nruab Ntug',
    englishName: 'Mid-Level',
    chaoNumber: '33',
    ipaDiacritic: '˧˧',
    fullIpa: '[pɔ˧˧]',
    pitchTrajectoryDescription: 'Steady, neutral, relaxed pitch sustained right in the conversational center (level 3).',
    phonationType: 'modal',
    phonationBadge: 'Modal (Baseline Default)',
    minimalPairWord: 'po',
    minimalPairMeaning: 'spleen, pancreas, to lose/fail',
    acousticMechanics: 'The default equilibrium state of the vocal tract. Syllables written without a final consonant letter carry this neutral, baseline fundamental frequency.',
    commonExamples: [
      { word: 'zoo', meaning: 'good, well, beautiful', ipa: '[ʒõŋ˧˧]' },
      { word: 'no', meaning: 'this, cold', ipa: '[nɔ˧˧]' },
      { word: 'ua', meaning: 'to do, to make', ipa: '[ua˧˧]' },
      { word: 'roob', meaning: 'mountain, hill', ipa: '[ʐɔ̃ŋ˧˧]' },
    ],
  },
  {
    key: 's',
    letterLabel: '-s',
    hmoobName: 'Qis',
    englishName: 'Low-Level',
    chaoNumber: '22',
    ipaDiacritic: '˨˨',
    fullIpa: '[pɔ˨˨]',
    pitchTrajectoryDescription: 'Low, relaxed flat tone sustained at level 2 without significant pitch change.',
    phonationType: 'modal',
    phonationBadge: 'Modal (Low Chest Register)',
    minimalPairWord: 'pos',
    minimalPairMeaning: 'thorn, brier, prickly bush',
    acousticMechanics: 'Decreased cricothyroid contraction and lower subglottal pressure yield a stable low pitch (~-3 semitones below baseline), pronounced with relaxed vocal folds.',
    commonExamples: [
      { word: 'mus', meaning: 'to go, walk', ipa: '[mu˨˨]' },
      { word: 'daws', meaning: 'to solve, alleviate', ipa: '[daɨ˨˨]' },
      { word: 'lus', meaning: 'word, language, speech', ipa: '[lu˨˨]' },
      { word: 'tis', meaning: 'wings, to name', ipa: '[ti˨˨]' },
    ],
  },
  {
    key: 'g',
    letterLabel: '-g',
    hmoobName: 'Ntxhi / Ua Pa',
    englishName: 'Falling Breathy',
    chaoNumber: '42',
    ipaDiacritic: '˦˨̤',
    fullIpa: '[pɔ˦˨̤]',
    pitchTrajectoryDescription: 'Starts in the upper register (level 4) and falls gently to level 2 with continuous glottal whisper and breathiness.',
    phonationType: 'breathy',
    phonationBadge: 'Breathy Phonation (Murmured)',
    minimalPairWord: 'pog',
    minimalPairMeaning: 'paternal grandmother',
    acousticMechanics: 'Arytenoid cartilages remain partially open, allowing turbulent air to escape while vocal folds vibrate, producing an audible breathy whisper alongside the falling pitch.',
    commonExamples: [
      { word: 'nrog', meaning: 'with, accompanying', ipa: '[ᶯɖɔ˦˨̤]' },
      { word: 'ntxhi', meaning: 'to whisper, softly', ipa: '[ᶯt͡sʰi˦˨̤]' },
      { word: 'lug', meaning: 'word, speech (Mong Leng)', ipa: '[lu˦˨̤]' },
      { word: 'ntag', meaning: 'indeed, precisely so', ipa: '[da˦˨̤]' },
    ],
  },
  {
    key: 'm',
    letterLabel: '-m',
    hmoobName: 'Khaus / Tu Siab',
    englishName: 'Low Creaky Glottal',
    chaoNumber: '21ˀ',
    ipaDiacritic: '˨˩̰',
    fullIpa: '[pɔ˨˩̰ʔ]',
    pitchTrajectoryDescription: 'Low-falling pitch with vocal fry subharmonics terminating in a sharp, abrupt glottal stop [ʔ].',
    phonationType: 'creaky',
    phonationBadge: 'Creaky Glottal Stop [ʔ]',
    minimalPairWord: 'pom',
    minimalPairMeaning: 'to see, observe, witness',
    acousticMechanics: 'Vocal folds are tightly compressed, producing slow, irregular vocal fry (period doubling) before snapping shut completely at the coda, cutting off acoustic sound abruptly.',
    commonExamples: [
      { word: 'tiam', meaning: 'generation, era, lifetime', ipa: '[tia˨˩̰ʔ]' },
      { word: 'tsam', meaning: 'lest, in case, fear that', ipa: '[t͡ʃa˨˩̰ʔ]' },
      { word: 'lam', meaning: 'casually, recklessly', ipa: '[la˨˩̰ʔ]' },
      { word: 'cuam', meaning: 'assistance (in pab cuam)', ipa: '[cua˨˩̰ʔ]' },
    ],
  },
  {
    key: 'd',
    letterLabel: '-d',
    hmoobName: 'Nce Qis',
    englishName: 'Low-Rising Sandhi',
    chaoNumber: '23',
    ipaDiacritic: '˨˧',
    fullIpa: '[pɔ˨˧]',
    pitchTrajectoryDescription: 'Low rising tone (level 2 to level 3). Arises primarily from phonological tone sandhi mutation in connected speech.',
    phonationType: 'sandhi',
    phonationBadge: 'Tone Sandhi Variant (23)',
    minimalPairWord: 'pod',
    minimalPairMeaning: 'variant test minimal pair',
    acousticMechanics: 'A morphophonemic variant: when a high tone (-b or -j) precedes words with -s (22) or -m (21ˀ) tones, the second tone morphs into -d (23) for articulatory ease.',
    commonExamples: [
      { word: 'ob tud tub', meaning: 'two sons (from tug -> tud)', ipa: '[ɔ˥˥ tu˨˧ tu˥˥]' },
      { word: 'ib tod', meaning: 'over that side (from tom -> tod)', ipa: '[i˥˥ tɔ˨˧]' },
      { word: 'peb lad', meaning: 'three persons (sandhi)', ipa: '[pe˥˥ la˨˧]' },
      { word: 'ib qhad', meaning: 'one portion (sandhi)', ipa: '[i˥˥ qʰa˨˧]' },
    ],
  },
];

export const ToneGuideModal: React.FC<ToneGuideModalProps> = ({
  isOpen,
  onClose,
  dialect = 'dawb',
  onSelectTone,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRegister, setFilterRegister] = useState<'all' | 'high' | 'mid' | 'low' | 'special'>('all');
  const [auditioningWord, setAuditioningWord] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'tones' | 'mechanics'>('tones');

  // Handle escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Stop audio on unmount or close
  useEffect(() => {
    if (!isOpen) {
      hmongTTS.stop();
      setAuditioningWord(null);
    }
  }, [isOpen]);

  const handleAudition = (wordToSpeak: string) => {
    if (auditioningWord === wordToSpeak) {
      hmongTTS.stop();
      setAuditioningWord(null);
      taskCoordinator.notifyTaskEnded('tone_guide');
      return;
    }

    taskCoordinator.notifyTaskStarted('tone_guide');
    setAuditioningWord(wordToSpeak);
    const voice = HMONG_VOICE_PROFILES[dialect === 'dawb' ? 0 : 2];

    hmongTTS.speak(wordToSpeak, dialect, {
      voice,
      rate: 0.86,
      toneEmphasis: 1.25,
      prosody: 1.1,
      onEnd: () => {
        setAuditioningWord(null);
        taskCoordinator.notifyTaskEnded('tone_guide');
      },
      onError: () => {
        setAuditioningWord(null);
        taskCoordinator.notifyTaskEnded('tone_guide');
      },
    });
  };

  const filteredTones = useMemo(() => {
    return TONE_GUIDE_DATA.filter((tone) => {
      // Register filter
      if (filterRegister === 'high' && !['b', 'j'].includes(tone.key)) return false;
      if (filterRegister === 'mid' && !['v', ''].includes(tone.key)) return false;
      if (filterRegister === 'low' && !['s', 'd'].includes(tone.key)) return false;
      if (filterRegister === 'special' && !['g', 'm'].includes(tone.key)) return false;

      // Text search
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        tone.letterLabel.toLowerCase().includes(q) ||
        tone.hmoobName.toLowerCase().includes(q) ||
        tone.englishName.toLowerCase().includes(q) ||
        tone.chaoNumber.includes(q) ||
        tone.minimalPairWord.toLowerCase().includes(q) ||
        tone.commonExamples.some((ex) => ex.word.toLowerCase().includes(q) || ex.meaning.toLowerCase().includes(q))
      );
    });
  }, [filterRegister, searchQuery]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-4xl max-h-[92vh] flex flex-col bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden text-slate-100">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950/90 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white font-['Syne',sans-serif]">
                  Full 8-Tone Hmong RPA Guide & Phonology
                </h2>
                <span className="text-xs font-mono text-teal-400 bg-teal-950/80 border border-teal-800/60 px-2 py-0.5 rounded">
                  {dialect === 'dawb' ? 'Hmoob Dawb' : 'Moob Leeg'}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                <span>RPA Final Letters</span>
                <span aria-hidden="true">·</span>
                <span>Chao 5-Level Numbers</span>
                <span aria-hidden="true">·</span>
                <span>International Phonetic Alphabet (IPA)</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
              title="Close Tone Guide (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Switcher & Search Bar */}
        <div className="p-4 border-b border-slate-800 bg-slate-950/60 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
          {/* View Toggle */}
          <div className="flex items-center gap-1 p-1 bg-slate-900 rounded-xl border border-slate-800 shrink-0">
            <button
              onClick={() => setActiveTab('tones')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'tones'
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>8 Tones Catalogue</span>
            </button>
            <button
              onClick={() => setActiveTab('mechanics')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'mechanics'
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Acoustic Mechanics & Chao Grid</span>
            </button>
          </div>

          {activeTab === 'tones' && (
            <div className="flex items-center gap-2 flex-1 sm:max-w-md">
              {/* Filter By Register */}
              <select
                value={filterRegister}
                onChange={(e) => setFilterRegister(e.target.value as any)}
                className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 text-xs focus:outline-hidden focus:border-teal-500 shrink-0 cursor-pointer"
              >
                <option value="all">All Registers</option>
                <option value="high">High Tones (-b, -j)</option>
                <option value="mid">Mid Tones (-v, -ø)</option>
                <option value="low">Low Tones (-s, -d)</option>
                <option value="special">Phonation (-g, -m)</option>
              </select>

              {/* Search Box */}
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search tone letter, word, or Chao..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 text-xs focus:outline-hidden focus:border-teal-500 placeholder:text-slate-500"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {activeTab === 'tones' ? (
            <div className="space-y-4">
              {/* Quick Summary Banner */}
              <div className="p-3.5 rounded-xl bg-teal-950/40 border border-teal-800/40 flex items-start gap-3 text-xs">
                <Info className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                <div className="space-y-0.5 text-slate-300">
                  <div className="font-semibold text-teal-300">Key RPA Orthography Insight:</div>
                  <p className="text-slate-400 leading-relaxed">
                    In the Hmong Romanized Popular Alphabet (RPA), final consonant letters (<code className="font-mono text-teal-300">b, j, v, s, g, m, d</code>) are <strong>never pronounced as consonant sounds</strong>. They are tone diacritics indicating pitch trajectory, vocal fold tension, and phonation register.
                  </p>
                </div>
              </div>

              {/* List of 8 Tone Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredTones.map((tone) => {
                  const colorObj = TONE_COLORS[tone.key] || TONE_COLORS[''];
                  const isAuditioningPair = auditioningWord === tone.minimalPairWord;

                  return (
                    <div
                      key={tone.key}
                      className="p-4 rounded-xl border border-slate-800 bg-slate-950/70 hover:border-slate-700 transition flex flex-col justify-between space-y-3"
                    >
                      {/* Tone Header */}
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className={`text-2xl font-bold font-mono ${colorObj.text}`}>
                              {tone.letterLabel}
                            </span>
                            <div>
                              <div className="text-sm font-bold text-slate-200">
                                {tone.hmoobName} · {tone.englishName}
                              </div>
                              <div className="text-xs font-mono text-slate-400 flex items-center gap-1.5 mt-0.5">
                                <span className="text-amber-300 font-semibold">Chao: {tone.chaoNumber}</span>
                                <span>·</span>
                                <span>IPA: {tone.ipaDiacritic}</span>
                                <span>·</span>
                                <span className="text-teal-400 font-semibold">{tone.fullIpa}</span>
                              </div>
                            </div>
                          </div>

                          <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded border border-slate-800 ${colorObj.bg} ${colorObj.text}`}>
                            {tone.phonationBadge}
                          </span>
                        </div>

                        {/* Description */}
                        <p className="text-xs text-slate-300 mt-2.5 leading-relaxed">
                          {tone.pitchTrajectoryDescription}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-1 italic">
                          Acoustics: {tone.acousticMechanics}
                        </p>
                      </div>

                      {/* Minimal Pair & Examples Box */}
                      <div className="pt-2.5 border-t border-slate-800/80 space-y-2">
                        {/* Minimal Pair Sample */}
                        <div className="flex items-center justify-between bg-slate-900/80 p-2 rounded-lg border border-slate-800/60 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="text-slate-500">Benchmark:</span>
                            <span className="font-mono font-bold text-teal-300 text-sm">
                              "{tone.minimalPairWord}"
                            </span>
                            <span className="text-slate-400 text-[11px]">
                              ({tone.minimalPairMeaning})
                            </span>
                          </div>

                          <button
                            onClick={() => handleAudition(tone.minimalPairWord)}
                            className="p-1.5 rounded-md bg-teal-600 hover:bg-teal-500 text-white transition active:scale-95 flex items-center gap-1 text-[11px] font-semibold cursor-pointer"
                            title={`Audition "${tone.minimalPairWord}"`}
                          >
                            {isAuditioningPair ? <Square className="w-3 h-3 fill-current" /> : <Volume2 className="w-3 h-3" />}
                            <span>{isAuditioningPair ? 'Stop' : 'Listen'}</span>
                          </button>
                        </div>

                        {/* Common Vocabulary Words */}
                        <div className="text-[11px] text-slate-400">
                          <span className="text-slate-500 font-medium">Common Words: </span>
                          <span className="space-x-1.5">
                            {tone.commonExamples.map((ex, i) => (
                              <button
                                key={i}
                                onClick={() => handleAudition(ex.word)}
                                className="inline-flex items-center gap-1 font-mono text-slate-300 hover:text-teal-300 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 transition cursor-pointer"
                                title={`Click to pronounce "${ex.word}" (${ex.meaning})`}
                              >
                                <span>{ex.word}</span>
                                <span className="text-[10px] text-slate-500">{ex.ipa}</span>
                              </button>
                            ))}
                          </span>
                        </div>
                      </div>

                      {/* Select in Tone Lab Action */}
                      {onSelectTone && (
                        <div className="pt-1 flex justify-end">
                          <button
                            onClick={() => {
                              onSelectTone(tone.key);
                              onClose();
                            }}
                            className="text-xs text-teal-400 hover:text-teal-300 flex items-center gap-1 font-semibold transition cursor-pointer"
                          >
                            <span>Analyze in Tone Lab visualizer</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Tab 2: Acoustic Mechanics & Chao Grid Explanation */
            <div className="space-y-6 text-xs text-slate-300">
              {/* Section 1: Chao 5-Level Pitch Scale */}
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/70 space-y-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-teal-400" />
                  <span>The Chao 5-Level Pitch Number System</span>
                </h3>
                <p className="text-slate-400 leading-relaxed">
                  Linguist Yuen Ren Chao invented the 5-level pitch notation (1–5) to describe tone languages. Level 1 represents the speaker's lowest vocal pitch floor, and Level 5 represents their highest comfortable vocal pitch ceiling.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 pt-2">
                  {[
                    { num: '5', label: 'Siab (Highest)', desc: 'High vocal ceiling. Found in -b (55) & start of -j (52).' },
                    { num: '4', label: 'Upper-Mid', desc: 'Breathy tone -g (42) starts here; -v (24) peaks here.' },
                    { num: '3', label: 'Nruab Ntug (Mid)', desc: 'Neutral conversational baseline in -ø (33) & sandhi -d (23).' },
                    { num: '2', label: 'Qis (Lower-Mid)', desc: 'Low flat tone -s (22); floor of -j (52) & -g (42).' },
                    { num: '1', label: 'Qis Kawg (Floor)', desc: 'Vocal fry creaky tone -m (21ˀ) plunges here before glottal stop.' },
                  ].map((lvl) => (
                    <div key={lvl.num} className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 font-mono">
                      <div className="text-teal-400 font-bold text-base">Level {lvl.num}</div>
                      <div className="text-slate-200 font-semibold text-[11px] mt-0.5">{lvl.label}</div>
                      <div className="text-slate-400 text-[10px] mt-1 leading-normal">{lvl.desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Section 2: Phonation Types in Hmong */}
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/70 space-y-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>The Three Phonation Registers (Vocal Postures)</span>
                </h3>
                <p className="text-slate-400 leading-relaxed">
                  Unlike languages like Mandarin or Vietnamese where tones only vary in pitch, Hmong tones simultaneously encode distinct physiological phonation registers (modes of vocal fold vibration):
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                    <span className="text-cyan-400 font-bold font-mono">1. Modal Phonation</span>
                    <p className="text-slate-400 text-[11px]">
                      Normal, clean vocal fold vibration without air turbulence. Found in <code className="text-cyan-300">-b, -j, -v, -ø, -s, -d</code>. Crisp periodic acoustic waveform.
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                    <span className="text-pink-400 font-bold font-mono">2. Breathy Phonation (-g)</span>
                    <p className="text-slate-400 text-[11px]">
                      Vocal folds vibrate while arytenoid cartilages remain open, mixing acoustic vibration with continuous turbulent airflow murmur (glottal whisper).
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                    <span className="text-rose-400 font-bold font-mono">3. Creaky Glottal Phonation (-m)</span>
                    <p className="text-slate-400 text-[11px]">
                      High vocal fold compression causes period doubling (vocal fry) and abruptly terminates with complete vocal fold adduction (glottal stop [ʔ]).
                    </p>
                  </div>
                </div>
              </div>

              {/* Section 3: Tone Sandhi Mutation Rules */}
              <div className="p-4 rounded-xl border border-slate-800 bg-slate-950/70 space-y-2.5">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-purple-400" />
                  <span>Tone Sandhi (Acoustic Pitch Mutation in Connected Speech)</span>
                </h3>
                <p className="text-slate-400 leading-relaxed">
                  In natural continuous Hmong speech, certain tones mutate when adjacent to other tones to minimize articulatory effort:
                </p>
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 font-mono text-slate-300 space-y-1">
                  <div className="text-purple-300 font-semibold">The High Tone Trigger Rule:</div>
                  <p className="text-slate-400 text-[11px]">
                    When a word with a High tone (<code className="text-teal-300">-b</code> or <code className="text-sky-300">-j</code>) or numbers (<code className="text-slate-200">ib, ob, peb</code>) precedes a word carrying a Low <code className="text-amber-300">-s (22)</code> or Creaky <code className="text-rose-300">-m (21ˀ)</code> tone, the second word regularly mutates into the <code className="text-purple-300">-d (23)</code> rising sandhi tone.
                  </p>
                  <div className="text-teal-400 text-[11px] pt-1">
                    Example: <span className="text-white font-bold">ob</span> (-b) + <span className="text-white font-bold">tug</span> (-g / -s) ➔ <span className="text-white font-bold">ob tud tub</span> ("two sons")
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/90 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400 shrink-0">
          <div className="flex items-center gap-2">
            <span>Click any example word to audition authentic native pronunciation.</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold transition cursor-pointer"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};

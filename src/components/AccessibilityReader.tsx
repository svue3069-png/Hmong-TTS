import React, { useState, useMemo } from 'react';
import { hmongTTS, HMONG_VOICE_PROFILES } from '../engine/hmongAudioSynthesizer';
import { HmongDialect, parseHmongText, convertDialectText, SyllableDecomposition } from '../engine/hmongPhonology';
import { speechCoordinator } from '../engine/multilingualCoordinator';
import { detectLanguage } from '../engine/languageDetector';
import { Play, Square, RotateCcw, Type, Volume2, Sparkles, BookOpen, Globe2, Languages } from 'lucide-react';

const PRESET_STORIES = [
  {
    title: 'Health & Clinic Questions (Kws Kho Mob)',
    dawb: 'Nyob zoo kws kho mob. Kuv mob taub hau thiab kub cev tau ob hnub lawm. Thov pab kuaj kuv seb puas tau noj tshuaj.',
    leeg: 'Nyob zoo kws kho mob. Kuv mob taub hau hab kub cev tau ob nub lawm. Thov paab kuaj kuv saib puas tau noj tshuaj.',
  },
  {
    title: 'Bilingual Patient Guide (Lus Askiv & Lus Hmoob)',
    dawb: 'Nyob zoo! Please rest comfortably in the waiting room. Kws kho mob yuav tuaj ntsib koj sai sai.',
    leeg: 'Nyob zoo! Please rest comfortably in the waiting room. Kws kho mob yuav tuaj ntsib koj sai sai.',
  },
  {
    title: 'Daily Greetings & Hospitality (Kev Txais Qhua)',
    dawb: 'Txais tos nej txhua tus tuaj koom peb tsev neeg. Thov nej zaum noj mov thiab haus dej haus cawv nrog peb kom zoo siab.',
    leeg: 'Txais tog mej txhua tug tuaj koom peb tsev neeg. Thov mej zaum noj moov hab haus dleeg haus cawv nrug peb kuas zoo sab.',
  },
  {
    title: 'Hmong Folklore & Heritage (Kwv Txhiaj Dab Neeg)',
    dawb: 'Thaum ub puag thaum ub, Hmoob nyob rau saum roob siab. Huab cua txias zias, txhua tus sib hlub sib pab ua neej nyob luag ntxhi.',
    leeg: 'Thau u puag thau u, Moob nyob rua sau roob sab. Huab cua txhag zias, txhua tug sib hlub sib paab ua neej nyob luag ntxhi.',
  },
];

export const AccessibilityReader: React.FC = () => {
  const [selectedStoryIdx, setSelectedStoryIdx] = useState(0);
  const [dialect, setDialect] = useState<HmongDialect>('dawb');
  const [fontSize, setFontSize] = useState<'normal' | 'large' | 'xlarge'>('large');
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeSyllableIdx, setActiveSyllableIdx] = useState<number | null>(null);
  const [speed, setSpeed] = useState(0.9); // Slightly slower default for accessibility clarity

  const currentText = dialect === 'dawb'
    ? PRESET_STORIES[selectedStoryIdx].dawb
    : PRESET_STORIES[selectedStoryIdx].leeg;

  const detection = useMemo(() => detectLanguage(currentText), [currentText]);
  const syllables = parseHmongText(currentText, dialect);

  const handlePlay = async () => {
    if (isPlaying) {
      speechCoordinator.stop();
      setIsPlaying(false);
      setActiveSyllableIdx(null);
      return;
    }

    setIsPlaying(true);
    const voice = HMONG_VOICE_PROFILES[dialect === 'dawb' ? 0 : 2];

    await speechCoordinator.speak(currentText, {
      mode: 'auto',
      hmongVoice: voice,
      rate: speed,
      toneEmphasis: 1.25, // enhanced tone contrast for accessibility
      onWord: (idx) => {
        setActiveSyllableIdx(idx);
      },
      onEnd: () => {
        setIsPlaying(false);
        setActiveSyllableIdx(null);
      },
      onError: () => {
        setIsPlaying(false);
        setActiveSyllableIdx(null);
      },
    });
  };

  const handleStop = () => {
    speechCoordinator.stop();
    setIsPlaying(false);
    setActiveSyllableIdx(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
          <span>Accessible Hmong Screen Reader & Assistive Mode</span>
        </h2>
        <p className="text-sm text-slate-400 mt-0.5">
          High-contrast visual tracker with synchronized word highlighting and measured tone prosody for elderly native speakers and language accessibility.
        </p>
      </div>

      {/* Preset selector */}
      <div className="flex flex-wrap gap-2">
        {PRESET_STORIES.map((story, i) => (
          <button
            key={i}
            onClick={() => {
              handleStop();
              setSelectedStoryIdx(i);
            }}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition ${
              selectedStoryIdx === i
                ? 'bg-teal-950/80 border-teal-500 text-teal-300'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            {story.title}
          </button>
        ))}
      </div>

      {/* Reader Controls Toolbar */}
      <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button
            onClick={handlePlay}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-white shadow-lg transition active:scale-95 ${
              isPlaying
                ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-950'
                : 'bg-teal-600 hover:bg-teal-500 shadow-teal-950'
            }`}
          >
            {isPlaying ? <Square className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
            <span>{isPlaying ? 'Xum Hais (Stop)' : 'Mloog Lus (Listen Aloud)'}</span>
          </button>

          {isPlaying && (
            <button
              onClick={handleStop}
              className="p-2.5 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700"
              title="Reset"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Dialect Switcher */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-lg border border-slate-800">
            <button
              onClick={() => { handleStop(); setDialect('dawb'); }}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
                dialect === 'dawb' ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Hmoob Dawb
            </button>
            <button
              onClick={() => { handleStop(); setDialect('leeg'); }}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
                dialect === 'leeg' ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Moob Leeg
            </button>
          </div>

          {/* Font Size Selector */}
          <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-lg border border-slate-800 text-xs">
            <button
              onClick={() => setFontSize('normal')}
              className={`px-2 py-1 rounded ${fontSize === 'normal' ? 'bg-slate-800 text-teal-300' : 'text-slate-400'}`}
            >
              Standard
            </button>
            <button
              onClick={() => setFontSize('large')}
              className={`px-2 py-1 rounded ${fontSize === 'large' ? 'bg-slate-800 text-teal-300' : 'text-slate-400'}`}
            >
              Large
            </button>
            <button
              onClick={() => setFontSize('xlarge')}
              className={`px-2 py-1 rounded font-bold ${fontSize === 'xlarge' ? 'bg-slate-800 text-teal-300' : 'text-slate-400'}`}
            >
              Extra
            </button>
          </div>
        </div>
      </div>

      {/* Reading Visual Viewport with Synchronized Highlight */}
      <div className="p-8 rounded-2xl border-2 border-slate-800 bg-slate-950/80 shadow-inner min-h-[180px] flex items-center">
        <div className={`leading-loose tracking-wide ${
          fontSize === 'normal' ? 'text-lg' : fontSize === 'large' ? 'text-2xl' : 'text-3xl'
        }`}>
          {syllables.map((syl, idx) => {
            const isActive = activeSyllableIdx === idx;
            return (
              <span
                key={idx}
                className={`inline-block mr-2.5 transition-all duration-150 rounded px-1.5 py-0.5 ${
                  isActive
                    ? 'bg-amber-400 text-slate-950 font-bold scale-110 shadow-lg shadow-amber-400/20 ring-2 ring-amber-300'
                    : 'text-slate-200'
                }`}
              >
                {syl.raw}
              </span>
            );
          })}
        </div>
      </div>

      {/* Current Active Syllable Tone Helper Badge */}
      {activeSyllableIdx !== null && syllables[activeSyllableIdx] && (
        <div className="p-3 bg-slate-900 border border-teal-800/40 rounded-xl flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="text-teal-400 font-bold text-sm">
              "{syllables[activeSyllableIdx].clean}"
            </span>
            <span className="text-slate-500">·</span>
            <span className="text-slate-300">
              Tone: -{syllables[activeSyllableIdx].toneLetter || 'ø'} ({syllables[activeSyllableIdx].tone.name})
            </span>
          </div>
          <div className="text-amber-300">
            IPA: {syllables[activeSyllableIdx].ipa}
          </div>
        </div>
      )}
    </div>
  );
};

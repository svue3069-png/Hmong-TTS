import React, { useState } from 'react';
import { HMONG_TONES, HMONG_VOWELS, DIALECT_MAPPINGS, HmongDialect, parseHmongSyllable } from '../engine/hmongPhonology';
import { hmongTTS, HMONG_VOICE_PROFILES } from '../engine/hmongAudioSynthesizer';
import { Volume2, Play, Info } from 'lucide-react';

export const ToneLaboratory: React.FC = () => {
  const [testWord, setTestWord] = useState('los');
  const [selectedDialect, setSelectedDialect] = useState<HmongDialect>('dawb');
  const [activeAuditionTone, setActiveAuditionTone] = useState<string | null>(null);

  const decomposed = parseHmongSyllable(testWord, selectedDialect);

  const playToneAudition = (toneKey: string, exampleWord: string) => {
    setActiveAuditionTone(toneKey);
    const voice = HMONG_VOICE_PROFILES[0];
    hmongTTS.speak(exampleWord, selectedDialect, {
      voice,
      rate: 0.85,
      toneEmphasis: 1.3,
      prosody: 1.15,
      onEnd: () => setActiveAuditionTone(null),
    });
  };

  const toneExamples: Record<string, string> = {
    b: 'pob',
    j: 'poj',
    v: 'pov',
    '': 'po',
    s: 'pos',
    g: 'pog',
    m: 'pom',
    d: 'pod',
  };

  return (
    <div className="space-y-6">
      {/* Header explanation */}
      <div>
        <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
          <span>Hmong RPA Tone & Phonological System</span>
        </h2>
        <p className="text-sm text-slate-400 mt-1 max-w-3xl">
          In the Romanized Popular Alphabet (RPA), the final consonant of each syllable is not pronounced as a consonant — it encodes the tonal pitch contour and phonation register.
        </p>
      </div>

      {/* 8 Tones Interactive Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {Object.entries(HMONG_TONES).map(([key, tone]) => {
          const exWord = toneExamples[key] || 'po';
          const isCurrentActive = activeAuditionTone === key;

          return (
            <div
              key={key || 'mid'}
              className={`p-4 rounded-xl border transition-all ${
                isCurrentActive
                  ? 'border-teal-500 bg-teal-950/30'
                  : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xl font-bold font-mono text-teal-400">
                      -{key || 'ø'}
                    </span>
                    <span className="text-xs font-semibold text-slate-200">
                      {tone.name}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Hmoob: <span className="text-slate-300 font-medium">{tone.hmoobName}</span>
                  </div>
                </div>

                <button
                  onClick={() => playToneAudition(key, exWord)}
                  className="p-2 rounded-lg bg-slate-800 hover:bg-teal-600 text-slate-300 hover:text-white transition active:scale-95"
                  title={`Audition tone with word: "${exWord}"`}
                >
                  <Volume2 className="w-4 h-4" />
                </button>
              </div>

              {/* Pitch contour diagram */}
              <div className="mt-3">
                <div className="h-8 w-full bg-slate-950/70 rounded px-2 py-1 flex items-center justify-between border border-slate-800/60">
                  <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400">
                    <span>Chao: {tone.chaoNumber}</span>
                    <span>·</span>
                    <span>IPA: {tone.ipaDiacritic}</span>
                  </div>
                  <span className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded ${
                    tone.phonation === 'creaky' ? 'text-amber-300 bg-amber-950/50' :
                    tone.phonation === 'breathy' ? 'text-sky-300 bg-sky-950/50' : 'text-slate-400 bg-slate-800'
                  }`}>
                    {tone.phonation}
                  </span>
                </div>
              </div>

              <div className="mt-2.5 text-xs text-slate-400 leading-relaxed">
                {tone.description}
              </div>

              <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <span className="text-slate-500">Sample:</span>
                <span className="font-mono font-medium text-teal-300">"{exWord}" [{tone.chaoNumber}]</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Syllable Inspector & Sandbox */}
      <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/60">
        <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
          <span>Real-Time Syllable Decomposer & IPA Engine</span>
        </h3>

        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center mb-4">
          <div className="flex-1">
            <input
              type="text"
              value={testWord}
              onChange={(e) => setTestWord(e.target.value)}
              placeholder="Enter Hmong word (e.g. nyob, tsaug, hmoob, ntxoov, dleev)..."
              className="w-full px-3.5 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 font-mono text-sm focus:outline-hidden focus:border-teal-500"
            />
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-lg border border-slate-800">
            <button
              onClick={() => setSelectedDialect('dawb')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
                selectedDialect === 'dawb'
                  ? 'bg-teal-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Hmoob Dawb (White)
            </button>
            <button
              onClick={() => setSelectedDialect('leeg')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
                selectedDialect === 'leeg'
                  ? 'bg-teal-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Moob Leeg (Green)
            </button>
          </div>

          <button
            onClick={() => {
              hmongTTS.speak(testWord, selectedDialect, {
                voice: HMONG_VOICE_PROFILES[selectedDialect === 'dawb' ? 0 : 2],
              });
            }}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-xs font-semibold transition active:scale-95 whitespace-nowrap"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Audition "{decomposed.clean || testWord}"</span>
          </button>
        </div>

        {/* Breakdown Card */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-3 bg-slate-950 rounded-lg border border-slate-800 font-mono text-xs">
          <div>
            <div className="text-slate-500 text-[10px] uppercase">Onset Consonant</div>
            <div className="text-slate-200 font-semibold text-sm mt-0.5">
              {decomposed.onset ? decomposed.onset : '(null)'}
            </div>
          </div>
          <div>
            <div className="text-slate-500 text-[10px] uppercase">Nucleus Vowel</div>
            <div className="text-slate-200 font-semibold text-sm mt-0.5">
              {decomposed.vowel}
            </div>
          </div>
          <div>
            <div className="text-slate-500 text-[10px] uppercase">Tone Letter</div>
            <div className="text-teal-400 font-bold text-sm mt-0.5">
              -{decomposed.toneLetter || 'ø'}
            </div>
          </div>
          <div>
            <div className="text-slate-500 text-[10px] uppercase">Pitch & Chao</div>
            <div className="text-slate-200 font-semibold text-sm mt-0.5">
              {decomposed.tone.name} ({decomposed.tone.chaoNumber})
            </div>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <div className="text-slate-500 text-[10px] uppercase">IPA Phonetic</div>
            <div className="text-amber-300 font-semibold text-sm mt-0.5">
              {decomposed.ipa}
            </div>
          </div>
        </div>
      </div>

      {/* Dialect Comparison Section */}
      <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/60">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <span>Dialect Comparison: Hmoob Dawb vs Moob Leeg</span>
          </h3>
          <span className="text-xs text-slate-500">Cross-dialect acoustic normalization</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300 border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-500 font-mono uppercase text-[11px]">
                <th className="py-2.5 px-3">Hmoob Dawb (White)</th>
                <th className="py-2.5 px-3">Moob Leeg (Green)</th>
                <th className="py-2.5 px-3">English Meaning</th>
                <th className="py-2.5 px-3">Phonological Difference</th>
                <th className="py-2.5 px-3 text-right">Audition</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {DIALECT_MAPPINGS.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-800/40 transition">
                  <td className="py-2.5 px-3 font-mono font-medium text-teal-300">{item.dawb}</td>
                  <td className="py-2.5 px-3 font-mono font-medium text-sky-300">{item.leeg}</td>
                  <td className="py-2.5 px-3 text-slate-200">{item.english}</td>
                  <td className="py-2.5 px-3 text-slate-400 text-[11px]">{item.notes}</td>
                  <td className="py-2.5 px-3 text-right space-x-1">
                    <button
                      onClick={() => hmongTTS.speak(item.dawb, 'dawb')}
                      className="px-2 py-1 text-[11px] rounded bg-slate-800 hover:bg-teal-600 text-slate-300 hover:text-white transition"
                      title="Audition White Hmong"
                    >
                      White
                    </button>
                    <button
                      onClick={() => hmongTTS.speak(item.leeg, 'leeg')}
                      className="px-2 py-1 text-[11px] rounded bg-slate-800 hover:bg-sky-600 text-slate-300 hover:text-white transition"
                      title="Audition Green Hmong"
                    >
                      Green
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

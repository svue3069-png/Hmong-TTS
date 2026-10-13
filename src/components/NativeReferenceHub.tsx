/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Native Reference Hub & Phonetic Video Archive
 * Curated authentic Hmong language citations, interactive video player
 * with URL input and file upload, and acoustic phonetic calibration.
 */

import React, { useState, useEffect } from 'react';
import { Play, Video } from 'lucide-react';
import { hmongTTS, HMONG_VOICE_PROFILES } from '../engine/hmongAudioSynthesizer';
import { HmongDialect } from '../engine/hmongPhonology';
import { taskCoordinator } from '../engine/taskCoordinator';
import { VideoPlayerHub } from './VideoPlayerHub';

interface NativeReferenceHubProps {
  onUseTranscript?: (text: string) => void;
  onNavigateToToneLab?: (toneKey?: string) => void;
  dialect?: HmongDialect;
}

const CITATION_PHRASES = [
  {
    dawb: 'Pob, poj, pov, po, pos, pog, pom, pod',
    leeg: 'Pob, poj, pov, po, pos, pog, pom, pod',
    label: 'Standard RPA 8-Tone Minimal Pair ("Po")',
    note: 'The foundational benchmark for calibrating Hmong pitch contours.',
  },
  {
    dawb: 'Kuv mus tom tsev noj mov.',
    leeg: 'Kuv moog kws tsev noj moov.',
    label: 'Everyday Household Co-articulation',
    note: 'Observe the -s and -g tone contrast and nasal vowel shifts.',
  },
  {
    dawb: 'Nyob zoo sawv daws, zoo siab ntsib nej.',
    leeg: 'Nyob zoo suav daws, zoo sab ntsib mej.',
    label: 'Formal Polite Welcoming Cadence',
    note: 'Smooth sustained intonation with mid-rising inflection.',
  },
];

export const NativeReferenceHub: React.FC<NativeReferenceHubProps> = ({
  onUseTranscript,
  onNavigateToToneLab,
  dialect = 'dawb',
}) => {
  const [activeAudition, setActiveAudition] = useState<number | null>(null);

  useEffect(() => {
    const unregister = taskCoordinator.registerStopHandler('native_reference', () => {
      hmongTTS.stop();
      setActiveAudition(null);
    });
    return () => {
      unregister();
      hmongTTS.stop();
    };
  }, []);

  const handleAudition = (idx: number, text: string, targetDialect: HmongDialect = 'dawb') => {
    if (activeAudition === idx) {
      hmongTTS.stop();
      setActiveAudition(null);
      taskCoordinator.notifyTaskEnded('native_reference');
      return;
    }

    taskCoordinator.notifyTaskStarted('native_reference');
    setActiveAudition(idx);
    const voice = HMONG_VOICE_PROFILES[targetDialect === 'dawb' ? 0 : 2];
    hmongTTS.speak(text, targetDialect, {
      voice,
      rate: 0.88,
      toneEmphasis: 1.25,
      prosody: 1.15,
      onEnd: () => {
        setActiveAudition(null);
        taskCoordinator.notifyTaskEnded('native_reference');
      },
      onError: () => {
        setActiveAudition(null);
        taskCoordinator.notifyTaskEnded('native_reference');
      },
    });
  };

  return (
    <div className="space-y-8">
      {/* Interactive Video Player & Input URL Component */}
      <VideoPlayerHub
        onUseTranscript={onUseTranscript}
        onNavigateToToneLab={onNavigateToToneLab}
        dialect={dialect}
      />

      {/* Phonetic Citation Soundboard */}
      <div className="p-5 rounded-2xl border border-slate-800 bg-slate-950/80 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Video className="w-4 h-4 text-teal-400" />
              <span>Acoustic Citation Benchmarks</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Citation minimal pairs demonstrating native formant gliding and tone contrasts
            </p>
          </div>
          <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-800/30 px-2.5 py-1 rounded">
            Native LF Glottal Engine Active
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {CITATION_PHRASES.map((item, idx) => (
            <div
              key={idx}
              className="p-4 rounded-xl bg-slate-900 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div>
                <div className="text-xs font-semibold text-slate-200 mb-1">{item.label}</div>
                <div className="font-mono text-teal-300 text-sm font-medium mb-1">
                  "{item.dawb}"
                </div>
                <div className="text-xs text-slate-500">{item.note}</div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleAudition(idx, item.dawb, 'dawb')}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-xs font-semibold transition active:scale-95"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>White Hmong</span>
                </button>
                <button
                  onClick={() => handleAudition(idx + 10, item.leeg, 'leeg')}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition active:scale-95"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Green Hmong</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

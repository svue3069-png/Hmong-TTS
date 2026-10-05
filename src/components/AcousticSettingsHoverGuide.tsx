/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * AcousticSettingsHoverGuide
 * Interactive acoustic phonetic guidance card that appears when hovering
 * over the Native Acoustic Settings in the HmongTTS Studio.
 * Explains Formants (F1, F2, F3), LF Glottal Flow, Chao tone contours,
 * phonation types (modal, breathy -g, creaky -m), and one-click calibration presets.
 */

import React from 'react';
import {
  Sparkles,
  Info,
  Waves,
  Zap,
  Gauge,
  Sliders,
  Check,
  Volume2,
} from 'lucide-react';

interface AcousticSettingsHoverGuideProps {
  onApplyPreset?: (preset: {
    rate: number;
    pitch: number;
    toneEmphasis: number;
    prosody: number;
  }) => void;
  currentRate: number;
  currentPitch: number;
  currentToneEmphasis: number;
  currentProsody: number;
}

export const AcousticSettingsHoverGuide: React.FC<AcousticSettingsHoverGuideProps> = ({
  onApplyPreset,
  currentRate,
  currentPitch,
  currentToneEmphasis,
  currentProsody,
}) => {
  const PRESETS = [
    {
      name: '🎙️ Natural Conversational',
      desc: 'Balanced cadence with organic tone sandhi and micro-prosody.',
      config: { rate: 1.0, pitch: 1.0, toneEmphasis: 1.1, prosody: 1.15 },
    },
    {
      name: '🎓 Phonics & Tone Learning',
      desc: 'Slower tempo with exaggerated Chao pitch contours for clarity.',
      config: { rate: 0.85, pitch: 1.0, toneEmphasis: 1.35, prosody: 1.2 },
    },
    {
      name: '📜 Melodic Kwv Txhiaj & Folktale',
      desc: 'Expressive final-syllable lengthening and rich pitch glides.',
      config: { rate: 0.92, pitch: 0.95, toneEmphasis: 1.4, prosody: 1.35 },
    },
    {
      name: '📻 Clear Broadcast News',
      desc: 'Rapid, consistent tempo with tight pitch stabilization.',
      config: { rate: 1.15, pitch: 1.05, toneEmphasis: 1.0, prosody: 0.9 },
    },
  ];

  return (
    <div className="w-[320px] sm:w-[360px] p-4 rounded-2xl border border-teal-500/50 bg-slate-950/98 shadow-2xl text-slate-200 text-xs space-y-3.5 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-md bg-teal-950 border border-teal-800/40 text-teal-400">
            <Waves className="w-3.5 h-3.5" />
          </div>
          <div>
            <h4 className="font-bold text-slate-100 text-xs">
              Native Acoustic Phonetics Guide
            </h4>
            <p className="text-[10px] text-slate-400 font-mono">
              Fant (1960) & Fant, Liljencrants-Fant (LF) Model
            </p>
          </div>
        </div>
        <span className="px-1.5 py-0.5 rounded bg-teal-950 text-teal-300 font-mono text-[10px] border border-teal-800/50">
          UCLA Phonetics
        </span>
      </div>

      {/* Acoustic Parameters Explained */}
      <div className="space-y-2">
        <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800/80 space-y-1">
          <div className="flex items-center justify-between font-semibold text-[11px] text-slate-200">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-teal-400" />
              <span>Speech Rate (Tempo)</span>
            </span>
            <span className="font-mono text-teal-300 text-[10px]">{currentRate.toFixed(2)}x</span>
          </div>
          <p className="text-[10px] text-slate-400 leading-relaxed">
            Controls syllable duration without pitch distortion. 0.85x is recommended for learners to distinguish rapid consonant releases.
          </p>
        </div>

        <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800/80 space-y-1">
          <div className="flex items-center justify-between font-semibold text-[11px] text-slate-200">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-sky-400" />
              <span>Base Pitch (Fundamental F₀)</span>
            </span>
            <span className="font-mono text-sky-300 text-[10px]">{currentPitch.toFixed(2)}x</span>
          </div>
          <p className="text-[10px] text-slate-400 leading-relaxed">
            Shifts the speaker's baseline vocal cord frequency (~125Hz male, ~215Hz female) while maintaining natural Hmong tone intervals.
          </p>
        </div>

        <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800/80 space-y-1">
          <div className="flex items-center justify-between font-semibold text-[11px] text-slate-200">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <span>Tone Contour Inflection (ΔF₀)</span>
            </span>
            <span className="font-mono text-amber-300 text-[10px]">{currentToneEmphasis.toFixed(2)}x</span>
          </div>
          <p className="text-[10px] text-slate-400 leading-relaxed">
            Magnifies the Chao pitch contours of the 8 RPA tones (e.g. -b high level 55 vs -j high falling 52 vs -v rising 24).
          </p>
        </div>

        <div className="p-2 rounded-xl bg-slate-900/80 border border-slate-800/80 space-y-1">
          <div className="flex items-center justify-between font-semibold text-[11px] text-slate-200">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-400" />
              <span>Human Prosody & Phonation</span>
            </span>
            <span className="font-mono text-rose-300 text-[10px]">{currentProsody.toFixed(2)}x</span>
          </div>
          <p className="text-[10px] text-slate-400 leading-relaxed">
            Synthesizes sentence-final lengthening, vocal fry on tone <code className="text-teal-300">-m</code> (creaky [ʔ] cutoff), and breathy murmur on tone <code className="text-teal-300">-g</code>.
          </p>
        </div>
      </div>

      {/* Quick 1-Click Calibration Presets */}
      {onApplyPreset && (
        <div className="pt-2 border-t border-slate-800 space-y-2">
          <span className="text-[11px] font-bold text-slate-300 block">
            Click to Apply Acoustic Calibration Preset:
          </span>
          <div className="grid grid-cols-1 gap-1.5">
            {PRESETS.map((p, idx) => (
              <button
                key={idx}
                onClick={() => onApplyPreset(p.config)}
                className="flex items-start justify-between p-2 rounded-xl bg-slate-900 hover:bg-teal-950/60 border border-slate-800 hover:border-teal-500/50 transition text-left group"
              >
                <div>
                  <div className="font-semibold text-slate-200 group-hover:text-teal-300 text-[11px]">
                    {p.name}
                  </div>
                  <div className="text-[10px] text-slate-500 group-hover:text-slate-400">
                    {p.desc}
                  </div>
                </div>
                <span className="text-[10px] font-mono text-teal-400 opacity-0 group-hover:opacity-100 transition shrink-0 ml-1">
                  Apply ↵
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

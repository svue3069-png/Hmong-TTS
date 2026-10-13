/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Interactive Pitch-Contour Visualizer
 * Real-time fundamental frequency (F0) trajectory and Chao 5-level pitch contour
 * visualizer based on the HmongTTS DSP acoustic synthesis engine.
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  HMONG_TONES,
  HmongToneInfo,
  HmongDialect,
  parseHmongSyllable,
} from '../engine/hmongPhonology';
import {
  hmongTTS,
  HMONG_VOICE_PROFILES,
  VoiceProfile,
} from '../engine/hmongAudioSynthesizer';
import { taskCoordinator } from '../engine/taskCoordinator';
import {
  Play,
  Square,
  Volume2,
  Sliders,
  Layers,
  Sparkles,
  Info,
  Activity,
  RotateCcw,
  Eye,
  BookOpen,
  Mic,
} from 'lucide-react';

export interface InteractivePitchContourVisualizerProps {
  initialTone?: string;
  dialect?: HmongDialect;
  onAuditionComplete?: () => void;
  onOpenToneGuide?: () => void;
  onOpenVoiceTrainer?: (toneKey: string) => void;
}

// Color coding for Hmong tones aligned with phonological groupings
export const TONE_COLORS: Record<string, { stroke: string; glow: string; text: string; bg: string }> = {
  b: { stroke: '#06b6d4', glow: 'rgba(6,182,212,0.4)', text: 'text-cyan-400', bg: 'bg-cyan-950/60' }, // High Siab
  j: { stroke: '#38bdf8', glow: 'rgba(56,189,248,0.4)', text: 'text-sky-400', bg: 'bg-sky-950/60' },   // High-Falling Nqes
  v: { stroke: '#10b981', glow: 'rgba(16,185,129,0.4)', text: 'text-emerald-400', bg: 'bg-emerald-950/60' }, // Mid-Rising Nce
  '': { stroke: '#14b8a6', glow: 'rgba(20,184,166,0.4)', text: 'text-teal-400', bg: 'bg-teal-950/60' }, // Mid Nruab Ntug
  s: { stroke: '#f59e0b', glow: 'rgba(245,158,11,0.4)', text: 'text-amber-400', bg: 'bg-amber-950/60' }, // Low Qis
  g: { stroke: '#ec4899', glow: 'rgba(236,72,153,0.4)', text: 'text-pink-400', bg: 'bg-pink-950/60' },  // Breathy Ntxhi
  m: { stroke: '#f43f5e', glow: 'rgba(244,63,94,0.4)', text: 'text-rose-400', bg: 'bg-rose-950/60' },   // Creaky Khaus
  d: { stroke: '#a855f7', glow: 'rgba(168,85,247,0.4)', text: 'text-purple-400', bg: 'bg-purple-950/60' }, // Sandhi Nce Qis
};

const MINIMAL_PAIR_WORDS: Record<string, string> = {
  b: 'pob',
  j: 'poj',
  v: 'pov',
  '': 'po',
  s: 'pos',
  g: 'pog',
  m: 'pom',
  d: 'pod',
};

function hzToNote(hz: number): string {
  if (hz <= 0 || isNaN(hz)) return '--';
  const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const semitonesFromA4 = 12 * Math.log2(hz / 440);
  const midi = Math.round(69 + semitonesFromA4);
  const noteName = notes[((midi % 12) + 12) % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${noteName}${octave}`;
}

export const InteractivePitchContourVisualizer: React.FC<InteractivePitchContourVisualizerProps> = ({
  initialTone = 'b',
  dialect = 'dawb',
  onOpenToneGuide,
  onOpenVoiceTrainer,
}) => {
  const [selectedToneKey, setSelectedToneKey] = useState<string>(initialTone);
  const [overlayTones, setOverlayTones] = useState<string[]>([]);
  const [isMultiOverlayMode, setIsMultiOverlayMode] = useState<boolean>(false);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>('paj_dawb_female');
  const [toneEmphasis, setToneEmphasis] = useState<number>(1.2);
  const [rate, setRate] = useState<number>(0.9);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackProgress, setPlaybackProgress] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState<number | null>(null);
  const [showFormantGlow, setShowFormantGlow] = useState<boolean>(true);

  // Synchronize tone selection when parent component updates initialTone
  useEffect(() => {
    if (initialTone !== undefined) {
      setSelectedToneKey(initialTone);
    }
  }, [initialTone]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const auditionStartTimeRef = useRef<number>(0);
  const auditionDurationMsRef = useRef<number>(400);

  const voice = useMemo(
    () => HMONG_VOICE_PROFILES.find((v) => v.id === selectedVoiceId) || HMONG_VOICE_PROFILES[0],
    [selectedVoiceId]
  );

  // Active tone info
  const activeTone = HMONG_TONES[selectedToneKey] || HMONG_TONES['b'];

  // Register with taskCoordinator to immediately stop audition when tab/window switches
  useEffect(() => {
    const unregister = taskCoordinator.registerStopHandler('pitch_contour_visualizer', () => {
      hmongTTS.stop();
      setIsPlaying(false);
      setPlaybackProgress(null);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    });

    return () => {
      unregister();
      hmongTTS.stop();
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  // Compute DSP F0 trajectory point
  const calculateDspF0 = useCallback(
    (tone: HmongToneInfo, progress: number, baseF0: number, emphasis: number): number => {
      const contour = tone.contour;
      const cIdx = progress * (contour.length - 1);
      const cLower = Math.floor(cIdx);
      const cUpper = Math.min(cLower + 1, contour.length - 1);
      const cFrac = cIdx - cLower;
      const baseContour = contour[cLower] * (1 - cFrac) + contour[cUpper] * cFrac;

      // Authentic Hmong Chao Tone Semitone Scale (~9.8 - 10.5 semitone dynamic pitch span)
      const toneSemitones = (baseContour - 0.5) * 9.8 * emphasis;

      let curF0 = baseF0 * Math.pow(2, toneSemitones / 12);

      // Phonation modifiers from DSP engine
      if (tone.letter === 'g') {
        // Breathy lowering towards the coda
        curF0 *= 1.0 - progress * 0.18;
      } else if (tone.letter === 'm' && progress > 0.35) {
        // Vocal fry subharmonic period doubling
        curF0 *= 0.86;
      }

      return curF0;
    },
    []
  );

  // Trajectory points for selected tone(s)
  const trajectoryCurves = useMemo(() => {
    const targetToneKeys = isMultiOverlayMode
      ? overlayTones.length > 0
        ? overlayTones
        : [selectedToneKey]
      : [selectedToneKey];

    const samplesCount = 100;
    const baseF0 = voice.baseF0;

    return targetToneKeys.map((key) => {
      const tone = HMONG_TONES[key] || HMONG_TONES[''];
      const points: Array<{ progress: number; f0: number; chao: number; semitones: number }> = [];

      for (let i = 0; i <= samplesCount; i++) {
        const progress = i / samplesCount;
        const f0 = calculateDspF0(tone, progress, baseF0, toneEmphasis);
        // Smooth continuous Chao level interpolation (1.0 to 5.0)
        const contour = tone.contour;
        const cIdx = progress * (contour.length - 1);
        const cLower = Math.floor(cIdx);
        const cUpper = Math.min(cLower + 1, contour.length - 1);
        const cFrac = cIdx - cLower;
        const baseContour = contour[cLower] * (1 - cFrac) + contour[cUpper] * cFrac;
        const chao = 1.0 + baseContour * 4.0;
        const semitones = 12 * Math.log2(f0 / baseF0);

        points.push({ progress, f0, chao, semitones });
      }

      return {
        key,
        tone,
        color: TONE_COLORS[key] || TONE_COLORS[''],
        points,
      };
    });
  }, [isMultiOverlayMode, overlayTones, selectedToneKey, voice.baseF0, toneEmphasis, calculateDspF0]);

  // Frequency range for Y-axis calculation
  const yAxisRange = useMemo(() => {
    let minF0 = Infinity;
    let maxF0 = -Infinity;

    trajectoryCurves.forEach((curve) => {
      curve.points.forEach((pt) => {
        if (pt.f0 < minF0) minF0 = pt.f0;
        if (pt.f0 > maxF0) maxF0 = pt.f0;
      });
    });

    const pad = (maxF0 - minF0) * 0.25 || 25;
    return {
      min: Math.max(60, Math.floor(minF0 - pad)),
      max: Math.ceil(maxF0 + pad),
    };
  }, [trajectoryCurves]);

  // Audio Playback / Audition
  const handleAuditionTone = (toneKeyToPlay = selectedToneKey) => {
    if (isPlaying) {
      hmongTTS.stop();
      setIsPlaying(false);
      setPlaybackProgress(null);
      taskCoordinator.notifyTaskEnded('pitch_contour_visualizer');
      return;
    }

    const wordToSpeak = MINIMAL_PAIR_WORDS[toneKeyToPlay] || 'po';
    taskCoordinator.notifyTaskStarted('pitch_contour_visualizer');
    setIsPlaying(true);
    setPlaybackProgress(0);

    const estDurationMs = Math.round((360 / rate));
    auditionDurationMsRef.current = estDurationMs;
    auditionStartTimeRef.current = performance.now();

    // Track playhead animation
    const trackPlayhead = () => {
      const elapsed = performance.now() - auditionStartTimeRef.current;
      const progress = Math.min(1.0, elapsed / auditionDurationMsRef.current);
      setPlaybackProgress(progress);

      if (progress < 1.0 && hmongTTS.isBusy()) {
        animFrameRef.current = requestAnimationFrame(trackPlayhead);
      } else {
        setPlaybackProgress(null);
        setIsPlaying(false);
        taskCoordinator.notifyTaskEnded('pitch_contour_visualizer');
      }
    };

    animFrameRef.current = requestAnimationFrame(trackPlayhead);

    hmongTTS.speak(wordToSpeak, dialect, {
      voice,
      rate,
      toneEmphasis,
      prosody: 1.0,
      onEnd: () => {
        setIsPlaying(false);
        setPlaybackProgress(null);
        taskCoordinator.notifyTaskEnded('pitch_contour_visualizer');
      },
      onError: () => {
        setIsPlaying(false);
        setPlaybackProgress(null);
        taskCoordinator.notifyTaskEnded('pitch_contour_visualizer');
      },
    });
  };

  // Toggle overlay tone in multi-mode
  const handleToggleOverlay = (key: string) => {
    setSelectedToneKey(key);
    setOverlayTones((prev) => {
      if (prev.includes(key)) {
        const next = prev.filter((k) => k !== key);
        return next.length === 0 ? [key] : next;
      } else {
        return [...prev, key];
      }
    });
  };

  // Canvas drawing for real-time waveform glow & pitch playhead
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const analyser = hmongTTS.getAnalyser();
    const dataArray = analyser ? new Uint8Array(analyser.frequencyBinCount) : new Uint8Array(64);

    const draw = () => {
      animId = requestAnimationFrame(draw);
      const w = canvas.width;
      const h = canvas.height;

      ctx.clearRect(0, 0, w, h);

      // 1. Draw subtle analyser waveform in background when audio is active
      if (analyser && isPlaying && showFormantGlow) {
        analyser.getByteTimeDomainData(dataArray);
        ctx.save();
        ctx.beginPath();
        const sliceWidth = w / dataArray.length;
        let x = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const v = dataArray[i] / 128.0;
          const y = (v * h) / 2;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
          x += sliceWidth;
        }
        ctx.strokeStyle = 'rgba(20, 184, 166, 0.12)';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.restore();
      }

      // 2. Draw real-time playhead sweep line & tracking dot
      if (playbackProgress !== null && playbackProgress >= 0 && playbackProgress <= 1.0) {
        const playheadX = playbackProgress * w;

        // Vertical laser sweep line
        ctx.save();
        const grad = ctx.createLinearGradient(playheadX, 0, playheadX, h);
        grad.addColorStop(0, 'rgba(45, 212, 191, 0.8)');
        grad.addColorStop(0.5, 'rgba(45, 212, 191, 0.4)');
        grad.addColorStop(1, 'rgba(45, 212, 191, 0.1)');

        ctx.strokeStyle = grad;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(playheadX, 0);
        ctx.lineTo(playheadX, h);
        ctx.stroke();

        // Pulsing tracking dot on main curve
        const activeCurve = trajectoryCurves[0];
        if (activeCurve && activeCurve.points.length > 0) {
          const ptIdx = Math.min(
            activeCurve.points.length - 1,
            Math.floor(playbackProgress * (activeCurve.points.length - 1))
          );
          const pt = activeCurve.points[ptIdx];
          const normY = (pt.f0 - yAxisRange.min) / (yAxisRange.max - yAxisRange.min);
          const dotY = (1 - normY) * h;

          // Outer halo
          ctx.beginPath();
          ctx.arc(playheadX, dotY, 9, 0, Math.PI * 2);
          ctx.fillStyle = activeCurve.color.glow;
          ctx.fill();

          // Inner solid core
          ctx.beginPath();
          ctx.arc(playheadX, dotY, 4.5, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
        }
        ctx.restore();
      }
    };

    draw();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [isPlaying, playbackProgress, showFormantGlow, trajectoryCurves, yAxisRange]);

  // Coordinate mapping for SVG curves
  const getCoordinates = (progress: number, f0: number) => {
    const x = progress * 100;
    const normY = (f0 - yAxisRange.min) / (yAxisRange.max - yAxisRange.min);
    const y = (1 - Math.max(0, Math.min(1, normY))) * 100;
    return { x, y };
  };

  // Build SVG path data for a trajectory curve
  const buildSvgPath = (points: Array<{ progress: number; f0: number }>) => {
    if (points.length === 0) return '';
    return points
      .map((pt, idx) => {
        const { x, y } = getCoordinates(pt.progress, pt.f0);
        return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(' ');
  };

  // Hover calculation data
  const hoverData = useMemo(() => {
    if (hoverX === null) return null;
    const progress = Math.max(0, Math.min(1, hoverX));
    const mainCurve = trajectoryCurves.find((c) => c.key === selectedToneKey) || trajectoryCurves[0];
    if (!mainCurve) return null;

    const f0 = calculateDspF0(mainCurve.tone, progress, voice.baseF0, toneEmphasis);
    const semitones = 12 * Math.log2(f0 / voice.baseF0);
    const note = hzToNote(f0);
    const timeMs = Math.round(progress * (360 / rate));

    // Smooth continuous Chao pitch estimate
    const contour = mainCurve.tone.contour;
    const cIdx = progress * (contour.length - 1);
    const cLower = Math.floor(cIdx);
    const cUpper = Math.min(cLower + 1, contour.length - 1);
    const cFrac = cIdx - cLower;
    const baseContour = contour[cLower] * (1 - cFrac) + contour[cUpper] * cFrac;
    const chaoLevel = (1.0 + baseContour * 4.0).toFixed(1);

    // Phonation descriptor
    let phonationStatus = 'Modal Phonation (Clean)';
    if (mainCurve.tone.letter === 'g') {
      phonationStatus = 'Breathy Phonation (Glottal Murmur)';
    } else if (mainCurve.tone.letter === 'm') {
      phonationStatus = progress > 0.8 ? 'Abrupt Glottal Stop [ʔ]' : 'Low Creaky Fry (Subharmonics)';
    }

    return {
      progress: Math.round(progress * 100),
      timeMs,
      f0: Math.round(f0),
      semitones: semitones >= 0 ? `+${semitones.toFixed(1)}` : semitones.toFixed(1),
      note,
      chaoLevel,
      phonationStatus,
    };
  }, [hoverX, trajectoryCurves, calculateDspF0, voice.baseF0, toneEmphasis, rate]);

  return (
    <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/70 shadow-xl space-y-5">
      {/* Visualizer Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
              <Activity className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-slate-100 font-['Syne',sans-serif]">
              Real-Time Tone Pitch-Contour & F₀ Trajectory Visualizer
            </h3>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
            <span>Chao 5-Level Grid</span>
            <span aria-hidden="true">·</span>
            <span>Liljencrants-Fant Human Glottal Source</span>
            <span aria-hidden="true">·</span>
            <span>Real-Time DSP Semitone Formula</span>
          </div>
        </div>

        {/* Action Controls & Mode Switch */}
        <div className="flex items-center gap-2">
          {onOpenToneGuide && (
            <button
              onClick={onOpenToneGuide}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-teal-800/60 bg-teal-950/40 hover:bg-teal-900/60 text-teal-300 hover:text-white transition flex items-center gap-1.5 shadow-xs"
              title="Open full 8-tone RPA educational guide with IPA, Chao tone numbers, and acoustic mechanics"
            >
              <BookOpen className="w-3.5 h-3.5 text-teal-400" />
              <span>Tone Guide</span>
            </button>
          )}

          {onOpenVoiceTrainer && (
            <button
              onClick={() => onOpenVoiceTrainer(selectedToneKey)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-amber-600/50 bg-amber-950/40 hover:bg-amber-900/60 text-amber-300 hover:text-white transition flex items-center gap-1.5 shadow-xs"
              title="Record your voice and overlay your pitch contour against target for pronunciation training"
            >
              <Mic className="w-3.5 h-3.5 text-amber-400" />
              <span>Voice Overlay Trainer</span>
            </button>
          )}

          {/* Multi-Tone Overlay Toggle */}
          <button
            onClick={() => {
              setIsMultiOverlayMode(!isMultiOverlayMode);
              if (!isMultiOverlayMode && overlayTones.length === 0) {
                setOverlayTones([selectedToneKey, 's', 'v']);
              }
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition flex items-center gap-1.5 ${
              isMultiOverlayMode
                ? 'bg-teal-950/80 border-teal-500 text-teal-300'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
            }`}
            title="Overlay multiple Hmong tone pitch contours to compare them on one graph"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{isMultiOverlayMode ? 'Multi-Tone Overlay: ON' : 'Overlay Multiple Tones'}</span>
          </button>

          {/* Primary Audition Button */}
          <button
            onClick={() => handleAuditionTone()}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-xl font-bold text-xs text-white shadow-md transition active:scale-95 ${
              isPlaying
                ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-950'
                : 'bg-teal-600 hover:bg-teal-500 shadow-teal-950'
            }`}
          >
            {isPlaying ? <Square className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
            <span>{isPlaying ? 'Stop Audition' : `Audition -${activeTone.letter || 'ø'} ("${MINIMAL_PAIR_WORDS[selectedToneKey] || 'po'}")`}</span>
          </button>
        </div>
      </div>

      {/* Tone Selection Tabs (Clean Unboxed Pill-Free Segmented Buttons) */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-950/90 border border-slate-800 rounded-xl overflow-x-auto no-scrollbar">
        {Object.entries(HMONG_TONES).map(([key, tone]) => {
          const isSelected = selectedToneKey === key;
          const isOverlayChecked = overlayTones.includes(key);
          const colorObj = TONE_COLORS[key] || TONE_COLORS[''];

          return (
            <button
              key={key || 'mid'}
              onClick={() => {
                if (isMultiOverlayMode) {
                  handleToggleOverlay(key);
                } else {
                  setSelectedToneKey(key);
                }
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                isMultiOverlayMode
                  ? isOverlayChecked
                    ? `${colorObj.bg} border border-slate-700 text-white shadow-sm`
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                  : isSelected
                  ? `${colorObj.bg} border border-slate-700 text-white shadow-sm`
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <span className={`font-mono font-bold ${colorObj.text}`}>
                -{key || 'ø'}
              </span>
              <span>{tone.hmoobName}</span>
              <span className="text-[10px] opacity-60 font-mono">[{tone.chaoNumber}]</span>
            </button>
          );
        })}
      </div>

      {/* Main Interactive Pitch Trajectory Graph Canvas Area */}
      <div className="relative rounded-xl border border-slate-800 bg-[#070d19] overflow-hidden select-none">
        {/* Chao 5-Level Reference Lines (5: Siab, 4: Siab Nqes, 3: Nruab Ntug, 2: Qis, 1: Qis Kawg) */}
        <div className="absolute inset-0 pointer-events-none flex flex-col justify-between py-4 px-3 text-[10px] font-mono text-slate-500 z-0">
          {[
            { chao: '5 (Siab)', label: 'Level 5 · High Ceiling', f0Approx: Math.round(voice.baseF0 * 1.33) },
            { chao: '4', label: 'Level 4 · Upper Mid', f0Approx: Math.round(voice.baseF0 * 1.15) },
            { chao: '3 (Nruab Ntug)', label: 'Level 3 · Neutral Baseline', f0Approx: Math.round(voice.baseF0) },
            { chao: '2 (Qis)', label: 'Level 2 · Lower Register', f0Approx: Math.round(voice.baseF0 * 0.85) },
            { chao: '1 (Qis Kawg)', label: 'Level 1 · Low Floor', f0Approx: Math.round(voice.baseF0 * 0.72) },
          ].map((level, i) => (
            <div key={i} className="flex items-center justify-between border-b border-slate-800/60 pb-1">
              <span className="text-slate-400 font-semibold">{level.chao}</span>
              <span className="text-slate-600 hidden sm:inline">{level.label}</span>
              <span className="text-slate-500 font-mono">~{level.f0Approx} Hz ({hzToNote(level.f0Approx)})</span>
            </div>
          ))}
        </div>

        {/* Syllable Phase Regions (Onset, Nucleus, Coda) */}
        <div className="absolute inset-0 pointer-events-none flex text-[9px] font-mono text-slate-600 uppercase tracking-wider z-0">
          <div className="w-[15%] border-r border-slate-800/40 p-2 flex items-end">
            <span>Consonant Onset</span>
          </div>
          <div className="w-[60%] border-r border-slate-800/40 p-2 flex items-end">
            <span>Vowel Formant Nucleus & Tone Body</span>
          </div>
          <div className="w-[25%] p-2 flex items-end">
            <span>Tone Resolution / Coda</span>
          </div>
        </div>

        {/* Real-time Web Audio Analyser Glow & Playhead Canvas Layer */}
        <canvas
          ref={canvasRef}
          width={800}
          height={320}
          className="absolute inset-0 w-full h-full pointer-events-none z-10"
        />

        {/* Vector SVG Pitch Trajectories Layer */}
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="w-full h-64 sm:h-80 relative z-20 cursor-crosshair"
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const relX = (e.clientX - rect.left) / rect.width;
            setHoverX(relX);
          }}
          onMouseLeave={() => setHoverX(null)}
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const relX = (e.clientX - rect.left) / rect.width;
            setHoverX(relX);
            handleAuditionTone();
          }}
        >
          <defs>
            {trajectoryCurves.map((curve) => (
              <linearGradient key={`grad-${curve.key}`} id={`grad-${curve.key}`} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={curve.color.stroke} stopOpacity="0.7" />
                <stop offset="60%" stopColor={curve.color.stroke} stopOpacity="1.0" />
                <stop offset="100%" stopColor={curve.color.stroke} stopOpacity="0.85" />
              </linearGradient>
            ))}

            <filter id="glow-filter" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="1.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Render Trajectory Curves */}
          {trajectoryCurves.map((curve) => {
            const pathData = buildSvgPath(curve.points);
            const isMainSelected = curve.key === selectedToneKey;

            return (
              <g key={curve.key}>
                {/* Glow underlay */}
                <path
                  d={pathData}
                  fill="none"
                  stroke={curve.color.stroke}
                  strokeWidth={isMainSelected ? '3.5' : '2'}
                  strokeOpacity="0.4"
                  filter="url(#glow-filter)"
                />
                {/* Crisp foreground trajectory line */}
                <path
                  d={pathData}
                  fill="none"
                  stroke={`url(#grad-${curve.key})`}
                  strokeWidth={isMainSelected ? '2.4' : '1.5'}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Trajectory Start and End Markers */}
                {curve.points.length > 0 && (
                  <>
                    <circle
                      cx={getCoordinates(0, curve.points[0].f0).x}
                      cy={getCoordinates(0, curve.points[0].f0).y}
                      r={isMainSelected ? '1.8' : '1.2'}
                      fill={curve.color.stroke}
                    />
                    <circle
                      cx={getCoordinates(1, curve.points[curve.points.length - 1].f0).x}
                      cy={getCoordinates(1, curve.points[curve.points.length - 1].f0).y}
                      r={isMainSelected ? '2.2' : '1.4'}
                      fill="#ffffff"
                    />
                  </>
                )}
              </g>
            );
          })}

          {/* Interactive Hover Guide Crosshair Line */}
          {hoverX !== null && (
            <line
              x1={hoverX * 100}
              y1={0}
              x2={hoverX * 100}
              y2={100}
              stroke="rgba(148, 163, 184, 0.4)"
              strokeWidth="0.8"
              strokeDasharray="1.5 1.5"
            />
          )}
        </svg>

        {/* Live Hover Inspection Tooltip Overlay */}
        {hoverData && hoverX !== null && (
          <div
            className="absolute top-3 pointer-events-none z-30 transform -translate-x-1/2 bg-slate-950/95 border border-slate-700/80 rounded-xl px-3 py-2 shadow-2xl backdrop-blur-md text-xs font-mono"
            style={{
              left: `${Math.max(18, Math.min(82, hoverX * 100))}%`,
            }}
          >
            <div className="flex items-center gap-2 text-slate-200 font-semibold border-b border-slate-800 pb-1 mb-1">
              <span className="text-teal-400">-{activeTone.letter || 'ø'} {activeTone.name}</span>
              <span className="text-slate-500">·</span>
              <span className="text-amber-300">Level {hoverData.chaoLevel}</span>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] text-slate-400">
              <div>Time: <span className="text-slate-200">{hoverData.timeMs}ms ({hoverData.progress}%)</span></div>
              <div>Frequency: <span className="text-teal-300 font-bold">{hoverData.f0} Hz</span></div>
              <div>Pitch Note: <span className="text-cyan-300 font-bold">{hoverData.note}</span></div>
              <div>Offset: <span className="text-slate-300">{hoverData.semitones} st</span></div>
            </div>
            <div className="mt-1 pt-1 border-t border-slate-800 text-[10px] text-slate-400 italic">
              {hoverData.phonationStatus}
            </div>
          </div>
        )}
      </div>

      {/* Curve Legend & Minimal Pair Comparison Soundboard */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-300">Tone Phonation:</span>
            <span className="text-teal-300">Modal (Crisp)</span>
            <span aria-hidden="true">·</span>
            <span className="text-pink-300">Breathy (-g)</span>
            <span aria-hidden="true">·</span>
            <span className="text-rose-300">Creaky Glottal (-m)</span>
          </div>

          <div className="flex items-center gap-2 font-mono text-[11px] text-slate-500">
            <span>Voice: {voice.name} ({voice.baseF0}Hz F₀)</span>
            <span aria-hidden="true">·</span>
            <span>Duration: ~{Math.round(360 / rate)}ms</span>
          </div>
        </div>

        {/* Minimal Pair Rapid Comparison Row */}
        <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800/80 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-300 font-semibold flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Standard 8-Tone Minimal Pair ("Po"): Click to hear & compare contour transformations</span>
            </span>
            <span className="text-[11px] text-slate-500 hidden sm:inline">Identical onset [p-] & vowel [-o], varying tone consonant</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
            {Object.entries(MINIMAL_PAIR_WORDS).map(([tKey, word]) => {
              const tone = HMONG_TONES[tKey] || HMONG_TONES[''];
              const isCur = selectedToneKey === tKey;
              const col = TONE_COLORS[tKey] || TONE_COLORS[''];

              return (
                <button
                  key={tKey}
                  onClick={() => {
                    setSelectedToneKey(tKey);
                    if (isMultiOverlayMode) {
                      setOverlayTones((prev) => (prev.includes(tKey) ? prev : [...prev, tKey]));
                    }
                    handleAuditionTone(tKey);
                  }}
                  className={`p-2 rounded-lg border text-left transition active:scale-95 cursor-pointer ${
                    isCur
                      ? 'border-teal-500 bg-teal-950/40 text-white'
                      : 'border-slate-800 bg-slate-900/60 hover:border-slate-700 text-slate-300'
                  }`}
                  title={`Audition "${word}" [${tone.chaoNumber}]`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-sm text-teal-300">"{word}"</span>
                    <span className={`text-[10px] font-mono ${col.text}`}>-{tKey || 'ø'}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5 truncate">
                    {tone.hmoobName} [{tone.chaoNumber}]
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* DSP Acoustic Tuning Parameter Sliders */}
      <div className="pt-2 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
        {/* Voice Model Selector */}
        <div className="space-y-1.5">
          <label className="text-slate-400 font-medium flex items-center justify-between">
            <span>Voice Model (Base F₀ Hz)</span>
            <span className="font-mono text-teal-400">{voice.baseF0} Hz</span>
          </label>
          <select
            value={selectedVoiceId}
            onChange={(e) => setSelectedVoiceId(e.target.value)}
            className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-hidden focus:border-teal-500"
          >
            {HMONG_VOICE_PROFILES.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} ({v.baseF0}Hz F₀ - {v.gender})
              </option>
            ))}
          </select>
        </div>

        {/* Tone Dynamic Range Emphasis Slider */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-slate-400 font-medium">
            <span>Tone Range (DSP Emphasis)</span>
            <span className="font-mono text-teal-400">{toneEmphasis.toFixed(2)}x</span>
          </div>
          <input
            type="range"
            min="0.8"
            max="1.6"
            step="0.05"
            value={toneEmphasis}
            onChange={(e) => setToneEmphasis(parseFloat(e.target.value))}
            className="w-full accent-teal-500 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
            <span>0.8x Natural</span>
            <span>1.2x Clear</span>
            <span>1.6x Learner</span>
          </div>
        </div>

        {/* Syllable Pacing / Speech Rate Slider */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-slate-400 font-medium">
            <span>Syllable Duration Pacing</span>
            <span className="font-mono text-teal-400">{rate.toFixed(2)}x (~{Math.round(360 / rate)}ms)</span>
          </div>
          <input
            type="range"
            min="0.6"
            max="1.4"
            step="0.05"
            value={rate}
            onChange={(e) => setRate(parseFloat(e.target.value))}
            className="w-full accent-teal-500 cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-slate-500 font-mono">
            <span>Slow (~600ms)</span>
            <span>Standard</span>
            <span>Fast (~250ms)</span>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * ToneComparisonTrainer
 * Interactive voice comparison and pronunciation training studio for Hmong RPA tones.
 * Allows users to record their voice, extracts pitch contours in real-time,
 * and overlays their pitch trajectory directly against the engine's target contour
 * with tolerance corridors, synchronized playback, and phonetic coaching.
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
import {
  extractPitchContour,
  comparePitchContours,
  PitchContourResult,
  PitchComparisonResult,
} from '../engine/pitchDetection';
import { taskCoordinator } from '../engine/taskCoordinator';
import { TONE_COLORS } from './InteractivePitchContourVisualizer';
import {
  Mic,
  Square,
  Play,
  RotateCcw,
  Volume2,
  Sparkles,
  Award,
  CheckCircle2,
  AlertTriangle,
  Upload,
  Layers,
  Sliders,
  HelpCircle,
  Activity,
  ArrowRight,
  Info,
  RefreshCw,
  Eye,
  Headphones,
} from 'lucide-react';

export interface ToneComparisonTrainerProps {
  initialTone?: string;
  dialect?: HmongDialect;
  onOpenToneGuide?: () => void;
}

const PRACTICE_WORDS: Record<string, { dawb: string; leeg: string; gloss: string }> = {
  b: { dawb: 'pob', leeg: 'pob', gloss: 'ball / pile (High Siab)' },
  j: { dawb: 'poj', leeg: 'poj', gloss: 'female / grandmother (High-Falling Nqes)' },
  v: { dawb: 'pov', leeg: 'pov', gloss: 'throw / cast (Mid-Rising Nce)' },
  '': { dawb: 'po', leeg: 'po', gloss: 'spleen / pop (Mid Nruab Ntug)' },
  s: { dawb: 'pos', leeg: 'pos', gloss: 'thorn / sting (Low Qis)' },
  g: { dawb: 'pog', leeg: 'pog', gloss: 'paternal grandmother (Breathy Ntxhi)' },
  m: { dawb: 'pom', leeg: 'pom', gloss: 'see / behold (Creaky Khaus)' },
  d: { dawb: 'pod', leeg: 'pod', gloss: 'sandhi variant (Sandhi Nce Qis)' },
};

export const ToneComparisonTrainer: React.FC<ToneComparisonTrainerProps> = ({
  initialTone = 'b',
  dialect: propDialect = 'dawb',
  onOpenToneGuide,
}) => {
  const [selectedToneKey, setSelectedToneKey] = useState<string>(initialTone);
  const [dialect, setDialect] = useState<HmongDialect>(propDialect);
  const [customWord, setCustomWord] = useState<string>('');
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>('paj_dawb_female');

  // Recording State
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordDuration, setRecordDuration] = useState<number>(0);
  const [vuLevel, setVuLevel] = useState<number>(0);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Playback State
  const [isPlayingTarget, setIsPlayingTarget] = useState<boolean>(false);
  const [isPlayingUser, setIsPlayingUser] = useState<boolean>(false);
  const [isPlayingSequential, setIsPlayingSequential] = useState<boolean>(false);
  const [playheadProgress, setPlayheadProgress] = useState<number | null>(null);
  const [hoverProgress, setHoverProgress] = useState<number | null>(null);

  // Display Settings
  const [showToleranceBand, setShowToleranceBand] = useState<boolean>(true);
  const [showChaoLevels, setShowChaoLevels] = useState<boolean>(true);
  const [yAxisMode, setYAxisMode] = useState<'semitones' | 'chao'>('chao');

  // Pitch Analysis Results
  const [userContour, setUserContour] = useState<PitchContourResult | null>(null);
  const [comparisonResult, setComparisonResult] = useState<PitchComparisonResult | null>(null);

  // Audio & Hardware Refs
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const userAudioElementRef = useRef<HTMLAudioElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const recordIntervalRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const graphContainerRef = useRef<HTMLDivElement | null>(null);

  // Sync prop dialect
  useEffect(() => {
    if (propDialect) setDialect(propDialect);
  }, [propDialect]);

  // Sync initial tone
  useEffect(() => {
    if (initialTone !== undefined) {
      setSelectedToneKey(initialTone);
    }
  }, [initialTone]);

  const activeVoice: VoiceProfile = useMemo(() => {
    return (
      HMONG_VOICE_PROFILES.find((v) => v.id === selectedVoiceId) ||
      HMONG_VOICE_PROFILES[dialect === 'dawb' ? 0 : 2]
    );
  }, [selectedVoiceId, dialect]);

  // Practice word to display
  const currentPracticeWord = useMemo(() => {
    if (customWord.trim()) return customWord.trim();
    const pair = PRACTICE_WORDS[selectedToneKey] || PRACTICE_WORDS['b'];
    return dialect === 'dawb' ? pair.dawb : pair.leeg;
  }, [customWord, selectedToneKey, dialect]);

  // Cleanup & Task Coordinator
  useEffect(() => {
    const unregister = taskCoordinator.registerStopHandler('tone_comparison_trainer', () => {
      stopAllAudio();
    });

    return () => {
      unregister();
      stopAllAudio();
      if (userAudioElementRef.current) {
        userAudioElementRef.current.pause();
        userAudioElementRef.current = null;
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, []);

  const stopAllAudio = () => {
    hmongTTS.stop();
    if (userAudioElementRef.current) {
      userAudioElementRef.current.pause();
      userAudioElementRef.current.currentTime = 0;
    }
    setIsPlayingTarget(false);
    setIsPlayingUser(false);
    setIsPlayingSequential(false);
    setPlayheadProgress(null);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (isRecording) {
      stopRecording();
    }
  };

  // Re-calculate comparison when target tone or voice changes
  useEffect(() => {
    if (userContour) {
      const comp = comparePitchContours(
        userContour,
        selectedToneKey,
        activeVoice.baseF0,
        dialect
      );
      setComparisonResult(comp);
    } else {
      // Create initial synthetic target comparison baseline
      const dummyContour: PitchContourResult = {
        frames: [],
        normalizedPoints: Array.from({ length: 100 }, (_, i) => ({
          progress: i / 99,
          f0: activeVoice.baseF0,
          semitones: 0,
          chao: 3.0,
        })),
        voicedDurationMs: 380,
        totalDurationMs: 420,
        meanF0: activeVoice.baseF0,
        medianF0: activeVoice.baseF0,
        minF0: activeVoice.baseF0 - 20,
        maxF0: activeVoice.baseF0 + 20,
        pitchRangeSemitones: 3.5,
        startF0: activeVoice.baseF0,
        endF0: activeVoice.baseF0,
        overallClarity: 0.8,
        isCreaky: false,
        isBreathy: false,
      };
      const initialComp = comparePitchContours(
        dummyContour,
        selectedToneKey,
        activeVoice.baseF0,
        dialect
      );
      setComparisonResult(initialComp);
    }
  }, [userContour, selectedToneKey, activeVoice, dialect]);

  // Decode audio blob and extract pitch contour
  const processAudioForPitch = async (blob: Blob) => {
    setIsAnalyzing(true);
    setErrorMessage(null);
    try {
      const arrayBuffer = await blob.arrayBuffer();
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        audioContextRef.current = new AudioCtx();
      }
      const audioCtx = audioContextRef.current;
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }

      const decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      const channelData = decodedBuffer.getChannelData(0);
      const sampleRate = decodedBuffer.sampleRate;

      const result = extractPitchContour(channelData, sampleRate);
      setUserContour(result);

      const comp = comparePitchContours(
        result,
        selectedToneKey,
        activeVoice.baseF0,
        dialect
      );
      setComparisonResult(comp);
    } catch (err: any) {
      console.error('Pitch contour extraction failed:', err);
      setErrorMessage(
        'Could not decode audio file for pitch analysis. Try recording again or using a standard WAV/MP3 format.'
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Start Recording
  const startRecording = async () => {
    stopAllAudio();
    setErrorMessage(null);
    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: true,
        },
      });

      mediaStreamRef.current = stream;

      // VU Meter setup
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      const pcmData = new Uint8Array(analyser.frequencyBinCount);
      const updateMeter = () => {
        if (!mediaStreamRef.current) return;
        analyser.getByteFrequencyData(pcmData);
        let sum = 0;
        for (let i = 0; i < pcmData.length; i++) sum += pcmData[i];
        const avg = sum / pcmData.length;
        setVuLevel(Math.min(100, Math.round((avg / 128) * 100)));
        animFrameRef.current = requestAnimationFrame(updateMeter);
      };
      animFrameRef.current = requestAnimationFrame(updateMeter);

      // MediaRecorder setup with supported MIME type
      const mimeTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
      let selectedMime = '';
      for (const m of mimeTypes) {
        if (MediaRecorder.isTypeSupported(m)) {
          selectedMime = m;
          break;
        }
      }

      const recorder = selectedMime
        ? new MediaRecorder(stream, { mimeType: selectedMime })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      const startTime = Date.now();
      recorder.onstop = async () => {
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        setVuLevel(0);
        ctx.close().catch(() => {});

        // Release mic stream
        stream.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;

        const blob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });
        const url = URL.createObjectURL(blob);
        setRecordedBlob(blob);
        setRecordedAudioUrl(url);

        await processAudioForPitch(blob);
      };

      recorder.start(100);
      setIsRecording(true);
      setRecordDuration(0);

      recordIntervalRef.current = window.setInterval(() => {
        const secs = (Date.now() - startTime) / 1000;
        setRecordDuration(parseFloat(secs.toFixed(1)));
        // Auto-stop after 4 seconds (plenty for a single syllable / tone practice)
        if (secs >= 3.8) {
          stopRecording();
        }
      }, 100);
    } catch (err: any) {
      console.error('Microphone access denied:', err);
      setErrorMessage(
        'Microphone access is unavailable or denied. Check browser permissions or click "Try Demo Voice" to test without microphone.'
      );
      setIsRecording(false);
    }
  };

  // Stop Recording
  const stopRecording = () => {
    if (recordIntervalRef.current) {
      clearInterval(recordIntervalRef.current);
      recordIntervalRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (_) {}
    }
    setIsRecording(false);
  };

  // Demo audio synthesis for immediate test without mic
  const handleLoadDemoPractice = async () => {
    stopAllAudio();
    setIsAnalyzing(true);
    try {
      // Use synthesized reference from Hmong audio synthesizer
      const word = currentPracticeWord;
      const targetTone = HMONG_TONES[selectedToneKey] || HMONG_TONES['b'];
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const sampleRate = ctx.sampleRate;
      const durationSec = 0.42;
      const totalSamples = Math.floor(sampleRate * durationSec);
      const audioBuffer = ctx.createBuffer(1, totalSamples, sampleRate);
      const channel = audioBuffer.getChannelData(0);

      // Synthesize harmonic tone with target contour + slight natural human vocal jitter
      const baseF0 = activeVoice.baseF0;
      let phase = 0;

      for (let i = 0; i < totalSamples; i++) {
        const progress = i / totalSamples;
        const cIdx = progress * (targetTone.contour.length - 1);
        const cLower = Math.floor(cIdx);
        const cUpper = Math.min(cLower + 1, targetTone.contour.length - 1);
        const cFrac = cIdx - cLower;
        const contourVal = targetTone.contour[cLower] * (1 - cFrac) + targetTone.contour[cUpper] * cFrac;

        // Slight micro-jitter (+/- 0.8%) for natural vocal simulation
        const microJitter = 1 + 0.008 * Math.sin(progress * 42);
        const toneSemitones = (contourVal - 0.5) * 9.8 * 1.15;
        const curF0 = baseF0 * Math.pow(2, toneSemitones / 12) * microJitter;

        phase += (2 * Math.PI * curF0) / sampleRate;

        // Formant vowel envelope (e.g. /o/)
        const env = Math.sin(progress * Math.PI);
        const wave =
          0.6 * Math.sin(phase) +
          0.3 * Math.sin(phase * 2) +
          0.15 * Math.sin(phase * 3) +
          0.08 * Math.sin(phase * 4);

        channel[i] = wave * env * 0.75;
      }

      // Master Condition
      const wavBlob = hmongTTS.encodeWav(audioBuffer);
      const url = URL.createObjectURL(wavBlob);
      setRecordedBlob(wavBlob);
      setRecordedAudioUrl(url);

      const result = extractPitchContour(channel, sampleRate);
      setUserContour(result);

      const comp = comparePitchContours(
        result,
        selectedToneKey,
        activeVoice.baseF0,
        dialect
      );
      setComparisonResult(comp);
      ctx.close().catch(() => {});
    } catch (err: any) {
      console.error('Demo sample generation failed:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Play Engine Target Tone Audio
  const handlePlayTarget = () => {
    if (isPlayingTarget) {
      stopAllAudio();
      return;
    }
    stopAllAudio();
    setIsPlayingTarget(true);
    setPlayheadProgress(0);

    const estDuration = Math.round(380);
    const startT = performance.now();

    const track = () => {
      const elapsed = performance.now() - startT;
      const progress = Math.min(1.0, elapsed / estDuration);
      setPlayheadProgress(progress);
      if (progress < 1.0 && hmongTTS.isBusy()) {
        animFrameRef.current = requestAnimationFrame(track);
      } else {
        setPlayheadProgress(null);
        setIsPlayingTarget(false);
      }
    };
    animFrameRef.current = requestAnimationFrame(track);

    hmongTTS.speak(currentPracticeWord, dialect, {
      voice: activeVoice,
      rate: 0.85,
      toneEmphasis: 1.25,
      onEnd: () => {
        setIsPlayingTarget(false);
        setPlayheadProgress(null);
      },
      onError: () => {
        setIsPlayingTarget(false);
        setPlayheadProgress(null);
      },
    });
  };

  // Play User Recorded Audio
  const handlePlayUserVoice = () => {
    if (!recordedAudioUrl) return;
    if (isPlayingUser) {
      stopAllAudio();
      return;
    }
    stopAllAudio();
    setIsPlayingUser(true);
    setPlayheadProgress(0);

    if (!userAudioElementRef.current) {
      userAudioElementRef.current = new Audio(recordedAudioUrl);
    } else {
      userAudioElementRef.current.src = recordedAudioUrl;
    }

    const audio = userAudioElementRef.current;
    audio.currentTime = 0;

    const track = () => {
      if (!audio.paused && audio.duration) {
        setPlayheadProgress(Math.min(1.0, audio.currentTime / audio.duration));
        animFrameRef.current = requestAnimationFrame(track);
      }
    };

    audio.onended = () => {
      setIsPlayingUser(false);
      setPlayheadProgress(null);
    };

    audio.onerror = () => {
      setIsPlayingUser(false);
      setPlayheadProgress(null);
    };

    audio.play().then(() => {
      animFrameRef.current = requestAnimationFrame(track);
    }).catch(() => {
      setIsPlayingUser(false);
    });
  };

  // Play Sequential Comparison (Target first, then User)
  const handlePlayBothSequential = () => {
    if (isPlayingSequential) {
      stopAllAudio();
      return;
    }
    stopAllAudio();
    setIsPlayingSequential(true);
    setPlayheadProgress(0);

    // 1. Play Target First
    const estDuration = 380;
    const startT = performance.now();

    const trackTarget = () => {
      const elapsed = performance.now() - startT;
      const progress = Math.min(1.0, elapsed / estDuration);
      setPlayheadProgress(progress);
      if (progress < 1.0 && hmongTTS.isBusy()) {
        animFrameRef.current = requestAnimationFrame(trackTarget);
      }
    };
    animFrameRef.current = requestAnimationFrame(trackTarget);

    hmongTTS.speak(currentPracticeWord, dialect, {
      voice: activeVoice,
      rate: 0.85,
      toneEmphasis: 1.25,
      onEnd: () => {
        setPlayheadProgress(null);
        // Short pause between samples
        window.setTimeout(() => {
          if (!recordedAudioUrl) {
            setIsPlayingSequential(false);
            return;
          }
          // 2. Play User Voice Next
          if (!userAudioElementRef.current) {
            userAudioElementRef.current = new Audio(recordedAudioUrl);
          } else {
            userAudioElementRef.current.src = recordedAudioUrl;
          }
          const audio = userAudioElementRef.current;
          audio.currentTime = 0;

          const trackUser = () => {
            if (!audio.paused && audio.duration) {
              setPlayheadProgress(Math.min(1.0, audio.currentTime / audio.duration));
              animFrameRef.current = requestAnimationFrame(trackUser);
            }
          };

          audio.onended = () => {
            setIsPlayingSequential(false);
            setPlayheadProgress(null);
          };

          audio.play().then(() => {
            animFrameRef.current = requestAnimationFrame(trackUser);
          }).catch(() => {
            setIsPlayingSequential(false);
          });
        }, 300);
      },
      onError: () => {
        setIsPlayingSequential(false);
        setPlayheadProgress(null);
      },
    });
  };

  // Handle Audio File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    stopAllAudio();
    const url = URL.createObjectURL(file);
    setRecordedBlob(file);
    setRecordedAudioUrl(url);
    processAudioForPitch(file);
  };

  // Keyboard shortcut: Spacebar to toggle recording when focused inside trainer (ignoring inputs/textareas)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const tag = target?.tagName;
      const isEditable = tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable;
      if (e.code === 'Space' && !isEditable) {
        e.preventDefault();
        if (isRecording) {
          stopRecording();
        } else {
          startRecording();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isRecording]);

  // Visual SVG Graph Dimensions & Mapping
  const activeTone = HMONG_TONES[selectedToneKey] || HMONG_TONES['b'];
  const toneColor = TONE_COLORS[selectedToneKey] || TONE_COLORS['b'];

  // Chao 1 to 5 mapping (bottom 90% to top 10%)
  const chaoToY = (chao: number) => {
    // chao: 1.0 (lowest) to 5.0 (highest)
    const norm = (chao - 1.0) / 4.0;
    return (1.0 - Math.max(0, Math.min(1, norm))) * 80 + 10; // 10% to 90%
  };

  // Semitone mapping (-6 semitones to +6 semitones)
  const semitonesToY = (semitones: number) => {
    const norm = (semitones + 6) / 12;
    return (1.0 - Math.max(0, Math.min(1, norm))) * 80 + 10;
  };

  const getYCoord = (pt: { chao: number; semitones: number }) => {
    return yAxisMode === 'chao' ? chaoToY(pt.chao) : semitonesToY(pt.semitones);
  };

  // Build SVG Path
  const makeSvgPath = (points: Array<{ progress: number; chao: number; semitones: number }>) => {
    if (!points || points.length === 0) return '';
    return points
      .map((p, idx) => {
        const x = p.progress * 100;
        const y = getYCoord(p);
        return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(' ');
  };

  // Build Tolerance Corridor Polygon Path (dynamically mapped in both Chao and Semitone views)
  const tolerancePolygonPath = useMemo(() => {
    if (!comparisonResult || comparisonResult.toleranceBand.length === 0) return '';
    const band = comparisonResult.toleranceBand;
    const upperPoints = band.map((b, idx) => {
      const x = b.progress * 100;
      let y: number;
      if (yAxisMode === 'chao') {
        const targetChao = comparisonResult.targetPoints[idx]?.chao ?? 3.0;
        y = chaoToY(Math.min(5.0, targetChao + 0.67));
      } else {
        y = semitonesToY(b.upper);
      }
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    });
    const lowerPoints = [...band].reverse().map((b, revIdx) => {
      const origIdx = band.length - 1 - revIdx;
      const x = b.progress * 100;
      let y: number;
      if (yAxisMode === 'chao') {
        const targetChao = comparisonResult.targetPoints[origIdx]?.chao ?? 3.0;
        y = chaoToY(Math.max(1.0, targetChao - 0.67));
      } else {
        y = semitonesToY(b.lower);
      }
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    });
    return `M ${upperPoints.join(' L ')} L ${lowerPoints.join(' L ')} Z`;
  }, [comparisonResult, yAxisMode]);

  const targetPath = useMemo(() => {
    return comparisonResult ? makeSvgPath(comparisonResult.targetPoints) : '';
  }, [comparisonResult, yAxisMode]);

  const userPath = useMemo(() => {
    return userContour && comparisonResult ? makeSvgPath(comparisonResult.userPoints) : '';
  }, [userContour, comparisonResult, yAxisMode]);

  // Current scrubber coordinate
  const currentInspectorData = useMemo(() => {
    const prog = playheadProgress !== null ? playheadProgress : hoverProgress;
    if (prog === null || !comparisonResult) return null;

    const idx = Math.min(
      comparisonResult.targetPoints.length - 1,
      Math.max(0, Math.floor(prog * (comparisonResult.targetPoints.length - 1)))
    );
    const targetPt = comparisonResult.targetPoints[idx];
    const userPt = userContour ? comparisonResult.userPoints[idx] : null;

    const targetY = getYCoord(targetPt);
    const userY = userPt ? getYCoord(userPt) : null;
    const diffSemitones = userPt ? userPt.semitones - targetPt.semitones : null;

    return {
      progress: prog,
      x: prog * 100,
      targetPt,
      userPt,
      targetY,
      userY,
      diffSemitones,
    };
  }, [playheadProgress, hoverProgress, comparisonResult, userContour, yAxisMode]);

  // Handle canvas mouse move for interactive inspection
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!graphContainerRef.current) return;
    const rect = graphContainerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const prog = Math.max(0, Math.min(1.0, x / rect.width));
    setHoverProgress(prog);
  };

  return (
    <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 shadow-2xl space-y-6">
      {/* Header & Mode Description */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-teal-500/20 text-teal-300 border border-teal-500/30">
              <Mic className="w-4 h-4" />
            </span>
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <span>Interactive Voice Pitch Trainer & Pronunciation Comparison</span>
              <span className="text-slate-600 hidden sm:inline" aria-hidden="true">·</span>
              <span className="text-xs font-mono text-teal-400 font-medium hidden sm:inline">
                Acoustic DSP Overlay
              </span>
            </h3>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
            Record your voice pronouncing any Hmong syllable. Our high-precision vocal pitch tracker extracts your F0 trajectory and overlays it directly onto the acoustic synthesis engine's target tone contour.
          </p>
        </div>

        {/* Global Action & Guide Links */}
        <div className="flex items-center gap-2 shrink-0">
          {onOpenToneGuide && (
            <button
              onClick={onOpenToneGuide}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium border border-slate-700 transition flex items-center gap-1.5"
            >
              <Info className="w-3.5 h-3.5 text-teal-400" />
              <span>RPA Tone Guide</span>
            </button>
          )}

          {/* Dialect Switcher */}
          <div className="flex items-center p-1 bg-slate-950 rounded-lg border border-slate-800 text-xs font-medium">
            <button
              onClick={() => setDialect('dawb')}
              className={`px-2.5 py-1 rounded transition ${
                dialect === 'dawb'
                  ? 'bg-teal-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Hmoob Dawb
            </button>
            <button
              onClick={() => setDialect('leeg')}
              className={`px-2.5 py-1 rounded transition ${
                dialect === 'leeg'
                  ? 'bg-teal-600 text-white font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Moob Leeg
            </button>
          </div>
        </div>
      </div>

      {/* 8 Hmong Tone Quick Selection Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <span>Select Target Tone to Train:</span>
            <span className="text-slate-500 font-normal">({activeTone.name} · Chao {activeTone.chaoNumber})</span>
          </label>
          <span className="text-[11px] text-slate-500 font-mono">Word: "{currentPracticeWord}"</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          {Object.entries(HMONG_TONES).map(([key, tone]) => {
            const isSelected = selectedToneKey === key;
            const tColor = TONE_COLORS[key] || TONE_COLORS[''];
            const pair = PRACTICE_WORDS[key] || PRACTICE_WORDS['b'];
            const exWord = dialect === 'dawb' ? pair.dawb : pair.leeg;

            return (
              <button
                key={key || 'mid'}
                onClick={() => {
                  setSelectedToneKey(key);
                  setCustomWord('');
                  stopAllAudio();
                }}
                className={`p-2.5 rounded-xl border text-left transition relative group overflow-hidden ${
                  isSelected
                    ? 'border-teal-500 bg-teal-950/40 shadow-lg ring-1 ring-teal-500/30'
                    : 'border-slate-800/80 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-800/50'
                }`}
              >
                {/* Tone color indicator pill */}
                <div
                  className="absolute top-0 left-0 bottom-0 w-1"
                  style={{ backgroundColor: tColor.stroke }}
                />

                <div className="flex items-center justify-between pl-1.5">
                  <span className="font-mono font-bold text-sm text-slate-100">
                    -{key || 'ø'}
                  </span>
                  <span className="text-[11px] font-mono px-1.5 py-0.2 rounded bg-slate-800/80 text-teal-300">
                    [{tone.chaoNumber}]
                  </span>
                </div>

                <div className="pl-1.5 mt-1 flex items-baseline justify-between text-[11px]">
                  <span className="text-slate-400 truncate font-mono">"{exWord}"</span>
                  <span className="text-[10px] text-slate-500">{tone.ipaDiacritic}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Studio Workbench Grid: Graph on Left, Controls & Evaluation on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Visual Pitch Contour Comparison Canvas (7 cols) */}
        <div className="lg:col-span-7 space-y-3">
          {/* Canvas Header & Display Toggles */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-slate-950/70 rounded-xl border border-slate-800/60 text-xs">
            <div className="flex items-center gap-3">
              <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-teal-400" />
                <span>Pitch Trajectory Canvas</span>
              </span>

              {/* Legend Badges */}
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 text-[11px] text-teal-400">
                  <span className="w-2.5 h-1 rounded-full" style={{ backgroundColor: toneColor.stroke }} />
                  Target (-{selectedToneKey || 'ø'})
                </span>
                <span className="flex items-center gap-1 text-[11px] text-amber-400">
                  <span className="w-2.5 h-1 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
                  Your Voice
                </span>
              </div>
            </div>

            {/* Canvas View Toggles */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowToleranceBand(!showToleranceBand)}
                className={`px-2 py-0.5 rounded text-[11px] transition ${
                  showToleranceBand
                    ? 'bg-slate-800 text-teal-300 border border-teal-800/40'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
                title="Toggle tolerance guide corridor"
              >
                Corridor
              </button>

              <button
                onClick={() => setYAxisMode(yAxisMode === 'chao' ? 'semitones' : 'chao')}
                className="px-2 py-0.5 rounded bg-slate-800/70 text-slate-300 hover:text-white text-[11px] border border-slate-700/60 transition"
                title="Switch between Chao 5-scale and Semitones"
              >
                Scale: {yAxisMode === 'chao' ? 'Chao [1-5]' : 'Semitones'}
              </button>
            </div>
          </div>

          {/* SVG Pitch Graph Container */}
          <div
            ref={graphContainerRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHoverProgress(null)}
            className="relative h-64 sm:h-72 w-full rounded-2xl bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 border border-slate-800/80 shadow-inner overflow-hidden select-none cursor-crosshair"
          >
            {/* Chao Level Grid Lines (5, 4, 3, 2, 1) */}
            {showChaoLevels && (
              <div className="absolute inset-0 pointer-events-none">
                {[5, 4, 3, 2, 1].map((level) => {
                  const topPercent = chaoToY(level);
                  const labels: Record<number, string> = {
                    5: 'High [5] Siab',
                    4: 'Mid-High [4]',
                    3: 'Mid [3] Nruab Ntug',
                    2: 'Mid-Low [2]',
                    1: 'Low [1] Qis',
                  };

                  return (
                    <div
                      key={level}
                      className="absolute left-0 right-0 flex items-center"
                      style={{ top: `${topPercent}%` }}
                    >
                      <div className="w-full border-t border-slate-800/60" />
                      <span className="absolute left-2.5 -top-2.5 text-[10px] font-mono text-slate-500 bg-slate-950/80 px-1.5 rounded">
                        {yAxisMode === 'chao' ? labels[level] : `${((level - 3) * 2.4).toFixed(1)} st`}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Syllable Progression Vertical Markers (Onset, Nucleus, Coda) */}
            <div className="absolute inset-0 pointer-events-none flex justify-between px-6">
              <div className="h-full border-r border-slate-800/30" />
              <div className="h-full border-r border-slate-800/30" />
              <div className="h-full border-r border-slate-800/30" />
            </div>

            {/* Main SVG Contour Render */}
            <svg
              className="absolute inset-0 w-full h-full"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
            >
              <defs>
                {/* Glow Filter for High Visibility */}
                <filter id="glow-target" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="1.5" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                <filter id="glow-user" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="1.8" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Shaded Tolerance Band Corridor */}
              {showToleranceBand && comparisonResult && tolerancePolygonPath && (
                <path
                  d={tolerancePolygonPath}
                  fill={toneColor.glow}
                  opacity="0.22"
                  className="transition-all duration-300"
                />
              )}

              {/* Target Engine Pitch Contour (Solid glowing line) */}
              {targetPath && (
                <path
                  d={targetPath}
                  fill="none"
                  stroke={toneColor.stroke}
                  strokeWidth="3.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  filter="url(#glow-target)"
                  className="transition-all duration-200"
                />
              )}

              {/* User Voice Recorded Pitch Contour (Vibrant Amber) */}
              {userPath && (
                <path
                  d={userPath}
                  fill="none"
                  stroke="#fbbf24"
                  strokeWidth="3.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  filter="url(#glow-user)"
                  className="transition-all duration-200"
                />
              )}

              {/* Playhead / Inspection Scrubber Vertical Line */}
              {currentInspectorData && (
                <g>
                  <line
                    x1={currentInspectorData.x}
                    y1="0"
                    x2={currentInspectorData.x}
                    y2="100"
                    stroke="rgba(255,255,255,0.4)"
                    strokeWidth="0.8"
                    strokeDasharray="2,2"
                  />
                  {/* Target Node Point */}
                  <circle
                    cx={currentInspectorData.x}
                    cy={currentInspectorData.targetY}
                    r="2.2"
                    fill={toneColor.stroke}
                    stroke="#ffffff"
                    strokeWidth="0.8"
                  />
                  {/* User Voice Node Point */}
                  {currentInspectorData.userY !== null && (
                    <circle
                      cx={currentInspectorData.x}
                      cy={currentInspectorData.userY}
                      r="2.6"
                      fill="#fbbf24"
                      stroke="#ffffff"
                      strokeWidth="1.0"
                    />
                  )}
                </g>
              )}
            </svg>

            {/* Live Playhead Sweep Laser during playback */}
            {playheadProgress !== null && (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-gradient-to-b from-teal-300 via-amber-300 to-teal-400 pointer-events-none shadow-[0_0_12px_rgba(45,212,191,0.9)]"
                style={{ left: `${playheadProgress * 100}%` }}
              />
            )}

            {/* Real-Time Recording Wave / VU Pulse Overlay */}
            {isRecording && (
              <div className="absolute inset-0 bg-red-950/20 backdrop-blur-[1px] flex flex-col items-center justify-center pointer-events-none">
                <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-red-900/90 border border-red-500/60 text-white text-xs font-semibold shadow-lg animate-pulse">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-400 animate-ping" />
                  <span>Recording Voice ({recordDuration.toFixed(1)}s)... Speak now!</span>
                </div>
                <div className="mt-3 flex items-center gap-1">
                  {Array.from({ length: 16 }).map((_, i) => (
                    <div
                      key={i}
                      className="w-1 bg-red-400/80 rounded-full transition-all duration-75"
                      style={{
                        height: `${Math.max(4, Math.min(36, (vuLevel / 100) * 36 * (Math.sin(i * 0.5) * 0.5 + 0.8)))}px`,
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Interactive Inspector Tooltip Floater */}
            {currentInspectorData && (
              <div
                className="absolute pointer-events-none bottom-3 left-4 right-4 sm:left-auto sm:right-4 p-2.5 rounded-xl bg-slate-950/90 border border-slate-700/80 backdrop-blur-md shadow-xl flex items-center justify-between text-xs font-mono"
              >
                <div className="flex items-center gap-3">
                  <div>
                    <span className="text-slate-500 text-[10px] block">PROGRESS</span>
                    <span className="text-slate-200">
                      {(currentInspectorData.progress * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div>
                    <span className="text-teal-400 text-[10px] block">TARGET F0</span>
                    <span className="text-slate-200">
                      {currentInspectorData.targetPt.f0.toFixed(0)} Hz (Chao {currentInspectorData.targetPt.chao.toFixed(1)})
                    </span>
                  </div>
                  {currentInspectorData.userPt && (
                    <div>
                      <span className="text-amber-400 text-[10px] block">YOUR VOICE</span>
                      <span className="text-slate-200">
                        {currentInspectorData.userPt.f0.toFixed(0)} Hz (Chao {currentInspectorData.userPt.chao.toFixed(1)})
                      </span>
                    </div>
                  )}
                </div>

                {currentInspectorData.diffSemitones !== null && (
                  <div className="text-right">
                    <span className="text-slate-500 text-[10px] block">OFFSET</span>
                    <span
                      className={`font-bold ${
                        Math.abs(currentInspectorData.diffSemitones) <= 1.5
                          ? 'text-emerald-400'
                          : 'text-amber-400'
                      }`}
                    >
                      {currentInspectorData.diffSemitones >= 0 ? '+' : ''}
                      {currentInspectorData.diffSemitones.toFixed(1)} st
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Time Progression Axis Marks */}
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 px-1">
            <span>0% (Onset)</span>
            <span>25% (Vowel Start)</span>
            <span>50% (Vowel Nucleus)</span>
            <span>75% (Pitch Gliding)</span>
            <span>100% (Coda / Termination)</span>
          </div>

          {/* Synchronized Audition Toolbar */}
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {/* Play Target Engine */}
              <button
                onClick={handlePlayTarget}
                disabled={isRecording}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                  isPlayingTarget
                    ? 'bg-teal-600 border-teal-500 text-white'
                    : 'bg-slate-900 border-slate-800 text-teal-300 hover:bg-slate-800'
                }`}
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Play Target ({activeTone.name})</span>
              </button>

              {/* Play Recorded User Voice */}
              <button
                onClick={handlePlayUserVoice}
                disabled={!recordedAudioUrl || isRecording}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                  !recordedAudioUrl
                    ? 'opacity-40 cursor-not-allowed bg-slate-900 border-slate-800 text-slate-500'
                    : isPlayingUser
                    ? 'bg-amber-500 border-amber-400 text-slate-950'
                    : 'bg-slate-900 border-slate-800 text-amber-300 hover:bg-slate-800'
                }`}
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>Play My Voice</span>
              </button>

              {/* Compare Both Sequentially */}
              <button
                onClick={handlePlayBothSequential}
                disabled={!recordedAudioUrl || isRecording}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                  !recordedAudioUrl
                    ? 'opacity-40 cursor-not-allowed bg-slate-900 border-slate-800 text-slate-500'
                    : isPlayingSequential
                    ? 'bg-purple-600 border-purple-500 text-white'
                    : 'bg-slate-900 border-slate-800 text-purple-300 hover:bg-slate-800'
                }`}
                title="Play target tone first, then your recorded voice after a brief pause"
              >
                <Headphones className="w-3.5 h-3.5" />
                <span>Compare Both in Ear</span>
              </button>
            </div>

            {/* Quick Demo Voice Loader for Instant Testing */}
            <button
              onClick={handleLoadDemoPractice}
              disabled={isRecording || isAnalyzing}
              className="text-xs text-slate-400 hover:text-teal-300 font-medium flex items-center gap-1 transition"
              title="Generate a calibrated reference sample to preview pitch overlay without microphone"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin text-teal-400' : ''}`} />
              <span>Try Demo Reference</span>
            </button>
          </div>
        </div>

        {/* Right Column: Recording Console & Phonetic Coaching Evaluation (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Recording & Input Controls Box */}
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Mic className="w-4 h-4 text-teal-400" />
                <span>Practice Recording Console</span>
              </label>
              <span className="text-[11px] text-slate-500">Spacebar = Rec/Stop</span>
            </div>

            {/* Big Record Button */}
            <div className="flex items-center gap-3">
              {!isRecording ? (
                <button
                  onClick={startRecording}
                  disabled={isAnalyzing}
                  className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 active:scale-95 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-teal-950/50 transition cursor-pointer"
                >
                  <Mic className="w-4 h-4 text-white animate-bounce" />
                  <span>Record "{currentPracticeWord}"</span>
                </button>
              ) : (
                <button
                  onClick={stopRecording}
                  className="flex-1 py-3 px-4 rounded-xl bg-red-600 hover:bg-red-500 active:scale-95 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-red-950/50 transition cursor-pointer animate-pulse"
                >
                  <Square className="w-4 h-4 fill-current" />
                  <span>Stop & Analyze ({recordDuration}s)</span>
                </button>
              )}

              {/* Upload Voice File Option */}
              <label
                className="p-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-300 hover:text-white cursor-pointer transition flex items-center justify-center shrink-0"
                title="Upload audio file (.wav, .mp3, .m4a)"
              >
                <Upload className="w-4 h-4" />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            {/* Error Message Notice if any */}
            {errorMessage && (
              <div className="p-2.5 rounded-lg bg-amber-950/50 border border-amber-800/60 text-amber-300 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}
          </div>

          {/* Pronunciation Match Evaluation Card */}
          {comparisonResult && userContour ? (
            <div className="p-4 rounded-xl bg-slate-950/90 border border-slate-800/80 space-y-4">
              {/* Score Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-800/60">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex items-center justify-center w-12 h-12 rounded-xl border font-mono font-bold text-lg shadow-lg ${
                      comparisonResult.score >= 85
                        ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300 shadow-emerald-950/40'
                        : comparisonResult.score >= 70
                        ? 'bg-teal-950/80 border-teal-500 text-teal-300 shadow-teal-950/40'
                        : comparisonResult.score >= 55
                        ? 'bg-amber-950/80 border-amber-500 text-amber-300 shadow-amber-950/40'
                        : 'bg-rose-950/80 border-rose-500 text-rose-300 shadow-rose-950/40'
                    }`}
                  >
                    {comparisonResult.score}%
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-bold text-slate-100">
                        {comparisonResult.feedback.title}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Grade {comparisonResult.grade} · {comparisonResult.slopeMatch === comparisonResult.userSlope ? 'Matched Pitch Slope' : 'Contour Deviation'}
                    </p>
                  </div>
                </div>

                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
                  {userContour.voicedDurationMs.toFixed(0)}ms
                </span>
              </div>

              {/* Acoustic Metrics Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/60">
                  <span className="text-slate-500 text-[10px] block uppercase">Shape Similarity</span>
                  <span className="text-slate-200 font-bold">
                    {(comparisonResult.shapeCorrelation * 100).toFixed(0)}%
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">Pearson slope r</span>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/60">
                  <span className="text-slate-500 text-[10px] block uppercase">Pitch Glide (ΔF0)</span>
                  <span className="text-amber-400 font-bold">
                    {comparisonResult.userPitchChangeSemitones >= 0 ? '+' : ''}
                    {comparisonResult.userPitchChangeSemitones.toFixed(1)} st
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    Target: {comparisonResult.targetPitchChangeSemitones >= 0 ? '+' : ''}
                    {comparisonResult.targetPitchChangeSemitones.toFixed(1)} st
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/60">
                  <span className="text-slate-500 text-[10px] block uppercase">Speaker Mean Pitch</span>
                  <span className="text-slate-200 font-bold">
                    {userContour.meanF0.toFixed(0)} Hz
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    Range: {userContour.minF0.toFixed(0)} - {userContour.maxF0.toFixed(0)} Hz
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800/60">
                  <span className="text-slate-500 text-[10px] block uppercase">Register Level</span>
                  <span className="text-slate-200 font-bold">
                    {comparisonResult.registerMatch ? 'Aligned ✓' : 'Shifted'}
                  </span>
                  <span className="text-[10px] text-slate-500 block mt-0.5">
                    RMSE: {comparisonResult.rmseSemitones.toFixed(1)} st
                  </span>
                </div>
              </div>

              {/* Coaching Feedback & Strengths */}
              <div className="space-y-2 text-xs">
                {/* Pros */}
                {comparisonResult.feedback.pros.length > 0 && (
                  <div className="space-y-1">
                    {comparisonResult.feedback.pros.map((pro, idx) => (
                      <div key={idx} className="flex items-center gap-1.5 text-emerald-400">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                        <span>{pro}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Improvements */}
                {comparisonResult.feedback.improvements.length > 0 && (
                  <div className="space-y-1">
                    {comparisonResult.feedback.improvements.map((imp, idx) => (
                      <div key={idx} className="flex items-start gap-1.5 text-amber-300">
                        <ArrowRight className="w-3.5 h-3.5 shrink-0 text-amber-400 mt-0.5" />
                        <span>{imp}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Hmong Language Coaching Advice */}
                {comparisonResult.feedback.hmongTip && (
                  <div className="p-2.5 rounded-lg bg-teal-950/40 border border-teal-800/40 text-teal-300 text-[11px] leading-relaxed">
                    <span className="font-semibold block text-teal-200">Lus Qhia Hmoob:</span>
                    {comparisonResult.feedback.hmongTip}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Prompt to Record */
            <div className="p-5 rounded-xl bg-slate-950/60 border border-dashed border-slate-800 text-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-slate-400">
                <Mic className="w-5 h-5 text-teal-400" />
              </div>
              <h4 className="text-xs font-semibold text-slate-200">
                Ready to Record "{currentPracticeWord}"
              </h4>
              <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                Press the Record button above or click "Try Demo Reference" to view your pitch contour comparison.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

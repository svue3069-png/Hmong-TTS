/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * HmongTTS - Mobile & Cross-Platform Hmong Voice Synthesis Engine
 * With Intelligent Multilingual Auto-Detect (Hmong vs English) & Dynamic Cultural Themes
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  hmongTTS,
  HMONG_VOICE_PROFILES,
  VoiceProfile,
  SynthesisMetadataExport,
} from './engine/hmongAudioSynthesizer';
import {
  HmongDialect,
  parseHmongText,
  convertDialectText,
  HMONG_TONES,
} from './engine/hmongPhonology';
import { detectLanguage, DetectionResult } from './engine/languageDetector';
import { speechCoordinator, SpeechEngineMode, ActiveEngineType } from './engine/multilingualCoordinator';
import { webSpeech } from './engine/webSpeechEngine';
import { taskCoordinator } from './engine/taskCoordinator';
import { AudioVisualizer } from './components/AudioVisualizer';
import { PWAInstallButton } from './components/PWAInstallButton';
import { ToneLaboratory } from './components/ToneLaboratory';
import { DeveloperHub } from './components/DeveloperHub';
import { VoicePackManager } from './components/VoicePackManager';
import { MissingWordRecorder } from './components/MissingWordRecorder';
import { AccessibilityReader } from './components/AccessibilityReader';
import { NativeReferenceHub } from './components/NativeReferenceHub';
import { MetadataInspectorModal } from './components/MetadataInspectorModal';
import { VoiceRecorderCard } from './components/VoiceRecorderCard';
import { AudioPlayerController } from './components/AudioPlayerController';
import { useStudioAudioPlayer } from './hooks/useStudioAudioPlayer';
import { ThemeColorBackgroundPicker, BackgroundConfig } from './components/ThemeColorBackgroundPicker';
import { AcousticSettingsHoverGuide } from './components/AcousticSettingsHoverGuide';
import { FixPronunciationModal } from './components/FixPronunciationModal';
import { PhrasebookDrawerModal } from './components/PhrasebookDrawerModal';
import { BatchProcessingTool } from './components/BatchProcessingTool';
import {
  Play,
  Square,
  Download,
  RotateCcw,
  Sliders,
  Languages,
  Check,
  Sparkles,
  Bot,
  Globe2,
  Volume2,
  Video,
  Palette,
  ExternalLink,
  FileCode,
  Mic,
  Info,
  HelpCircle,
  BookOpen,
  Wrench,
  Layers,
} from 'lucide-react';

// Preset phrases in White Hmong, Green Hmong, English, and Bilingual Code-Switching
const PRESET_PHRASES = [
  {
    label: 'Daily Greeting (Nyob Zoo)',
    category: 'hmong',
    dawb: 'Nyob zoo sawv daws! Hnub no nej puas nyob zoo?',
    leeg: 'Nyob zoo suav daws! Nub nua mej puas nyob zoo?',
    english: 'Hello everyone! Are you all doing well today?',
    text: 'Nyob zoo sawv daws! Hnub no nej puas nyob zoo?',
  },
  {
    label: 'Gratitude (Ua Tsaug)',
    category: 'hmong',
    dawb: 'Ua tsaug ntau ntau rau nej txoj kev pab cuam.',
    leeg: 'Ua tsaug ntau ntau rua mej txuj kev paab cuam.',
    english: 'Thank you very much for your helpful assistance.',
    text: 'Ua tsaug ntau ntau rau nej txoj kev pab cuam.',
  },
  {
    label: 'Hmong New Year (Noj Peb Caug)',
    category: 'hmong',
    dawb: 'Zoo siab tos txais nej sawv daws tuaj koom peb lub tsiab peb caug!',
    leeg: 'Zoo sab txais mej suav daws tuaj koom peb lub tsiab peb caug!',
    english: 'Welcome everyone to celebrate our Hmong New Year!',
    text: 'Zoo siab tos txais nej sawv daws tuaj koom peb lub tsiab peb caug!',
  },
  {
    label: 'Doctor Visit (Mus Saib Mob)',
    category: 'hmong',
    dawb: 'Kuv tuaj ntsib kws kho mob vim kuv lub taub hau mob heev.',
    leeg: 'Kuv tuaj ntsib kws kho mob vim kuv lub taub hau mob heev.',
    english: 'I came to see the doctor because I have a severe headache.',
    text: 'Kuv tuaj ntsib kws kho mob vim kuv lub taub hau mob heev.',
  },
  {
    label: 'English Welcome',
    category: 'english',
    text: 'Welcome to the Hmong speech synthesizer! Auto-detect seamlessly routes this sentence to the browser Web Speech API.',
  },
  {
    label: 'Bilingual Clinic Intake',
    category: 'mixed',
    text: 'Nyob zoo! Please check in at the reception desk to see the doctor.',
  },
];

export type ColorTheme = 'indigo' | 'jade' | 'amber' | 'slate';

const THEMES: Record<ColorTheme, { name: string; bg: string; surface: string; border: string; accent: string; dot: string }> = {
  indigo: {
    name: 'Hmong Indigo Midnight',
    bg: 'bg-[#060b14]',
    surface: 'bg-[#0d1527]/70',
    border: 'border-slate-800/80',
    accent: 'text-teal-400',
    dot: 'bg-teal-500',
  },
  jade: {
    name: 'Batik Jade & Emerald',
    bg: 'bg-[#03100c]',
    surface: 'bg-[#06211a]/70',
    border: 'border-emerald-900/50',
    accent: 'text-emerald-400',
    dot: 'bg-emerald-500',
  },
  amber: {
    name: 'Highland Obsidian & Amber',
    bg: 'bg-[#0e0a0d]',
    surface: 'bg-[#19141f]/70',
    border: 'border-amber-900/40',
    accent: 'text-amber-400',
    dot: 'bg-amber-500',
  },
  slate: {
    name: 'Deep Studio Slate',
    bg: 'bg-[#0b0f19]',
    surface: 'bg-[#111827]/70',
    border: 'border-slate-800/80',
    accent: 'text-cyan-400',
    dot: 'bg-cyan-500',
  },
};

// Preset highlight colors for Hmong and English modes
const HMONG_HIGHLIGHT_PRESETS = [
  { name: 'Teal Traditional (Default)', color: '#14b8a6' },
  { name: 'Jade Batik', color: '#10b981' },
  { name: 'Paj Ntaub Rose', color: '#f43f5e' },
  { name: 'Highland Amber', color: '#f59e0b' },
  { name: 'Indigo Royal', color: '#6366f1' },
  { name: 'Electric Cyan', color: '#06b6d4' },
  { name: 'Lime Citrus', color: '#84cc16' },
];

const ENGLISH_HIGHLIGHT_PRESETS = [
  { name: 'Sky Blue (Default)', color: '#0ea5e9' },
  { name: 'Ocean Blue', color: '#3b82f6' },
  { name: 'Royal Purple', color: '#8b5cf6' },
  { name: 'Fuchsia Pink', color: '#d946ef' },
  { name: 'Vibrant Orange', color: '#f97316' },
  { name: 'Golden Sun', color: '#eab308' },
  { name: 'Coral Red', color: '#ef4444' },
];

function getContrastTextColor(hexColor: string): string {
  const hex = hexColor.replace('#', '');
  if (hex.length === 3) {
    const r = parseInt(hex[0] + hex[0], 16);
    const g = parseInt(hex[1] + hex[1], 16);
    const b = parseInt(hex[2] + hex[2], 16);
    return ((r * 299 + g * 587 + b * 114) / 1000) >= 128 ? '#020617' : '#ffffff';
  }
  if (hex.length !== 6) return '#020617';
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 128 ? '#020617' : '#ffffff';
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'studio' | 'tones' | 'references' | 'sdk' | 'offline' | 'accessibility'>('studio');
  const [text, setText] = useState('');
  const [engineMode, setEngineMode] = useState<SpeechEngineMode>('auto');
  const [dialect, setDialect] = useState<HmongDialect>('dawb');
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>('paj_dawb_female');
  const [rate, setRate] = useState<number>(1.0);
  const [pitch, setPitch] = useState<number>(1.0);
  const [toneEmphasis, setToneEmphasis] = useState<number>(1.1);
  const [prosody, setProsody] = useState<number>(1.1);
  const [currentWordIdx, setCurrentWordIdx] = useState<number | null>(null);
  const [activeEngine, setActiveEngine] = useState<ActiveEngineType>('hmongdictionary_native');
  const [audioSource, setAudioSource] = useState<'hmongdictionary_native' | 'hmong_dsp'>('hmongdictionary_native');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [isExportingMetadata, setIsExportingMetadata] = useState<boolean>(false);
  const [isMetadataModalOpen, setIsMetadataModalOpen] = useState<boolean>(false);
  const [currentMetadata, setCurrentMetadata] = useState<SynthesisMetadataExport | null>(null);
  const [theme, setTheme] = useState<ColorTheme>('indigo');
  const [isHoverGuideOpen, setIsHoverGuideOpen] = useState<boolean>(false);
  const [appliedPresetToast, setAppliedPresetToast] = useState<string | null>(null);
  const [showLiveReading, setShowLiveReading] = useState<boolean>(true);
  const [readingWindowMode, setReadingWindowMode] = useState<'twenty' | 'half' | 'full'>('twenty');
  const [showWordCount] = useState<boolean>(true);
  const [isAutoScrollSyncEnabled, setIsAutoScrollSyncEnabled] = useState<boolean>(true);
  const [manualChunkIndex, setManualChunkIndex] = useState<number>(0);

  // Spoken Word Highlight Custom Colors for Live Reading Window
  const [hmongHighlightColor, setHmongHighlightColor] = useState<string>(() => {
    try {
      return localStorage.getItem('hmongtts_highlight_hmong') || '#14b8a6';
    } catch {
      return '#14b8a6';
    }
  });
  const [englishHighlightColor, setEnglishHighlightColor] = useState<string>(() => {
    try {
      return localStorage.getItem('hmongtts_highlight_english') || '#0ea5e9';
    } catch {
      return '#0ea5e9';
    }
  });
  const [isReadingColorSettingsOpen, setIsReadingColorSettingsOpen] = useState<boolean>(false);

  const handleUpdateHmongHighlight = (color: string) => {
    setHmongHighlightColor(color);
    try {
      localStorage.setItem('hmongtts_highlight_hmong', color);
    } catch (_) {}
  };

  const handleUpdateEnglishHighlight = (color: string) => {
    setEnglishHighlightColor(color);
    try {
      localStorage.setItem('hmongtts_highlight_english', color);
    } catch (_) {}
  };

  const handleResetHighlightColors = () => {
    handleUpdateHmongHighlight('#14b8a6');
    handleUpdateEnglishHighlight('#0ea5e9');
  };

  // Background Theme Configuration (Office-style palette with live hover preview & image upload)
  const [bgConfig, setBgConfig] = useState<BackgroundConfig>(() => {
    try {
      const saved = localStorage.getItem('hmongtts_bg_config');
      return saved ? JSON.parse(saved) : { type: 'color', value: '#060b14', name: 'Automatic Midnight' };
    } catch {
      return { type: 'color', value: '#060b14', name: 'Automatic Midnight' };
    }
  });
  const [hoverPreviewBg, setHoverPreviewBg] = useState<BackgroundConfig | null>(null);

  const handleSelectBg = (newBg: BackgroundConfig) => {
    setBgConfig(newBg);
    setHoverPreviewBg(null);
    try {
      localStorage.setItem('hmongtts_bg_config', JSON.stringify(newBg));
    } catch (_) {}
  };

  const activeBg = hoverPreviewBg || bgConfig;

  // Fix Pronunciation Modal State
  const [isFixModalOpen, setIsFixModalOpen] = useState(false);
  const [fixModalWord, setFixModalWord] = useState('');

  // Phrasebook Modal State
  const [isPhrasebookOpen, setIsPhrasebookOpen] = useState(false);

  // Batch Processing Tool Modal State
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);

  // Live Reading Window View Mode: 'rpa' (Hmong RPA) | 'respell' (English-friendly respelling) | 'ipa' (IPA Phonetics)
  const [readingDisplayMode, setReadingDisplayMode] = useState<'rpa' | 'respell' | 'ipa'>('rpa');

  // Quick Microphone Voice Input Dictation State
  const [isVoiceInputActive, setIsVoiceInputActive] = useState(false);
  const recognitionRef = React.useRef<any>(null);

  // Stop all active tasks, audio playback, and background processes immediately whenever activeTab changes
  useEffect(() => {
    taskCoordinator.stopAll('tab_changed');
    setCurrentWordIdx(null);
  }, [activeTab]);

  // Register voice dictation with taskCoordinator so it stops when tab/window switches
  useEffect(() => {
    const unregister = taskCoordinator.registerStopHandler('voice_dictation', () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (_) {}
      }
      setIsVoiceInputActive(false);
    });
    return () => unregister();
  }, []);

  const handleToggleVoiceInput = () => {
    if (isVoiceInputActive) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (_) {}
      }
      setIsVoiceInputActive(false);
      taskCoordinator.notifyTaskEnded('voice_dictation');
      return;
    }

    // Stop any playing audio before dictation starts
    taskCoordinator.stopAll('new_task_started');

    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRec) {
      try {
        const recognition = new SpeechRec();
        recognition.continuous = true;
        recognition.interimResults = true;
        // Attempt browser default or en-US if hmn is unsupported in browser
        try {
          recognition.lang = navigator.language || 'en-US';
        } catch (_) {}

        recognition.onstart = () => {
          setIsVoiceInputActive(true);
        };

        recognition.onresult = (event: any) => {
          let interimTranscript = '';
          let finalTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            } else {
              interimTranscript += event.results[i][0].transcript;
            }
          }
          const spoken = (finalTranscript || interimTranscript).trim();
          if (spoken) {
            setText((prev) => (prev.trim() ? `${prev.trim()} ${spoken}` : spoken));
            studioPlayer.clearTrack();
          }
        };

        recognition.onerror = (errEvent: any) => {
          setIsVoiceInputActive(false);
          // If browser speech recognition failed or was blocked, navigate to microphone recorder
          const cardEl = document.getElementById('voice-recorder-card-section');
          if (cardEl) {
            cardEl.scrollIntoView({ behavior: 'smooth' });
          }
        };

        recognition.onend = () => {
          setIsVoiceInputActive(false);
        };

        recognitionRef.current = recognition;
        recognition.start();
        return;
      } catch (err) {
        console.warn('SpeechRecognition initialization note, scrolling to recorder:', err);
      }
    }

    // Direct fallback: scroll smoothly to Voice Recording Studio card
    const cardEl = document.getElementById('voice-recorder-card-section');
    if (cardEl) {
      cardEl.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Studio Audio Player Hook with Play, Pause, Speed (1x, 2x, 3x), and Persistent Relistening
  const studioPlayer = useStudioAudioPlayer({
    onWordHighlight: (idx) => {
      setCurrentWordIdx(idx);
    },
  });

  const isPlaying = studioPlayer.isPlaying;

  // Dynamic language detection on user input
  const detection: DetectionResult = useMemo(() => {
    return detectLanguage(text);
  }, [text]);

  // Determine active effective engine based on mode and detection
  const resolvedEngine: ActiveEngineType = useMemo(() => {
    if (engineMode === 'english') return 'web_speech';
    if (detection.language === 'english' && engineMode === 'auto') return 'web_speech';
    return audioSource === 'hmongdictionary_native' ? 'hmongdictionary_native' : 'hmong_dsp';
  }, [engineMode, detection.language, audioSource]);

  // Current Hmong Voice
  const currentVoice = HMONG_VOICE_PROFILES.find(v => v.id === selectedVoiceId) || HMONG_VOICE_PROFILES[0];

  // Syllables or words for synchronized karaoke display with English-friendly respellings and IPA
  const displayTokens = useMemo(() => {
    if (resolvedEngine !== 'web_speech') {
      const parsed = parseHmongText(text, dialect);
      return parsed.map((p) => ({
        token: p.raw,
        clean: p.clean,
        isPunctuation: p.isPunctuation,
        tone: p.toneLetter,
        englishRespelling: p.englishRespelling || p.clean,
        ipa: p.ipa,
        gloss: p.gloss,
        isOverride: p.isOverride,
        isToneSandhi: p.isToneSandhi,
        sandhiShift: p.sandhiShift,
      }));
    } else {
      // English / Web Speech tokenization
      return text.split(/\s+/).filter(Boolean).map((w) => ({
        token: w,
        clean: w.replace(/[^a-zA-Z]/g, ''),
        isPunctuation: false,
        tone: '',
        englishRespelling: w,
        ipa: '',
        gloss: '',
        isOverride: false,
        isToneSandhi: false,
        sandhiShift: undefined,
      }));
    }
  }, [text, dialect, resolvedEngine]);

  // Dialect toggle handler
  const handleDialectChange = (newDialect: HmongDialect) => {
    taskCoordinator.stopAll('dialect_changed');
    setDialect(newDialect);
    if (engineMode !== 'english') {
      const converted = convertDialectText(text, dialect, newDialect);
      setText(converted);
    }
    if (newDialect === 'dawb' && currentVoice.dialect !== 'dawb') {
      setSelectedVoiceId('paj_dawb_female');
    } else if (newDialect === 'leeg' && currentVoice.dialect !== 'leeg') {
      setSelectedVoiceId('mee_leeg_female');
    }
  };

  const handlePlay = async () => {
    if (studioPlayer.isPlaying) {
      studioPlayer.pause();
      return;
    }

    if (studioPlayer.isPaused && studioPlayer.track) {
      await studioPlayer.play();
      return;
    }

    if (!text.trim()) return;

    const newTrack = await studioPlayer.loadTrack(text, dialect, {
      voice: currentVoice,
      rate,
      pitch,
      toneEmphasis,
      prosody,
      engineMode,
      audioSource,
    });

    if (newTrack) {
      await studioPlayer.play();
    }
  };

  const handleStop = () => {
    taskCoordinator.stopAll('user_stopped');
    studioPlayer.stop();
    setCurrentWordIdx(null);
  };

  const handleDownloadWav = async () => {
    if (studioPlayer.track?.blob) {
      studioPlayer.downloadTrackWav('hmong_audio');
      return;
    }

    if (!text.trim()) return;
    setIsExporting(true);
    try {
      const { buffer } = await hmongTTS.renderToAudioBuffer(text, dialect, {
        voice: currentVoice,
        rate,
        pitch,
        toneEmphasis,
        prosody,
        audioSource,
      });
      const wavBlob = hmongTTS.encodeWav(buffer);
      const url = URL.createObjectURL(wavBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `hmongtts_${dialect}_${Date.now()}.wav`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Export WAV error:', e);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadMetadataJson = async () => {
    if (!text.trim()) return;
    setIsExportingMetadata(true);
    try {
      const meta = await hmongTTS.generateMetadata(text, dialect, {
        voice: currentVoice,
        rate,
        pitch,
        toneEmphasis,
        prosody,
      });
      const jsonBlob = hmongTTS.encodeMetadataJson(meta);
      const url = URL.createObjectURL(jsonBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `hmong_tts_metadata_${dialect}_${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export Metadata JSON error:', err);
    } finally {
      setIsExportingMetadata(false);
    }
  };

  const handleOpenMetadataInspector = async () => {
    if (!text.trim()) return;
    taskCoordinator.stopAll('modal_opened');
    try {
      const meta = await hmongTTS.generateMetadata(text, dialect, {
        voice: currentVoice,
        rate,
        pitch,
        toneEmphasis,
        prosody,
      });
      setCurrentMetadata(meta);
      setIsMetadataModalOpen(true);
    } catch (err) {
      console.error('Open Metadata Inspector error:', err);
    }
  };

  const handleInsertTone = (toneLetter: string) => {
    setText(prev => prev + toneLetter + ' ');
  };

  const currentTheme = THEMES[theme];

  return (
    <div
      style={{
        backgroundColor: activeBg.type === 'color' ? activeBg.value : '#060b14',
        backgroundImage: activeBg.type === 'gradient' ? activeBg.value : undefined,
        transition: 'background-color 0.15s ease, background-image 0.15s ease',
      }}
      className="min-h-screen text-slate-100 flex flex-col font-sans transition-colors duration-150 relative overflow-x-hidden"
    >
      {/* Background Image Layer (Custom Uploaded or Curated Scenic Wallpapers) */}
      {activeBg.type === 'image' && activeBg.imageUrl && (
        <div
          className="fixed inset-0 pointer-events-none z-0 transition-opacity duration-300"
          style={{
            backgroundImage: `url(${activeBg.imageUrl})`,
            backgroundSize: activeBg.imageFit || 'cover',
            backgroundPosition: 'center',
            opacity: activeBg.imageOpacity !== undefined ? activeBg.imageOpacity : 0.35,
            filter: `blur(${activeBg.imageBlur || 0}px)`,
          }}
        />
      )}

      {/* Top Bar Contract (Strict 3-zone architecture) */}
      <header className={`border-b ${currentTheme.border} bg-slate-950/85 backdrop-blur-md sticky top-0 z-40 px-4 lg:px-8 py-3`}>
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-8">
          {/* Zone 1: Single text wordmark in display face */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
              <Languages className="w-4 h-4" />
            </div>
            <a href="/" className="text-xl font-bold font-['Syne',sans-serif] tracking-tight text-white hover:text-teal-300 transition whitespace-nowrap">
              HmongTTS
            </a>
          </div>

          {/* Zone 2: Clean single-line text navigation links */}
          <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-slate-400">
            <button
              onClick={() => setActiveTab('studio')}
              className={`hover:text-white transition-colors cursor-pointer whitespace-nowrap shrink-0 ${activeTab === 'studio' ? 'text-teal-400 font-semibold' : ''}`}
            >
              Studio Synthesizer
            </button>
            <button
              onClick={() => setActiveTab('tones')}
              className={`hover:text-white transition-colors cursor-pointer whitespace-nowrap shrink-0 ${activeTab === 'tones' ? 'text-teal-400 font-semibold' : ''}`}
            >
              Tone Lab
            </button>
            <button
              onClick={() => setActiveTab('references')}
              className={`hover:text-white transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${activeTab === 'references' ? 'text-teal-400 font-semibold' : ''}`}
            >
              <Video className="w-3.5 h-3.5" />
              <span>Video & Media Player</span>
            </button>
            <button
              onClick={() => setActiveTab('sdk')}
              className={`hover:text-white transition-colors cursor-pointer whitespace-nowrap shrink-0 ${activeTab === 'sdk' ? 'text-teal-400 font-semibold' : ''}`}
            >
              Developer SDK & APIs
            </button>
            <button
              onClick={() => setActiveTab('offline')}
              className={`hover:text-white transition-colors cursor-pointer whitespace-nowrap shrink-0 ${activeTab === 'offline' ? 'text-teal-400 font-semibold' : ''}`}
            >
              Offline Models
            </button>
            <button
              onClick={() => setActiveTab('accessibility')}
              className={`hover:text-white transition-colors cursor-pointer whitespace-nowrap shrink-0 ${activeTab === 'accessibility' ? 'text-teal-400 font-semibold' : ''}`}
            >
              Screen Reader
            </button>
          </nav>

          {/* Zone 3: Primary action button, Theme Selector & PWA Install */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => {
                taskCoordinator.stopAll('modal_opened');
                setIsPhrasebookOpen(true);
              }}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors flex items-center gap-1.5 shadow-sm whitespace-nowrap shrink-0 cursor-pointer"
              title="Open Hmong Community Phrasebook"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Phrasebook</span>
            </button>

            {/* Multiple Color Background in One Label with Live Hover Preview & Custom Upload */}
            <ThemeColorBackgroundPicker
              currentBg={bgConfig}
              onSelectBg={handleSelectBg}
              onHoverPreview={setHoverPreviewBg}
            />

            <PWAInstallButton />
          </div>
        </div>
      </header>

      {/* Mobile Sub-Navigation Bar */}
      <div className="lg:hidden flex overflow-x-auto border-b border-slate-800 bg-slate-900/60 px-4 py-2 gap-2 text-xs no-scrollbar">
        <button
          onClick={() => setActiveTab('studio')}
          className={`px-3 py-1.5 rounded-lg whitespace-nowrap ${activeTab === 'studio' ? 'bg-teal-600 text-white font-medium' : 'text-slate-400'}`}
        >
          Studio
        </button>
        <button
          onClick={() => setActiveTab('tones')}
          className={`px-3 py-1.5 rounded-lg whitespace-nowrap ${activeTab === 'tones' ? 'bg-teal-600 text-white font-medium' : 'text-slate-400'}`}
        >
          Tone Lab
        </button>
        <button
          onClick={() => setActiveTab('references')}
          className={`px-3 py-1.5 rounded-lg whitespace-nowrap flex items-center gap-1 ${activeTab === 'references' ? 'bg-teal-600 text-white font-medium' : 'text-slate-400'}`}
        >
          <Video className="w-3.5 h-3.5" />
          <span>References</span>
        </button>
        <button
          onClick={() => setActiveTab('sdk')}
          className={`px-3 py-1.5 rounded-lg whitespace-nowrap ${activeTab === 'sdk' ? 'bg-teal-600 text-white font-medium' : 'text-slate-400'}`}
        >
          SDK & APIs
        </button>
        <button
          onClick={() => setActiveTab('offline')}
          className={`px-3 py-1.5 rounded-lg whitespace-nowrap ${activeTab === 'offline' ? 'bg-teal-600 text-white font-medium' : 'text-slate-400'}`}
        >
          Offline Models
        </button>
        <button
          onClick={() => setActiveTab('accessibility')}
          className={`px-3 py-1.5 rounded-lg whitespace-nowrap ${activeTab === 'accessibility' ? 'bg-teal-600 text-white font-medium' : 'text-slate-400'}`}
        >
          Screen Reader
        </button>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-8">
        {activeTab === 'studio' && (
          <div className="space-y-6">
            {/* Studio Header with Engine Mode Selector */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-white font-['Syne',sans-serif]">
                  Native Hmong Voice Synthesis Studio
                </h1>
                <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                  <span>LF Human Glottal Model & Dynamic Formant Gliding</span>
                  <span aria-hidden="true">·</span>
                  <span>Intelligent Auto-Detect</span>
                  <span aria-hidden="true">·</span>
                  <span>Low-Latency Offline DSP</span>
                </div>
              </div>

              {/* Mode Selector Segmented Control */}
              <div className="flex items-center gap-1 p-1 bg-slate-900/80 border border-slate-800 rounded-xl shrink-0 overflow-x-auto">
                <button
                  onClick={() => { taskCoordinator.stopAll('mode_changed'); setEngineMode('auto'); }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                    engineMode === 'auto'
                      ? 'bg-teal-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Automatically detect whether text is Hmong or English"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Auto-Detect</span>
                </button>
                <button
                  onClick={() => { taskCoordinator.stopAll('mode_changed'); setEngineMode('hmong_dawb'); setDialect('dawb'); }}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                    engineMode === 'hmong_dawb'
                      ? 'bg-teal-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Hmoob Dawb
                </button>
                <button
                  onClick={() => { taskCoordinator.stopAll('mode_changed'); setEngineMode('hmong_leeg'); setDialect('leeg'); }}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                    engineMode === 'hmong_leeg'
                      ? 'bg-teal-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Moob Leeg
                </button>
                <button
                  onClick={() => { taskCoordinator.stopAll('mode_changed'); setEngineMode('english'); }}
                  className={`flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                    engineMode === 'english'
                      ? 'bg-sky-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Globe2 className="w-3.5 h-3.5" />
                  <span>English</span>
                </button>

                <button
                  onClick={() => { taskCoordinator.stopAll('tab_changed'); setActiveTab('references'); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-teal-950/80 hover:bg-teal-900 border border-teal-800/60 text-teal-300 transition"
                  title="Open Video Studio to input video URL or upload video file"
                >
                  <Video className="w-3.5 h-3.5 text-teal-400" />
                  <span>Input Video & URL</span>
                </button>

                <button
                  onClick={() => {
                    taskCoordinator.stopAll('modal_opened');
                    setIsBatchModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-teal-950/80 hover:bg-teal-900 border border-teal-700/70 text-teal-300 transition shadow-xs"
                  title="Open Batch Processing tool to synthesize multiple sentences and export individual WAVs or concatenated track"
                >
                  <Layers className="w-3.5 h-3.5 text-teal-400" />
                  <span>Batch Processing</span>
                  <span className="px-1 py-0.2 rounded-full text-[9px] font-bold bg-teal-800 text-teal-200 uppercase">
                    New
                  </span>
                </button>
              </div>
            </div>

            {/* Quick Preset Selector */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
              <span className="text-slate-500 whitespace-nowrap">Presets:</span>
              {PRESET_PHRASES.map((preset, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    taskCoordinator.stopAll('preset_changed');
                    handleStop();
                    if (preset.category === 'hmong') {
                      setText(dialect === 'dawb' ? preset.dawb! : preset.leeg!);
                    } else {
                      setText(preset.text);
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white whitespace-nowrap transition"
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Main Interactive Studio Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              {/* Left Column: Text Area, Auto-Detect Card, and Karaoke View */}
              <div className="lg:col-span-2 space-y-4">
                <div className={`p-5 rounded-2xl border ${currentTheme.border} ${currentTheme.surface} space-y-3.5 shadow-xl`}>
                  {/* Real-Time Language Detection Banner */}
                  <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-950/80 rounded-xl border border-slate-800/80 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">Language:</span>
                      <span className="font-semibold text-slate-100 flex items-center gap-1.5">
                        {detection.language === 'english' ? (
                          <>
                            <Globe2 className="w-3.5 h-3.5 text-sky-400" />
                            <span>English</span>
                          </>
                        ) : detection.language === 'mixed' ? (
                          <>
                            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                            <span>Bilingual Mixed (Hmong + English)</span>
                          </>
                        ) : (
                          <>
                            <Languages className="w-3.5 h-3.5 text-teal-400" />
                            <span>Hmong ({detection.detectedDialect === 'leeg' ? 'Moob Leeg' : 'Hmoob Dawb'})</span>
                          </>
                        )}
                      </span>
                      <span className="text-slate-500 font-mono">
                        ({Math.round(detection.confidence * 100)}% conf)
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400">Engine:</span>
                      <span className={`px-2 py-0.5 rounded text-[11px] font-mono font-medium ${
                        resolvedEngine === 'web_speech'
                          ? 'bg-sky-950 text-sky-300 border border-sky-800/40'
                          : resolvedEngine === 'hmongdictionary_native'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/50 shadow-xs'
                          : 'bg-teal-950 text-teal-300 border border-teal-800/40'
                      }`}>
                        {resolvedEngine === 'web_speech'
                          ? 'Web Speech API'
                          : resolvedEngine === 'hmongdictionary_native'
                          ? '🎙️ HmongDictionary.com Native Voice'
                          : 'Hmong LF Acoustic DSP'}
                      </span>
                    </div>
                  </div>

                  {/* Text Input Area */}
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 mb-1.5">
                      <div className="flex items-center gap-2">
                        <label className="font-semibold text-slate-200 flex items-center gap-1.5">
                          <span>Type Text On Top (Hmong RPA or English)</span>
                        </label>
                      </div>

                      <div className="flex items-center flex-wrap gap-2">
                        {/* Quick Microphone Voice Input Dictation */}
                        <button
                          type="button"
                          onClick={handleToggleVoiceInput}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition flex items-center gap-1.5 active:scale-95 shadow-sm ${
                            isVoiceInputActive
                              ? 'bg-rose-950/90 border-rose-500 text-rose-300 ring-2 ring-rose-500/50 animate-pulse'
                              : 'bg-slate-800/90 hover:bg-slate-700 text-slate-200 border-slate-700/80 hover:text-white'
                          }`}
                          title="Click to speak and input your voice directly into the text area"
                        >
                          <Mic className={`w-3.5 h-3.5 ${isVoiceInputActive ? 'text-rose-400 animate-ping' : 'text-teal-400'}`} />
                          <span>{isVoiceInputActive ? 'Listening to voice...' : 'Input My Voice'}</span>
                        </button>

                        {/* Hmoob Phrasebook Button */}
                        <button
                          type="button"
                          onClick={() => {
                            taskCoordinator.stopAll('modal_opened');
                            setIsPhrasebookOpen(true);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-emerald-950/70 hover:bg-emerald-900/90 text-emerald-300 border border-emerald-800/70 text-xs font-semibold transition active:scale-95 flex items-center gap-1.5 shadow-sm hover:text-white"
                          title="Open Hmong Community Phrasebook (Greetings, Basics, Numbers, Food, Travel, Family)"
                        >
                          <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Phrasebook</span>
                        </button>

                        {/* Fix Word Pronunciation Button */}
                        <button
                          type="button"
                          onClick={() => {
                            taskCoordinator.stopAll('modal_opened');
                            setFixModalWord('');
                            setIsFixModalOpen(true);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-amber-950/70 hover:bg-amber-900/90 text-amber-300 border border-amber-800/70 text-xs font-semibold transition active:scale-95 flex items-center gap-1.5 shadow-sm hover:text-white"
                          title="Fix or override pronunciation for any word (English respelling, IPA, tones)"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                          <span>Fix Pronunciation</span>
                        </button>

                        {/* Batch Processing Tool Button */}
                        <button
                          type="button"
                          onClick={() => {
                            taskCoordinator.stopAll('modal_opened');
                            setIsBatchModalOpen(true);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-teal-950/80 hover:bg-teal-900/90 text-teal-300 border border-teal-800/80 text-xs font-semibold transition active:scale-95 flex items-center gap-1.5 shadow-sm hover:text-white"
                          title="Batch Processing: Upload or paste multiple sentences and export individual audio files or a single concatenated track"
                        >
                          <Layers className="w-3.5 h-3.5 text-teal-400" />
                          <span>Batch Processing</span>
                        </button>

                        {text.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              handleStop();
                              setText('');
                              studioPlayer.clearTrack();
                            }}
                            className="text-xs text-slate-400 hover:text-rose-400 transition underline underline-offset-2 ml-1"
                          >
                            Clear
                          </button>
                        )}
                        <span className="font-mono text-[11px] text-slate-500">{text.length} chars</span>
                      </div>
                    </div>

                    <textarea
                      value={text}
                      onChange={(e) => {
                        setText(e.target.value);
                        studioPlayer.clearTrack();
                      }}
                      rows={4}
                      placeholder="Type Hmong RPA or English sentence here (e.g. Nyob zoo sawv daws, Haus tshuaj no, or select from the Phrasebook)..."
                      className="w-full p-3.5 bg-slate-950/90 border border-slate-800 rounded-xl text-slate-100 placeholder:text-slate-600 font-sans text-base focus:outline-hidden focus:border-teal-500 focus:ring-1 focus:ring-teal-500/30 transition resize-y min-h-[110px]"
                    />
                  </div>

                  <MissingWordRecorder text={text} dialect={dialect} />

                  {/* Hmong Tone Input Helper Toolbar */}
                  <div className="flex items-center flex-wrap gap-1.5 pt-1 border-t border-slate-800/80">
                    <span className="text-[11px] font-mono text-slate-500 mr-1">RPA Tone Consonants:</span>
                    {Object.entries(HMONG_TONES).map(([key, tone]) => (
                      <button
                        key={key || 'mid'}
                        onClick={() => handleInsertTone(key)}
                        className="px-2 py-1 bg-slate-950 border border-slate-800 hover:border-teal-600 rounded text-xs font-mono text-teal-300 hover:text-white transition"
                        title={`${tone.name} (${tone.chaoNumber}): ${tone.description}`}
                      >
                        -{key || 'ø'} <span className="text-[10px] text-slate-500">[{tone.chaoNumber}]</span>
                      </button>
                    ))}
                  </div>

                  {/* Real-time Karaoke Reading Box (Optional display with Half / 6 / Full & Optional Word Count) */}
                  <div className="p-4 bg-slate-950/90 rounded-xl border border-slate-800/80 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-slate-400 border-b border-slate-900 pb-2">
                      <div className="flex items-center gap-2">
                        <span>Live Reading Window</span>
                        {displayTokens.length > 0 && showLiveReading && (
                          <span className="text-teal-400 font-mono tabular-nums text-xs">
                            · Word {(currentWordIdx ?? 0) + 1} of {displayTokens.length}
                          </span>
                        )}
                        {showLiveReading && resolvedEngine === 'hmongdictionary_native' && (
                          <span className="hidden sm:inline text-xs text-emerald-400/90 font-medium">
                            · Native Voice Synced
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Word Display Mode: RPA / Respelling / IPA */}
                        {showLiveReading && displayTokens.length > 0 && (
                          <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-[10px]" title="Change phonetic display mode for learners">
                            <button
                              type="button"
                              onClick={() => setReadingDisplayMode('rpa')}
                              className={`px-2 py-0.5 rounded font-semibold transition ${
                                readingDisplayMode === 'rpa'
                                  ? 'bg-amber-600 text-white shadow-xs'
                                  : 'text-slate-400 hover:text-white'
                              }`}
                              title="Show standard Hmong RPA orthography"
                            >
                              RPA
                            </button>
                            <button
                              type="button"
                              onClick={() => setReadingDisplayMode('respell')}
                              className={`px-2 py-0.5 rounded font-semibold transition ${
                                readingDisplayMode === 'respell'
                                  ? 'bg-amber-600 text-white shadow-xs'
                                  : 'text-slate-400 hover:text-white'
                              }`}
                              title="Show English-friendly phonetic respellings"
                            >
                              Respelling
                            </button>
                            <button
                              type="button"
                              onClick={() => setReadingDisplayMode('ipa')}
                              className={`px-2 py-0.5 rounded font-semibold transition ${
                                readingDisplayMode === 'ipa'
                                  ? 'bg-amber-600 text-white shadow-xs'
                                  : 'text-slate-400 hover:text-white'
                              }`}
                              title="Show International Phonetic Alphabet (IPA)"
                            >
                              IPA
                            </button>
                          </div>
                        )}

                        {/* 20 Words / Half Text / Full Text Window Mode Selector */}
                        {showLiveReading && displayTokens.length > 0 && (
                          <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-[10px]">
                            <button
                              onClick={() => setReadingWindowMode('twenty')}
                              className={`px-2 py-0.5 rounded transition ${
                                readingWindowMode === 'twenty'
                                  ? 'bg-teal-600 text-white font-bold'
                                  : 'text-slate-400 hover:text-white'
                              }`}
                              title="Show 20 Words Window"
                            >
                              20 Words
                            </button>
                            <button
                              onClick={() => setReadingWindowMode('half')}
                              className={`px-2 py-0.5 rounded transition ${
                                readingWindowMode === 'half'
                                  ? 'bg-teal-600 text-white font-bold'
                                  : 'text-slate-400 hover:text-white'
                              }`}
                              title="Show Half Text"
                            >
                              Half Text
                            </button>
                            <button
                              onClick={() => setReadingWindowMode('full')}
                              className={`px-2 py-0.5 rounded transition ${
                                readingWindowMode === 'full'
                                  ? 'bg-teal-600 text-white font-bold'
                                  : 'text-slate-400 hover:text-white'
                              }`}
                              title="Show Full Text"
                            >
                              Full Text
                            </button>
                          </div>
                        )}

                        {/* Auto-Scroll Sync Toggle */}
                        {showLiveReading && displayTokens.length > 0 && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => {
                                const next = !isAutoScrollSyncEnabled;
                                setIsAutoScrollSyncEnabled(next);
                                if (!next) {
                                  const chunkSize = readingWindowMode === 'half' ? Math.ceil(displayTokens.length / 2) : readingWindowMode === 'twenty' ? 20 : displayTokens.length;
                                  const activeIdx = currentWordIdx ?? 0;
                                  setManualChunkIndex(Math.floor(activeIdx / chunkSize));
                                }
                              }}
                              className={`px-2 py-0.5 rounded text-[10px] font-mono transition border ${
                                isAutoScrollSyncEnabled
                                  ? 'bg-teal-950/80 border-teal-600/60 text-teal-300 font-bold'
                                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                              }`}
                              title={isAutoScrollSyncEnabled ? 'Auto-sync ON: Player syncs view automatically' : 'Auto-sync OFF: Manual exploration enabled'}
                            >
                              {isAutoScrollSyncEnabled ? 'Sync: ON' : 'Sync: OFF'}
                            </button>

                            {!isAutoScrollSyncEnabled && readingWindowMode !== 'full' && (
                              <div className="flex items-center gap-0.5 bg-slate-900 p-0.5 rounded border border-slate-800 text-[10px]">
                                <button
                                  onClick={() => setManualChunkIndex(prev => Math.max(0, prev - 1))}
                                  disabled={manualChunkIndex <= 0}
                                  className="px-1.5 py-0.5 text-slate-300 hover:text-white disabled:opacity-30"
                                  title="Previous Part"
                                >
                                  ◀
                                </button>
                                <span className="text-slate-400 font-mono px-1">
                                  Part {manualChunkIndex + 1}/{Math.ceil(displayTokens.length / (readingWindowMode === 'half' ? Math.ceil(displayTokens.length / 2) : 20)) || 1}
                                </span>
                                <button
                                  onClick={() => setManualChunkIndex(prev => Math.min(Math.ceil(displayTokens.length / (readingWindowMode === 'half' ? Math.ceil(displayTokens.length / 2) : 20)) - 1, prev + 1))}
                                  disabled={manualChunkIndex >= Math.ceil(displayTokens.length / (readingWindowMode === 'half' ? Math.ceil(displayTokens.length / 2) : 20)) - 1}
                                  className="px-1.5 py-0.5 text-slate-300 hover:text-white disabled:opacity-30"
                                  title="Next Part"
                                >
                                  ▶
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Highlight Colors Settings Toggle */}
                        {showLiveReading && (
                          <button
                            onClick={() => setIsReadingColorSettingsOpen(!isReadingColorSettingsOpen)}
                            className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-sans font-medium transition border ${
                              isReadingColorSettingsOpen
                                ? 'bg-teal-950 border-teal-500 text-teal-300 ring-1 ring-teal-500/30'
                                : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white hover:border-slate-700'
                            }`}
                            title="Customize spoken word highlight colors for Hmong and English modes"
                          >
                            <Palette className="w-3 h-3 text-teal-400" />
                            <span>Colors</span>
                            <span
                              className="w-2 h-2 rounded-full border border-white/30"
                              style={{
                                backgroundColor: resolvedEngine === 'web_speech' ? englishHighlightColor : hmongHighlightColor,
                              }}
                              title={`Active mode color (${resolvedEngine === 'web_speech' ? 'English' : 'Hmong'})`}
                            />
                          </button>
                        )}

                        {/* Hide/Show Live Reading Display */}
                        <button
                          onClick={() => setShowLiveReading(!showLiveReading)}
                          className="text-xs text-teal-400 hover:text-teal-300 font-sans font-semibold transition underline underline-offset-2"
                        >
                          {showLiveReading ? 'Hide Display' : 'Show Live Reading'}
                        </button>
                      </div>
                    </div>

                    {/* Live Reading Window Highlight Color Settings Panel */}
                    {showLiveReading && isReadingColorSettingsOpen && (
                      <div className="p-3 bg-slate-900/95 rounded-xl border border-slate-800/90 text-xs space-y-2.5 shadow-xl">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                          <div className="flex items-center gap-1.5">
                            <Palette className="w-3.5 h-3.5 text-teal-400" />
                            <span className="font-bold text-slate-200">Highlight Colors Settings</span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              (Hmong vs English Spoken Word Highlighting)
                            </span>
                          </div>

                          <button
                            onClick={handleResetHighlightColors}
                            className="text-[11px] text-slate-400 hover:text-rose-300 transition underline underline-offset-2 flex items-center gap-1"
                            title="Reset Hmong and English highlight colors to defaults"
                          >
                            <RotateCcw className="w-3 h-3" />
                            Reset Defaults
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {/* Hmong Mode Highlight Color Customizer */}
                          <div className={`p-2.5 rounded-lg border transition ${
                            resolvedEngine !== 'web_speech'
                              ? 'bg-slate-950/80 border-teal-600/70 ring-1 ring-teal-500/20'
                              : 'bg-slate-950/50 border-slate-800/80'
                          }`}>
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-1.5 font-semibold text-slate-200">
                                <Languages className="w-3.5 h-3.5 text-teal-400" />
                                <span>Hmong Mode</span>
                                {resolvedEngine !== 'web_speech' && (
                                  <span className="text-[9px] font-bold uppercase tracking-wider bg-teal-950 text-teal-300 border border-teal-800/60 px-1.5 py-0.5 rounded">
                                    Active Now
                                  </span>
                                )}
                              </div>
                              <span
                                className="text-[11px] font-extrabold px-2 py-0.5 rounded shadow-sm transition"
                                style={{
                                  backgroundColor: hmongHighlightColor,
                                  color: getContrastTextColor(hmongHighlightColor),
                                  boxShadow: `0 4px 10px ${hmongHighlightColor}40`,
                                }}
                              >
                                Nyob zoo
                              </span>
                            </div>

                            <div className="space-y-1.5">
                              <div className="flex items-center flex-wrap gap-1.5">
                                {HMONG_HIGHLIGHT_PRESETS.map((p) => {
                                  const isSelected = hmongHighlightColor.toLowerCase() === p.color.toLowerCase();
                                  return (
                                    <button
                                      key={p.color}
                                      onClick={() => handleUpdateHmongHighlight(p.color)}
                                      className={`w-6 h-6 rounded-md transition-all hover:scale-110 flex items-center justify-center border ${
                                        isSelected
                                          ? 'border-white ring-2 ring-teal-400/50 scale-110'
                                          : 'border-slate-700/60 hover:border-slate-500'
                                      }`}
                                      style={{ backgroundColor: p.color }}
                                      title={p.name}
                                    >
                                      {isSelected && (
                                        <Check className="w-3 h-3 stroke-[3]" style={{ color: getContrastTextColor(p.color) }} />
                                      )}
                                    </button>
                                  );
                                })}

                                {/* Custom Color Input */}
                                <label
                                  className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-900 border border-slate-700 text-[10px] text-slate-300 cursor-pointer hover:border-teal-500/60 hover:text-white transition"
                                  title="Pick custom Hmong highlight color"
                                >
                                  <input
                                    type="color"
                                    value={hmongHighlightColor}
                                    onChange={(e) => handleUpdateHmongHighlight(e.target.value)}
                                    className="w-3.5 h-3.5 rounded cursor-pointer border-0 bg-transparent p-0"
                                  />
                                  <span className="font-mono uppercase">{hmongHighlightColor}</span>
                                </label>
                              </div>
                              <p className="text-[10px] text-slate-500 italic">
                                Applied when playing Hmong RPA text (White Hmong & Green Hmong).
                              </p>
                            </div>
                          </div>

                          {/* English Mode Highlight Color Customizer */}
                          <div className={`p-2.5 rounded-lg border transition ${
                            resolvedEngine === 'web_speech'
                              ? 'bg-slate-950/80 border-sky-600/70 ring-1 ring-sky-500/20'
                              : 'bg-slate-950/50 border-slate-800/80'
                          }`}>
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-1.5 font-semibold text-slate-200">
                                <Globe2 className="w-3.5 h-3.5 text-sky-400" />
                                <span>English Mode</span>
                                {resolvedEngine === 'web_speech' && (
                                  <span className="text-[9px] font-bold uppercase tracking-wider bg-sky-950 text-sky-300 border border-sky-800/60 px-1.5 py-0.5 rounded">
                                    Active Now
                                  </span>
                                )}
                              </div>
                              <span
                                className="text-[11px] font-extrabold px-2 py-0.5 rounded shadow-sm transition"
                                style={{
                                  backgroundColor: englishHighlightColor,
                                  color: getContrastTextColor(englishHighlightColor),
                                  boxShadow: `0 4px 10px ${englishHighlightColor}40`,
                                }}
                              >
                                Welcome
                              </span>
                            </div>

                            <div className="space-y-1.5">
                              <div className="flex items-center flex-wrap gap-1.5">
                                {ENGLISH_HIGHLIGHT_PRESETS.map((p) => {
                                  const isSelected = englishHighlightColor.toLowerCase() === p.color.toLowerCase();
                                  return (
                                    <button
                                      key={p.color}
                                      onClick={() => handleUpdateEnglishHighlight(p.color)}
                                      className={`w-6 h-6 rounded-md transition-all hover:scale-110 flex items-center justify-center border ${
                                        isSelected
                                          ? 'border-white ring-2 ring-sky-400/50 scale-110'
                                          : 'border-slate-700/60 hover:border-slate-500'
                                      }`}
                                      style={{ backgroundColor: p.color }}
                                      title={p.name}
                                    >
                                      {isSelected && (
                                        <Check className="w-3 h-3 stroke-[3]" style={{ color: getContrastTextColor(p.color) }} />
                                      )}
                                    </button>
                                  );
                                })}

                                {/* Custom Color Input */}
                                <label
                                  className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-900 border border-slate-700 text-[10px] text-slate-300 cursor-pointer hover:border-sky-500/60 hover:text-white transition"
                                  title="Pick custom English highlight color"
                                >
                                  <input
                                    type="color"
                                    value={englishHighlightColor}
                                    onChange={(e) => handleUpdateEnglishHighlight(e.target.value)}
                                    className="w-3.5 h-3.5 rounded cursor-pointer border-0 bg-transparent p-0"
                                  />
                                  <span className="font-mono uppercase">{englishHighlightColor}</span>
                                </label>
                              </div>
                              <p className="text-[10px] text-slate-500 italic">
                                Applied when playing English sentences via the Web Speech engine.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {showLiveReading && (
                      <div className="leading-relaxed text-lg flex flex-wrap gap-2 items-center min-h-[50px] pt-1">
                        {displayTokens.length === 0 ? (
                          <span className="text-slate-600 text-sm italic font-sans">
                            Real-time syllable tracking will highlight words when playing...
                          </span>
                        ) : (
                          (() => {
                            const chunkSize =
                              readingWindowMode === 'half'
                                ? Math.ceil(displayTokens.length / 2)
                                : readingWindowMode === 'twenty'
                                ? 20
                                : displayTokens.length;

                            const activeIdx = currentWordIdx ?? 0;
                            const totalChunks = Math.ceil(displayTokens.length / chunkSize) || 1;
                            const currentChunk = readingWindowMode === 'full'
                              ? 0
                              : isAutoScrollSyncEnabled
                              ? Math.min(totalChunks - 1, Math.floor(activeIdx / chunkSize))
                              : Math.min(totalChunks - 1, manualChunkIndex);

                            const startIdx = readingWindowMode === 'full' ? 0 : currentChunk * chunkSize;
                            const endIdx = readingWindowMode === 'full' ? displayTokens.length : Math.min(displayTokens.length, startIdx + chunkSize);

                            const isHmongMode = resolvedEngine !== 'web_speech';
                            const activeWordHighlightColor = isHmongMode ? hmongHighlightColor : englishHighlightColor;
                            const activeWordTextColor = getContrastTextColor(activeWordHighlightColor);

                            return displayTokens.slice(startIdx, endIdx).map((item, localIdx) => {
                              const actualIdx = startIdx + localIdx;
                              const isCurrent = currentWordIdx === actualIdx;
                              const displayText =
                                readingDisplayMode === 'respell' && !item.isPunctuation
                                  ? (item.englishRespelling || item.token)
                                  : readingDisplayMode === 'ipa' && !item.isPunctuation
                                  ? (item.ipa || item.token)
                                  : item.token;

                              return (
                                <span
                                  key={actualIdx}
                                  onClick={() => {
                                    if (!item.isPunctuation && item.clean) {
                                      taskCoordinator.stopAll('modal_opened');
                                      setFixModalWord(item.clean);
                                      setIsFixModalOpen(true);
                                    }
                                  }}
                                  className={`rounded px-2.5 py-1 transition-all duration-150 inline-flex items-center gap-1 ${
                                    item.isPunctuation ? '' : 'cursor-pointer hover:border-amber-500/80 hover:text-amber-200'
                                  } ${
                                    isCurrent
                                      ? 'font-extrabold scale-110 shadow-lg ring-1 ring-white/30'
                                      : 'text-slate-300 bg-slate-900/60 border border-slate-800/80'
                                  }`}
                                  style={
                                    isCurrent
                                      ? {
                                          backgroundColor: activeWordHighlightColor,
                                          color: activeWordTextColor,
                                          boxShadow: `0 8px 18px -2px ${activeWordHighlightColor}55`,
                                        }
                                      : undefined
                                  }
                                  title={
                                    item.isPunctuation
                                      ? ''
                                      : `Click to fix pronunciation for "${item.clean || item.token}" (IPA: ${item.ipa || '—'}, respelling: ${item.englishRespelling || '—'})`
                                  }
                                >
                                  <span>{displayText}</span>
                                  {item.isToneSandhi && (
                                    <span
                                      className="text-[9px] px-1 py-0.2 rounded font-mono font-bold bg-teal-950/80 text-teal-300 border border-teal-700/60"
                                      title={`Tone Sandhi applied: ${item.sandhiShift || ''}`}
                                    >
                                      Sandhi
                                    </span>
                                  )}
                                  {item.isOverride && (
                                    <span
                                      className="w-1.5 h-1.5 rounded-full bg-amber-400"
                                      title="Custom pronunciation override active"
                                    />
                                  )}
                                </span>
                              );
                            });
                          })()
                        )}
                      </div>
                    )}
                  </div>

                  {/* Persistent Audio Player Controller with Combined Play & Hais Lus (Speak Hmong) */}
                  <AudioPlayerController
                    track={studioPlayer.track}
                    isPlaying={studioPlayer.isPlaying}
                    isPaused={studioPlayer.isPaused}
                    isEnded={studioPlayer.isEnded}
                    currentTime={studioPlayer.currentTime}
                    duration={studioPlayer.duration}
                    playbackSpeed={studioPlayer.playbackSpeed}
                    isLooping={studioPlayer.isLooping}
                    volume={studioPlayer.volume}
                    isSynthesizing={studioPlayer.isSynthesizing}
                    onPlay={studioPlayer.play}
                    onPause={studioPlayer.pause}
                    onTogglePlayPause={studioPlayer.togglePlayPause}
                    onRelisten={studioPlayer.relisten}
                    onSeek={studioPlayer.seek}
                    onSkip={studioPlayer.skipSeconds}
                    onSetSpeed={studioPlayer.setSpeed}
                    onToggleLoop={studioPlayer.toggleLoop}
                    onSetVolume={studioPlayer.setAudioVolume}
                    onDownloadWav={handleDownloadWav}
                    onRenderAndPlay={handlePlay}
                    hasText={Boolean(text.trim())}
                    speakButtonLabel={
                      resolvedEngine === 'web_speech'
                        ? 'Speak (English)'
                        : dialect === 'leeg'
                        ? 'Hais Lus (Moob Leeg)'
                        : 'Hais Lus (Hmoob Dawb)'
                    }
                    engineType={resolvedEngine}
                  />

                  {/* Waveform Visualizer */}
                  <AudioVisualizer
                    analyser={hmongTTS.getAnalyser()}
                    isPlaying={isPlaying}
                    color={resolvedEngine === 'web_speech' ? '#38bdf8' : '#14b8a6'}
                  />

                  {/* Unified Studio Action Row (Export & Alignment Tools) */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-300 font-mono">
                        <span className={`w-2 h-2 rounded-full ${isPlaying ? 'bg-teal-400 animate-ping' : 'bg-teal-500'}`} />
                        <span>
                          {resolvedEngine === 'web_speech'
                            ? 'Web Speech API (en-US)'
                            : `LF Synthesizer • ${dialect === 'dawb' ? 'Hmoob Dawb (White)' : 'Moob Leeg (Green)'}`}
                        </span>
                      </span>

                      {isPlaying && (
                        <button
                          onClick={handleStop}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-950/60 hover:bg-rose-900 border border-rose-800/60 text-rose-300 hover:text-white text-xs font-semibold transition active:scale-95"
                          title="Stop current speech synthesis"
                        >
                          <Square className="w-3.5 h-3.5 fill-current" />
                          <span>Stop</span>
                        </button>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={handleDownloadWav}
                        disabled={isExporting || !text.trim()}
                        className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold border border-slate-700/60 transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                        title="Download synthesized audio as standard 16-bit PCM WAV"
                      >
                        <Download className="w-3.5 h-3.5 text-teal-400" />
                        <span>{isExporting ? 'Exporting...' : 'Export WAV'}</span>
                      </button>

                      <button
                        onClick={handleDownloadMetadataJson}
                        disabled={isExportingMetadata || !text.trim()}
                        className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold border border-slate-700/60 transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                        title="Download timing, IPA transcription, and Chao tone alignment as JSON"
                      >
                        <FileCode className="w-3.5 h-3.5 text-amber-400" />
                        <span>{isExportingMetadata ? 'Exporting...' : 'Export Metadata (JSON)'}</span>
                      </button>

                      <button
                        onClick={handleOpenMetadataInspector}
                        disabled={!text.trim()}
                        className="flex items-center gap-1.5 px-3 py-2.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-medium border border-slate-700/40 transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                        title="Inspect interactive alignment table and raw JSON"
                      >
                        <span>Inspect</span>
                      </button>

                      <button
                        onClick={() => {
                          taskCoordinator.stopAll('modal_opened');
                          setIsBatchModalOpen(true);
                        }}
                        className="flex items-center gap-1.5 px-3.5 py-2.5 bg-teal-950/80 hover:bg-teal-900 text-teal-300 hover:text-white rounded-xl text-xs font-semibold border border-teal-700/60 transition active:scale-95 shadow-sm"
                        title="Open Batch Processing tool to synthesize lists of sentences and export individual or concatenated audio"
                      >
                        <Layers className="w-3.5 h-3.5 text-teal-400" />
                        <span>Batch Processing Tool</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Voice Recording Studio Card */}
                <VoiceRecorderCard
                  onTranscribe={(newText, mode = 'replace') => {
                    if (mode === 'replace' || !text.trim()) {
                      setText(newText);
                    } else {
                      setText((prev) => `${prev.trim()} ${newText}`);
                    }
                  }}
                  onCompareNativeSpeech={handlePlay}
                  isNativeSpeechPlaying={isPlaying}
                  targetText={text}
                  dialect={dialect}
                />
              </div>

              {/* Right Column: Voice & Acoustic Tuning Controls */}
              <div className="space-y-4">
                {/* Voice Sound Source Card: HmongDictionary.com Native Voice vs Pure DSP */}
                <div className={`p-4 rounded-2xl border ${currentTheme.border} ${currentTheme.surface} space-y-3 shadow-xl`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Volume2 className="w-4 h-4 text-emerald-400" />
                      <h3 className="text-sm font-bold text-slate-200">Hmong Speech Sound Source</h3>
                    </div>
                    <span className="text-xs text-emerald-400 font-medium">
                      Authentic Native
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    <button
                      type="button"
                      onClick={() => setAudioSource('hmongdictionary_native')}
                      className={`p-3 rounded-xl border text-left transition flex items-start justify-between gap-2.5 ${
                        audioSource === 'hmongdictionary_native'
                          ? 'bg-emerald-950/70 border-emerald-500 text-white shadow-lg ring-1 ring-emerald-500/40'
                          : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white">🎙️ HmongDictionary.com Native Voice</span>
                          {audioSource === 'hmongdictionary_native' && (
                            <span className="text-[9px] font-bold uppercase bg-emerald-500 text-slate-950 px-1.5 py-0.5 rounded">
                              Active
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          Authentic recorded human voices from HmongDictionary.com with continuous whole-sentence reading, YouTube-style tonal cadence, and dedicated stops at periods.
                        </p>
                      </div>
                      <div className={`w-4 h-4 rounded-full border mt-0.5 shrink-0 flex items-center justify-center ${
                        audioSource === 'hmongdictionary_native' ? 'border-emerald-400 bg-emerald-400 text-slate-950' : 'border-slate-700'
                      }`}>
                        {audioSource === 'hmongdictionary_native' && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setAudioSource('hmong_dsp')}
                      className={`p-2.5 rounded-xl border text-left transition flex items-start justify-between gap-2.5 ${
                        audioSource === 'hmong_dsp'
                          ? 'bg-teal-950/70 border-teal-500 text-white shadow-lg ring-1 ring-teal-500/40'
                          : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-slate-200">⚡ Offline Formant Synthesizer</span>
                          {audioSource === 'hmong_dsp' && (
                            <span className="text-[9px] font-bold uppercase bg-teal-500 text-slate-950 px-1.5 py-0.5 rounded">
                              Active
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          Pure client-side acoustic DSP pipeline modeling glottal pulses and formant resonators.
                        </p>
                      </div>
                      <div className={`w-4 h-4 rounded-full border mt-0.5 shrink-0 flex items-center justify-center ${
                        audioSource === 'hmong_dsp' ? 'border-teal-400 bg-teal-400 text-slate-950' : 'border-slate-700'
                      }`}>
                        {audioSource === 'hmong_dsp' && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </button>
                  </div>
                </div>

                <div className={`p-5 rounded-2xl border ${currentTheme.border} ${currentTheme.surface} space-y-5 shadow-xl`}>
                  <div className="flex items-center justify-between relative">
                    <div className="flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-teal-400" />
                      <h3 className="text-sm font-bold text-slate-200">Native Acoustic Settings</h3>
                    </div>

                    {/* Clickable Acoustic Guide & Presets Toggle (No Hover) */}
                    <div className="relative">
                      <button
                        onClick={() => setIsHoverGuideOpen(!isHoverGuideOpen)}
                        className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-teal-950/80 border border-teal-800/60 text-teal-300 text-xs font-mono transition active:scale-95 shadow-sm"
                      >
                        <Info className="w-3.5 h-3.5 text-teal-400" />
                        <span>{isHoverGuideOpen ? 'Close Guide' : 'Acoustic Guide & Presets'}</span>
                      </button>

                      {/* Guide Card */}
                      {isHoverGuideOpen && (
                        <div className="absolute right-0 top-full mt-2.5 z-50 pointer-events-auto shadow-2xl">
                          <AcousticSettingsHoverGuide
                            currentRate={rate}
                            currentPitch={pitch}
                            currentToneEmphasis={toneEmphasis}
                            currentProsody={prosody}
                            onApplyPreset={(p, presetName) => {
                              setRate(p.rate);
                              setPitch(p.pitch);
                              setToneEmphasis(p.toneEmphasis);
                              setProsody(p.prosody);
                              setIsHoverGuideOpen(false);

                              setAppliedPresetToast(`✨ Applied: ${presetName}`);
                              setTimeout(() => setAppliedPresetToast(null), 3500);

                              if (text.trim()) {
                                handlePlay();
                              }
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {appliedPresetToast && (
                    <div className="p-2.5 rounded-xl bg-teal-950/90 border border-teal-500/60 text-teal-300 text-xs font-semibold flex items-center justify-between animate-in fade-in slide-in-from-top-1 duration-200">
                      <span>{appliedPresetToast}</span>
                      <span className="text-[10px] font-mono text-teal-400">Settings updated</span>
                    </div>
                  )}

                  {/* Active Voice Info */}
                  {resolvedEngine === 'web_speech' && (
                    <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-2">
                      <div className="font-semibold text-sky-400 flex items-center gap-1.5">
                        <Globe2 className="w-4 h-4" />
                        <span>Default English Browser Voice</span>
                      </div>
                      <p className="text-slate-400 text-[11px] leading-relaxed">
                        Speech synthesized via browser native Web Speech API with automatic accent selection (en-US).
                      </p>
                    </div>
                  )}

                  {/* Acoustic Sliders with Hover Guides */}
                  <div className="space-y-4 pt-3 border-t border-slate-800/80">
                    {/* Speech Rate */}
                    <div className="group/slider relative" title="Speech Rate: Syllable duration scaling (1.0x default, 0.85x recommended for pronunciation practice)">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-400 group-hover/slider:text-teal-300 transition flex items-center gap-1">
                          <span>Speech Rate</span>
                          <span className="text-[10px] text-slate-500 font-mono">(Tempo)</span>
                        </span>
                        <span className="font-mono text-teal-400 font-bold">{rate.toFixed(2)}x</span>
                      </div>
                      <input
                        type="range"
                        min="0.5"
                        max="1.8"
                        step="0.05"
                        value={rate}
                        onChange={(e) => setRate(parseFloat(e.target.value))}
                        className="w-full accent-teal-500 cursor-pointer"
                      />
                    </div>

                    {/* Pitch Shift */}
                    <div className="group/slider relative" title="Base Pitch: Fundamental frequency F0 shifting (~125Hz male, ~215Hz female)">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-400 group-hover/slider:text-teal-300 transition flex items-center gap-1">
                          <span>Base Pitch</span>
                          <span className="text-[10px] text-slate-500 font-mono">(F₀ Frequency)</span>
                        </span>
                        <span className="font-mono text-teal-400 font-bold">{pitch.toFixed(2)}x</span>
                      </div>
                      <input
                        type="range"
                        min="0.75"
                        max="1.35"
                        step="0.05"
                        value={pitch}
                        onChange={(e) => setPitch(parseFloat(e.target.value))}
                        className="w-full accent-teal-500 cursor-pointer"
                      />
                    </div>

                    {/* Tone Clarity (Only active for Hmong) */}
                    {resolvedEngine === 'hmong_dsp' && (
                      <div className="group/slider relative" title="Tone Contour Inflection: Magnifies Chao pitch intervals across the 8 Hmong RPA tones (-b 55, -j 52, -v 24, etc.)">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-slate-400 group-hover/slider:text-teal-300 transition flex items-center gap-1">
                            <span>Tone Contour Inflection</span>
                            <span className="text-[10px] text-slate-500 font-mono">(ΔF₀)</span>
                          </span>
                          <span className="font-mono text-teal-400 font-bold">{toneEmphasis.toFixed(2)}x</span>
                        </div>
                        <input
                          type="range"
                          min="0.8"
                          max="1.5"
                          step="0.05"
                          value={toneEmphasis}
                          onChange={(e) => setToneEmphasis(parseFloat(e.target.value))}
                          className="w-full accent-teal-500 cursor-pointer"
                        />
                      </div>
                    )}

                    {/* Human Prosody & Micro-Variation (Syllable Timing Rubato & Micro-Pitch) */}
                    {resolvedEngine === 'hmong_dsp' && (
                      <div className="space-y-1.5 pt-1 border-t border-slate-800/60 group/slider relative" title="Human Prosody: Organic micro-pitch drift, sentence-final lengthening, and vocal fry/murmur modeling">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-200 font-semibold flex items-center gap-1.5 group-hover/slider:text-amber-300 transition">
                            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                            <span>Human Prosody</span>
                          </span>
                          <span className="font-mono text-amber-300 font-medium">
                            {prosody === 0
                              ? '0.00x (Robotic)'
                              : prosody < 0.8
                              ? `${prosody.toFixed(2)}x (Subtle)`
                              : prosody <= 1.25
                              ? `${prosody.toFixed(2)}x (Natural Speech)`
                              : `${prosody.toFixed(2)}x (Expressive Rubato)`}
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0.0"
                          max="2.0"
                          step="0.05"
                          value={prosody}
                          onChange={(e) => setProsody(parseFloat(e.target.value))}
                          className="w-full accent-amber-500 cursor-pointer"
                        />
                        <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
                          <button
                            type="button"
                            onClick={() => setProsody(0.0)}
                            className={`px-1.5 py-0.5 rounded transition ${prosody === 0 ? 'bg-amber-950 text-amber-300 font-bold' : 'hover:text-slate-300'}`}
                          >
                            Robot (0.0x)
                          </button>
                          <button
                            type="button"
                            onClick={() => setProsody(1.0)}
                            className={`px-1.5 py-0.5 rounded transition ${prosody === 1.0 ? 'bg-amber-950 text-amber-300 font-bold' : 'hover:text-slate-300'}`}
                          >
                            Natural (1.0x)
                          </button>
                          <button
                            type="button"
                            onClick={() => setProsody(1.4)}
                            className={`px-1.5 py-0.5 rounded transition ${prosody === 1.4 ? 'bg-amber-950 text-amber-300 font-bold' : 'hover:text-slate-300'}`}
                          >
                            Expressive (1.4x)
                          </button>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-tight">
                          Modulates syllable timing rubato, pre-pausal lengthening, and micro-pitch inflections to avoid monotonic robot cadence.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Native Reference Quick Link */}
                  <div className="pt-3 border-t border-slate-800/80">
                    <button
                      onClick={() => setActiveTab('references')}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-teal-300 transition"
                    >
                      <span className="flex items-center gap-2">
                        <Video className="w-4 h-4 text-teal-400" />
                        <span>View Native Video References</span>
                      </span>
                      <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Tone & Phonology Laboratory */}
        {activeTab === 'tones' && <ToneLaboratory />}

        {/* Tab 3: Native Acoustic Video References & Video Media Studio */}
        {activeTab === 'references' && (
          <NativeReferenceHub
            onUseTranscript={(newText) => {
              setText(newText);
              setActiveTab('studio');
            }}
            onNavigateToToneLab={() => {
              setActiveTab('tones');
            }}
            dialect={dialect}
          />
        )}

        {/* Tab 4: Developer SDK & Cross-Platform Integration */}
        {activeTab === 'sdk' && <DeveloperHub />}

        {/* Tab 5: Offline Voice Packs & Local Storage */}
        {activeTab === 'offline' && <VoicePackManager />}

        {/* Tab 6: Accessible Screen Reader Mode */}
        {activeTab === 'accessibility' && <AccessibilityReader />}
      </main>

      {/* Clean Single-Row Footer */}
      <footer className={`border-t ${currentTheme.border} ${currentTheme.bg} px-4 lg:px-8 py-5 text-xs text-slate-500`}>
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-400">HmongTTS Platform</span>
            <span>·</span>
            <span>Native Acoustic Formants & LF Glottal Flow Model</span>
          </div>

          <div className="flex items-center gap-4 text-slate-400">
            <span>RPA Orthography</span>
            <span>·</span>
            <span>Web Audio API</span>
            <span>·</span>
            <span>White Hmong & Green Hmong Ready</span>
          </div>
        </div>
      </footer>
      {/* Metadata Inspector Modal */}
      <MetadataInspectorModal
        metadata={currentMetadata}
        isOpen={isMetadataModalOpen}
        onClose={() => setIsMetadataModalOpen(false)}
      />

      {/* Fix Pronunciation Modal */}
      <FixPronunciationModal
        isOpen={isFixModalOpen}
        onClose={() => setIsFixModalOpen(false)}
        targetWord={fixModalWord}
        dialect={dialect}
        onApplied={() => {
          studioPlayer.clearTrack();
        }}
      />

      {/* Hmong Community Phrasebook Drawer Modal */}
      <PhrasebookDrawerModal
        isOpen={isPhrasebookOpen}
        onClose={() => setIsPhrasebookOpen(false)}
        onSelectPhrase={(phrase) => {
          setText(phrase);
          studioPlayer.clearTrack();
          setIsPhrasebookOpen(false);
        }}
        dialect={dialect}
      />

      {/* Batch Processing Studio Modal */}
      {isBatchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-5xl max-h-[95vh] flex flex-col">
            <BatchProcessingTool
              onClose={() => setIsBatchModalOpen(false)}
              onUseSentenceInStudio={(sentence) => {
                setText(sentence);
                studioPlayer.clearTrack();
                setIsBatchModalOpen(false);
              }}
              initialDialect={dialect}
              initialSoundSource={audioSource}
            />
          </div>
        </div>
      )}
    </div>
  );
}

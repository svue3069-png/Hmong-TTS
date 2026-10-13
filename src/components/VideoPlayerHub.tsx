/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * VideoPlayerHub
 * Interactive reference video studio with YouTube video citation playback,
 * speed controls (1x, 2x, 3x), relisten, AI audio transcription, and a dedicated
 * Native Voiceover & Speech Shadowing Studio with authentic tone sandhi and continuous human reading.
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { taskCoordinator } from '../engine/taskCoordinator';
import { hmongTTS, HMONG_VOICE_PROFILES, VoiceProfile } from '../engine/hmongAudioSynthesizer';
import { HmongDialect, parseHmongText, HMONG_TONES } from '../engine/hmongPhonology';
import {
  Video,
  Play,
  Pause,
  RotateCcw,
  Upload,
  Link as LinkIcon,
  Sparkles,
  ExternalLink,
  Volume2,
  VolumeX,
  Maximize2,
  FileVideo,
  Check,
  Copy,
  ArrowUpRight,
  AlertCircle,
  RefreshCw,
  X,
  Gauge,
  Headphones,
  Mic,
  BookOpen,
  Square,
  Volume1,
  Sparkle,
} from 'lucide-react';

export interface VideoTranscriptSentence {
  id: string;
  hmong: string;
  english: string;
  toneFocus?: string;
  isSandhi?: boolean;
  sandhiNote?: string;
}

interface CuratedVideoPreset {
  title: string;
  category: string;
  dialect: 'dawb' | 'leeg' | 'both';
  url: string;
  description: string;
  sentences: VideoTranscriptSentence[];
}

const PRESET_VIDEOS: CuratedVideoPreset[] = [
  {
    title: 'Hmong 8 Tones Acoustic Pronunciation Masterclass',
    category: 'Phonology & Tones',
    dialect: 'both',
    url: 'https://www.youtube.com/watch?v=7PqwU2fP2_k',
    description: 'Learn the exact pitch heights for the 8 RPA tones: -b, -j, -v, blank, -s, -g, -m, -d, plus native tone sandhi.',
    sentences: [
      {
        id: 'tone_1',
        hmong: 'Nyob zoo sawv daws, hnub no peb kawm txog yim lub suab lus Hmoob.',
        english: 'Hello everyone, today we learn about the eight Hmong tones.',
        toneFocus: 'b',
      },
      {
        id: 'tone_2',
        hmong: 'Ib tug dev thiab ib tug miv nyob hauv tsev.',
        english: 'One dog and one cat are inside the house.',
        toneFocus: 'g',
        isSandhi: true,
        sandhiNote: 'Tone Sandhi: ib tus dev ➔ ib tug dev (White Hmong sandhi shifts -s to -g after numerals)',
      },
      {
        id: 'tone_3',
        hmong: 'Suab siab yog suab b, xws li lo lus pob thiab tsev.',
        english: 'High level tone is tone b, like the words pob (ball) and tsev (house).',
        toneFocus: 'b',
      },
      {
        id: 'tone_4',
        hmong: 'Suab nqes siab yog suab j, xws li lo lus koj thiab nej.',
        english: 'High-falling tone is tone j, like the pronouns koj (you) and nej (you all).',
        toneFocus: 'j',
      },
      {
        id: 'tone_5',
        hmong: 'Suab nce nruab ntug yog suab v, xws li lo lus kuv thiab lawv.',
        english: 'Mid-rising tone is tone v, sweeping upward from low-mid to high.',
        toneFocus: 'v',
      },
      {
        id: 'tone_6',
        hmong: 'Suab nruab ntug tsis muaj cim, xws li lo lus no thiab ua.',
        english: 'Mid-level tone is unmarked in RPA, sustained with relaxed pitch.',
        toneFocus: '',
      },
      {
        id: 'tone_7',
        hmong: 'Suab qis yog suab s, xws li lo lus mus thiab daws.',
        english: 'Low-flat tone is tone s, steady and deep in the vocal register.',
        toneFocus: 's',
      },
      {
        id: 'tone_8',
        hmong: 'Suab nqes qis yog suab g, muaj suab nrov nqus pa thiab nqes qis.',
        english: 'Breathy-falling tone is tone g, articulated with audible aspiration breath.',
        toneFocus: 'g',
      },
      {
        id: 'tone_9',
        hmong: 'Suab qis kawg yog suab m, muaj lub suab nres ntawm caj pas.',
        english: 'Creaky low tone is tone m, terminating with a crisp glottal stop closure [ʔ].',
        toneFocus: 'm',
      },
      {
        id: 'tone_10',
        hmong: 'Suab nce qis yog suab d, xws li lo lus tod thiab kod.',
        english: 'Low-rising tone is tone d, common in spatial demonstratives and tone sandhi compounds.',
        toneFocus: 'd',
      },
      {
        id: 'tone_11',
        hmong: 'Ua tsaug ntau ntau rau nej txoj kev pab peb txhua tus.',
        english: 'Thank you very much for your great kindness in helping all of us.',
        toneFocus: 'g',
      },
    ],
  },
  {
    title: 'Hmoob Dawb vs Moob Leeg Dialect Shifts & Lateral Releases',
    category: 'Dialect Comparison',
    dialect: 'both',
    url: 'https://www.youtube.com/watch?v=k5lqWzQp_2o',
    description: 'Comparative analysis of White Hmong vs Green Hmong consonants, lateral releases dl/dlh, and nasal vowels.',
    sentences: [
      {
        id: 'dialect_1',
        hmong: 'Moob Leeg has tas moog tsev, Hmoob Dawb hais tias mus tsev.',
        english: 'Green Hmong says moog tsev, White Hmong says mus tsev.',
        toneFocus: 's',
      },
      {
        id: 'dialect_2',
        hmong: 'Ib tug dlaag dleev nyob ntawm nua.',
        english: 'A Green Hmong sentence featuring lateral released stops dl and dlaag.',
        toneFocus: 'g',
        isSandhi: true,
        sandhiNote: 'Lateral releases dl [tˡ] & dlaag in Moob Leeg phonology',
      },
      {
        id: 'dialect_3',
        hmong: 'Moob Leeg suab aa yog suab ntswg zoo li lo lus paab.',
        english: 'Green Hmong double vowel aa is nasalized [aŋ], as heard in paab (help).',
        toneFocus: 'b',
      },
      {
        id: 'dialect_4',
        hmong: 'Peb nyiam noj mov nplej thiab haus dej tshiab.',
        english: 'We love eating fragrant upland rice and drinking pure fresh water.',
        toneFocus: 'v',
      },
    ],
  },
  {
    title: 'Hmong RPA Phonics & Syllable Reading for Beginners',
    category: 'Language Learning',
    dialect: 'dawb',
    url: 'https://www.youtube.com/watch?v=k6e6uVv5B3w',
    description: 'Pronunciation drills with native audio for rapid RPA literacy and natural reading fluency.',
    sentences: [
      {
        id: 'phonics_1',
        hmong: 'Kuv xav paub hais lus Hmoob kom meej meej.',
        english: 'I want to know how to speak the Hmong language very clearly and articulately.',
        toneFocus: 'j',
      },
      {
        id: 'phonics_2',
        hmong: 'Cov tub ntxhais hluas yuav tsum kawm ntawv Hmoob.',
        english: 'Young students should study the Hmong Romanized Popular Alphabet.',
        toneFocus: 'b',
      },
      {
        id: 'phonics_3',
        hmong: 'Hmoob tej lus muaj nqi heev rau peb txhua tus.',
        english: 'The Hmong spoken heritage is deeply valuable to each and every one of us.',
        toneFocus: 's',
      },
      {
        id: 'phonics_4',
        hmong: 'Sawv daws sib pab sib hlub ces lub neej thiaj vam meej.',
        english: 'When everyone supports and cares for each other, community life prospers.',
        toneFocus: 'j',
      },
    ],
  },
  {
    title: 'Direct MP4 Sample Stream (HTML5 Video Controls Test)',
    category: 'DSP Test Video',
    dialect: 'both',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    description: 'Direct MP4 video file to test custom speed controls (1x, 2x, 3x), scrubber, and relistening.',
    sentences: [
      {
        id: 'mp4_1',
        hmong: 'Peb sim saib daim yeeb yaj kiab no kom meej.',
        english: 'We test and stream this direct video sample clearly.',
        toneFocus: 's',
      },
      {
        id: 'mp4_2',
        hmong: 'Koj tuaj yeem hloov ceev ntawm ib npaug mus rau peb npaug.',
        english: 'You can adjust playback rate between 1x, 2x, and 3x smoothly.',
        toneFocus: 'b',
      },
    ],
  },
];

interface VideoPlayerHubProps {
  onUseTranscript?: (text: string) => void;
  onNavigateToToneLab?: (toneKey?: string) => void;
  dialect?: 'dawb' | 'leeg';
}

export const VideoPlayerHub: React.FC<VideoPlayerHubProps> = ({
  onUseTranscript,
  onNavigateToToneLab,
  dialect = 'dawb',
}) => {
  const [videoUrlInput, setVideoUrlInput] = useState<string>(
    'https://www.youtube.com/watch?v=7PqwU2fP2_k'
  );
  const [activeVideoUrl, setActiveVideoUrl] = useState<string>(
    'https://www.youtube.com/watch?v=7PqwU2fP2_k'
  );
  const [videoTitle, setVideoTitle] = useState<string>(
    'Hmong 8 Tones Acoustic Pronunciation Masterclass'
  );
  const [activePresetIndex, setActivePresetIndex] = useState<number>(0);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  // Playback states for HTML5 video
  const [isVideoPlaying, setIsVideoPlaying] = useState<boolean>(false);
  const [isVideoEnded, setIsVideoEnded] = useState<boolean>(false);
  const [videoCurrentTime, setVideoCurrentTime] = useState<number>(0);
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // Transcription state
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [transcriptResult, setTranscriptResult] = useState<string | null>(null);
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  // Native Voiceover Studio State
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>('paj_dawb_female');
  const [voiceoverRate, setVoiceoverRate] = useState<number>(1.0);
  const [activeVoiceoverId, setActiveVoiceoverId] = useState<string | null>(null);
  const [isContinuousPlaying, setIsContinuousPlaying] = useState<boolean>(false);
  const [continuousSentenceIndex, setContinuousSentenceIndex] = useState<number>(-1);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Current preset sentences
  const activePreset = PRESET_VIDEOS[activePresetIndex] || PRESET_VIDEOS[0];
  const activeSentences = useMemo(() => {
    return activePreset?.sentences || [];
  }, [activePreset]);

  // Selected voice profile
  const selectedVoice = useMemo(() => {
    return (
      HMONG_VOICE_PROFILES.find((v) => v.id === selectedVoiceId) ||
      HMONG_VOICE_PROFILES[0]
    );
  }, [selectedVoiceId]);

  // Register with taskCoordinator to immediately stop playback on tab or window switch
  useEffect(() => {
    const unregister = taskCoordinator.registerStopHandler('video_player', () => {
      if (videoRef.current && !videoRef.current.paused) {
        videoRef.current.pause();
        setIsVideoPlaying(false);
      }
      try {
        const iframes = document.querySelectorAll<HTMLIFrameElement>('iframe');
        iframes.forEach((iframe) => {
          iframe.contentWindow?.postMessage('{"event":"command","func":"pauseVideo","args":""}', '*');
        });
      } catch (_) {}
      hmongTTS.stop();
      setActiveVoiceoverId(null);
      setIsContinuousPlaying(false);
      setContinuousSentenceIndex(-1);
    });

    return () => {
      unregister();
      if (videoRef.current) {
        videoRef.current.pause();
      }
      hmongTTS.stop();
    };
  }, []);

  // Check if active URL is YouTube
  const extractYouTubeId = (url: string): string | null => {
    if (!url) return null;
    const match = url.match(
      /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/i
    );
    return match ? match[1] : null;
  };

  const youTubeId = extractYouTubeId(activeVideoUrl);
  const isDirectVideo = !youTubeId && Boolean(activeVideoUrl);

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle URL Submission
  const handleLoadUrl = () => {
    if (!videoUrlInput.trim()) return;
    if (uploadedFile) {
      URL.revokeObjectURL(activeVideoUrl);
      setUploadedFile(null);
    }
    setActiveVideoUrl(videoUrlInput.trim());
    const matchedPresetIdx = PRESET_VIDEOS.findIndex((p) => p.url === videoUrlInput.trim());
    if (matchedPresetIdx >= 0) {
      setActivePresetIndex(matchedPresetIdx);
      setVideoTitle(PRESET_VIDEOS[matchedPresetIdx].title);
    } else {
      setActivePresetIndex(-1);
      setVideoTitle(
        videoUrlInput.includes('youtube.com') || videoUrlInput.includes('youtu.be')
          ? 'Custom YouTube Video'
          : 'Direct Video Stream'
      );
    }
    setIsVideoEnded(false);
    setIsVideoPlaying(false);
    setVideoCurrentTime(0);
    hmongTTS.stop();
    setActiveVoiceoverId(null);
  };

  // Handle Local File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (uploadedFile) {
        URL.revokeObjectURL(activeVideoUrl);
      }
      const localUrl = URL.createObjectURL(file);
      setUploadedFile(file);
      setActiveVideoUrl(localUrl);
      setVideoTitle(file.name);
      setVideoUrlInput('');
      setActivePresetIndex(-1);
      setIsVideoEnded(false);
      setIsVideoPlaying(false);
      setVideoCurrentTime(0);
      hmongTTS.stop();
      setActiveVoiceoverId(null);
    }
  };

  // Change HTML5 video playback speed: 1x, 2x, 3x
  const handleSetSpeed = (spd: number) => {
    setPlaybackSpeed(spd);
    if (videoRef.current) {
      videoRef.current.playbackRate = spd;
    }
  };

  // Seek video
  const handleSeek = (percentage: number) => {
    if (videoRef.current && videoDuration > 0) {
      const targetTime = (percentage / 100) * videoDuration;
      videoRef.current.currentTime = targetTime;
      setVideoCurrentTime(targetTime);
      setIsVideoEnded(false);
    }
  };

  // Play / Pause HTML5 video
  const handleTogglePlayPause = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused || videoRef.current.ended) {
      if (videoRef.current.ended) {
        videoRef.current.currentTime = 0;
        setIsVideoEnded(false);
      }
      taskCoordinator.notifyTaskStarted('video_player');
      videoRef.current.playbackRate = playbackSpeed;
      videoRef.current.play().then(() => setIsVideoPlaying(true)).catch(() => {
        taskCoordinator.notifyTaskEnded('video_player');
      });
    } else {
      videoRef.current.pause();
      setIsVideoPlaying(false);
      taskCoordinator.notifyTaskEnded('video_player');
    }
  };

  // Relisten: restarts video from 0:00
  const handleRelisten = () => {
    if (!videoRef.current) return;
    taskCoordinator.notifyTaskStarted('video_player');
    videoRef.current.currentTime = 0;
    setVideoCurrentTime(0);
    setIsVideoEnded(false);
    videoRef.current.playbackRate = playbackSpeed;
    videoRef.current.play().then(() => setIsVideoPlaying(true)).catch(() => {
      taskCoordinator.notifyTaskEnded('video_player');
    });
  };

  // Mute toggle
  const handleToggleMute = () => {
    if (!videoRef.current) return;
    videoRef.current.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  // Fullscreen toggle
  const handleFullscreen = () => {
    if (videoRef.current) {
      if (videoRef.current.requestFullscreen) {
        videoRef.current.requestFullscreen();
      }
    }
  };

  // Speak single sentence with HmongTTS native voiceover
  const handlePlayVoiceoverLine = (sentence: VideoTranscriptSentence) => {
    if (activeVoiceoverId === sentence.id) {
      hmongTTS.stop();
      setActiveVoiceoverId(null);
      setIsContinuousPlaying(false);
      return;
    }

    hmongTTS.stop();
    setActiveVoiceoverId(sentence.id);
    setIsContinuousPlaying(false);
    taskCoordinator.notifyTaskStarted('video_player');

    const curDialect = selectedVoice.dialect || dialect;
    hmongTTS.speak(sentence.hmong, curDialect, {
      voice: selectedVoice,
      rate: voiceoverRate,
      prosody: 1.15,
      toneEmphasis: 1.25,
      onEnd: () => {
        setActiveVoiceoverId(null);
        taskCoordinator.notifyTaskEnded('video_player');
      },
      onError: () => {
        setActiveVoiceoverId(null);
        taskCoordinator.notifyTaskEnded('video_player');
      },
    });
  };

  // Continuous Human Reading Voiceover across all sentences in preset
  const handleToggleContinuousReading = () => {
    if (isContinuousPlaying) {
      hmongTTS.stop();
      setIsContinuousPlaying(false);
      setContinuousSentenceIndex(-1);
      setActiveVoiceoverId(null);
      taskCoordinator.notifyTaskEnded('video_player');
      return;
    }

    if (activeSentences.length === 0) return;

    hmongTTS.stop();
    setIsContinuousPlaying(true);
    taskCoordinator.notifyTaskStarted('video_player');

    let curIdx = 0;
    const curDialect = selectedVoice.dialect || dialect;

    const playNextSentence = () => {
      if (curIdx >= activeSentences.length) {
        setIsContinuousPlaying(false);
        setContinuousSentenceIndex(-1);
        setActiveVoiceoverId(null);
        taskCoordinator.notifyTaskEnded('video_player');
        return;
      }

      const s = activeSentences[curIdx];
      setContinuousSentenceIndex(curIdx);
      setActiveVoiceoverId(s.id);

      hmongTTS.speak(s.hmong, curDialect, {
        voice: selectedVoice,
        rate: voiceoverRate,
        prosody: 1.2,
        toneEmphasis: 1.25,
        onEnd: () => {
          // Authentic human pause between sentences (750ms natural breath pause)
          curIdx++;
          window.setTimeout(playNextSentence, 750 / voiceoverRate);
        },
        onError: () => {
          setIsContinuousPlaying(false);
          setContinuousSentenceIndex(-1);
          setActiveVoiceoverId(null);
          taskCoordinator.notifyTaskEnded('video_player');
        },
      });
    };

    playNextSentence();
  };

  // AI Transcribe Video Audio (Gemini AI)
  const handleTranscribeVideo = async () => {
    if (!uploadedFile) {
      setTranscriptionError(
        'To transcribe video audio via Gemini AI, please upload a video file.'
      );
      return;
    }

    setIsTranscribing(true);
    setTranscriptionError(null);

    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const res = reader.result as string;
          const base64 = res.split(',')[1] || res;
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(uploadedFile);
      });

      const base64Data = await base64Promise;

      const res = await fetch('/api/tts/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioData: base64Data,
          mimeType: uploadedFile.type || 'video/mp4',
          dialectHint: dialect,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Server transcription failed');
      }

      setTranscriptResult(data.transcript || 'No speech detected in clip.');
    } catch (err: any) {
      console.error('Video transcription error:', err);
      setTranscriptionError(err.message || 'Could not transcribe video');
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleCopyTranscript = () => {
    if (!transcriptResult) return;
    navigator.clipboard.writeText(transcriptResult);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const progressPercent = videoDuration > 0 ? (videoCurrentTime / videoDuration) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*,.mp4,.webm,.mov,.mkv"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
          <Video className="w-5 h-5 text-teal-400" />
          <span>Interactive Video Player & Speech Analysis Studio</span>
        </h2>
        <p className="text-sm text-slate-400 mt-1 max-w-3xl">
          Watch curated YouTube Hmong phonetics masterclasses, direct video streams, or upload local files. Audition native TTS voiceovers, shadow real human pitch contours, and transcribe dialogue with Gemini AI.
        </p>
      </div>

      {/* Input Bar: Video URL & Upload File */}
      <div className="p-4 rounded-2xl border border-slate-800 bg-slate-950/90 shadow-xl space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          {/* URL Input */}
          <div className="relative flex-1">
            <LinkIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={videoUrlInput}
              onChange={(e) => setVideoUrlInput(e.target.value)}
              placeholder="Paste video URL (YouTube, MP4, WebM link)..."
              onKeyDown={(e) => e.key === 'Enter' && handleLoadUrl()}
              className="w-full pl-10 pr-24 py-2.5 bg-slate-900 border border-slate-700/80 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-teal-500 font-mono transition"
            />
            {videoUrlInput && (
              <button
                onClick={() => setVideoUrlInput('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Load URL Button */}
          <button
            onClick={handleLoadUrl}
            className="flex items-center justify-center gap-1.5 px-5 py-2.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-bold shadow-md shadow-teal-950 transition active:scale-95 shrink-0"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Display Video</span>
          </button>

          {/* Upload Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold border border-slate-700 transition active:scale-95 shrink-0"
          >
            <Upload className="w-3.5 h-3.5 text-teal-400" />
            <span>Upload File</span>
          </button>
        </div>

        {/* Preset Quick Buttons */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-800/80 text-[11px]">
          <span className="text-slate-500 font-mono">Sample Videos:</span>
          {PRESET_VIDEOS.map((preset, idx) => (
            <button
              key={idx}
              onClick={() => {
                setVideoUrlInput(preset.url);
                setActiveVideoUrl(preset.url);
                setVideoTitle(preset.title);
                setActivePresetIndex(idx);
                setUploadedFile(null);
                setIsVideoEnded(false);
                setIsVideoPlaying(false);
                hmongTTS.stop();
                setActiveVoiceoverId(null);
              }}
              className={`px-2.5 py-1 rounded-lg border transition truncate max-w-[220px] ${
                activePresetIndex === idx
                  ? 'bg-teal-950 border-teal-600 text-teal-300 font-semibold shadow-xs'
                  : 'bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-teal-300 border-slate-800'
              }`}
              title={preset.description}
            >
              {preset.title}
            </button>
          ))}
        </div>
      </div>

      {/* Main Display Video Container */}
      <div className="p-4 rounded-2xl border border-slate-800 bg-slate-950/95 shadow-2xl space-y-4">
        {/* Title Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-teal-950 border border-teal-800/40 text-teal-400">
              <FileVideo className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-200 truncate max-w-[360px]">
                {videoTitle}
              </h3>
              <p className="text-[11px] text-slate-500 font-mono">
                {uploadedFile
                  ? `Local File • ${(uploadedFile.size / (1024 * 1024)).toFixed(1)} MB`
                  : youTubeId
                  ? 'YouTube Embedded Stream'
                  : 'Direct Video Stream'}
              </p>
            </div>
          </div>

          {/* Status Badge */}
          {isVideoEnded && (
            <span className="inline-flex items-center gap-1.5 text-[10px] font-mono font-medium text-emerald-300 bg-emerald-950/80 px-2.5 py-1 rounded-lg border border-emerald-800/50">
              <Check className="w-3 h-3 text-emerald-400" />
              <span>Finished • Video Saved (Ready to Relisten)</span>
            </span>
          )}

          {/* External Link */}
          {activeVideoUrl && !uploadedFile && (
            <a
              href={activeVideoUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="flex items-center gap-1 text-slate-400 hover:text-slate-200 text-xs transition"
            >
              <span>Open Source URL</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>

        {/* Video Player Display Area */}
        <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden shadow-2xl border border-slate-800">
          {youTubeId ? (
            /* YouTube IFrame Player */
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${youTubeId}?autoplay=1&rel=0&modestbranding=1&enablejsapi=1`}
              title={videoTitle}
              className="w-full h-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          ) : isDirectVideo ? (
            /* HTML5 Video Player */
            <video
              ref={videoRef}
              src={activeVideoUrl}
              className="w-full h-full object-contain"
              playsInline
              onPlay={() => {
                setIsVideoPlaying(true);
                setIsVideoEnded(false);
              }}
              onPause={() => setIsVideoPlaying(false)}
              onEnded={() => {
                setIsVideoPlaying(false);
                setIsVideoEnded(true);
              }}
              onTimeUpdate={() => {
                if (videoRef.current) {
                  setVideoCurrentTime(videoRef.current.currentTime);
                  setVideoDuration(videoRef.current.duration || 0);
                }
              }}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 space-y-2">
              <Video className="w-12 h-12 stroke-[1.2] text-slate-600" />
              <p className="text-xs">No video loaded. Enter a video URL or upload a file above.</p>
            </div>
          )}
        </div>

        {/* Dedicated Controller Bar for HTML5 / Direct Video (Play, Pause, Speed 1x 2x 3x, Scrubber, Relistening) */}
        {isDirectVideo && (
          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
            {/* Timeline Scrubber */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                <span className="text-teal-300 font-bold">{formatTime(videoCurrentTime)}</span>
                <span className="text-slate-500">{formatTime(videoDuration)}</span>
              </div>

              {/* Clickable Seek Bar */}
              <div
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const clickX = e.clientX - rect.left;
                  const pct = Math.max(0, Math.min(100, (clickX / rect.width) * 100));
                  handleSeek(pct);
                }}
                className="w-full h-2.5 bg-slate-950 rounded-full cursor-pointer overflow-hidden border border-slate-800 hover:border-teal-500/50 transition relative"
                title="Click to seek in video"
              >
                <div
                  className={`h-full transition-all duration-75 rounded-full ${
                    isVideoEnded
                      ? 'bg-emerald-500'
                      : 'bg-gradient-to-r from-teal-500 to-sky-400 shadow-md shadow-teal-500/30'
                  }`}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* Controller Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-2">
                {/* Play / Pause Toggle */}
                <button
                  onClick={handleTogglePlayPause}
                  className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-bold shadow-md shadow-teal-950 transition active:scale-95 cursor-pointer"
                >
                  {isVideoPlaying ? (
                    <>
                      <Pause className="w-3.5 h-3.5 fill-current" />
                      <span>Pause</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>{isVideoEnded ? 'Relisten' : 'Play'}</span>
                    </>
                  )}
                </button>

                {/* Relisten Button */}
                <button
                  onClick={handleRelisten}
                  className={`flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold border transition active:scale-95 cursor-pointer ${
                    isVideoEnded
                      ? 'bg-teal-950 border-teal-600 text-teal-300 shadow-sm animate-bounce'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700/60'
                  }`}
                  title="Relisten: restart video from beginning (0:00)"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Relisten</span>
                </button>
              </div>

              {/* Speed Buttons: 1x, 2x, 3x */}
              <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
                <Gauge className="w-3.5 h-3.5 text-teal-400 mx-1" />
                <span className="text-[10px] font-mono text-slate-500 mr-1">Speed:</span>
                {[0.75, 1.0, 1.5, 2.0, 3.0].map((spd) => {
                  const isSelected = playbackSpeed === spd;
                  return (
                    <button
                      key={spd}
                      onClick={() => handleSetSpeed(spd)}
                      className={`px-2 py-0.5 rounded text-xs font-mono font-bold transition cursor-pointer ${
                        isSelected
                          ? 'bg-teal-500 text-slate-950 font-extrabold shadow-sm'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800'
                      }`}
                    >
                      {spd}x
                    </button>
                  );
                })}
              </div>

              {/* Right Side: Volume & Fullscreen */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleToggleMute}
                  className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
                  title={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted ? <VolumeX className="w-3.5 h-3.5 text-rose-400" /> : <Volume2 className="w-3.5 h-3.5" />}
                </button>

                <button
                  onClick={handleFullscreen}
                  className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
                  title="Fullscreen"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Native Voiceover & Speech Shadowing Studio (Dedicated Audio Reading Engine) */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
            <div>
              <h4 className="text-xs font-bold text-slate-200 flex items-center gap-2">
                <Headphones className="w-4 h-4 text-teal-400" />
                <span>Native Voiceover & Speech Shadowing Studio</span>
                <span className="px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-800/50 text-[10px] font-mono text-emerald-300">
                  Real Native Reader Mode
                </span>
              </h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Listen to authentic Hmong reading with tone sandhi rules applied. Practice line-by-line shadowing or listen to continuous speech.
              </p>
            </div>

            {/* Voiceover Controls */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Voice Picker */}
              <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-500 font-mono">Voice:</span>
                <select
                  value={selectedVoiceId}
                  onChange={(e) => setSelectedVoiceId(e.target.value)}
                  className="bg-transparent text-xs font-semibold text-slate-200 focus:outline-none cursor-pointer"
                >
                  {HMONG_VOICE_PROFILES.map((v) => (
                    <option key={v.id} value={v.id} className="bg-slate-900 text-white">
                      {v.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Speed Picker */}
              <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-500 font-mono">Rate:</span>
                {[0.8, 1.0, 1.2].map((r) => (
                  <button
                    key={r}
                    onClick={() => setVoiceoverRate(r)}
                    className={`px-1.5 py-0.5 rounded text-[11px] font-mono font-bold cursor-pointer transition ${
                      voiceoverRate === r
                        ? 'bg-teal-500 text-slate-950'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {r}x
                  </button>
                ))}
              </div>

              {/* Continuous Read-Aloud Button */}
              {activeSentences.length > 0 && (
                <button
                  onClick={handleToggleContinuousReading}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition active:scale-95 cursor-pointer shadow-md ${
                    isContinuousPlaying
                      ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950 animate-pulse'
                      : 'bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white shadow-teal-950'
                  }`}
                >
                  {isContinuousPlaying ? (
                    <>
                      <Square className="w-3.5 h-3.5 fill-current" />
                      <span>Stop Reading</span>
                    </>
                  ) : (
                    <>
                      <Volume2 className="w-3.5 h-3.5" />
                      <span>Continuous Read-Aloud</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Synchronized Transcript Sentence List */}
          {activeSentences.length > 0 ? (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                <span>Passage Sentences ({activeSentences.length} lines):</span>
                <span className="text-teal-400">Click any line to audition native voiceover</span>
              </div>

              <div className="grid grid-cols-1 gap-2">
                {activeSentences.map((sentence, sIdx) => {
                  const isLineActive = activeVoiceoverId === sentence.id;
                  const isContinuousHighlight = continuousSentenceIndex === sIdx;

                  return (
                    <div
                      key={sentence.id}
                      className={`p-3 rounded-xl border transition-all ${
                        isLineActive || isContinuousHighlight
                          ? 'border-teal-500 bg-teal-950/40 shadow-md shadow-teal-950/50 ring-1 ring-teal-500/50'
                          : 'border-slate-800/90 bg-slate-950/70 hover:border-slate-700 hover:bg-slate-950'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        {/* Sentence Text */}
                        <div className="space-y-1 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-sm font-semibold text-slate-100 select-text">
                              "{sentence.hmong}"
                            </span>

                            {/* Tone Focus Tag */}
                            {sentence.toneFocus && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700">
                                Tone -{sentence.toneFocus || 'mid'}
                              </span>
                            )}

                            {/* Tone Sandhi Tag */}
                            {sentence.isSandhi && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-950/80 text-amber-300 border border-amber-800/50 flex items-center gap-1">
                                <Sparkle className="w-2.5 h-2.5" />
                                <span>{sentence.sandhiNote || 'Tone Sandhi Active'}</span>
                              </span>
                            )}
                          </div>

                          <p className="text-xs text-slate-400 italic">
                            {sentence.english}
                          </p>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                          {/* Play Line */}
                          <button
                            onClick={() => handlePlayVoiceoverLine(sentence)}
                            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition active:scale-95 cursor-pointer ${
                              isLineActive
                                ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-xs'
                                : 'bg-teal-950/80 hover:bg-teal-900 border border-teal-700/60 text-teal-300'
                            }`}
                            title="Play Hmong TTS native voiceover for this line"
                          >
                            {isLineActive ? (
                              <Square className="w-3 h-3 fill-current" />
                            ) : (
                              <Play className="w-3 h-3 fill-current" />
                            )}
                            <span>{isLineActive ? 'Stop' : 'Voiceover'}</span>
                          </button>

                          {/* Send to Speech Studio */}
                          {onUseTranscript && (
                            <button
                              onClick={() => onUseTranscript(sentence.hmong)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 transition cursor-pointer"
                              title="Send sentence text to Speech Studio"
                            >
                              <ArrowUpRight className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Practice in Tone Lab */}
                          {onNavigateToToneLab && (
                            <button
                              onClick={() => onNavigateToToneLab(sentence.toneFocus || 'b')}
                              className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-amber-950/50 hover:bg-amber-900/60 border border-amber-800/50 text-amber-300 text-xs transition cursor-pointer"
                              title="Inspect and practice in Tone Lab"
                            >
                              <Mic className="w-3 h-3" />
                              <span className="text-[11px]">Tone Lab</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-lg bg-slate-950/50 border border-slate-800 text-center text-xs text-slate-400">
              Select one of the curated video presets above to load synchronized Hmong reading lines.
            </div>
          )}
        </div>

        {/* AI Audio Transcription for Uploaded Video */}
        {uploadedFile && (
          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>AI Video Audio Transcription</span>
                </h4>
                <p className="text-[11px] text-slate-400">
                  Extract spoken dialogue from this video and transcribe it into Hmong RPA or English text.
                </p>
              </div>

              <button
                onClick={handleTranscribeVideo}
                disabled={isTranscribing}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-lg text-xs font-semibold shadow transition active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {isTranscribing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Transcribing Video...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                    <span>Transcribe Video Audio</span>
                  </>
                )}
              </button>
            </div>

            {/* Error */}
            {transcriptionError && (
              <div className="p-2 rounded-lg bg-rose-950/40 border border-rose-800/50 text-xs text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{transcriptionError}</span>
              </div>
            )}

            {/* Result Box */}
            {transcriptResult && (
              <div className="p-3 rounded-xl bg-slate-950 border border-teal-800/40 space-y-2 animate-in fade-in">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-teal-300">Transcribed Video Speech:</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCopyTranscript}
                      className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-800 transition cursor-pointer"
                    >
                      {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copied ? 'Copied' : 'Copy'}</span>
                    </button>

                    {onUseTranscript && (
                      <button
                        onClick={() => onUseTranscript(transcriptResult)}
                        className="flex items-center gap-1 text-[11px] text-teal-300 hover:text-white px-2 py-0.5 rounded bg-teal-950 border border-teal-800/50 transition cursor-pointer"
                      >
                        <ArrowUpRight className="w-3 h-3" />
                        <span>Use in Speech Studio</span>
                      </button>
                    )}
                  </div>
                </div>

                <p className="font-mono text-xs text-slate-200 leading-relaxed p-2 bg-slate-900 rounded border border-slate-800 select-text">
                  "{transcriptResult}"
                </p>

                {/* Direct Voiceover of Transcribed Audio */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => {
                      if (activeVoiceoverId === 'transcription_result') {
                        hmongTTS.stop();
                        setActiveVoiceoverId(null);
                      } else {
                        hmongTTS.stop();
                        setActiveVoiceoverId('transcription_result');
                        hmongTTS.speak(transcriptResult, selectedVoice.dialect || dialect, {
                          voice: selectedVoice,
                          rate: voiceoverRate,
                          prosody: 1.15,
                          onEnd: () => setActiveVoiceoverId(null),
                          onError: () => setActiveVoiceoverId(null),
                        });
                      }
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-950 hover:bg-teal-900 border border-teal-800/60 text-teal-300 text-xs font-semibold cursor-pointer"
                  >
                    {activeVoiceoverId === 'transcription_result' ? (
                      <>
                        <Square className="w-3 h-3 fill-current" />
                        <span>Stop Voiceover</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3 h-3 fill-current" />
                        <span>Voiceover Transcript</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

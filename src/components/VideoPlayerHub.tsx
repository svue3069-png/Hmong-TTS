/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * VideoPlayerHub
 * Interactive video studio allowing users to input video URLs (YouTube, MP4, WebM)
 * or upload video files, display the video, control playback with Speed 1x, 2x, 3x,
 * seeking, relistening on completion, and AI speech transcription.
 */

import React, { useState, useRef, useEffect } from 'react';
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
} from 'lucide-react';

interface VideoPlayerHubProps {
  onUseTranscript?: (text: string) => void;
  dialect?: 'dawb' | 'leeg';
}

interface CuratedVideoPreset {
  title: string;
  category: string;
  dialect: 'dawb' | 'leeg' | 'both';
  url: string;
  description: string;
}

const PRESET_VIDEOS: CuratedVideoPreset[] = [
  {
    title: 'Hmong 8 Tones Acoustic Pronunciation Masterclass',
    category: 'Phonology & Tones',
    dialect: 'both',
    url: 'https://www.youtube.com/watch?v=7PqwU2fP2_k',
    description: 'Learn the exact pitch heights for the 8 RPA tones: -b, -j, -v, blank, -s, -g, -m, -d.',
  },
  {
    title: 'Hmoob Dawb vs Moob Leeg Dialect Shifts & Lateral Releases',
    category: 'Dialect Comparison',
    dialect: 'both',
    url: 'https://www.youtube.com/watch?v=k5lqWzQp_2o',
    description: 'Comparative analysis of White Hmong vs Green Hmong consonants and nasal vowels.',
  },
  {
    title: 'Hmong RPA Phonics & Syllable Reading for Beginners',
    category: 'Language Learning',
    dialect: 'dawb',
    url: 'https://www.youtube.com/watch?v=k6e6uVv5B3w',
    description: 'Pronunciation drills with native audio for rapid RPA literacy.',
  },
  {
    title: 'Direct MP4 Sample Stream (HTML5 Video Controls Test)',
    category: 'DSP Test Video',
    dialect: 'both',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    description: 'Direct MP4 video file to test custom speed controls (1x, 2x, 3x), scrubber, and relistening.',
  },
];

export const VideoPlayerHub: React.FC<VideoPlayerHubProps> = ({
  onUseTranscript,
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
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  // Playback states for HTML5 video
  const [isVideoPlaying, setIsVideoPlaying] = useState<boolean>(false);
  const [isVideoEnded, setIsVideoEnded] = useState<boolean>(false);
  const [videoCurrentTime, setVideoCurrentTime] = useState<number>(0);
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [videoVolume, setVideoVolume] = useState<number>(1.0);

  // Transcription state
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const [transcriptResult, setTranscriptResult] = useState<string | null>(null);
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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
    setVideoTitle(
      videoUrlInput.includes('youtube.com') || videoUrlInput.includes('youtu.be')
        ? 'YouTube Video'
        : 'Direct Video Stream'
    );
    setIsVideoEnded(false);
    setIsVideoPlaying(false);
    setVideoCurrentTime(0);
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
      setIsVideoEnded(false);
      setIsVideoPlaying(false);
      setVideoCurrentTime(0);
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

  // Play / Pause video
  const handleTogglePlayPause = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused || videoRef.current.ended) {
      if (videoRef.current.ended) {
        videoRef.current.currentTime = 0;
        setIsVideoEnded(false);
      }
      videoRef.current.playbackRate = playbackSpeed;
      videoRef.current.play().then(() => setIsVideoPlaying(true)).catch(() => {});
    } else {
      videoRef.current.pause();
      setIsVideoPlaying(false);
    }
  };

  // Relisten: restarts video from 0:00
  const handleRelisten = () => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = 0;
    setVideoCurrentTime(0);
    setIsVideoEnded(false);
    videoRef.current.playbackRate = playbackSpeed;
    videoRef.current.play().then(() => setIsVideoPlaying(true)).catch(() => {});
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

  // AI Transcribe Video Audio (Gemini AI)
  const handleTranscribeVideo = async () => {
    if (!uploadedFile) {
      setTranscriptionError(
        'To transcribe video audio via Gemini AI, please upload a video file or pick an audio clip.'
      );
      return;
    }

    setIsTranscribing(true);
    setTranscriptionError(null);

    try {
      // Read video file as base64
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
          Input any video URL (YouTube, MP4, WebM) or upload a local video file. Display and watch with speed controls (1x, 2x, 3x), relisten after playback ends, and transcribe spoken dialogue with Gemini AI.
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

          {/* Upload Video File Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold border border-slate-700/60 transition active:scale-95 shrink-0"
            title="Upload MP4, WebM, MOV video file from your device"
          >
            <Upload className="w-3.5 h-3.5 text-sky-400" />
            <span>Upload Video</span>
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
                setUploadedFile(null);
                setIsVideoEnded(false);
                setIsVideoPlaying(false);
              }}
              className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-teal-300 border border-slate-800 transition truncate max-w-[200px]"
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
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-300 bg-emerald-950/80 px-2.5 py-1 rounded-full border border-emerald-800/50">
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

            {/* Controller Buttons: Play, Pause, Relisten, Speed 1x 2x 3x, Volume */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-2">
                {/* Play / Pause Toggle */}
                <button
                  onClick={handleTogglePlayPause}
                  className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-bold shadow-md shadow-teal-950 transition active:scale-95"
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
                  className={`flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold border transition active:scale-95 ${
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
                      className={`px-2 py-0.5 rounded text-xs font-mono font-bold transition ${
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
                  className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition"
                  title={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted ? <VolumeX className="w-3.5 h-3.5 text-rose-400" /> : <Volume2 className="w-3.5 h-3.5" />}
                </button>

                <button
                  onClick={handleFullscreen}
                  className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition"
                  title="Fullscreen"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}

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
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-lg text-xs font-semibold shadow transition active:scale-95 disabled:opacity-50"
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
                      className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-800 transition"
                    >
                      {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copied ? 'Copied' : 'Copy'}</span>
                    </button>

                    {onUseTranscript && (
                      <button
                        onClick={() => onUseTranscript(transcriptResult)}
                        className="flex items-center gap-1 text-[11px] text-teal-300 hover:text-white px-2 py-0.5 rounded bg-teal-950 border border-teal-800/50 transition"
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
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

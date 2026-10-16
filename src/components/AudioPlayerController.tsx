/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * AudioPlayerController
 * Feature-packed interactive audio player with Play, Pause, Speed (1x, 2x, 3x),
 * draggable scrub timeline, persistent track retention after playback ends,
 * and 1-click Relistening.
 */

import React, { useRef } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Repeat,
  Download,
  Gauge,
  FastForward,
  Rewind,
  Music2,
  CheckCircle2,
} from 'lucide-react';
import { AudioTrackMetadata } from '../hooks/useStudioAudioPlayer';

interface AudioPlayerControllerProps {
  track: AudioTrackMetadata | null;
  isPlaying: boolean;
  isPaused: boolean;
  isEnded: boolean;
  currentTime: number;
  duration: number;
  playbackSpeed: number;
  isLooping: boolean;
  volume: number;
  isSynthesizing: boolean;
  onPlay: () => void;
  onPause: () => void;
  onTogglePlayPause: () => void;
  onRelisten: () => void;
  onSeek: (timeSec: number) => void;
  onSkip: (offsetSec: number) => void;
  onSetSpeed: (speed: number) => void;
  onToggleLoop: () => void;
  onSetVolume: (vol: number) => void;
  onDownloadWav?: () => void;
  onRenderAndPlay?: () => void;
  hasText?: boolean;
  speakButtonLabel?: string;
  engineType?: 'hmong_dsp' | 'web_speech' | 'hmongdictionary_native' | 'orpheus_neural' | 'nouai_cloud';
}

export const AudioPlayerController: React.FC<AudioPlayerControllerProps> = ({
  track,
  isPlaying,
  isPaused,
  isEnded,
  currentTime,
  duration,
  playbackSpeed,
  isLooping,
  volume,
  isSynthesizing,
  onPlay,
  onPause,
  onTogglePlayPause,
  onRelisten,
  onSeek,
  onSkip,
  onSetSpeed,
  onToggleLoop,
  onSetVolume,
  onDownloadWav,
  onRenderAndPlay,
  hasText = true,
  speakButtonLabel,
  engineType = 'hmongdictionary_native',
}) => {
  const progressBarRef = useRef<HTMLDivElement | null>(null);

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const tenths = Math.floor((seconds % 1) * 10);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${tenths}`;
  };

  const handleProgressBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || duration <= 0) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));
    onSeek(percentage * duration);
  };

  const progressPercent = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  // Speed options with 1x, 2x, 3x explicitly supported
  const SPEED_OPTIONS = [0.75, 1.0, 1.5, 2.0, 3.0];

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/90 p-4 shadow-xl space-y-3.5 transition-all">
      {/* Player Header: Track Status & Relisten indicator */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
        <div className="flex items-center gap-2">
          <div
            className={`p-2 rounded-xl border ${
              isPlaying
                ? 'bg-teal-950/80 border-teal-600/60 text-teal-400 animate-pulse'
                : isEnded
                ? 'bg-emerald-950/70 border-emerald-600/50 text-emerald-400'
                : 'bg-slate-900 border-slate-800 text-slate-400'
            }`}
          >
            <Music2 className="w-4 h-4" />
          </div>

          <div>
            <div className="flex items-center gap-2 text-xs">
              <span className="font-semibold text-slate-100">
                {track
                  ? `Track: ${track.text.slice(0, 36)}${track.text.length > 36 ? '...' : ''}`
                  : 'Synthesizer Audio Player'}
              </span>

              {isEnded && (
                <>
                  <span className="text-slate-600" aria-hidden="true">·</span>
                  <span className="text-xs text-emerald-400 font-medium">
                    Finished · Ready to relisten
                  </span>
                </>
              )}

              {isPlaying && (
                <>
                  <span className="text-slate-600" aria-hidden="true">·</span>
                  <span className="text-xs text-teal-400 font-medium">
                    Playing ({playbackSpeed}x)
                  </span>
                </>
              )}

              {isPaused && (
                <>
                  <span className="text-slate-600" aria-hidden="true">·</span>
                  <span className="text-xs text-amber-400 font-medium">
                    Paused at {formatTime(currentTime)}
                  </span>
                </>
              )}
            </div>

            <div className="text-xs text-slate-400 mt-1 flex flex-wrap items-center gap-2">
              {track ? (
                <>
                  <span>{track.dialect === 'dawb' ? 'White Hmong (Hmoob Dawb)' : 'Green Hmong (Moob Leeg)'}</span>
                  <span className="text-slate-600" aria-hidden="true">·</span>
                  {track.engine === 'hmongdictionary_native' ? (
                    <>
                      <span className="text-emerald-400 font-medium">
                        HmongDictionary.com Native Voice
                      </span>
                      <span className="text-slate-600" aria-hidden="true">·</span>
                      <span className="text-slate-400">
                        Natural Sentence Cadence
                      </span>
                    </>
                  ) : (
                    <span>{track.voice.name}</span>
                  )}
                </>
              ) : (
                <span>Synthesize or speak any sentence with authentic Hmong native human pronunciation.</span>
              )}
            </div>
          </div>
        </div>

        {/* Quick Relisten / Repeat Button */}
        {track && (
          <div className="flex items-center gap-2">
            <button
              onClick={onRelisten}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition active:scale-95 ${
                isEnded
                  ? 'bg-teal-600 hover:bg-teal-500 text-white border-teal-500 shadow-md shadow-teal-950 animate-bounce duration-1000'
                  : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800'
              }`}
              title="Relisten: re-play track from the beginning (0:00)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Relisten Track</span>
            </button>

            {onDownloadWav && (
              <button
                onClick={onDownloadWav}
                className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition"
                title="Download this audio track (.wav)"
              >
                <Download className="w-3.5 h-3.5 text-teal-400" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Interactive Timeline & Scrubber Bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs font-mono tabular-nums text-slate-400 select-none">
          <span className="text-teal-300 font-bold tabular-nums">{formatTime(currentTime)}</span>
          <span className="text-slate-500 tabular-nums">
            {duration > 0 ? formatTime(duration) : '00:00.0'}
          </span>
        </div>

        {/* Seekable Track Bar */}
        <div
          ref={progressBarRef}
          onClick={handleProgressBarClick}
          className="relative w-full h-3 bg-slate-900 rounded-md cursor-pointer overflow-hidden border border-slate-800 hover:border-teal-500/50 transition group"
          title="Click or drag to seek to any point in the track"
        >
          {/* Progress fill */}
          <div
            className={`h-full transition-all duration-75 rounded-md ${
              isEnded
                ? 'bg-emerald-500'
                : 'bg-gradient-to-r from-teal-500 to-sky-400 shadow-lg shadow-teal-500/30'
            }`}
            style={{ width: `${progressPercent}%` }}
          />

          {/* Interactive thumb marker */}
          <div
            className="absolute top-0 bottom-0 w-1 bg-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow"
            style={{ left: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Main Controls Row: Play/Pause, Rewind/Forward, Speed, Loop, Volume */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
        {/* Playback Transport Buttons */}
        <div className="flex items-center gap-2">
          {/* Skip Back -2s */}
          <button
            onClick={() => onSkip(-2)}
            disabled={!track}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition disabled:opacity-40 disabled:cursor-not-allowed"
            title="Rewind 2 seconds"
          >
            <Rewind className="w-4 h-4" />
          </button>

          {/* Primary Button: Unified Play / Pause Toggle & Synthesize Speech */}
          <button
            onClick={() => {
              if (track || isPaused || isPlaying || isEnded) {
                onTogglePlayPause();
              } else if (onRenderAndPlay) {
                onRenderAndPlay();
              }
            }}
            disabled={!track && !hasText}
            className={`flex items-center gap-2.5 px-6 py-2.5 rounded-xl text-sm font-bold text-white shadow-xl transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed group ${
              isPlaying
                ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-950/60 animate-pulse'
                : engineType === 'web_speech'
                ? 'bg-sky-600 hover:bg-sky-500 shadow-sky-950/60'
                : 'bg-teal-600 hover:bg-teal-500 shadow-teal-950/60'
            }`}
            title={
              isPlaying
                ? 'Pause playback (Press to pause)'
                : isPaused
                ? 'Resume playback (Press to play)'
                : track
                ? 'Play track (Press to play)'
                : 'Synthesize & Speak Speech'
            }
          >
            {isSynthesizing ? (
              <>
                <RotateCcw className="w-4 h-4 animate-spin text-teal-200" />
                <span>Synthesizing...</span>
              </>
            ) : isPlaying ? (
              <>
                <Pause className="w-4 h-4 fill-current group-hover:scale-110 transition-transform" />
                <span>Xum Hais (Pause)</span>
              </>
            ) : isPaused ? (
              <>
                <Play className="w-4 h-4 fill-current group-hover:scale-110 transition-transform" />
                <span>Hais Ntxiv (Resume)</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current group-hover:scale-110 transition-transform" />
                <span>
                  {speakButtonLabel ||
                    (engineType === 'web_speech' ? 'Speak (English)' : 'Hais Lus (Speak Hmong)')}
                </span>
              </>
            )}
          </button>

          {/* Skip Forward +2s */}
          <button
            onClick={() => onSkip(2)}
            disabled={!track}
            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition disabled:opacity-40 disabled:cursor-not-allowed"
            title="Forward 2 seconds"
          >
            <FastForward className="w-4 h-4" />
          </button>

          {/* Loop / Repeat Toggle */}
          <button
            onClick={onToggleLoop}
            className={`p-2 rounded-xl border transition ${
              isLooping
                ? 'bg-teal-950 border-teal-600 text-teal-400 shadow-sm shadow-teal-950'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-400 border-slate-800'
            }`}
            title={isLooping ? 'Looping enabled (track repeats automatically)' : 'Enable auto-repeat'}
          >
            <Repeat className="w-4 h-4" />
          </button>
        </div>

        {/* Speed Selector: 1x, 2x, 3x (with 0.75x & 1.5x) */}
        <div className="flex items-center gap-1.5 bg-slate-900/80 p-1 rounded-xl border border-slate-800">
          <div className="flex items-center gap-1 px-1 text-slate-500 text-xs font-mono mr-0.5">
            <Gauge className="w-3.5 h-3.5 text-teal-400" />
            <span className="hidden sm:inline">Speed:</span>
          </div>

          {SPEED_OPTIONS.map((speed) => {
            const isSelected = playbackSpeed === speed;
            const isTargetHighlight = speed === 1.0 || speed === 2.0 || speed === 3.0;

            return (
              <button
                key={speed}
                onClick={() => onSetSpeed(speed)}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition active:scale-95 ${
                  isSelected
                    ? 'bg-teal-500 text-slate-950 shadow-md shadow-teal-500/20 font-extrabold'
                    : isTargetHighlight
                    ? 'text-teal-300 hover:text-white hover:bg-slate-800'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
                title={`Set playback speed to ${speed}x`}
              >
                {speed}x
              </button>
            );
          })}
        </div>

        {/* Volume Slider Control */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onSetVolume(volume > 0 ? 0 : 1.0)}
            className="text-slate-400 hover:text-white transition"
            title={volume === 0 ? 'Unmute' : 'Mute'}
          >
            {volume === 0 ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
          </button>

          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            onChange={(e) => onSetVolume(parseFloat(e.target.value))}
            className="w-18 accent-teal-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            title={`Volume: ${Math.round(volume * 100)}%`}
          />
        </div>
      </div>

      {/* Synthesizing Indicator Banner */}
      {isSynthesizing && (
        <div className="p-2 rounded-xl bg-teal-950/40 border border-teal-800/40 text-xs text-teal-300 flex items-center gap-2 animate-pulse font-mono">
          <div className="w-2 h-2 rounded-full bg-teal-400 animate-ping" />
          <span>Synthesizing native acoustic wave & timing alignment...</span>
        </div>
      )}
    </div>
  );
};

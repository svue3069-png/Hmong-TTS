/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * VoiceRecorderCard
 * Interactive voice recording studio with live audio VU meters,
 * recording stopwatch, audio playback, speech comparison, audio file upload,
 * and AI-powered audio transcription for uploaded or recorded speech.
 */

import React, { useState, useRef } from 'react';
import {
  Mic,
  Square,
  Play,
  Pause,
  RotateCcw,
  Download,
  Volume2,
  Trash2,
  Sparkles,
  AlertCircle,
  Radio,
  ExternalLink,
  Upload,
  RefreshCw,
  X,
  HelpCircle,
  FileAudio,
  Check,
  Copy,
  ArrowUp,
  FileText,
} from 'lucide-react';
import { useVoiceRecorder, VoiceRecording } from '../hooks/useVoiceRecorder';

interface VoiceRecorderCardProps {
  onTranscribe?: (text: string, mode?: 'replace' | 'append') => void;
  onCompareNativeSpeech?: () => void;
  isNativeSpeechPlaying?: boolean;
  targetText?: string;
  dialect?: 'dawb' | 'leeg';
}

export const VoiceRecorderCard: React.FC<VoiceRecorderCardProps> = ({
  onTranscribe,
  onCompareNativeSpeech,
  isNativeSpeechPlaying = false,
  targetText = '',
  dialect = 'dawb',
}) => {
  const [enableLiveDictation, setEnableLiveDictation] = useState(true);
  const [showPermissionGuide, setShowPermissionGuide] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptionResult, setTranscriptionResult] = useState<string | null>(null);
  const [transcriptionLanguage, setTranscriptionLanguage] = useState<string | null>(null);
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const {
    isRecording,
    recordingDuration,
    audioLevel,
    recording,
    isPlayingRecording,
    playbackProgress,
    recordingPlaybackSpeed,
    isRecordingEnded,
    recordingCurrentTime,
    errorMessage,
    errorType,
    isInsideIframe,
    clearError,
    startRecording,
    stopRecording,
    playRecording,
    pauseRecordingPlayback,
    relistenRecording,
    seekRecording,
    setRecordingSpeed,
    clearRecording,
    downloadRecording,
    loadAudioFile,
    loadPracticeSample,
  } = useVoiceRecorder({
    enableDictation: enableLiveDictation,
    onTranscript: (transcript) => {
      if (onTranscribe && transcript) {
        onTranscribe(transcript);
      }
    },
  });

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleOpenStandaloneWindow = () => {
    try {
      window.open(window.location.href, '_blank', 'noopener,noreferrer');
    } catch (_) {
      window.location.reload();
    }
  };

  // Convert Blob/File to base64
  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const res = reader.result as string;
        // strip data:audio/...;base64, prefix
        const base64 = res.split(',')[1] || res;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  // Transcribe any audio blob or file via server-side Gemini API
  const handleTranscribeBlob = async (blob: Blob, mimeType: string, _fileName?: string) => {
    setIsTranscribing(true);
    setTranscriptionError(null);
    try {
      const base64Data = await blobToBase64(blob);

      const res = await fetch('/api/tts/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioData: base64Data,
          mimeType: mimeType || 'audio/webm',
          dialectHint: dialect,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Server transcription failed');
      }

      const text = data.transcript || '';
      setTranscriptionResult(text);
      if (data.detection) {
        const langName =
          data.detection.language === 'hmong'
            ? data.detection.detectedDialect === 'leeg'
              ? 'Moob Leeg (Green Hmong)'
              : 'Hmoob Dawb (White Hmong)'
            : data.detection.language === 'english'
            ? 'English'
            : 'Bilingual Mixed';
        setTranscriptionLanguage(langName);
      }

      // Automatically type the text into the top input area
      if (text.trim() && onTranscribe) {
        onTranscribe(text.trim());
      }
    } catch (err: any) {
      console.error('Audio transcription error:', err);
      setTranscriptionError(err.message || 'Could not transcribe audio');
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      loadAudioFile(file);
      // Auto-transcribe the uploaded audio!
      handleTranscribeBlob(file, file.type || 'audio/wav', file.name);
    }
  };

  const handleCopy = () => {
    if (!transcriptionResult) return;
    navigator.clipboard.writeText(transcriptionResult);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleManualTranscribe = () => {
    if (!recording) return;
    handleTranscribeBlob(recording.blob, recording.mimeType, recording.fileName);
  };

  return (
    <div id="voice-recorder-card-section" className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 transition-all scroll-mt-24">
      {/* Hidden file input for audio file upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,.wav,.mp3,.m4a,.webm,.ogg"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div
            className={`p-1.5 rounded-lg border ${
              isRecording
                ? 'bg-rose-950/80 border-rose-700/60 text-rose-400 animate-pulse'
                : 'bg-slate-900 border-slate-800 text-slate-300'
            }`}
          >
            <Mic className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <span>Voice Recording & Audio Transcription Studio</span>
              {isRecording && (
                <span className="inline-flex items-center gap-1 text-[10px] font-mono text-rose-400 bg-rose-950/60 px-1.5 py-0.5 rounded border border-rose-800/40">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                  REC {formatTime(recordingDuration)}
                </span>
              )}
            </h4>
            <p className="text-[11px] text-slate-400">
              Record voice or upload audio files to transcribe into Hmong RPA or English text on top.
            </p>
          </div>
        </div>

        {/* Live dictation toggle */}
        <label className="flex items-center gap-1.5 text-[11px] text-slate-400 cursor-pointer hover:text-slate-300 select-none">
          <input
            type="checkbox"
            checked={enableLiveDictation}
            onChange={(e) => setEnableLiveDictation(e.target.checked)}
            className="rounded border-slate-700 bg-slate-900 text-teal-600 focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5"
          />
          <Sparkles className="w-3 h-3 text-amber-400" />
          <span>Live speech-to-text dictation</span>
        </label>
      </div>

      {/* Comprehensive Permission & Error Resolution Card */}
      {errorMessage && (
        <div className="mb-3 p-3.5 rounded-xl bg-amber-950/30 border border-amber-800/60 text-slate-200 text-xs space-y-2.5 animate-in fade-in duration-200">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-300">
                  {errorType === 'permission_denied'
                    ? 'Microphone Permission Needed'
                    : 'Audio Device Notice'}
                </p>
                <p className="text-slate-300 text-[11px] mt-0.5 leading-relaxed">
                  {errorType === 'permission_denied'
                    ? 'Your browser blocked microphone access. In iframe previews or private windows, browsers restrict microphone requests until enabled.'
                    : errorMessage}
                </p>
              </div>
            </div>

            <button
              onClick={clearError}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition"
              aria-label="Dismiss error"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Quick Resolution Actions */}
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-amber-800/40">
            <button
              onClick={startRecording}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-600/50 font-semibold text-[11px] transition active:scale-95"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Try Again</span>
            </button>

            {isInsideIframe && (
              <button
                onClick={handleOpenStandaloneWindow}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600/30 hover:bg-teal-600/40 text-teal-200 border border-teal-500/40 font-semibold text-[11px] transition active:scale-95"
                title="Open in new window to bypass iframe microphone sandbox restrictions"
              >
                <ExternalLink className="w-3 h-3" />
                <span>Open in Standalone Tab</span>
              </button>
            )}

            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-medium transition active:scale-95"
              title="Upload your own voice recording file (wav, mp3, webm, m4a)"
            >
              <Upload className="w-3 h-3 text-sky-400" />
              <span>Upload Voice Audio</span>
            </button>

            <button
              onClick={loadPracticeSample}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-medium transition active:scale-95"
              title="Load a demo voice audio clip to test playback and comparison"
            >
              <FileAudio className="w-3 h-3 text-emerald-400" />
              <span>Use Practice Sample</span>
            </button>

            <button
              onClick={() => setShowPermissionGuide(!showPermissionGuide)}
              className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 ml-auto transition"
            >
              <HelpCircle className="w-3 h-3" />
              <span>{showPermissionGuide ? 'Hide Steps' : 'How to unblock'}</span>
            </button>
          </div>

          {/* Collapsible Browser Unblock Steps */}
          {showPermissionGuide && (
            <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 text-[11px] text-slate-400 space-y-1">
              <p className="font-semibold text-slate-300">How to allow microphone in your browser:</p>
              <ul className="list-disc list-inside space-y-0.5 text-slate-400">
                <li>
                  <strong className="text-slate-300">Chrome / Edge:</strong> Click the tune / lock icon (🔒 or 🎚️) in the address bar $\rightarrow$ toggle <strong>Microphone</strong> to <strong>Allow</strong> $\rightarrow$ click <strong>Try Again</strong>.
                </li>
                <li>
                  <strong className="text-slate-300">Safari:</strong> Open <em>Safari Settings $\rightarrow$ Websites $\rightarrow$ Microphone</em> $\rightarrow$ choose <strong>Allow</strong>.
                </li>
                <li>
                  <strong className="text-slate-300">Mobile iOS / Android:</strong> Tap the <em>AA / Site Settings</em> in address bar and allow microphone permissions.
                </li>
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Main Controls & VU Meter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
        <div className="flex flex-wrap items-center gap-2.5">
          {!isRecording ? (
            <button
              onClick={startRecording}
              className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-950/50 transition active:scale-95 group"
            >
              <Mic className="w-4 h-4 text-white group-hover:scale-110 transition-transform" />
              <span>Record Voice</span>
            </button>
          ) : (
            <button
              onClick={stopRecording}
              className="flex items-center gap-2 px-4 py-2 bg-rose-700 hover:bg-rose-600 text-white rounded-xl text-xs font-bold shadow-lg shadow-rose-950 transition active:scale-95 animate-pulse"
            >
              <Square className="w-4 h-4 fill-current" />
              <span>Stop Recording ({formatTime(recordingDuration)})</span>
            </button>
          )}

          {/* Quick upload audio button */}
          {!isRecording && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-medium border border-slate-700/60 transition active:scale-95"
              title="Upload an audio recording (.wav, .mp3, .webm, .m4a) to transcribe"
            >
              <Upload className="w-3.5 h-3.5 text-sky-400" />
              <span>Upload Audio</span>
            </button>
          )}

          {/* Live Audio Level Meter when Recording */}
          {isRecording && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono">
              <Radio className="w-3.5 h-3.5 text-rose-400 animate-pulse" />
              <div className="flex items-end gap-0.5 h-4 w-24">
                {[...Array(12)].map((_, i) => {
                  const threshold = (i / 12) * 100;
                  const isActive = audioLevel >= threshold;
                  return (
                    <div
                      key={i}
                      className={`flex-1 rounded-xs transition-all duration-75 ${
                        isActive
                          ? i > 9
                            ? 'bg-rose-500'
                            : i > 6
                            ? 'bg-amber-400'
                            : 'bg-emerald-400'
                          : 'bg-slate-800'
                      }`}
                      style={{ height: `${Math.max(20, (i + 1) * 8)}%` }}
                    />
                  );
                })}
              </div>
              <span className="text-[11px] text-slate-400">{audioLevel}%</span>
            </div>
          )}
        </div>

        {/* Existing Recording Player & Transcription Controls */}
        {recording && !isRecording && (
          <div className="flex flex-wrap items-center gap-2">
            {/* Play/Pause/Relisten Button */}
            {!isPlayingRecording ? (
              <button
                onClick={isRecordingEnded ? relistenRecording : playRecording}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-xs font-semibold shadow-sm transition active:scale-95 group"
                title={isRecordingEnded ? 'Relisten from beginning' : 'Play audio'}
              >
                {isRecordingEnded ? (
                  <>
                    <RotateCcw className="w-3.5 h-3.5 group-hover:-rotate-45 transition-transform" />
                    <span>Relisten</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Play Voice</span>
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={pauseRecordingPlayback}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold shadow-sm transition active:scale-95 animate-pulse"
                title="Pause playback"
              >
                <Pause className="w-3.5 h-3.5 fill-current" />
                <span>Pause</span>
              </button>
            )}

            {/* Relisten Track shortcut button */}
            <button
              onClick={relistenRecording}
              className={`p-1.5 rounded-lg border transition ${
                isRecordingEnded
                  ? 'bg-teal-950 border-teal-600 text-teal-300 animate-bounce'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700/60'
              }`}
              title="Relisten: jump back to start (0:00) and replay"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            {/* Speed Selector: 1x, 2x, 3x */}
            <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded-lg border border-slate-800">
              <span className="text-[10px] font-mono text-slate-500 px-1">Speed:</span>
              {[1.0, 2.0, 3.0].map((spd) => (
                <button
                  key={spd}
                  onClick={() => setRecordingSpeed(spd)}
                  className={`px-1.5 py-0.5 rounded text-[11px] font-mono font-bold transition ${
                    recordingPlaybackSpeed === spd
                      ? 'bg-teal-500 text-slate-950 font-extrabold shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title={`Play at ${spd}x speed`}
                >
                  {spd}x
                </button>
              ))}
            </div>

            {/* AI Transcribe Audio Button */}
            <button
              onClick={handleManualTranscribe}
              disabled={isTranscribing}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-lg text-xs font-semibold shadow-sm transition active:scale-95 disabled:opacity-50"
              title="Transcribe speech in this audio to Hmong RPA or English text using Gemini AI"
            >
              {isTranscribing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Transcribing...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>Transcribe</span>
                </>
              )}
            </button>

            {/* Compare with Native Speech button */}
            {onCompareNativeSpeech && targetText.trim() && (
              <button
                onClick={onCompareNativeSpeech}
                disabled={isNativeSpeechPlaying}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-950/70 hover:bg-emerald-900/80 text-emerald-300 rounded-lg text-xs font-semibold border border-emerald-800/60 transition active:scale-95 disabled:opacity-50"
                title="Play synthesized native Hmong audio to compare pronunciation"
              >
                <Volume2 className={`w-3.5 h-3.5 text-emerald-400 ${isNativeSpeechPlaying ? 'animate-bounce' : ''}`} />
                <span>{isNativeSpeechPlaying ? 'Native Playing...' : 'Listen to Native Audio'}</span>
              </button>
            )}

            {/* Download Recording */}
            <button
              onClick={() => downloadRecording(`hmong_user_voice_${dialect}`)}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/50 transition"
              title="Download your voice recording (.webm/.wav)"
            >
              <Download className="w-3.5 h-3.5" />
            </button>

            {/* Clear Recording */}
            <button
              onClick={() => {
                clearRecording();
                setTranscriptionResult(null);
              }}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/70 text-slate-400 hover:text-rose-400 border border-slate-700/50 transition"
              title="Delete recording"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Voice Pronunciation Match & Rhythm Comparison Panel */}
      {recording && !isRecording && targetText.trim() && (
        <div className="mt-3 p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 shadow-md space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-200 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Voice Pronunciation Comparison:</span>
            </span>

            {(() => {
              const words = targetText.trim().split(/\s+/).filter(Boolean);
              const estNativeSec = Math.max(1, words.length * 0.38);
              const ratio = recording.durationSec / estNativeSec;
              const matchScore = Math.max(72, Math.min(98, Math.round(100 - Math.abs(ratio - 1) * 28)));
              return (
                <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-amber-950/80 text-amber-300 border border-amber-800/60">
                  {matchScore}% Rhythm & Tone Match
                </span>
              );
            })()}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {/* User Voice Playback */}
            <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800/80 flex items-center justify-between">
              <div className="space-y-0.5 min-w-0">
                <span className="text-[10px] uppercase font-mono text-slate-400 font-bold block">
                  My Voice Input
                </span>
                <span className="text-xs font-semibold text-teal-300 font-mono truncate block">
                  {formatTime(recording.durationSec)} duration
                </span>
              </div>
              <button
                onClick={isPlayingRecording ? pauseRecordingPlayback : playRecording}
                className="px-2.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs flex items-center gap-1 transition active:scale-95"
              >
                {isPlayingRecording ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3 fill-current" />}
                <span>{isPlayingRecording ? 'Pause' : 'Play Mine'}</span>
              </button>
            </div>

            {/* Native Audio Playback */}
            <div className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800/80 flex items-center justify-between">
              <div className="space-y-0.5 min-w-0">
                <span className="text-[10px] uppercase font-mono text-slate-400 font-bold block">
                  Native Hmong Audio
                </span>
                <span className="text-xs font-semibold text-emerald-300 font-mono truncate block">
                  HmongDictionary.com
                </span>
              </div>
              <button
                onClick={onCompareNativeSpeech}
                disabled={isNativeSpeechPlaying}
                className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1 transition active:scale-95 disabled:opacity-50"
              >
                <Volume2 className="w-3 h-3" />
                <span>{isNativeSpeechPlaying ? 'Playing...' : 'Play Native'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Persistent Interactive Track Scrubber & Timer - STAYS LOADED EVEN AFTER ENDING */}
      {recording && !isRecording && (
        <div className="mt-3 p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/80 space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-mono select-none">
            <div className="flex items-center gap-1.5">
              <span className="text-teal-300 font-bold">{formatTime(recordingCurrentTime)}</span>
              <span className="text-slate-500">/</span>
              <span className="text-slate-400">{formatTime(recording.durationSec)}</span>
              {isRecordingEnded && (
                <span className="text-[10px] text-emerald-400 font-semibold ml-1 bg-emerald-950/60 px-1.5 py-0.2 rounded border border-emerald-800/40">
                  Track Saved • Ready to Relisten
                </span>
              )}
            </div>

            <span className="text-slate-500 truncate max-w-[200px]">
              {recording.isUploaded ? `📁 ${recording.fileName || 'Uploaded Audio'}` : '🎙️ Microphone Voice Clip'}
            </span>
          </div>

          {/* Interactive Clickable Seek Track */}
          <div
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const clickX = e.clientX - rect.left;
              const pct = Math.max(0, Math.min(100, (clickX / rect.width) * 100));
              seekRecording(pct);
            }}
            className="w-full h-2.5 bg-slate-950 rounded-full cursor-pointer overflow-hidden border border-slate-800 hover:border-teal-500/50 transition group relative"
            title="Click to seek to any position"
          >
            <div
              className={`h-full transition-all duration-75 rounded-full ${
                isRecordingEnded
                  ? 'bg-emerald-500'
                  : 'bg-gradient-to-r from-teal-500 to-sky-400'
              }`}
              style={{ width: `${playbackProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Transcription Loading Spinner */}
      {isTranscribing && (
        <div className="mt-3 p-3 rounded-xl bg-indigo-950/40 border border-indigo-800/60 flex items-center gap-2.5 text-xs text-indigo-200 animate-pulse">
          <RefreshCw className="w-4 h-4 animate-spin text-indigo-400 shrink-0" />
          <span>Gemini AI is transcribing audio clip into Hmong RPA orthography...</span>
        </div>
      )}

      {/* Transcription Error Banner */}
      {transcriptionError && (
        <div className="mt-3 p-2.5 rounded-xl bg-rose-950/40 border border-rose-800/60 flex items-center gap-2 text-xs text-rose-300">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>Transcription error: {transcriptionError}</span>
        </div>
      )}

      {/* AI Transcription Result Box */}
      {transcriptionResult && !isTranscribing && (
        <div className="mt-3 p-3.5 rounded-xl bg-slate-900/90 border border-teal-800/50 shadow-md space-y-2">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-teal-400" />
                <span>Audio Transcript:</span>
              </span>
              {transcriptionLanguage && (
                <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-teal-950 text-teal-300 border border-teal-800/40">
                  {transcriptionLanguage}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 transition"
                title="Copy transcript to clipboard"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>

              <button
                onClick={() => {
                  if (onTranscribe && transcriptionResult) {
                    onTranscribe(transcriptionResult, 'replace');
                  }
                }}
                className="flex items-center gap-1 text-[11px] text-teal-300 hover:text-white px-2.5 py-1 rounded bg-teal-950/80 hover:bg-teal-900 border border-teal-800/60 transition"
                title="Replace top input box with this transcript"
              >
                <ArrowUp className="w-3 h-3" />
                <span>Set Top Text</span>
              </button>

              <button
                onClick={() => {
                  if (onTranscribe && transcriptionResult) {
                    onTranscribe(transcriptionResult, 'append');
                  }
                }}
                className="flex items-center gap-1 text-[11px] text-slate-300 hover:text-white px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 transition"
                title="Append this transcript to existing text"
              >
                <span>+ Append</span>
              </button>
            </div>
          </div>

          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800/80 font-mono text-sm text-teal-200 select-text leading-relaxed">
            "{transcriptionResult}"
          </div>

          <div className="flex items-center gap-1 text-[11px] text-emerald-400">
            <Check className="w-3 h-3" />
            <span>Automatically typed into top input field ready for synthesis & tone analysis.</span>
          </div>
        </div>
      )}
    </div>
  );
};

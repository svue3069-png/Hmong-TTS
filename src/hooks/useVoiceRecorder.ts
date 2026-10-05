/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * useVoiceRecorder
 * Production-ready microphone voice recording hook with live audio analysis,
 * duration timer, audio playback, speech-to-text dictation, file upload fallback,
 * and comprehensive browser/iframe permission error recovery.
 */

import { useState, useRef, useEffect, useCallback } from 'react';

export interface VoiceRecording {
  blob: Blob;
  url: string;
  durationSec: number;
  mimeType: string;
  timestamp: Date;
  isUploaded?: boolean;
  fileName?: string;
}

export interface UseVoiceRecorderOptions {
  onTranscript?: (text: string) => void;
  enableDictation?: boolean;
}

export type VoiceRecorderErrorType =
  | 'permission_denied'
  | 'device_not_found'
  | 'in_use'
  | 'unsupported'
  | 'general'
  | null;

export function useVoiceRecorder(options: UseVoiceRecorderOptions = {}) {
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [recordingDuration, setRecordingDuration] = useState<number>(0);
  const [audioLevel, setAudioLevel] = useState<number>(0); // 0 to 100
  const [recording, setRecording] = useState<VoiceRecording | null>(null);
  const [isPlayingRecording, setIsPlayingRecording] = useState<boolean>(false);
  const [playbackProgress, setPlaybackProgress] = useState<number>(0);
  const [recordingPlaybackSpeed, setRecordingPlaybackSpeed] = useState<number>(1.0);
  const [isRecordingEnded, setIsRecordingEnded] = useState<boolean>(false);
  const [recordingCurrentTime, setRecordingCurrentTime] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<VoiceRecorderErrorType>(null);
  const [isInsideIframe, setIsInsideIframe] = useState<boolean>(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<number | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const recognitionRef = useRef<any | null>(null);
  const recordingSpeedRef = useRef<number>(1.0);

  // Detect if running inside an iframe (e.g. AI Studio preview)
  useEffect(() => {
    try {
      setIsInsideIframe(window.self !== window.top);
    } catch (_) {
      setIsInsideIframe(true);
    }
  }, []);

  // Clean up all resources on unmount
  useEffect(() => {
    return () => {
      stopTracks();
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (audioElementRef.current) {
        audioElementRef.current.pause();
        audioElementRef.current = null;
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (_) {}
      }
    };
  }, []);

  const stopTracks = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const clearError = useCallback(() => {
    setErrorMessage(null);
    setErrorType(null);
  }, []);

  const startLevelMeter = (stream: MediaStream) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;
      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateMeter = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        const normalized = Math.min(100, Math.round((avg / 128) * 100));
        setAudioLevel(normalized);
        animFrameRef.current = requestAnimationFrame(updateMeter);
      };
      updateMeter();
    } catch (e) {
      console.warn('AudioContext level meter init warning:', e);
    }
  };

  const startRecording = useCallback(async () => {
    clearError();
    audioChunksRef.current = [];
    setRecordingDuration(0);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setErrorType('unsupported');
        throw new Error('Microphone access is not supported by your browser or secure HTTPS context.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      // Select supported audio mimeType
      const mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
        '',
      ];
      let selectedMime = '';
      for (const mime of mimeTypes) {
        if (mime === '' || MediaRecorder.isTypeSupported(mime)) {
          selectedMime = mime;
          break;
        }
      }

      const recorder = selectedMime
        ? new MediaRecorder(stream, { mimeType: selectedMime })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const finalBlob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });
        const url = URL.createObjectURL(finalBlob);
        setRecording({
          blob: finalBlob,
          url,
          durationSec: recordingDuration || 1,
          mimeType: recorder.mimeType || 'audio/webm',
          timestamp: new Date(),
        });
        stopTracks();
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        setAudioLevel(0);
      };

      recorder.start(100); // 100ms timeslices
      setIsRecording(true);
      setIsPaused(false);

      // Start level meter
      startLevelMeter(stream);

      // Start duration counter
      const startTimestamp = Date.now();
      timerIntervalRef.current = window.setInterval(() => {
        const sec = Math.floor((Date.now() - startTimestamp) / 1000);
        setRecordingDuration(sec);
      }, 500);

      // Optional live speech recognition dictation
      if (options.enableDictation && options.onTranscript) {
        const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRec) {
          try {
            const recognition = new SpeechRec();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.onresult = (evt: any) => {
              let transcript = '';
              for (let i = evt.resultIndex; i < evt.results.length; ++i) {
                transcript += evt.results[i][0].transcript;
              }
              if (transcript.trim() && options.onTranscript) {
                options.onTranscript(transcript);
              }
            };
            recognition.onerror = () => {};
            recognition.start();
            recognitionRef.current = recognition;
          } catch (_) {}
        }
      }
    } catch (err: any) {
      console.warn('Microphone start error:', err);
      setIsRecording(false);
      stopTracks();

      const name = err.name || '';
      const msg = err.message || '';

      if (
        name === 'NotAllowedError' ||
        name === 'PermissionDeniedError' ||
        name === 'SecurityError' ||
        msg.toLowerCase().includes('denied') ||
        msg.toLowerCase().includes('permission')
      ) {
        setErrorType('permission_denied');
        setErrorMessage(
          'Microphone permission was denied or blocked by your browser/iframe policy.'
        );
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        setErrorType('device_not_found');
        setErrorMessage('No microphone device found on your computer or headset.');
      } else if (name === 'NotReadableError' || name === 'TrackStartError') {
        setErrorType('in_use');
        setErrorMessage('Microphone is currently in use by another application or tab.');
      } else {
        setErrorType('general');
        setErrorMessage(msg || 'Could not access microphone.');
      }
    }
  }, [options, recordingDuration, clearError]);

  const stopRecording = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (_) {}
      recognitionRef.current = null;
    }
    setIsRecording(false);
    setIsPaused(false);
  }, []);

  const playRecording = useCallback(() => {
    if (!recording) return;

    if (!audioElementRef.current) {
      const audio = new Audio(recording.url);
      audioElementRef.current = audio;

      audio.ontimeupdate = () => {
        if (audio.duration) {
          setPlaybackProgress((audio.currentTime / audio.duration) * 100);
          setRecordingCurrentTime(audio.currentTime);
        }
      };

      // CRITICAL: When the recording ends, DO NOT DISAPPEAR the track!
      // The track stays loaded, ready for immediate relistening
      audio.onended = () => {
        setIsPlayingRecording(false);
        setIsRecordingEnded(true);
        setPlaybackProgress(100);
        if (audio.duration) setRecordingCurrentTime(audio.duration);
      };

      audio.onerror = (e) => {
        console.error('Audio playback error:', e);
        setIsPlayingRecording(false);
      };
    }

    const audio = audioElementRef.current;
    if (audio) {
      if (isRecordingEnded || (audio.duration && audio.currentTime >= audio.duration)) {
        audio.currentTime = 0;
        setPlaybackProgress(0);
        setRecordingCurrentTime(0);
        setIsRecordingEnded(false);
      }
      audio.playbackRate = recordingSpeedRef.current;
      audio.play()
        .then(() => {
          setIsPlayingRecording(true);
          setIsRecordingEnded(false);
        })
        .catch((err) => {
          console.error('Playback error:', err);
          setIsPlayingRecording(false);
        });
    }
  }, [recording, isRecordingEnded]);

  const pauseRecordingPlayback = useCallback(() => {
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      setIsPlayingRecording(false);
    }
  }, []);

  const relistenRecording = useCallback(() => {
    if (!recording) return;
    if (audioElementRef.current) {
      audioElementRef.current.currentTime = 0;
      setPlaybackProgress(0);
      setRecordingCurrentTime(0);
      setIsRecordingEnded(false);
      audioElementRef.current.playbackRate = recordingSpeedRef.current;
      audioElementRef.current.play()
        .then(() => setIsPlayingRecording(true))
        .catch(() => {});
    } else {
      playRecording();
    }
  }, [recording, playRecording]);

  const seekRecording = useCallback((percentage: number) => {
    if (audioElementRef.current && recording) {
      const clampedPct = Math.max(0, Math.min(100, percentage));
      const dur = audioElementRef.current.duration || recording.durationSec || 1;
      const targetTime = (clampedPct / 100) * dur;
      audioElementRef.current.currentTime = targetTime;
      setPlaybackProgress(clampedPct);
      setRecordingCurrentTime(targetTime);
      setIsRecordingEnded(false);
    }
  }, [recording]);

  const setRecordingSpeed = useCallback((speed: number) => {
    setRecordingPlaybackSpeed(speed);
    recordingSpeedRef.current = speed;
    if (audioElementRef.current) {
      audioElementRef.current.playbackRate = speed;
    }
  }, []);

  const clearRecording = useCallback(() => {
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current = null;
    }
    if (recording?.url) {
      URL.revokeObjectURL(recording.url);
    }
    setRecording(null);
    setRecordingDuration(0);
    setPlaybackProgress(0);
    setRecordingCurrentTime(0);
    setIsRecordingEnded(false);
    setIsPlayingRecording(false);
  }, [recording]);

  const downloadRecording = useCallback((filename = 'my_voice_recording') => {
    if (!recording) return;
    const a = document.createElement('a');
    a.href = recording.url;
    const ext = recording.mimeType.includes('ogg')
      ? 'ogg'
      : recording.mimeType.includes('wav')
      ? 'wav'
      : 'webm';
    a.download = `${filename}_${Date.now()}.${ext}`;
    a.click();
  }, [recording]);

  // Fallback: Load an audio file (drag-and-drop or file picker)
  const loadAudioFile = useCallback((file: File) => {
    clearError();
    if (recording?.url) {
      URL.revokeObjectURL(recording.url);
    }

    const url = URL.createObjectURL(file);
    const audio = new Audio(url);
    audio.onloadedmetadata = () => {
      const dur = Math.round(audio.duration) || 2;
      setRecording({
        blob: file,
        url,
        durationSec: dur,
        mimeType: file.type || 'audio/wav',
        timestamp: new Date(),
        isUploaded: true,
        fileName: file.name,
      });
      setRecordingDuration(dur);
    };
    audio.onerror = () => {
      setRecording({
        blob: file,
        url,
        durationSec: 3,
        mimeType: file.type || 'audio/wav',
        timestamp: new Date(),
        isUploaded: true,
        fileName: file.name,
      });
    };
  }, [clearError, recording]);

  // Fallback: Generate or load a sample voice recording for instant practice
  const loadPracticeSample = useCallback(() => {
    clearError();
    try {
      // Synthesize a clean 44.1kHz practice audio clip in memory
      const sampleRate = 44100;
      const durationSec = 1.8;
      const numSamples = Math.floor(sampleRate * durationSec);
      const audioBuffer = new AudioContext().createBuffer(1, numSamples, sampleRate);
      const channel = audioBuffer.getChannelData(0);

      // Acoustic wave simulating natural speech formants
      for (let i = 0; i < numSamples; i++) {
        const t = i / sampleRate;
        const env = Math.sin((Math.PI * t) / durationSec);
        const f0 = 160 + 20 * Math.sin(2 * Math.PI * 1.5 * t);
        const f1 = 650;
        const f2 = 1200;
        const voiceSignal =
          0.5 * Math.sin(2 * Math.PI * f0 * t) +
          0.3 * Math.sin(2 * Math.PI * f1 * t) +
          0.2 * Math.sin(2 * Math.PI * f2 * t);
        channel[i] = voiceSignal * env * 0.4;
      }

      // Convert buffer to WAV blob
      const bufferSize = 44 + numSamples * 2;
      const arrayBuffer = new ArrayBuffer(bufferSize);
      const view = new DataView(arrayBuffer);
      const writeStr = (offset: number, s: string) => {
        for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
      };

      writeStr(0, 'RIFF');
      view.setUint32(4, 36 + numSamples * 2, true);
      writeStr(8, 'WAVE');
      writeStr(12, 'fmt ');
      view.setUint32(16, 16, true);
      view.setUint16(20, 1, true);
      view.setUint16(22, 1, true);
      view.setUint32(24, sampleRate, true);
      view.setUint32(28, sampleRate * 2, true);
      view.setUint16(32, 2, true);
      view.setUint16(34, 16, true);
      writeStr(36, 'data');
      view.setUint32(40, numSamples * 2, true);

      let offset = 44;
      for (let i = 0; i < numSamples; i++) {
        const s = Math.max(-1, Math.min(1, channel[i]));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
        offset += 2;
      }

      const sampleBlob = new Blob([arrayBuffer], { type: 'audio/wav' });
      const url = URL.createObjectURL(sampleBlob);

      setRecording({
        blob: sampleBlob,
        url,
        durationSec: 2,
        mimeType: 'audio/wav',
        timestamp: new Date(),
        isUploaded: false,
        fileName: 'practice_voice_sample.wav',
      });
      setRecordingDuration(2);
    } catch (e) {
      console.error('Generate practice sample error:', e);
    }
  }, [clearError]);

  return {
    isRecording,
    isPaused,
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
  };
}

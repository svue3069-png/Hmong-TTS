/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * useStudioAudioPlayer
 * Robust audio player hook providing Play, Pause, Speed (1x, 2x, 3x), Seeking,
 * persistent track retention after playback ends, and millisecond-accurate
 * Hmong syllable karaoke synchronization.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { hmongTTS, HMONG_VOICE_PROFILES, VoiceProfile } from '../engine/hmongAudioSynthesizer';
import { HmongDialect, parseHmongText, SyllableDecomposition } from '../engine/hmongPhonology';
import { detectLanguage, DetectionResult } from '../engine/languageDetector';
import { webSpeech } from '../engine/webSpeechEngine';
import { taskCoordinator } from '../engine/taskCoordinator';

export interface AudioTrackMetadata {
  id: string;
  text: string;
  dialect: HmongDialect;
  engine: 'hmong_dsp' | 'web_speech' | 'hmongdictionary_native';
  audioSource?: 'hmongdictionary_native' | 'hmong_dsp';
  voice: VoiceProfile;
  url: string;
  blob?: Blob;
  durationSec: number;
  alignment: Array<{
    index: number;
    token: string;
    clean: string;
    timeStartSec: number;
    timeEndSec: number;
    durationMs: number;
  }>;
  createdAt: Date;
}

export interface UseStudioAudioPlayerOptions {
  onWordHighlight?: (wordIndex: number | null) => void;
  onTrackLoaded?: (track: AudioTrackMetadata) => void;
}

export function useStudioAudioPlayer(options: UseStudioAudioPlayerOptions = {}) {
  const [track, setTrack] = useState<AudioTrackMetadata | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [isEnded, setIsEnded] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [currentWordIdx, setCurrentWordIdx] = useState<number | null>(null);
  const [isLooping, setIsLooping] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(1.0);
  const [isSynthesizing, setIsSynthesizing] = useState<boolean>(false);

  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const trackRef = useRef<AudioTrackMetadata | null>(null);
  const isLoopingRef = useRef<boolean>(false);
  const speedRef = useRef<number>(1.0);

  trackRef.current = track;
  isLoopingRef.current = isLooping;
  speedRef.current = playbackSpeed;

  // Register with taskCoordinator to immediately stop on tab change or window blur
  useEffect(() => {
    const unregister = taskCoordinator.registerStopHandler('studio_player', () => {
      if (audioElementRef.current && !audioElementRef.current.paused) {
        audioElementRef.current.pause();
        setIsPlaying(false);
        setIsPaused(true);
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      }
    });

    return () => {
      unregister();
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (audioElementRef.current) {
        safelyTeardownAudioElement(audioElementRef.current);
        audioElementRef.current = null;
      }
    };
  }, []);

  // Update syllable highlight based on current playback timestamp
  const updateKaraokeHighlight = useCallback((time: number, currentTrack: AudioTrackMetadata | null) => {
    if (!currentTrack || currentTrack.alignment.length === 0) {
      setCurrentWordIdx(null);
      options.onWordHighlight?.(null);
      return;
    }

    const matched = currentTrack.alignment.find(
      (a) => time >= a.timeStartSec && time <= a.timeEndSec
    );

    if (matched) {
      setCurrentWordIdx(matched.index);
      options.onWordHighlight?.(matched.index);
    } else {
      // If between syllables or at pause, keep last or clear
      if (time >= currentTrack.durationSec) {
        setCurrentWordIdx(null);
        options.onWordHighlight?.(null);
      }
    }
  }, [options]);

  // Continuous animation frame sync for ultra-smooth timeline slider
  const startProgressTracking = useCallback(() => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

    const trackProgress = () => {
      const audio = audioElementRef.current;
      if (audio && !audio.paused) {
        const cur = audio.currentTime;
        setCurrentTime(cur);
        updateKaraokeHighlight(cur, trackRef.current);
        animFrameRef.current = requestAnimationFrame(trackProgress);
      }
    };

    animFrameRef.current = requestAnimationFrame(trackProgress);
  }, [updateKaraokeHighlight]);

function safelyTeardownAudioElement(audio: HTMLAudioElement | null) {
  if (!audio) return;
  try {
    audio.pause();
    audio.onplay = null;
    audio.onpause = null;
    audio.ontimeupdate = null;
    audio.onended = null;
    audio.onerror = null;
    audio.oncanplay = null;
    audio.onloadedmetadata = null;
    audio.removeAttribute('src');
    audio.load();
  } catch {
    // Ignore teardown errors
  }
}

  // Setup HTMLAudioElement with event handlers
  const setupAudioElement = useCallback((url: string, targetTrack: AudioTrackMetadata) => {
    if (audioElementRef.current) {
      safelyTeardownAudioElement(audioElementRef.current);
      audioElementRef.current = null;
    }

    const audio = new Audio(url);
    audio.playbackRate = speedRef.current;
    audio.volume = volume;
    audio.loop = isLoopingRef.current;
    audioElementRef.current = audio;

    audio.onplay = () => {
      setIsPlaying(true);
      setIsPaused(false);
      setIsEnded(false);
      startProgressTracking();
    };

    audio.onpause = () => {
      if (!audio.ended) {
        setIsPlaying(false);
        setIsPaused(true);
      }
    };

    audio.ontimeupdate = () => {
      if (audio && audioElementRef.current === audio) {
        setCurrentTime(audio.currentTime);
        updateKaraokeHighlight(audio.currentTime, targetTrack);
      }
    };

    // CRITICAL: When the track ends, DO NOT DISAPPEAR!
    // The track stays loaded on screen, ready for immediate relistening
    audio.onended = () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (isLoopingRef.current) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
        return;
      }

      setIsPlaying(false);
      setIsPaused(false);
      setIsEnded(true);
      setCurrentTime(audio.duration || targetTrack.durationSec);
      setCurrentWordIdx(null);
      options.onWordHighlight?.(null);
      taskCoordinator.notifyTaskEnded('studio_player');
    };

    audio.onerror = () => {
      // Ignore if this audio instance has been superseded or unloaded
      if (!audio || audioElementRef.current !== audio || !audio.src) {
        return;
      }
      const mediaErr = audio.error;
      // MEDIA_ERR_ABORTED (code 1) is benign user interruption
      if (mediaErr && mediaErr.code === 1) {
        return;
      }
      setIsPlaying(false);
      setIsPaused(false);
      const detail = mediaErr
        ? `Code ${mediaErr.code}: ${mediaErr.message || 'Media source error'}`
        : 'Playback interrupted';
      console.warn('Audio playback status:', detail);
    };

    return audio;
  }, [volume, startProgressTracking, updateKaraokeHighlight, options]);

  // Synthesize new speech track or prepare audio
  const loadTrack = useCallback(async (
    text: string,
    dialect: HmongDialect = 'dawb',
    optionsConfig: {
      voice?: VoiceProfile;
      rate?: number;
      pitch?: number;
      toneEmphasis?: number;
      prosody?: number;
      audioSource?: 'hmongdictionary_native' | 'hmong_dsp';
      engineMode?: 'auto' | 'hmong_dawb' | 'hmong_leeg' | 'english';
    } = {}
  ): Promise<AudioTrackMetadata | null> => {
    if (!text.trim()) return null;

    setIsSynthesizing(true);
    try {
      const detection = detectLanguage(text);
      const isEnglish =
        optionsConfig.engineMode === 'english' ||
        (optionsConfig.engineMode === 'auto' && detection.language === 'english');

      const voice = optionsConfig.voice || HMONG_VOICE_PROFILES[0];
      const rate = optionsConfig.rate || 1.0;
      const pitch = optionsConfig.pitch || 1.0;
      const toneEmphasis = optionsConfig.toneEmphasis || 1.0;
      const prosody = optionsConfig.prosody !== undefined ? optionsConfig.prosody : 1.0;
      const audioSource = optionsConfig.audioSource || 'hmongdictionary_native';

      if (!isEnglish) {
        // Synthesize via native Hmong speech (HmongDictionary.com authentic recorded voice)
        const { buffer, alignment, totalDuration } =
          await hmongTTS.renderToAudioBuffer(text, dialect, {
            voice,
            rate,
            pitch,
            toneEmphasis,
            prosody,
            audioSource,
          });

        const wavBlob = hmongTTS.encodeWav(buffer);
        const url = URL.createObjectURL(wavBlob);

        const newTrack: AudioTrackMetadata = {
          id: `track_${Date.now()}`,
          text,
          dialect,
          engine: audioSource === 'hmongdictionary_native' ? 'hmongdictionary_native' : 'hmong_dsp',
          audioSource,
          voice,
          url,
          blob: wavBlob,
          durationSec: totalDuration,
          alignment: alignment.map((a) => ({
            index: a.index,
            token: a.token,
            clean: a.clean,
            timeStartSec: a.timeStartSec,
            timeEndSec: a.timeEndSec,
            durationMs: a.durationMs,
          })),
          createdAt: new Date(),
        };

        setTrack(newTrack);
        setDuration(totalDuration);
        setCurrentTime(0);
        setIsEnded(false);
        setIsPaused(false);

        setupAudioElement(url, newTrack);
        options.onTrackLoaded?.(newTrack);

        return newTrack;
      } else {
        // Fallback or English Web Speech tracking
        const words = text.split(/\s+/).filter(Boolean);
        const estDuration = Math.max(1, (words.length * 0.38) / rate);

        // Render synthetic preview tone or prepare timing alignment
        const syntheticAlignment = words.map((w, idx) => {
          const start = (idx * 0.38) / rate;
          const end = ((idx + 1) * 0.38) / rate;
          return {
            index: idx,
            token: w,
            clean: w.replace(/[^a-zA-Z]/g, ''),
            timeStartSec: start,
            timeEndSec: end,
            durationMs: Math.round(((end - start) * 1000)),
          };
        });

        // Synthesize standard speech WAV via hmongTTS or server fallback for consistent audio player
        const { buffer, alignment } = await hmongTTS.renderToAudioBuffer(text, 'dawb', {
          voice,
          rate,
          pitch,
        });
        const wavBlob = hmongTTS.encodeWav(buffer);
        const url = URL.createObjectURL(wavBlob);

        const newTrack: AudioTrackMetadata = {
          id: `track_en_${Date.now()}`,
          text,
          dialect: 'dawb',
          engine: 'web_speech',
          voice,
          url,
          blob: wavBlob,
          durationSec: estDuration,
          alignment: syntheticAlignment,
          createdAt: new Date(),
        };

        setTrack(newTrack);
        setDuration(estDuration);
        setCurrentTime(0);
        setIsEnded(false);
        setIsPaused(false);

        setupAudioElement(url, newTrack);
        options.onTrackLoaded?.(newTrack);

        return newTrack;
      }
    } catch (err) {
      console.error('Track synthesis error:', err);
      return null;
    } finally {
      setIsSynthesizing(false);
    }
  }, [options, setupAudioElement]);

  // Play current track
  const play = useCallback(async () => {
    if (!audioElementRef.current) {
      if (track?.url) {
        setupAudioElement(track.url, track);
      } else {
        return;
      }
    }

    const audio = audioElementRef.current;
    if (!audio) return;

    // If ended, relisten from beginning
    if (isEnded || audio.currentTime >= audio.duration) {
      audio.currentTime = 0;
      setCurrentTime(0);
      setIsEnded(false);
    }

    audio.playbackRate = speedRef.current;
    try {
      taskCoordinator.notifyTaskStarted('studio_player');
      await audio.play();
      setIsPlaying(true);
      setIsPaused(false);
      setIsEnded(false);
    } catch (e) {
      taskCoordinator.notifyTaskEnded('studio_player');
      console.warn('Playback error:', e);
    }
  }, [isEnded, track, setupAudioElement]);

  // Pause playback
  const pause = useCallback(() => {
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      setIsPlaying(false);
      setIsPaused(true);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      taskCoordinator.notifyTaskEnded('studio_player');
    }
  }, []);

  // Stop playback completely and reset to 0:00
  const stop = useCallback(() => {
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.currentTime = 0;
    }
    setIsPlaying(false);
    setIsPaused(false);
    setCurrentTime(0);
    setCurrentWordIdx(null);
    options.onWordHighlight?.(null);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    taskCoordinator.notifyTaskEnded('studio_player');
  }, [options]);

  // Toggle Play / Pause
  const togglePlayPause = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, pause, play]);

  // Relisten: jumps back to 0:00 and plays
  const relisten = useCallback(async () => {
    if (!audioElementRef.current && track?.url) {
      setupAudioElement(track.url, track);
    }

    const audio = audioElementRef.current;
    if (!audio) return;

    audio.currentTime = 0;
    setCurrentTime(0);
    setIsEnded(false);
    audio.playbackRate = speedRef.current;

    try {
      taskCoordinator.notifyTaskStarted('studio_player');
      await audio.play();
      setIsPlaying(true);
      setIsPaused(false);
    } catch (e) {
      taskCoordinator.notifyTaskEnded('studio_player');
      console.warn('Relisten error:', e);
    }
  }, [track, setupAudioElement]);

  // Seek to specific time (seconds)
  const seek = useCallback((timeSec: number) => {
    const audio = audioElementRef.current;
    const clampedTime = Math.max(0, Math.min(timeSec, duration || 0));
    setCurrentTime(clampedTime);
    setIsEnded(false);

    if (audio) {
      audio.currentTime = clampedTime;
    }
    updateKaraokeHighlight(clampedTime, trackRef.current);
  }, [duration, updateKaraokeHighlight]);

  // Skip relative seconds (+5s or -5s)
  const skipSeconds = useCallback((offsetSec: number) => {
    const nextTime = currentTime + offsetSec;
    seek(nextTime);
  }, [currentTime, seek]);

  // Change playback speed: 0.5x, 1x, 1.5x, 2x, 3x
  const setSpeed = useCallback((newSpeed: number) => {
    setPlaybackSpeed(newSpeed);
    speedRef.current = newSpeed;
    if (audioElementRef.current) {
      audioElementRef.current.playbackRate = newSpeed;
    }
  }, []);

  // Toggle repeat / loop
  const toggleLoop = useCallback(() => {
    setIsLooping((prev) => {
      const next = !prev;
      isLoopingRef.current = next;
      if (audioElementRef.current) {
        audioElementRef.current.loop = next;
      }
      return next;
    });
  }, []);

  // Change volume
  const setAudioVolume = useCallback((newVol: number) => {
    const clamped = Math.max(0, Math.min(1, newVol));
    setVolume(clamped);
    if (audioElementRef.current) {
      audioElementRef.current.volume = clamped;
    }
  }, []);

  // Download track WAV
  const downloadTrackWav = useCallback((filename = 'hmong_speech') => {
    if (!track) return;
    const a = document.createElement('a');
    a.href = track.url;
    a.download = `${filename}_${track.dialect}_${Date.now()}.wav`;
    a.click();
  }, [track]);

  // Clear track and reset player to blank
  const clearTrack = useCallback(() => {
    if (audioElementRef.current) {
      safelyTeardownAudioElement(audioElementRef.current);
      audioElementRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (track?.url) {
      try {
        URL.revokeObjectURL(track.url);
      } catch (_) {}
    }
    setTrack(null);
    setIsPlaying(false);
    setIsPaused(false);
    setIsEnded(false);
    setCurrentTime(0);
    setDuration(0);
    setCurrentWordIdx(null);
    options.onWordHighlight?.(null);
  }, [track, options]);

  // Teardown on unmount
  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (audioElementRef.current) {
        safelyTeardownAudioElement(audioElementRef.current);
        audioElementRef.current = null;
      }
    };
  }, []);

  return {
    track,
    isPlaying,
    isPaused,
    isEnded,
    currentTime,
    duration,
    playbackSpeed,
    currentWordIdx,
    isLooping,
    volume,
    isSynthesizing,
    loadTrack,
    play,
    pause,
    stop,
    togglePlayPause,
    relisten,
    seek,
    skipSeconds,
    setSpeed,
    toggleLoop,
    setAudioVolume,
    downloadTrackWav,
    clearTrack,
  };
}

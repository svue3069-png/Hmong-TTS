/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Multilingual Speech Coordinator
 * Automatically identifies input language (Hmong vs English) and routes speech synthesis
 * to either the native HmongTTS acoustic engine or the browser Web Speech API.
 */

import { hmongTTS, HMONG_VOICE_PROFILES, VoiceProfile, AudioSource } from './hmongAudioSynthesizer';
import { webSpeech } from './webSpeechEngine';
import { classifyWord, detectLanguage, DetectionResult } from './languageDetector';
import { HmongDialect } from './hmongPhonology';

export type SpeechEngineMode = 'auto' | 'hmong_dawb' | 'hmong_leeg' | 'english';
export type ActiveEngineType = 'hmong_dsp' | 'web_speech' | 'hmongdictionary_native' | 'orpheus_neural';

export interface MultilingualSpeechOptions {
  mode?: SpeechEngineMode;
  hmongVoice?: VoiceProfile;
  rate?: number;
  pitch?: number;
  toneEmphasis?: number;
  prosody?: number;
  volume?: number;
  audioSource?: AudioSource;
  onStart?: (engine: ActiveEngineType, detected: DetectionResult) => void;
  onWord?: (index: number, token: string, engine: ActiveEngineType) => void;
  onEnd?: () => void;
  onError?: (err: Error) => void;
}

export class MultilingualCoordinator {
  private activeEngine: ActiveEngineType | null = null;
  private isSpeaking = false;
  private requestId = 0;
  private cancelMixedSegment: (() => void) | null = null;

  public stop(): void {
    // Invalidate callbacks from the previous engine before stopping it. Some
    // browser engines deliver their end/error callback asynchronously.
    this.requestId += 1;
    this.cancelMixedSegment?.();
    this.cancelMixedSegment = null;
    hmongTTS.stop();
    webSpeech.stop();
    this.isSpeaking = false;
    this.activeEngine = null;
  }

  public isBusy(): boolean {
    return this.isSpeaking || hmongTTS.isBusy() || webSpeech.isBusy();
  }

  public getActiveEngine(): ActiveEngineType | null {
    return this.activeEngine;
  }

  private splitMixedText(text: string): Array<{ language: 'hmong' | 'english'; text: string }> {
    const parts = text.match(/[A-Za-z]+(?:['’-][A-Za-z]+)*|\s+|[^A-Za-z\s]+/g) || [text];
    const segments: Array<{ language: 'hmong' | 'english'; text: string }> = [];
    let current: { language: 'hmong' | 'english'; text: string } | null = null;

    for (const part of parts) {
      const word = part.toLowerCase().replace(/[^a-z]/g, '');
      if (!word) {
        if (current) current.text += part;
        else if (segments.length === 0) segments.push({ language: 'hmong', text: part });
        else segments[segments.length - 1].text += part;
        continue;
      }

      const language = classifyWord(word).lang === 'english' ? 'english' : 'hmong';
      if (!current || current.language !== language) {
        if (current) segments.push({ ...current, text: current.text.trim() });
        current = { language, text: part };
      } else {
        current.text += part;
      }
    }

    if (current) segments.push({ ...current, text: current.text.trim() });
    return segments.filter((segment) => segment.text.length > 0);
  }

  private async speakMixed(
    text: string,
    dialect: HmongDialect,
    options: MultilingualSpeechOptions,
    isCurrentRequest: () => boolean,
  ): Promise<void> {
    let wordOffset = 0;
    const voice = options.hmongVoice || (dialect === 'leeg' ? HMONG_VOICE_PROFILES[2] : HMONG_VOICE_PROFILES[0]);

    for (const segment of this.splitMixedText(text)) {
      if (!isCurrentRequest()) return;
      const segmentOffset = wordOffset;
      const segmentWordCount = segment.text.split(/\s+/).filter(Boolean).length;

      await new Promise<void>((resolve, reject) => {
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          this.cancelMixedSegment = null;
          resolve();
        };
        const fail = (error: Error) => {
          if (settled) return;
          settled = true;
          this.cancelMixedSegment = null;
          if (isCurrentRequest() && options.onError) options.onError(error);
          reject(error);
        };
        this.cancelMixedSegment = finish;

        if (segment.language === 'english') {
          void webSpeech.speak(segment.text, {
            rate: options.rate !== undefined ? options.rate : 1.0,
            pitch: options.pitch !== undefined ? options.pitch : 1.0,
            volume: options.volume !== undefined ? options.volume : 1.0,
            lang: 'en-US',
            onWord: (idx, word) => {
              if (isCurrentRequest() && options.onWord) options.onWord(segmentOffset + idx, word, 'web_speech');
            },
            onEnd: finish,
            onError: fail,
          }).catch(fail);
        } else {
          void hmongTTS.speak(segment.text, dialect, {
            voice,
            rate: options.rate,
            pitch: options.pitch,
            toneEmphasis: options.toneEmphasis,
            prosody: options.prosody,
            volume: options.volume,
            audioSource: options.audioSource || 'hmongdictionary_native',
            onSyllable: (idx, syl) => {
              if (isCurrentRequest() && options.onWord) options.onWord(segmentOffset + idx, syl.clean || syl.raw, 'hmongdictionary_native');
            },
            onEnd: finish,
            onError: fail,
          });
        }
      });

      wordOffset += segmentWordCount;
    }
  }

  /**
   * Automatically detects language and routes speech synthesis.
   */
  public async speak(
    text: string,
    options: MultilingualSpeechOptions = {}
  ): Promise<{ engine: ActiveEngineType; detection: DetectionResult }> {
    const normalizedText = text.trim();
    if (!normalizedText) {
      throw new Error('Speech text must contain at least one non-whitespace character.');
    }

    this.stop();
    const requestId = this.requestId;
    const isCurrentRequest = () => requestId === this.requestId;
    const detection = detectLanguage(normalizedText);
    const mode = options.mode || 'auto';

    // Determine target engine
    const hmongEngineChoice: ActiveEngineType = options.audioSource === 'hmong_dsp' ? 'hmong_dsp' : 'hmongdictionary_native';
    let targetEngine: ActiveEngineType = hmongEngineChoice;
    let targetDialect: HmongDialect = detection.detectedDialect || 'dawb';

    if (mode === 'english') {
      targetEngine = 'web_speech';
    } else if (mode === 'hmong_dawb') {
      targetEngine = hmongEngineChoice;
      targetDialect = 'dawb';
    } else if (mode === 'hmong_leeg') {
      targetEngine = hmongEngineChoice;
      targetDialect = 'leeg';
    } else {
      // mode === 'auto'
      if (detection.language === 'english') {
        targetEngine = 'web_speech';
      } else {
        targetEngine = hmongEngineChoice;
        targetDialect = detection.detectedDialect || 'dawb';
      }
    }

    this.activeEngine = targetEngine;
    this.isSpeaking = true;

    if (options.onStart) {
      options.onStart(targetEngine, detection);
    }

    try {
      if (mode === 'auto' && detection.language === 'mixed') {
        await this.speakMixed(normalizedText, targetDialect, options, isCurrentRequest);
        if (isCurrentRequest()) {
          this.isSpeaking = false;
          this.activeEngine = null;
          if (options.onEnd) options.onEnd();
        }
      } else if (targetEngine === 'web_speech') {
        await webSpeech.speak(normalizedText, {
          rate: options.rate !== undefined ? options.rate : 1.0,
          pitch: options.pitch !== undefined ? options.pitch : 1.0,
          volume: options.volume !== undefined ? options.volume : 1.0,
          onWord: (idx, word) => {
            if (isCurrentRequest() && options.onWord) options.onWord(idx, word, 'web_speech');
          },
          onEnd: () => {
            if (!isCurrentRequest()) return;
            this.isSpeaking = false;
            this.activeEngine = null;
            if (options.onEnd) options.onEnd();
          },
          onError: (err) => {
            if (!isCurrentRequest()) return;
            this.isSpeaking = false;
            this.activeEngine = null;
            if (options.onError) options.onError(err);
          },
        });
      } else {
        // Hmong Voice Engine (Authentic Native Audio from HmongDictionary.com or DSP)
        const voice = options.hmongVoice || (targetDialect === 'leeg' ? HMONG_VOICE_PROFILES[2] : HMONG_VOICE_PROFILES[0]);
        await hmongTTS.speak(normalizedText, targetDialect, {
          voice,
          rate: options.rate,
          pitch: options.pitch,
          toneEmphasis: options.toneEmphasis,
          prosody: options.prosody,
          volume: options.volume,
          audioSource: options.audioSource || 'hmongdictionary_native',
          onSyllable: (idx, syl) => {
            if (isCurrentRequest() && options.onWord) options.onWord(idx, syl.clean || syl.raw, targetEngine);
          },
          onEnd: () => {
            if (!isCurrentRequest()) return;
            this.isSpeaking = false;
            this.activeEngine = null;
            if (options.onEnd) options.onEnd();
          },
          onError: (err) => {
            if (!isCurrentRequest()) return;
            this.isSpeaking = false;
            this.activeEngine = null;
            if (options.onError) options.onError(err);
          },
        });
      }
    } catch (err) {
      if (isCurrentRequest()) {
        this.isSpeaking = false;
        this.activeEngine = null;
      }
      throw err;
    }

    return { engine: targetEngine, detection };
  }
}

// Global Singleton
export const speechCoordinator = new MultilingualCoordinator();

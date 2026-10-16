/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Multilingual Speech Coordinator
 * Automatically identifies input language (Hmong vs English) and routes speech synthesis
 * to either the native HmongTTS acoustic engine or the browser Web Speech API.
 */

import { hmongTTS, HMONG_VOICE_PROFILES, VoiceProfile, AudioSource } from './hmongAudioSynthesizer';
import { webSpeech, WebSpeechOptions } from './webSpeechEngine';
import { detectLanguage, DetectionResult, DetectedLanguage } from './languageDetector';
import { HmongDialect, parseHmongText, SyllableDecomposition } from './hmongPhonology';

export type SpeechEngineMode = 'auto' | 'hmong_dawb' | 'hmong_leeg' | 'english';
export type ActiveEngineType = 'hmong_dsp' | 'web_speech' | 'hmongdictionary_native' | 'orpheus_neural' | 'nouai_cloud';

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

  public stop(): void {
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

  /**
   * Automatically detects language and routes speech synthesis.
   */
  public async speak(
    text: string,
    options: MultilingualSpeechOptions = {}
  ): Promise<{ engine: ActiveEngineType; detection: DetectionResult }> {
    this.stop();

    const detection = detectLanguage(text);
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
      if (targetEngine === 'web_speech') {
        await webSpeech.speak(text, {
          rate: options.rate !== undefined ? options.rate : 1.0,
          pitch: options.pitch !== undefined ? options.pitch : 1.0,
          volume: options.volume !== undefined ? options.volume : 1.0,
          onWord: (idx, word) => {
            if (options.onWord) options.onWord(idx, word, 'web_speech');
          },
          onEnd: () => {
            this.isSpeaking = false;
            this.activeEngine = null;
            if (options.onEnd) options.onEnd();
          },
          onError: (err) => {
            this.isSpeaking = false;
            this.activeEngine = null;
            if (options.onError) options.onError(err);
          },
        });
      } else {
        // Hmong Voice Engine (Authentic Native Audio from HmongDictionary.com or DSP)
        const voice = options.hmongVoice || (targetDialect === 'leeg' ? HMONG_VOICE_PROFILES[2] : HMONG_VOICE_PROFILES[0]);
        await hmongTTS.speak(text, targetDialect, {
          voice,
          rate: options.rate,
          pitch: options.pitch,
          toneEmphasis: options.toneEmphasis,
          prosody: options.prosody,
          volume: options.volume,
          audioSource: options.audioSource || 'hmongdictionary_native',
          onSyllable: (idx, syl) => {
            if (options.onWord) options.onWord(idx, syl.clean || syl.raw, targetEngine);
          },
          onEnd: () => {
            this.isSpeaking = false;
            this.activeEngine = null;
            if (options.onEnd) options.onEnd();
          },
          onError: (err) => {
            this.isSpeaking = false;
            this.activeEngine = null;
            if (options.onError) options.onError(err);
          },
        });
      }
    } catch (err) {
      this.isSpeaking = false;
      this.activeEngine = null;
      throw err;
    }

    return { engine: targetEngine, detection };
  }
}

// Global Singleton
export const speechCoordinator = new MultilingualCoordinator();

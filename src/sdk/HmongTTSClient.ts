/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * HmongTTSClient - Developer Client SDK for Web & Node.js
 */

import { HmongDialect, parseHmongText, SyllableDecomposition } from '../engine/hmongPhonology';
import { HmongAcousticEngine, HMONG_VOICE_PROFILES, VoiceProfile, SynthesisMetadataExport } from '../engine/hmongAudioSynthesizer';
import { detectLanguage, DetectionResult } from '../engine/languageDetector';
import { webSpeech } from '../engine/webSpeechEngine';

export interface ClientConfig {
  dialect?: HmongDialect;
  voiceId?: string;
  offlineOnly?: boolean;
  rate?: number;
  pitch?: number;
  autoDetect?: boolean;
  apiEndpoint?: string;
}

export class HmongTTSClient {
  private config: Required<ClientConfig>;
  private engine: HmongAcousticEngine;

  constructor(options: ClientConfig = {}) {
    this.config = {
      dialect: options.dialect || 'dawb',
      voiceId: options.voiceId || 'paj_dawb_female',
      offlineOnly: options.offlineOnly !== undefined ? options.offlineOnly : true,
      rate: options.rate || 1.0,
      pitch: options.pitch || 1.0,
      autoDetect: options.autoDetect !== undefined ? options.autoDetect : false,
      apiEndpoint: options.apiEndpoint || '/api/tts/synthesize',
    };
    this.engine = new HmongAcousticEngine();
  }

  public detect(text: string): DetectionResult {
    return detectLanguage(text);
  }

  public getVoice(): VoiceProfile {
    const found = HMONG_VOICE_PROFILES.find(v => v.id === this.config.voiceId);
    return found || HMONG_VOICE_PROFILES[0];
  }

  public getAvailableVoices(): VoiceProfile[] {
    return [...HMONG_VOICE_PROFILES];
  }

  public setDialect(dialect: HmongDialect) {
    this.config.dialect = dialect;
  }

  public setVoice(voiceId: string) {
    this.config.voiceId = voiceId;
  }

  /**
   * Speaks the provided text immediately, with optional automatic Hmong vs English routing.
   */
  public async speak(
    text: string,
    callbacks?: {
      onWord?: (index: number, syllableOrWord: any) => void;
      onStart?: (engine: 'hmong_dsp' | 'web_speech') => void;
      onEnd?: () => void;
      onError?: (err: Error) => void;
    }
  ): Promise<void> {
    if (this.config.autoDetect) {
      const detection = this.detect(text);
      if (detection.language === 'english') {
        if (callbacks?.onStart) callbacks.onStart('web_speech');
        return webSpeech.speak(text, {
          rate: this.config.rate,
          pitch: this.config.pitch,
          onWord: (idx, word) => callbacks?.onWord?.(idx, { clean: word, raw: word }),
          onEnd: callbacks?.onEnd,
          onError: callbacks?.onError,
        });
      }
    }

    if (callbacks?.onStart) callbacks.onStart('hmong_dsp');
    const voice = this.getVoice();
    return this.engine.speak(text, this.config.dialect, {
      voice,
      rate: this.config.rate,
      pitch: this.config.pitch,
      onStart: () => {},
      onSyllable: callbacks?.onWord,
      onEnd: callbacks?.onEnd,
      onError: callbacks?.onError,
    });
  }

  /**
   * Generates a downloadable or playable WAV audio blob offline.
   */
  public async synthesizeToWav(text: string): Promise<Blob> {
    const voice = this.getVoice();
    const { buffer } = await this.engine.renderToAudioBuffer(text, this.config.dialect, {
      voice,
      rate: this.config.rate,
      pitch: this.config.pitch,
    });
    return this.engine.encodeWav(buffer);
  }

  /**
   * Generates sample-accurate timing and phonetic metadata (IPA and tone alignment).
   */
  public async getMetadata(text: string): Promise<SynthesisMetadataExport> {
    const voice = this.getVoice();
    return this.engine.generateMetadata(text, this.config.dialect, {
      voice,
      rate: this.config.rate,
      pitch: this.config.pitch,
    });
  }

  /**
   * Analyzes text into Hmong RPA syllables, tone contours, and IPA.
   */
  public phonemize(text: string): SyllableDecomposition[] {
    return parseHmongText(text, this.config.dialect);
  }

  public stop() {
    this.engine.stop();
  }

  public isSpeaking(): boolean {
    return this.engine.isBusy();
  }
}

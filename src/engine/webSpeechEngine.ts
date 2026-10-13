/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Web Speech API Engine (Browser Native Speech Synthesis)
 * Fallback and multilingual engine for English and standard browser languages.
 */

export interface WebSpeechOptions {
  rate?: number;
  pitch?: number;
  volume?: number;
  lang?: string;
  voiceURI?: string;
  onStart?: () => void;
  onWord?: (index: number, word: string, charIndex: number) => void;
  onEnd?: () => void;
  onError?: (err: Error) => void;
}

export class WebSpeechEngine {
  private synth: SpeechSynthesis | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private isSpeakingState = false;
  private availableVoices: SpeechSynthesisVoice[] = [];

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
      this.loadVoices();
      if (this.synth.onvoiceschanged !== undefined) {
        this.synth.onvoiceschanged = () => this.loadVoices();
      }
    }
  }

  private loadVoices() {
    if (!this.synth) return;
    this.availableVoices = this.synth.getVoices();
  }

  public isAvailable(): boolean {
    return this.synth !== null;
  }

  public getEnglishVoices(): SpeechSynthesisVoice[] {
    return this.availableVoices.filter(v => v.lang.startsWith('en'));
  }

  public getBestEnglishVoice(): SpeechSynthesisVoice | null {
    const enVoices = this.getEnglishVoices();
    if (enVoices.length === 0) return null;
    // Prefer natural / google / local voices
    const preferred = enVoices.find(v => 
      v.name.includes('Google') || 
      v.name.includes('Natural') || 
      v.name.includes('Samantha') || 
      v.name.includes('Daniel')
    );
    return preferred || enVoices[0];
  }

  public stop(): void {
    if (this.currentUtterance) {
      this.currentUtterance.onstart = null;
      this.currentUtterance.onend = null;
      this.currentUtterance.onerror = null;
      this.currentUtterance.onboundary = null;
    }
    if (this.synth) {
      try {
        this.synth.cancel();
      } catch (_) {}
    }
    this.isSpeakingState = false;
    this.currentUtterance = null;
  }

  public isBusy(): boolean {
    return this.isSpeakingState || (this.synth?.speaking ?? false);
  }

  /**
   * Speaks English text using the browser's native SpeechSynthesis engine
   */
  public speak(text: string, options: WebSpeechOptions = {}): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.synth) {
        const err = new Error('Web Speech API is not supported in this browser environment.');
        if (options.onError) options.onError(err);
        return reject(err);
      }

      this.stop();

      const utterance = new SpeechSynthesisUtterance(text);
      this.currentUtterance = utterance;

      utterance.lang = options.lang || 'en-US';
      utterance.rate = options.rate !== undefined ? options.rate : 1.0;
      utterance.pitch = options.pitch !== undefined ? options.pitch : 1.0;
      utterance.volume = options.volume !== undefined ? options.volume : 1.0;

      const voice = options.voiceURI
        ? this.availableVoices.find(v => v.voiceURI === options.voiceURI)
        : this.getBestEnglishVoice();

      if (voice) {
        utterance.voice = voice;
      }

      // Word boundary callback for synchronized karaoke highlighting
      const words = text.split(/\s+/);
      let wordIndex = 0;

      utterance.onboundary = (event) => {
        if (event.name === 'word' && options.onWord) {
          const currentWord = words[wordIndex] || '';
          options.onWord(wordIndex, currentWord, event.charIndex);
          wordIndex++;
        }
      };

      utterance.onstart = () => {
        this.isSpeakingState = true;
        if (options.onStart) options.onStart();
      };

      utterance.onend = () => {
        this.isSpeakingState = false;
        this.currentUtterance = null;
        if (options.onEnd) options.onEnd();
        resolve();
      };

      utterance.onerror = (e) => {
        this.isSpeakingState = false;
        this.currentUtterance = null;
        // Ignore canceled errors triggered intentionally
        if (e.error === 'canceled' || e.error === 'interrupted') {
          resolve();
          return;
        }
        const err = new Error(`SpeechSynthesis error: ${e.error}`);
        if (options.onError) options.onError(err);
        reject(err);
      };

      this.synth.speak(utterance);
    });
  }
}

// Global Singleton
export const webSpeech = new WebSpeechEngine();

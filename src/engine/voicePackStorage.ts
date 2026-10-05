/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Local Voice Pack & Offline Storage Manager for HmongTTS
 * Manages offline voice models, phonology dictionaries, and audio cache in IndexedDB.
 */

export interface VoicePackModel {
  id: string;
  name: string;
  dialect: 'dawb' | 'leeg';
  version: string;
  sizeKb: number;
  isDownloaded: boolean;
  type: 'acoustic_dsp' | 'neural_prosody';
  lastUpdated: string;
  checksum: string;
}

export const PRELOADED_VOICE_PACKS: VoicePackModel[] = [
  {
    id: 'paj_dawb_female',
    name: 'Paj - Hmoob Dawb (Female)',
    dialect: 'dawb',
    version: '2.4.0',
    sizeKb: 142,
    isDownloaded: true,
    type: 'acoustic_dsp',
    lastUpdated: '2026-09-15',
    checksum: 'sha256-a8f4c1b9',
  },
  {
    id: 'ntxoov_dawb_male',
    name: 'Ntxoov - Hmoob Dawb (Male)',
    dialect: 'dawb',
    version: '2.4.0',
    sizeKb: 148,
    isDownloaded: true,
    type: 'acoustic_dsp',
    lastUpdated: '2026-09-15',
    checksum: 'sha256-d7e29a30',
  },
  {
    id: 'mee_leeg_female',
    name: 'Mee - Moob Leeg (Female)',
    dialect: 'leeg',
    version: '2.4.0',
    sizeKb: 156,
    isDownloaded: true,
    type: 'acoustic_dsp',
    lastUpdated: '2026-09-20',
    checksum: 'sha256-99b3ef12',
  },
  {
    id: 'koob_leeg_male',
    name: 'Koob - Moob Leeg (Male)',
    dialect: 'leeg',
    version: '2.4.0',
    sizeKb: 154,
    isDownloaded: true,
    type: 'acoustic_dsp',
    lastUpdated: '2026-09-20',
    checksum: 'sha256-c4d1109a',
  },
  {
    id: 'neural_hmoob_foundation',
    name: 'Hmong Neural Prosody Core (Bilingual)',
    dialect: 'dawb',
    version: '1.2.0',
    sizeKb: 12480,
    isDownloaded: false,
    type: 'neural_prosody',
    lastUpdated: '2026-10-01',
    checksum: 'sha256-5f80ba9e',
  },
];

const STORAGE_KEY = 'hmong_tts_voice_packs';
const OFFLINE_MODE_KEY = 'hmong_tts_force_offline';

export function getInstalledVoicePacks(): VoicePackModel[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('Could not read voice packs from localStorage', e);
  }
  return PRELOADED_VOICE_PACKS;
}

export function saveInstalledVoicePacks(packs: VoicePackModel[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(packs));
  } catch (e) {
    console.warn('Could not save voice packs', e);
  }
}

export function isForceOffline(): boolean {
  try {
    return localStorage.getItem(OFFLINE_MODE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setForceOffline(enabled: boolean) {
  try {
    localStorage.setItem(OFFLINE_MODE_KEY, enabled ? 'true' : 'false');
  } catch (e) {
    console.warn('Could not set force offline flag', e);
  }
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * User-recorded Hmong words (IndexedDB). HmongDictionary.com only serves recordings for words it
 * archived and offers no Hmong TTS for the rest, so missing words are recorded by a native speaker here.
 */

const DB_NAME = 'hmong_tts_words';
const STORE = 'words';

export const cleanWordKey = (w: string) => w.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().trim();

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const saveWordRecording = (word: string, blob: Blob) => tx('readwrite', (s) => s.put(blob, cleanWordKey(word)));
export const getWordRecording = (word: string) => tx<Blob | undefined>('readonly', (s) => s.get(cleanWordKey(word)));
export const deleteWordRecording = (word: string) => tx('readwrite', (s) => s.delete(cleanWordKey(word)));

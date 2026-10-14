import { useRef, useState } from 'react';
import { Mic, Square, Search } from 'lucide-react';
import type { HmongDialect } from '../engine/hmongPhonology';
import { findMissingWords, registerRecordedWord } from '../engine/hmongNativeAudio';
import { saveWordRecording } from '../engine/customWordRecordings';

/** Lists words with no native recording and lets a native speaker record them. */
export function MissingWordRecorder({ text, dialect }: { text: string; dialect: HmongDialect }) {
  const [missing, setMissing] = useState<string[] | null>(null);
  const [recording, setRecording] = useState<string | null>(null);
  const [error, setError] = useState('');
  const ctx = useRef<AudioContext | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const getCtx = () => (ctx.current ??= new AudioContext());

  const check = async () => {
    setError('');
    setMissing(await findMissingWords(text, dialect, getCtx()));
  };

  const start = async (word: string) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks: Blob[] = [];
      const mr = new MediaRecorder(stream);
      mr.ondataavailable = (e) => chunks.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: mr.mimeType });
        try {
          await registerRecordedWord(word, blob, getCtx());
          await saveWordRecording(word, blob);
          fetch(`/api/audio/custom/${encodeURIComponent(word)}`, { method: 'POST', body: blob }).catch(() => {}); // share across devices; local copy is the fallback
          setMissing((m) => m && m.filter((w) => w !== word));
        } catch {
          setError(`Could not save "${word}" - try recording again.`);
        }
        setRecording(null);
      };
      rec.current = mr;
      mr.start();
      setRecording(word);
    } catch {
      setError('Microphone access is required to record words.');
    }
  };

  return (
    <div className="rounded-lg border border-slate-700 p-3 text-sm space-y-2">
      <button onClick={check} className="flex items-center gap-2 text-emerald-400">
        <Search className="w-4 h-4" /> Find words with no native recording
      </button>
      {missing && missing.length === 0 && <p className="text-slate-400">All words have native recordings.</p>}
      {missing?.map((w) => (
        <div key={w} className="flex items-center justify-between">
          <span className="font-mono">{w}</span>
          {recording === w ? (
            <button onClick={() => rec.current?.stop()} className="flex items-center gap-1 text-red-400">
              <Square className="w-4 h-4" /> Stop &amp; save
            </button>
          ) : (
            <button disabled={!!recording} onClick={() => start(w)} className="flex items-center gap-1 text-emerald-400 disabled:opacity-40">
              <Mic className="w-4 h-4" /> Record
            </button>
          )}
        </div>
      ))}
      {error && <p className="text-red-400">{error}</p>}
    </div>
  );
}

import React, { useState } from 'react';
import {
  getInstalledVoicePacks,
  saveInstalledVoicePacks,
  isForceOffline,
  setForceOffline,
  VoicePackModel,
} from '../engine/voicePackStorage';
import { HardDrive, Wifi, WifiOff, CheckCircle2, Download, Trash2, ShieldCheck } from 'lucide-react';

export const VoicePackManager: React.FC = () => {
  const [packs, setPacks] = useState<VoicePackModel[]>(getInstalledVoicePacks());
  const [forceOffline, setOfflineState] = useState<boolean>(isForceOffline());
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const toggleForceOffline = () => {
    const nextState = !forceOffline;
    setOfflineState(nextState);
    setForceOffline(nextState);
  };

  const handleDownload = (id: string) => {
    setDownloadingId(id);
    setTimeout(() => {
      const updated = packs.map(p => p.id === id ? { ...p, isDownloaded: true } : p);
      setPacks(updated);
      saveInstalledVoicePacks(updated);
      setDownloadingId(null);
    }, 1200);
  };

  const handleRemove = (id: string) => {
    const updated = packs.map(p => p.id === id ? { ...p, isDownloaded: false } : p);
    setPacks(updated);
    saveInstalledVoicePacks(updated);
  };

  const totalStorageKb = packs
    .filter(p => p.isDownloaded)
    .reduce((sum, p) => sum + p.sizeKb, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
            <span>Offline Voice Packs & Local Storage</span>
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Pre-bundled native acoustic models run in pure client memory without sending voice data to any remote server.
          </p>
        </div>

        {/* Force Offline Simulation Toggle */}
        <button
          onClick={toggleForceOffline}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold border transition ${
            forceOffline
              ? 'bg-amber-950/60 border-amber-600/70 text-amber-300'
              : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-600'
          }`}
        >
          {forceOffline ? <WifiOff className="w-4 h-4 text-amber-400" /> : <Wifi className="w-4 h-4 text-emerald-400" />}
          <span>{forceOffline ? 'Forced Offline Mode: ACTIVE' : 'Simulate Offline Mode'}</span>
        </button>
      </div>

      {/* Storage Summary Bar */}
      <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-teal-950/60 border border-teal-800/40 text-teal-400">
            <HardDrive className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-slate-400">Local Device Storage Footprint</div>
            <div className="text-base font-bold text-slate-100 font-mono">
              {totalStorageKb > 1024 ? `${(totalStorageKb / 1024).toFixed(1)} MB` : `${totalStorageKb} KB`}
              <span className="text-xs font-normal text-slate-500 ml-2">(Zero cloud dependencies)</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-800/30 px-3 py-1.5 rounded-lg">
          <ShieldCheck className="w-4 h-4" />
          <span>100% On-Device Privacy Guaranteed</span>
        </div>
      </div>

      {/* Voice Packs Table / List */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 bg-slate-900/80 flex items-center justify-between">
          <span className="text-xs font-mono uppercase text-slate-400">Available Dialect Voice Models</span>
          <span className="text-xs text-slate-500">IndexedDB V2 Cache</span>
        </div>

        <div className="divide-y divide-slate-800/70">
          {packs.map((pack) => (
            <div key={pack.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-900/80 transition">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-200">{pack.name}</span>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                    pack.dialect === 'dawb' ? 'bg-teal-950 text-teal-300 border border-teal-800/50' : 'bg-sky-950 text-sky-300 border border-sky-800/50'
                  }`}>
                    {pack.dialect === 'dawb' ? 'Hmoob Dawb' : 'Moob Leeg'}
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">v{pack.version}</span>
                </div>

                <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                  <span>Size: {pack.sizeKb > 1024 ? `${(pack.sizeKb / 1024).toFixed(1)} MB` : `${pack.sizeKb} KB`}</span>
                  <span>·</span>
                  <span>Engine: {pack.type === 'acoustic_dsp' ? 'Low-Latency Formant DSP' : 'Neural Transformer'}</span>
                  <span>·</span>
                  <span className="text-slate-500">{pack.checksum}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {pack.isDownloaded ? (
                  <>
                    <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-800/30 px-2.5 py-1 rounded-md">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Ready Offline</span>
                    </div>

                    {pack.type === 'neural_prosody' && (
                      <button
                        onClick={() => handleRemove(pack.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-400 rounded-md hover:bg-slate-800 transition"
                        title="Remove from local cache"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </>
                ) : (
                  <button
                    onClick={() => handleDownload(pack.id)}
                    disabled={downloadingId === pack.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold transition active:scale-95 disabled:opacity-50"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{downloadingId === pack.id ? 'Caching...' : 'Pre-cache Model'}</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

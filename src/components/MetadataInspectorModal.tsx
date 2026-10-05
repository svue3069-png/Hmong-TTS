/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MetadataInspectorModal
 * Interactive developer inspector for verifying phonetic IPA alignments,
 * Chao tone markers, formant frequencies, and millisecond timestamps.
 */

import React, { useState } from 'react';
import {
  X,
  Download,
  Copy,
  Check,
  FileCode,
  Table as TableIcon,
  Clock,
  Layers,
  Sparkles,
  Search,
} from 'lucide-react';
import { SynthesisMetadataExport, hmongTTS } from '../engine/hmongAudioSynthesizer';

interface MetadataInspectorModalProps {
  metadata: SynthesisMetadataExport | null;
  isOpen: boolean;
  onClose: () => void;
}

export const MetadataInspectorModal: React.FC<MetadataInspectorModalProps> = ({
  metadata,
  isOpen,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'json'>('table');
  const [searchFilter, setSearchFilter] = useState('');

  if (!isOpen || !metadata) return null;

  const handleCopyJson = async () => {
    try {
      const jsonStr = JSON.stringify(metadata, null, 2);
      await navigator.clipboard.writeText(jsonStr);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy JSON:', err);
    }
  };

  const handleDownloadJson = () => {
    const blob = hmongTTS.encodeMetadataJson(metadata);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hmong_tts_metadata_${metadata.dialect}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredAlignment = metadata.alignment.filter((item) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return (
      item.token.toLowerCase().includes(q) ||
      item.phonetics.fullIpa.toLowerCase().includes(q) ||
      item.phonetics.toneName.toLowerCase().includes(q) ||
      item.phonetics.chaoNumber.includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-teal-950/80 border border-teal-700/50 text-teal-400">
              <FileCode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Phonetic & Timing Alignment Metadata</span>
                <span className="text-[11px] font-mono font-normal px-2 py-0.5 rounded bg-teal-950/80 text-teal-300 border border-teal-800/40">
                  JSON v{metadata.version}
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Sample-accurate acoustic timestamps, IPA transcriptions, and Chao tone values
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 px-6 py-3 bg-slate-950/40 border-b border-slate-800/80 text-xs">
          <div className="flex items-center gap-2 text-slate-400">
            <Clock className="w-4 h-4 text-sky-400 shrink-0" />
            <span>
              Duration: <strong className="text-white">{metadata.audioMetrics.totalDurationMs} ms</strong>
            </span>
          </div>
          <div className="flex items-center gap-2 text-slate-400">
            <Layers className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              Syllables: <strong className="text-white">{metadata.audioMetrics.syllableCount}</strong>
            </span>
          </div>
          <div className="flex items-center gap-2 text-slate-400">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              Dialect: <strong className="text-white">{metadata.dialect === 'dawb' ? 'Hmoob Dawb' : 'Moob Leeg'}</strong>
            </span>
          </div>
          <div className="flex items-center gap-2 text-slate-400">
            <span className="font-mono text-cyan-400 font-bold">F₀</span>
            <span>
              Base: <strong className="text-white">{metadata.voice.baseF0Hz} Hz</strong>
            </span>
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-2">
            <div className="flex p-0.5 rounded-xl bg-slate-950 border border-slate-800">
              <button
                onClick={() => setViewMode('table')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  viewMode === 'table'
                    ? 'bg-teal-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <TableIcon className="w-3.5 h-3.5" />
                <span>Alignment Table</span>
              </button>
              <button
                onClick={() => setViewMode('json')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  viewMode === 'json'
                    ? 'bg-teal-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileCode className="w-3.5 h-3.5" />
                <span>Raw JSON</span>
              </button>
            </div>

            {viewMode === 'table' && (
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Filter token or IPA..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="pl-8 pr-3 py-1 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-teal-500 w-44 sm:w-56"
                />
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyJson}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700/60 transition active:scale-95"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied JSON!' : 'Copy JSON'}</span>
            </button>
            <button
              onClick={handleDownloadJson}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold shadow-md shadow-teal-950 transition active:scale-95"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download .json</span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-auto p-6">
          {viewMode === 'table' ? (
            <div className="border border-slate-800 rounded-xl overflow-hidden shadow-inner">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-950 border-b border-slate-800 text-slate-400 font-mono text-[11px]">
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Token</th>
                    <th className="py-2.5 px-3">Time Range</th>
                    <th className="py-2.5 px-3">Duration</th>
                    <th className="py-2.5 px-3">Full IPA</th>
                    <th className="py-2.5 px-3">Onset [IPA]</th>
                    <th className="py-2.5 px-3">Nucleus [IPA]</th>
                    <th className="py-2.5 px-3">Tone (Chao)</th>
                    <th className="py-2.5 px-3">Formants (F₁ / F₂)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 bg-slate-900/60 font-sans">
                  {filteredAlignment.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-500 text-xs">
                        No syllables matching "{searchFilter}"
                      </td>
                    </tr>
                  ) : (
                    filteredAlignment.map((item) => (
                      <tr
                        key={item.index}
                        className={`hover:bg-slate-800/40 transition ${
                          item.isPunctuation ? 'bg-slate-950/40 text-slate-500' : ''
                        }`}
                      >
                        <td className="py-2 px-3 font-mono text-slate-500 text-[11px]">{item.index + 1}</td>
                        <td className="py-2 px-3 font-bold text-white">
                          {item.token || (item.isPunctuation ? '—' : '')}
                        </td>
                        <td className="py-2 px-3 font-mono text-cyan-300 text-[11px]">
                          {item.timeStartSec.toFixed(3)}s – {item.timeEndSec.toFixed(3)}s
                        </td>
                        <td className="py-2 px-3 font-mono text-slate-300">{item.durationMs}ms</td>
                        <td className="py-2 px-3 font-mono text-emerald-400 font-semibold">
                          {item.phonetics.fullIpa || '—'}
                        </td>
                        <td className="py-2 px-3 text-slate-300">
                          {item.phonetics.onset ? `${item.phonetics.onset} [${item.phonetics.onsetIpa}]` : '∅'}
                        </td>
                        <td className="py-2 px-3 text-slate-300">
                          {item.phonetics.vowel ? `${item.phonetics.vowel} [${item.phonetics.vowelIpa}]` : '—'}
                        </td>
                        <td className="py-2 px-3">
                          {item.isPunctuation ? (
                            <span className="text-slate-500">pause</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 font-mono text-amber-300 bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-800/30 text-[11px]">
                              <span>-{item.phonetics.toneLetter}</span>
                              <span className="text-slate-400">({item.phonetics.chaoNumber})</span>
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 font-mono text-slate-400 text-[11px]">
                          {item.acoustics.f1StartHz} / {item.acoustics.f2StartHz} Hz
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="relative">
              <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-teal-300 overflow-auto max-h-[60vh] leading-relaxed selection:bg-teal-900 selection:text-white">
                {JSON.stringify(metadata, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-800 bg-slate-950/70 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Developers can also retrieve this schema via <code>POST /api/tts/phonemize</code> or <code>POST /api/tts/metadata</code>.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

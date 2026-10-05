/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * BatchProcessingTab
 * Developer SDK tool for uploading lists of text files or pasting multiple
 * paragraphs/sentences and exporting all synthesized Hmong audio files in a single ZIP archive.
 */

import React, { useState, useRef } from 'react';
import {
  FolderArchive,
  Upload,
  FileText,
  Play,
  Download,
  CheckCircle2,
  Sparkles,
  Loader2,
  Trash2,
  FileCode,
  Languages,
} from 'lucide-react';
import JSZip from 'jszip';
import { hmongTTS, HMONG_VOICE_PROFILES } from '../engine/hmongAudioSynthesizer';
import { HmongDialect } from '../engine/hmongPhonology';

export const BatchProcessingTab: React.FC = () => {
  const [batchText, setBatchText] = useState<string>(
    'Nyob zoo sawv daws!\nKuv zoo siab tos txais nej tuaj rau HmongTTS Studio.\nUa tsaug ntau rau nej cov kev pab.\nHmoob cov lus zoo nkauj heev.'
  );
  const [dialect, setDialect] = useState<HmongDialect>('dawb');
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>('paj_dawb_female');
  const [rate, setRate] = useState<number>(1.0);
  const [pitch, setPitch] = useState<number>(1.0);
  
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [completedItemsCount, setCompletedItemsCount] = useState<number>(0);
  const [zipBlob, setZipBlob] = useState<Blob | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Handle file uploads (.txt or .csv)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    let combinedText = '';
    let processedCount = 0;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        if (content) {
          combinedText += `\n# --- File: ${file.name} ---\n` + content + '\n';
          setBatchText((prev) => (prev ? `${prev}\n${content}` : content));
        }
        processedCount++;
      };
      reader.readAsText(file);
    });
  };

  // Run Batch Synthesis & Generate ZIP
  const handleRunBatch = async () => {
    const lines = batchText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'));

    if (lines.length === 0) {
      alert('Please enter or upload at least one sentence or text line for batch processing.');
      return;
    }

    setIsProcessing(true);
    setProgressPercent(0);
    setCompletedItemsCount(0);
    setStatusMessage(`Initializing batch synthesis for ${lines.length} items...`);

    try {
      const zip = new JSZip();
      const voice = HMONG_VOICE_PROFILES.find((v) => v.id === selectedVoiceId) || HMONG_VOICE_PROFILES[0];

      let completed = 0;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        setStatusMessage(`Synthesizing item ${i + 1} of ${lines.length}: "${line.slice(0, 30)}..."`);

        // Render audio buffer via Hmong DSP synthesizer
        const { buffer } = await hmongTTS.renderToAudioBuffer(line, dialect, {
          voice,
          rate,
          pitch,
        });

        const wavBlob = hmongTTS.encodeWav(buffer);
        const arrayBuffer = await wavBlob.arrayBuffer();

        // Create filename slug
        const safeSlug = line
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '_')
          .slice(0, 24);
        const fileName = `item_${(i + 1).toString().padStart(2, '0')}_${safeSlug}.wav`;

        zip.file(fileName, arrayBuffer);

        completed++;
        setCompletedItemsCount(completed);
        setProgressPercent(Math.round((completed / lines.length) * 100));
      }

      setStatusMessage('Packaging ZIP archive...');
      const generatedZip = await zip.generateAsync({ type: 'blob' });
      setZipBlob(generatedZip);
      setStatusMessage(`Successfully synthesized ${lines.length} audio files into ZIP archive!`);
    } catch (err) {
      console.error('Batch synthesis error:', err);
      setStatusMessage('Error during batch synthesis. Check console for details.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Download ZIP
  const handleDownloadZip = () => {
    if (!zipBlob) return;
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hmong_tts_batch_export_${Date.now()}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const lineCount = batchText.split('\n').filter((l) => l.trim() && !l.startsWith('#')).length;

  return (
    <div className="space-y-6">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".txt,.csv,.md"
        onChange={handleFileUpload}
        className="hidden"
      />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <FolderArchive className="w-5 h-5 text-teal-400" />
            <span>Batch Processing & ZIP Archive Export</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Bulk-synthesize hundreds of text files or multi-line paragraphs into individual WAV files packaged inside a single ZIP archive.
          </p>
        </div>

        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-teal-300 rounded-xl text-xs font-semibold border border-teal-500/40 transition active:scale-95 shadow-md"
        >
          <Upload className="w-4 h-4 text-teal-400" />
          <span>Upload Text Files (.txt)</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Input Text Block */}
        <div className="lg:col-span-2 space-y-4">
          <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold text-slate-200">
                Batch Text Input (One sentence or phrase per line)
              </span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setBatchText('')}
                  className="text-xs text-slate-400 hover:text-rose-400 transition underline underline-offset-2"
                >
                  Clear All
                </button>
                <span className="font-mono text-teal-300 font-bold">{lineCount} valid lines</span>
              </div>
            </div>

            <textarea
              value={batchText}
              onChange={(e) => setBatchText(e.target.value)}
              rows={9}
              placeholder="Paste large text blocks or list of sentences here (each non-empty line will become a separate WAV file)..."
              className="w-full p-3.5 bg-slate-950/90 border border-slate-800 rounded-xl text-slate-100 placeholder:text-slate-600 font-mono text-xs focus:outline-hidden focus:border-teal-500 transition resize-y min-h-[180px]"
            />
          </div>
        </div>

        {/* Right: Settings & Execution Card */}
        <div className="space-y-4">
          <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-4">
            <h4 className="text-xs font-bold text-slate-200 flex items-center gap-2">
              <Languages className="w-4 h-4 text-teal-400" />
              <span>Batch Voice & Dialect Options</span>
            </h4>

            {/* Dialect */}
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400">Target Dialect</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setDialect('dawb')}
                  className={`py-2 rounded-xl text-xs font-semibold border transition ${
                    dialect === 'dawb'
                      ? 'bg-teal-600 text-white border-teal-500 shadow-md'
                      : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  Hmoob Dawb (White)
                </button>
                <button
                  onClick={() => setDialect('leeg')}
                  className={`py-2 rounded-xl text-xs font-semibold border transition ${
                    dialect === 'leeg'
                      ? 'bg-sky-600 text-white border-sky-500 shadow-md'
                      : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  Moob Leeg (Green)
                </button>
              </div>
            </div>

            {/* Run Button */}
            <div className="pt-2">
              <button
                disabled={isProcessing || lineCount === 0}
                onClick={handleRunBatch}
                className="w-full flex items-center justify-center gap-2 py-3 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-teal-950 transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing ({progressPercent}%)</span>
                  </>
                ) : (
                  <>
                    <FolderArchive className="w-4 h-4" />
                    <span>Synthesize & Export ZIP ({lineCount} items)</span>
                  </>
                )}
              </button>
            </div>

            {/* Status / Progress */}
            {statusMessage && (
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-2">
                <div className="text-slate-300 font-medium">{statusMessage}</div>
                {isProcessing && (
                  <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-teal-500 transition-all duration-150"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Download ZIP Button */}
            {zipBlob && !isProcessing && (
              <button
                onClick={handleDownloadZip}
                className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-950 transition active:scale-95 animate-bounce duration-1000"
              >
                <Download className="w-4 h-4" />
                <span>Download ZIP Archive (.zip)</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

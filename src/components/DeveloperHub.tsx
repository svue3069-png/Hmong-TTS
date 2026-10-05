import React, { useState } from 'react';
import { CODE_SNIPPETS } from '../sdk/codeSnippets';
import { Copy, Check, Terminal, Smartphone, Code2, Globe, Send, Play, Download } from 'lucide-react';
import { HmongTTSClient } from '../sdk/HmongTTSClient';
import { HmongDialect } from '../engine/hmongPhonology';

export const DeveloperHub: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'javascript' | 'reactNative' | 'flutter' | 'restApi'>('javascript');
  const [copied, setCopied] = useState(false);

  // Live API Sandbox state
  const [sandboxText, setSandboxText] = useState('Nyob zoo! Hais lus Hmoob yooj yim heev.');
  const [sandboxDialect, setSandboxDialect] = useState<HmongDialect>('dawb');
  const [sandboxFormat, setSandboxFormat] = useState<'wav' | 'pcm'>('wav');
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [apiResponse, setApiResponse] = useState<any | null>(null);
  const [downloadBlob, setDownloadBlob] = useState<Blob | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);

  const client = new HmongTTSClient({ dialect: sandboxDialect });

  const handleCopy = () => {
    navigator.clipboard.writeText(CODE_SNIPPETS[activeTab].code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRunSandbox = async () => {
    setIsSynthesizing(true);
    const start = performance.now();

    try {
      // Local client synthesis
      const wav = await client.synthesizeToWav(sandboxText);
      const metadata = await client.getMetadata(sandboxText);
      const elapsed = Math.round(performance.now() - start);

      setLatencyMs(elapsed);
      setDownloadBlob(wav);

      // Set accurate API metadata response
      setApiResponse({
        status: 'success',
        latencyMs: elapsed,
        audioSizeBytes: wav.size,
        ...metadata,
      });

      // Play sound
      await client.speak(sandboxText);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSynthesizing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
          <span>Cross-Platform Developer Integration SDK & APIs</span>
        </h2>
        <p className="text-sm text-slate-400 mt-1">
          Complete, drop-in SDKs for Web applications, React Native mobile apps, Flutter cross-platform clients, and backend REST microservices.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 p-1.5 bg-slate-900 border border-slate-800 rounded-xl">
        <button
          onClick={() => setActiveTab('javascript')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition ${
            activeTab === 'javascript'
              ? 'bg-teal-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Globe className="w-4 h-4" />
          <span>Web / TypeScript SDK</span>
        </button>

        <button
          onClick={() => setActiveTab('reactNative')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition ${
            activeTab === 'reactNative'
              ? 'bg-teal-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Smartphone className="w-4 h-4 text-cyan-400" />
          <span>React Native (iOS / Android)</span>
        </button>

        <button
          onClick={() => setActiveTab('flutter')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition ${
            activeTab === 'flutter'
              ? 'bg-teal-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Code2 className="w-4 h-4 text-sky-400" />
          <span>Flutter (Dart)</span>
        </button>

        <button
          onClick={() => setActiveTab('restApi')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition ${
            activeTab === 'restApi'
              ? 'bg-teal-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Terminal className="w-4 h-4 text-amber-400" />
          <span>REST API / cURL</span>
        </button>
      </div>

      {/* Code Display Box */}
      <div className="rounded-xl border border-slate-800 bg-slate-950 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-slate-900/90 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block" />
            <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
            <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
            <span className="ml-2 text-xs font-mono text-slate-300">
              {CODE_SNIPPETS[activeTab].filename}
            </span>
          </div>

          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-md transition"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied!' : 'Copy Code'}</span>
          </button>
        </div>

        <div className="p-4 overflow-x-auto max-h-[420px] font-mono text-xs text-slate-300 leading-relaxed">
          <pre>{CODE_SNIPPETS[activeTab].code}</pre>
        </div>
      </div>

      {/* Interactive API Sandbox */}
      <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/60">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-200">
              Interactive Low-Latency API Sandbox
            </h3>
            <p className="text-xs text-slate-400">
              Execute live synthesis and inspect the acoustic metadata payload
            </p>
          </div>

          {latencyMs !== null && (
            <div className="flex items-center gap-2 text-xs font-mono px-3 py-1 rounded bg-teal-950/60 border border-teal-800/60 text-teal-300">
              <span>LATENCY:</span>
              <span className="font-bold">{latencyMs}ms</span>
              <span className="text-slate-400">· ULTRA LOW-LATENCY</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-slate-400 mb-1">
              Hmong Text (RPA)
            </label>
            <input
              type="text"
              value={sandboxText}
              onChange={(e) => setSandboxText(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-slate-200 focus:outline-hidden focus:border-teal-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Dialect
              </label>
              <select
                value={sandboxDialect}
                onChange={(e) => setSandboxDialect(e.target.value as HmongDialect)}
                className="w-full px-2.5 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-hidden focus:border-teal-500"
              >
                <option value="dawb">Hmoob Dawb</option>
                <option value="leeg">Moob Leeg</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Audio Format
              </label>
              <select
                value={sandboxFormat}
                onChange={(e) => setSandboxFormat(e.target.value as any)}
                className="w-full px-2.5 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-hidden focus:border-teal-500"
              >
                <option value="wav">WAV (44.1kHz)</option>
                <option value="pcm">Raw PCM 16-bit</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleRunSandbox}
            disabled={isSynthesizing}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-xs font-semibold transition active:scale-95 disabled:opacity-50"
          >
            {isSynthesizing ? <Send className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
            <span>{isSynthesizing ? 'Synthesizing...' : 'Execute Test & Audition'}</span>
          </button>

          {downloadBlob && (
            <a
              href={URL.createObjectURL(downloadBlob)}
              download={`hmong_${sandboxDialect}_${Date.now()}.wav`}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition"
            >
              <Download className="w-3.5 h-3.5 text-teal-400" />
              <span>Download WAV</span>
            </a>
          )}

          {apiResponse && (
            <a
              href={URL.createObjectURL(new Blob([JSON.stringify(apiResponse, null, 2)], { type: 'application/json' }))}
              download={`hmong_metadata_${sandboxDialect}_${Date.now()}.json`}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition"
            >
              <Download className="w-3.5 h-3.5 text-amber-400" />
              <span>Download Metadata (.json)</span>
            </a>
          )}
        </div>

        {/* JSON Response Preview */}
        {apiResponse && (
          <div className="mt-4 p-3 bg-slate-950 rounded-lg border border-slate-800 font-mono text-[11px] text-teal-300 max-h-52 overflow-y-auto">
            <pre>{JSON.stringify(apiResponse, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
};

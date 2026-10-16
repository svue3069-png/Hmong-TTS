/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * BatchProcessingTool
 * High-performance batch speech synthesis and audio export tool for HmongTTS Studio.
 * Allows users to upload or paste a list of multiple Hmong sentences, audition individual items,
 * and export either as individual audio files (.wav & .zip) or as a single concatenated
 * track with user-defined pause intervals and synchronized subtitle cues (.srt / .vtt).
 */

import type { AudioSource } from '../engine/hmongAudioSynthesizer';
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { taskCoordinator } from '../engine/taskCoordinator';
import {
  FolderArchive,
  Upload,
  Play,
  Pause,
  Square,
  Download,
  CheckCircle2,
  Sparkles,
  Loader2,
  Trash2,
  FileCode,
  Languages,
  Clock,
  Sliders,
  Volume2,
  Layers,
  ArrowRight,
  FileText,
  RotateCcw,
  Check,
  Music,
  ExternalLink,
  ChevronDown,
  Info,
  X,
  FileSpreadsheet,
} from 'lucide-react';
import JSZip from 'jszip';
import {
  hmongTTS,
  HMONG_VOICE_PROFILES,
  VoiceProfile,
} from '../engine/hmongAudioSynthesizer';
import { HmongDialect, parseHmongText, convertDialectText } from '../engine/hmongPhonology';

export interface BatchItem {
  id: string;
  text: string;
  cleanText: string;
  dialect: HmongDialect;
  syllablesCount: number;
  tonesUsed: string[];
  buffer?: AudioBuffer;
  wavBlob?: Blob;
  durationSec?: number;
  status: 'idle' | 'processing' | 'ready' | 'error';
  errorMessage?: string;
  // Timing offsets inside the concatenated track
  concatStartSec?: number;
  concatEndSec?: number;
}

export interface BatchPreset {
  id: string;
  label: string;
  description: string;
  sentences: string[];
  dialect: HmongDialect;
}

const BATCH_PRESETS: BatchPreset[] = [
  {
    id: 'greetings',
    label: 'Everyday Greetings & Courtesies (8 sentences)',
    description: 'Polite greetings, well-wishes, and conversational introductions.',
    dialect: 'dawb',
    sentences: [
      'Nyob zoo sawv daws! Hnub no nej puas nyob zoo?',
      'Kuv zoo siab heev uas tau ntsib nej hnub no.',
      'Ua tsaug ntau ntau rau nej txoj kev pab cuam.',
      'Thov koj pab qhia kuv paub me ntsis ntxiv.',
      'Koj puas kam nrog kuv tham ib me pliag?',
      'Peb mus noj mov ua ke puas tau?',
      'Sib ntsib dua lwm zaus os!',
      'Thov kom nej txhua tus muaj kev thaj yeeb nyab xeeb.',
    ],
  },
  {
    id: 'folktale',
    label: 'Highland Wisdom & Sayings (Paj Lug) (6 sentences)',
    description: 'Traditional Hmong philosophical expressions and cultural proverbs.',
    dialect: 'dawb',
    sentences: [
      'Hmoob tej lus muaj nqi heev rau peb txhua tus.',
      'Sawv daws sib pab sib hlub ces lub neej thiaj li vam meej.',
      'Yuav ua neeg yuav tsum paub txoj cai thiab kev hwm.',
      'Tus neeg siab zoo yeej ib txwm muaj kev kaj siab lug.',
      'Dej siab dej ntsws thiaj li rub tau neeg lub siab.',
      'Peb cov poj koob yawm txwv tso tseg tej kab lis kev cai tsim txiaj.',
    ],
  },
  {
    id: 'clinic',
    label: 'Medical & Clinic Dialogue (6 sentences)',
    description: 'Healthcare consultations, doctor check-ins, and symptom questions.',
    dialect: 'dawb',
    sentences: [
      'Kuv lub taub hau mob heev tau ob peb hnub lawm.',
      'Kws kho mob, thov pab tshuaj xyuas kuv tus mob.',
      'Koj puas mob plab los yog kub cev?',
      'Haus tshuaj no hnubละ peb zaus tom qab noj mov tas.',
      'So me ntsis thiab haus dej kom ntau.',
      'Yog tias mob hnyav tuaj, rov qab tuaj ntsib kws kho mob ntxov.',
    ],
  },
  {
    id: 'leeg_culture',
    label: 'Moob Leeg Cultural Phrases (6 sentences)',
    description: 'Moob Leeg dialect pronunciations with nasal vowel shifts and lateral onsets.',
    dialect: 'leeg',
    sentences: [
      'Nyob zoo suav daws! Nub nua mej puas nyob zoo?',
      'Kuv zoo sab heev kws tau ntsib mej.',
      'Ua tsaug ntau rua mej txuj kev paab cuam.',
      'Moob tej lug muaj nqe heev rua peb suav daws.',
      'Tuaj nrug kuv moog noj mov os!',
      'Sib ntsib dlua lwm zag mog!',
    ],
  },
  {
    id: 'tones_drill',
    label: 'Chao Tone Minimal Pairs Drill (7 tones)',
    description: 'Systematic contrast of all 7 Hmong RPA tone consonants with the word po.',
    dialect: 'dawb',
    sentences: [
      'Pob: lub pob zeb nyob ntawm ntug kev (High Level - 55).',
      'Poj: poj niam yog niam tsev (High Falling - 52).',
      'Pov: pov pob mus rau lwm tus (Mid Rising - 24).',
      'Po: po tawg paj rau pem roob (Mid Level - 33).',
      'Pos: pos nphuab pos kub nyob hauv hav zoov (Low Level - 22).',
      'Pog: niam pog qhia kwv txhiaj (Breathy Falling - 42).',
      'Pom: kuv pom koj tuaj txog lawm (Creaky Falling - 21).',
    ],
  },
];

interface BatchProcessingToolProps {
  onClose?: () => void;
  onUseSentenceInStudio?: (text: string) => void;
  initialDialect?: HmongDialect;
  initialSoundSource?: AudioSource;
}

export const BatchProcessingTool: React.FC<BatchProcessingToolProps> = ({
  onClose,
  onUseSentenceInStudio,
  initialDialect = 'dawb',
  initialSoundSource = 'hmongdictionary_native',
}) => {
  // Input text
  const [inputText, setInputText] = useState<string>(() => {
    return BATCH_PRESETS[0].sentences.join('\n');
  });

  // Settings
  const [dialect, setDialect] = useState<HmongDialect>(initialDialect);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>('paj_dawb_female');
  const [soundSource, setSoundSource] = useState<AudioSource>(initialSoundSource);
  const [rate, setRate] = useState<number>(1.0);
  const [pitch, setPitch] = useState<number>(1.0);
  const [pauseIntervalSec, setPauseIntervalSec] = useState<number>(0.6); // Pause between concatenated sentences

  // Batch items state
  const [items, setItems] = useState<BatchItem[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [currentlyProcessingIndex, setCurrentlyProcessingIndex] = useState<number | null>(null);

  // Concatenated audio state
  const [concatenatedBuffer, setConcatenatedBuffer] = useState<AudioBuffer | null>(null);
  const [concatenatedWavBlob, setConcatenatedWavBlob] = useState<Blob | null>(null);
  const [concatenatedDurationSec, setConcatenatedDurationSec] = useState<number>(0);

  // Audio Playback State for Auditioning
  const [auditioningItemId, setAuditioningItemId] = useState<string | null>(null);
  const auditionSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const [auditionTimeProgress, setAuditionTimeProgress] = useState<number>(0);

  // Concatenated Track Player State
  const [isConcatPlaying, setIsConcatPlaying] = useState<boolean>(false);
  const [concatCurrentTime, setConcatCurrentTime] = useState<number>(0);
  const concatSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const concatStartTimeRef = useRef<number>(0);
  const concatPauseOffsetRef = useRef<number>(0);
  const concatRafRef = useRef<number | null>(null);
  const [concatSpeed, setConcatSpeed] = useState<number>(1.0);

  // Zip Export State
  const [zipBlob, setZipBlob] = useState<Blob | null>(null);
  const [isCreatingZip, setIsCreatingZip] = useState<boolean>(false);

  // UI state
  const [activeTab, setActiveTab] = useState<'editor' | 'queue' | 'concatenated'>('editor');
  const [selectedPresetId, setSelectedPresetId] = useState<string>('greetings');
  const [dragOver, setDragOver] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const abortRef = useRef<boolean>(false);

  // Parse raw text into structured BatchItem rows
  const parsedSentences = useMemo(() => {
    return inputText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith('#'));
  }, [inputText]);

  // Update voice if dialect changes
  useEffect(() => {
    if (dialect === 'dawb' && selectedVoiceId.includes('leeg')) {
      setSelectedVoiceId('paj_dawb_female');
    } else if (dialect === 'leeg' && selectedVoiceId.includes('dawb')) {
      setSelectedVoiceId('mee_leeg_female');
    }
  }, [dialect]);

  // Task coordinator listener to stop on navigation or tab changes
  useEffect(() => {
    const unregister = taskCoordinator.registerStopHandler('batch_processing_tool', () => {
      abortRef.current = true;
      stopAllAudition();
      stopConcatPlayback();
      setIsProcessing(false);
      setStatusMessage('Task cancelled or stopped.');
    });
    return () => {
      unregister();
      stopAllAudition();
      stopConcatPlayback();
    };
  }, []);

  // Stop audition audio
  const stopAllAudition = () => {
    if (auditionSourceRef.current) {
      try {
        auditionSourceRef.current.stop();
        auditionSourceRef.current.disconnect();
      } catch (_) {}
      auditionSourceRef.current = null;
    }
    setAuditioningItemId(null);
    setAuditionTimeProgress(0);
  };

  // Stop concatenated playback
  const stopConcatPlayback = () => {
    if (concatSourceRef.current) {
      try {
        concatSourceRef.current.stop();
        concatSourceRef.current.disconnect();
      } catch (_) {}
      concatSourceRef.current = null;
    }
    if (concatRafRef.current) {
      cancelAnimationFrame(concatRafRef.current);
      concatRafRef.current = null;
    }
    setIsConcatPlaying(false);
  };

  // Convert all input text to target dialect
  const handleConvertDialect = (targetDialect: HmongDialect) => {
    if (targetDialect === dialect) return;
    const converted = convertDialectText(inputText, dialect, targetDialect);
    setInputText(converted);
    setDialect(targetDialect);
  };

  // Apply a preset
  const handleApplyPreset = (preset: BatchPreset) => {
    setSelectedPresetId(preset.id);
    setInputText(preset.sentences.join('\n'));
    setDialect(preset.dialect);
    setStatusMessage(`Loaded preset: ${preset.label}`);
    // Clear previous audio cache to avoid stale outputs
    setItems([]);
    setConcatenatedBuffer(null);
    setConcatenatedWavBlob(null);
    setZipBlob(null);
  };

  // Handle file drop / upload
  const handleFileUpload = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    const reader = new FileReader();

    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (!content) return;

      if (file.name.endsWith('.json')) {
        try {
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed)) {
            const lines = parsed.map((item) => {
              if (typeof item === 'string') return item;
              return item.text || item.sentence || item.hmong || JSON.stringify(item);
            });
            setInputText(lines.join('\n'));
            setStatusMessage(`Imported ${lines.length} sentences from JSON.`);
            return;
          }
        } catch (_) {}
      }

      if (file.name.endsWith('.csv') || file.name.endsWith('.tsv')) {
        const separator = file.name.endsWith('.tsv') ? '\t' : ',';
        const lines = content
          .split('\n')
          .map((row) => {
            const clean = row.trim();
            if (!clean || clean.startsWith('#')) return '';
            const cols = clean.split(separator);
            // Grab the first column with meaningful text or longest string
            return cols[0].replace(/^["']|["']$/g, '').trim();
          })
          .filter(Boolean);
        setInputText(lines.join('\n'));
        setStatusMessage(`Imported ${lines.length} sentences from ${file.name}.`);
        return;
      }

      // Default plain text / markdown
      setInputText(content);
      setStatusMessage(`Imported text from ${file.name}.`);
    };

    reader.readAsText(file);
  };

  // Synthesize individual sentence
  const synthesizeSentence = async (
    text: string,
    targetDialect: HmongDialect,
    voice: VoiceProfile
  ): Promise<{ buffer: AudioBuffer; wavBlob: Blob; durationSec: number }> => {
    const { buffer } = await hmongTTS.renderToAudioBuffer(text, targetDialect, {
      voice,
      rate,
      pitch,
      audioSource: soundSource,
    });
    const wavBlob = hmongTTS.encodeWav(buffer);
    const durationSec = buffer.duration;
    return { buffer, wavBlob, durationSec };
  };

  // Run Batch Synthesis
  const handleStartBatchSynthesis = async () => {
    if (parsedSentences.length === 0) {
      setStatusMessage('Please enter or paste at least one sentence.');
      return;
    }

    stopAllAudition();
    stopConcatPlayback();

    abortRef.current = false;
    taskCoordinator.notifyTaskStarted('batch_processing_tool');
    setIsProcessing(true);
    setProgressPercent(0);
    setStatusMessage(`Preparing synthesis for ${parsedSentences.length} sentences...`);
    setActiveTab('queue');

    // Initialize item templates
    const initialBatchItems: BatchItem[] = parsedSentences.map((sentence, idx) => {
      const parsedSyllables = parseHmongText(sentence, dialect);
      const tones = Array.from(
        new Set(
          parsedSyllables
            .filter((s) => !s.isPunctuation && s.toneLetter)
            .map((s) => s.toneLetter)
        )
      );

      return {
        id: `batch-${idx + 1}-${Date.now()}`,
        text: sentence,
        cleanText: sentence.replace(/[^a-zA-Z0-9\s]/g, '').trim(),
        dialect,
        syllablesCount: parsedSyllables.filter((s) => !s.isPunctuation).length,
        tonesUsed: tones,
        status: 'idle',
      };
    });

    setItems(initialBatchItems);

    const voice =
      HMONG_VOICE_PROFILES.find((v) => v.id === selectedVoiceId) ||
      HMONG_VOICE_PROFILES[0];

    const completedBuffers: AudioBuffer[] = [];
    const updatedItems = [...initialBatchItems];

    try {
      for (let i = 0; i < parsedSentences.length; i++) {
        if (abortRef.current) {
          setStatusMessage('Batch synthesis stopped by user.');
          break;
        }

        setCurrentlyProcessingIndex(i);
        updatedItems[i].status = 'processing';
        setItems([...updatedItems]);
        setStatusMessage(`Synthesizing sentence ${i + 1} of ${parsedSentences.length}...`);

        try {
          const result = await synthesizeSentence(parsedSentences[i], dialect, voice);
          updatedItems[i].buffer = result.buffer;
          updatedItems[i].wavBlob = result.wavBlob;
          updatedItems[i].durationSec = result.durationSec;
          updatedItems[i].status = 'ready';
          completedBuffers.push(result.buffer);
        } catch (err: any) {
          console.error(`Error synthesizing sentence ${i}:`, err);
          updatedItems[i].status = 'error';
          updatedItems[i].errorMessage = err.message || 'Synthesis failed';
        }

        const pct = Math.round(((i + 1) / parsedSentences.length) * 100);
        setProgressPercent(pct);
        setItems([...updatedItems]);
      }

      if (!abortRef.current && completedBuffers.length > 0) {
        setStatusMessage('Assembling concatenated track with pause intervals...');
        // Build Concatenated Track
        const concatBuf = hmongTTS.concatenateBuffers(completedBuffers, pauseIntervalSec);
        const concatWav = hmongTTS.encodeWav(concatBuf);
        setConcatenatedBuffer(concatBuf);
        setConcatenatedWavBlob(concatWav);
        setConcatenatedDurationSec(concatBuf.duration);

        // Calculate timing offsets for subtitles and markers
        let currentOffset = 0;
        let bufIdx = 0;
        for (let i = 0; i < updatedItems.length; i++) {
          if (updatedItems[i].status === 'ready' && updatedItems[i].durationSec) {
            const dur = updatedItems[i].durationSec!;
            updatedItems[i].concatStartSec = currentOffset;
            updatedItems[i].concatEndSec = currentOffset + dur;
            currentOffset += dur + pauseIntervalSec;
            bufIdx++;
          }
        }
        setItems([...updatedItems]);

        setStatusMessage(
          `Successfully synthesized ${completedBuffers.length} sentences! Ready for individual or concatenated export.`
        );
      }
    } catch (globalErr: any) {
      console.error('Batch synthesis global error:', globalErr);
      setStatusMessage(`Error: ${globalErr.message || 'Unknown batch error'}`);
    } finally {
      setIsProcessing(false);
      setCurrentlyProcessingIndex(null);
      taskCoordinator.notifyTaskEnded('batch_processing_tool');
    }
  };

  // Play individual sentence audition
  const handlePlayAudition = async (item: BatchItem) => {
    if (!item.buffer) return;

    if (auditioningItemId === item.id) {
      stopAllAudition();
      return;
    }

    stopAllAudition();
    stopConcatPlayback();

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx({ sampleRate: 44100 });
    if (ctx.state === 'suspended') await ctx.resume();

    const source = ctx.createBufferSource();
    source.buffer = item.buffer;
    source.connect(ctx.destination);

    source.onended = () => {
      setAuditioningItemId(null);
      setAuditionTimeProgress(0);
    };

    setAuditioningItemId(item.id);
    auditionSourceRef.current = source;
    source.start(0);
  };

  // Download individual WAV
  const handleDownloadItemWav = (item: BatchItem, idx: number) => {
    if (!item.wavBlob) return;
    const slug = item.cleanText.slice(0, 20).replace(/\s+/g, '_').toLowerCase() || 'sentence';
    const fileName = `hmong_${(idx + 1).toString().padStart(2, '0')}_${slug}.wav`;
    const url = URL.createObjectURL(item.wavBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export all as ZIP Archive
  const handleExportZip = async () => {
    const readyItems = items.filter((it) => it.status === 'ready' && it.wavBlob);
    if (readyItems.length === 0) {
      setStatusMessage('No synthesized audio files available to package.');
      return;
    }

    setIsCreatingZip(true);
    setStatusMessage('Generating ZIP archive with all WAV files...');

    try {
      const zip = new JSZip();
      const manifest: any[] = [];
      let transcriptText = `# HmongTTS Batch Audio Export Transcript\n# Dialect: ${dialect}\n# Generated: ${new Date().toISOString()}\n\n`;

      for (let i = 0; i < readyItems.length; i++) {
        const it = readyItems[i];
        const slug = it.cleanText.slice(0, 24).replace(/\s+/g, '_').toLowerCase() || 'item';
        const fileName = `${(i + 1).toString().padStart(2, '0')}_${slug}.wav`;

        const arrayBuf = await it.wavBlob!.arrayBuffer();
        zip.file(fileName, arrayBuf);

        manifest.push({
          index: i + 1,
          fileName,
          text: it.text,
          dialect: it.dialect,
          durationSec: it.durationSec,
          syllablesCount: it.syllablesCount,
          tonesUsed: it.tonesUsed,
        });

        transcriptText += `[Track ${i + 1}] (${it.durationSec?.toFixed(2)}s) ${it.text}\n`;
      }

      // Add manifest.json and transcript.txt to the ZIP archive
      zip.file('manifest.json', JSON.stringify(manifest, null, 2));
      zip.file('transcript.txt', transcriptText);

      const generatedBlob = await zip.generateAsync({ type: 'blob' });
      setZipBlob(generatedBlob);

      const url = URL.createObjectURL(generatedBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `hmong_speech_batch_${dialect}_${Date.now()}.zip`;
      a.click();
      URL.revokeObjectURL(url);

      setStatusMessage(`Exported ZIP archive containing ${readyItems.length} WAV files and manifest.`);
    } catch (err: any) {
      console.error('Error creating ZIP:', err);
      setStatusMessage(`ZIP generation error: ${err.message}`);
    } finally {
      setIsCreatingZip(false);
    }
  };

  // Play Concatenated Audio Track
  const handlePlayConcat = async () => {
    if (!concatenatedBuffer) return;

    if (isConcatPlaying) {
      // Pause
      stopConcatPlayback();
      concatPauseOffsetRef.current = concatCurrentTime;
      return;
    }

    stopAllAudition();

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx({ sampleRate: 44100 });
    if (ctx.state === 'suspended') await ctx.resume();

    const source = ctx.createBufferSource();
    source.buffer = concatenatedBuffer;
    source.playbackRate.value = concatSpeed;
    source.connect(ctx.destination);

    const startOffset = concatPauseOffsetRef.current % concatenatedBuffer.duration;
    concatStartTimeRef.current = ctx.currentTime - startOffset / concatSpeed;

    source.onended = () => {
      setIsConcatPlaying(false);
      if (concatRafRef.current) cancelAnimationFrame(concatRafRef.current);
      if (concatCurrentTime >= concatenatedBuffer.duration - 0.1) {
        setConcatCurrentTime(0);
        concatPauseOffsetRef.current = 0;
      }
    };

    source.start(0, startOffset);
    concatSourceRef.current = source;
    setIsConcatPlaying(true);

    // Animation frame timer to update scrubber smoothly
    const updateTime = () => {
      if (source && ctx) {
        const elapsed = (ctx.currentTime - concatStartTimeRef.current) * concatSpeed;
        if (elapsed <= concatenatedBuffer.duration) {
          setConcatCurrentTime(elapsed);
          concatRafRef.current = requestAnimationFrame(updateTime);
        } else {
          setConcatCurrentTime(concatenatedBuffer.duration);
        }
      }
    };
    concatRafRef.current = requestAnimationFrame(updateTime);
  };

  // Seek Concatenated Audio Track
  const handleSeekConcat = (newTimeSec: number) => {
    if (!concatenatedBuffer) return;
    const wasPlaying = isConcatPlaying;
    stopConcatPlayback();
    concatPauseOffsetRef.current = newTimeSec;
    setConcatCurrentTime(newTimeSec);
    if (wasPlaying) {
      handlePlayConcat();
    }
  };

  // Download Single Concatenated Track as WAV
  const handleDownloadConcatWav = () => {
    if (!concatenatedWavBlob) return;
    const url = URL.createObjectURL(concatenatedWavBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hmong_concatenated_full_track_${dialect}_${Date.now()}.wav`;
    a.click();
    URL.revokeObjectURL(url);
    setStatusMessage('Downloaded full concatenated WAV track.');
  };

  // Download Subtitles (.srt and .vtt)
  const handleDownloadSubtitles = (format: 'srt' | 'vtt') => {
    const readyItems = items.filter((it) => it.status === 'ready' && it.concatStartSec !== undefined);
    if (readyItems.length === 0) return;

    const formatTimestamp = (totalSec: number, isVtt: boolean) => {
      const hours = Math.floor(totalSec / 3600);
      const minutes = Math.floor((totalSec % 3600) / 60);
      const seconds = Math.floor(totalSec % 60);
      const millis = Math.floor((totalSec % 1) * 1000);
      const sep = isVtt ? '.' : ',';
      return `${hours.toString().padStart(2, '0')}:${minutes
        .toString()
        .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}${sep}${millis
        .toString()
        .padStart(3, '0')}`;
    };

    let content = '';
    if (format === 'vtt') {
      content = 'WEBVTT\n\n';
      readyItems.forEach((it, idx) => {
        const start = formatTimestamp(it.concatStartSec!, true);
        const end = formatTimestamp(it.concatEndSec!, true);
        content += `${idx + 1}\n${start} --> ${end}\n${it.text}\n\n`;
      });
    } else {
      readyItems.forEach((it, idx) => {
        const start = formatTimestamp(it.concatStartSec!, false);
        const end = formatTimestamp(it.concatEndSec!, false);
        content += `${idx + 1}\n${start} --> ${end}\n${it.text}\n\n`;
      });
    }

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hmong_subtitles_${dialect}_${Date.now()}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
    setStatusMessage(`Exported ${format.toUpperCase()} subtitles for video editors.`);
  };

  // Active sentence during concatenated playback
  const activePlayingSentence = useMemo(() => {
    if (!concatenatedBuffer || !isConcatPlaying) return null;
    return items.find(
      (it) =>
        it.concatStartSec !== undefined &&
        it.concatEndSec !== undefined &&
        concatCurrentTime >= it.concatStartSec &&
        concatCurrentTime <= it.concatEndSec
    );
  }, [items, concatCurrentTime, isConcatPlaying, concatenatedBuffer]);

  // Format seconds to mm:ss
  const formatTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = Math.floor(sec % 60);
    const dec = Math.floor((sec % 1) * 10);
    return `${mins}:${secs.toString().padStart(2, '0')}.${dec}`;
  };

  return (
    <div className="bg-slate-900/95 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-md flex flex-col max-h-[92vh]">
      {/* Top Header */}
      <div className="p-4 sm:p-5 border-b border-slate-800/80 bg-slate-950/80 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400 shrink-0 shadow-inner">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Hmong Batch Speech Studio
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-teal-950 text-teal-300 border border-teal-800/70">
                Studio Tool
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Bulk-synthesize lists of Hmong sentences, audition each phrase, and export as individual files or one continuous track.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onClose && (
            <button
              onClick={() => {
                stopAllAudition();
                stopConcatPlayback();
                onClose();
              }}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 border border-transparent hover:border-slate-700 transition"
              title="Close Batch Processing Tool"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/40 px-4 sm:px-6 pt-2">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('editor')}
            className={`px-3.5 py-2 text-xs font-semibold border-b-2 transition flex items-center gap-2 ${
              activeTab === 'editor'
                ? 'border-teal-400 text-teal-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>1. Text & Audio Setup</span>
            <span className="px-1.5 py-0.2 rounded-full bg-slate-800 text-[10px] text-slate-300 font-mono">
              {parsedSentences.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('queue')}
            className={`px-3.5 py-2 text-xs font-semibold border-b-2 transition flex items-center gap-2 ${
              activeTab === 'queue'
                ? 'border-teal-400 text-teal-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <FolderArchive className="w-3.5 h-3.5" />
            <span>2. Sentence Queue & Audition</span>
            {items.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800/60 text-[10px] font-mono">
                {items.filter((i) => i.status === 'ready').length}/{items.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('concatenated')}
            className={`px-3.5 py-2 text-xs font-semibold border-b-2 transition flex items-center gap-2 ${
              activeTab === 'concatenated'
                ? 'border-teal-400 text-teal-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Music className="w-3.5 h-3.5" />
            <span>3. Concatenated Single Track</span>
            {concatenatedBuffer && (
              <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
            )}
          </button>
        </div>

        {/* Global Action Button */}
        <div className="hidden sm:flex items-center gap-2 pb-1.5">
          <button
            onClick={handleStartBatchSynthesis}
            disabled={isProcessing || parsedSentences.length === 0}
            className="flex items-center gap-2 px-3.5 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-bold shadow-md shadow-teal-950 transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Synthesizing ({progressPercent}%)</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>Synthesize Batch ({parsedSentences.length})</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Body */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        {/* TAB 1: Editor & Settings */}
        {activeTab === 'editor' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: Text Input & Presets */}
            <div className="lg:col-span-2 space-y-4">
              {/* Presets Bar */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Quick Hmong Sentence Presets:</span>
                  </span>
                  <span className="text-[11px] text-slate-500">Click to instantly populate</span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {BATCH_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      onClick={() => handleApplyPreset(preset)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition ${
                        selectedPresetId === preset.id
                          ? 'bg-teal-950 text-teal-300 border-teal-600 shadow-sm'
                          : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700 hover:text-white'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Text Area Card with Drag and Drop */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  handleFileUpload(e.dataTransfer.files);
                }}
                className={`p-4 rounded-2xl border transition space-y-3 ${
                  dragOver
                    ? 'border-teal-400 bg-teal-950/30'
                    : 'border-slate-800 bg-slate-950/70'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-200">
                      Hmong Sentences (One sentence per line)
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[11px] font-mono text-teal-300">
                      {parsedSentences.length} sentences detected
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".txt,.csv,.tsv,.json,.md"
                      onChange={(e) => handleFileUpload(e.target.files)}
                      className="hidden"
                    />

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-teal-300 rounded-lg text-xs font-semibold border border-slate-700 transition"
                      title="Upload .txt, .csv, or .json file of sentences"
                    >
                      <Upload className="w-3.5 h-3.5 text-teal-400" />
                      <span>Upload File</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setInputText('')}
                      className="text-xs text-slate-400 hover:text-rose-400 underline underline-offset-2 ml-1"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  rows={9}
                  placeholder={`Paste multiple Hmong sentences here, separated by newlines...\nExample:\nNyob zoo sawv daws!\nKuv zoo siab heev uas tau ntsib nej.\nUa tsaug ntau rau nej txoj kev pab.`}
                  className="w-full p-3.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 placeholder:text-slate-600 font-mono text-xs focus:outline-hidden focus:border-teal-500 focus:ring-1 focus:ring-teal-500/30 transition resize-y min-h-[200px]"
                />

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-slate-500">
                  <span>Lines starting with # are treated as comments and skipped.</span>
                  <span>Drag & Drop .txt, .csv, .tsv, .json files directly into the box.</span>
                </div>
              </div>

              {/* Quick Dialect Converter Toolbar */}
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-slate-300">
                  <Languages className="w-4 h-4 text-teal-400" />
                  <span className="font-medium">Batch Orthography Dialect Conversion:</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleConvertDialect('dawb')}
                    className={`px-3 py-1 rounded-lg font-semibold text-xs transition border ${
                      dialect === 'dawb'
                        ? 'bg-teal-600 text-white border-teal-500 shadow-sm'
                        : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    Convert All to Hmoob Dawb (White)
                  </button>
                  <button
                    onClick={() => handleConvertDialect('leeg')}
                    className={`px-3 py-1 rounded-lg font-semibold text-xs transition border ${
                      dialect === 'leeg'
                        ? 'bg-sky-600 text-white border-sky-500 shadow-sm'
                        : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    Convert All to Moob Leeg (Green)
                  </button>
                </div>
              </div>
            </div>

            {/* Right 1 Col: Acoustic Settings & Pause Interval */}
            <div className="space-y-4">
              {/* Voice & Sound Source Card */}
              <div className="p-4 rounded-2xl border border-slate-800 bg-slate-950/70 space-y-3.5">
                <div className="flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-xs font-bold text-slate-200">Batch Sound Source & Voice</h3>
                </div>

                {/* Sound Source Selector */}
                <div className="grid grid-cols-1 gap-2">
                  <button
                    type="button"
                    onClick={() => setSoundSource('hmongdictionary_native')}
                    className={`p-2.5 rounded-xl border text-left transition flex items-start justify-between gap-2 ${
                      soundSource === 'hmongdictionary_native'
                        ? 'bg-emerald-950/70 border-emerald-500 text-white shadow-sm ring-1 ring-emerald-500/40'
                        : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="space-y-0.5">
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        <span>🎙️ Authentic Recorded Native Voice</span>
                      </div>
                      <p className="text-[10px] text-slate-400">
                        Human voices from HmongDictionary.com with natural cadence.
                      </p>
                    </div>
                    {soundSource === 'hmongdictionary_native' && (
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setSoundSource('hmong_dsp')}
                    className={`p-2.5 rounded-xl border text-left transition flex items-start justify-between gap-2 ${
                      soundSource === 'hmong_dsp'
                        ? 'bg-teal-950/70 border-teal-500 text-white shadow-sm ring-1 ring-teal-500/40'
                        : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="space-y-0.5">
                      <div className="text-xs font-bold text-white flex items-center gap-1.5">
                        <span>⚡ Offline Formant Synthesizer</span>
                      </div>
                      <p className="text-[10px] text-slate-400">
                        Pure client-side acoustic DSP modeling glottal flow.
                      </p>
                    </div>
                    {soundSource === 'hmong_dsp' && (
                      <Check className="w-4 h-4 text-teal-400 shrink-0" />
                    )}
                  </button>
                </div>

                {/* Voice Profile Picker */}
                <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
                  <label className="text-xs text-slate-400 font-medium">Voice Profile:</label>
                  <select
                    value={selectedVoiceId}
                    onChange={(e) => setSelectedVoiceId(e.target.value)}
                    className="w-full p-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-200 focus:outline-hidden focus:border-teal-500"
                  >
                    {HMONG_VOICE_PROFILES.map((vp) => (
                      <option key={vp.id} value={vp.id}>
                        {vp.name} ({vp.gender}, {vp.dialect === 'dawb' ? 'Hmoob Dawb' : 'Moob Leeg'}) - {vp.description}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Speech Rate & Pitch Sliders */}
                <div className="space-y-3 pt-2 border-t border-slate-800/80 text-xs">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400">Speech Rate</span>
                      <span className="font-mono text-teal-400 font-bold">{rate.toFixed(2)}x</span>
                    </div>
                    <input
                      type="range"
                      min="0.6"
                      max="1.6"
                      step="0.05"
                      value={rate}
                      onChange={(e) => setRate(parseFloat(e.target.value))}
                      className="w-full accent-teal-500 cursor-pointer"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-400">Base Pitch</span>
                      <span className="font-mono text-teal-400 font-bold">{pitch.toFixed(2)}x</span>
                    </div>
                    <input
                      type="range"
                      min="0.75"
                      max="1.35"
                      step="0.05"
                      value={pitch}
                      onChange={(e) => setPitch(parseFloat(e.target.value))}
                      className="w-full accent-teal-500 cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* Pause Interval Card (The Key Requirement) */}
              <div className="p-4 rounded-2xl border border-teal-800/60 bg-teal-950/20 space-y-3 shadow-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-teal-400" />
                    <h3 className="text-xs font-bold text-slate-100">
                      Concatenation Pause Interval
                    </h3>
                  </div>
                  <span className="font-mono text-teal-300 font-bold text-xs bg-teal-950 px-2 py-0.5 rounded border border-teal-700/60">
                    {pauseIntervalSec.toFixed(2)}s silence
                  </span>
                </div>

                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Controls the exact duration of inserted silence between each sentence when merging them into a single concatenated audio file.
                </p>

                <input
                  type="range"
                  min="0.1"
                  max="3.0"
                  step="0.1"
                  value={pauseIntervalSec}
                  onChange={(e) => setPauseIntervalSec(parseFloat(e.target.value))}
                  className="w-full accent-teal-400 cursor-pointer"
                />

                {/* Preset Chips */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {[
                    { label: '0.2s Tight', val: 0.2 },
                    { label: '0.5s Natural', val: 0.5 },
                    { label: '0.8s Breathing', val: 0.8 },
                    { label: '1.2s Language Drill', val: 1.2 },
                    { label: '2.0s Classroom Quiz', val: 2.0 },
                  ].map((chip) => (
                    <button
                      key={chip.val}
                      onClick={() => setPauseIntervalSec(chip.val)}
                      className={`px-2 py-0.5 rounded text-[10px] font-mono transition border ${
                        Math.abs(pauseIntervalSec - chip.val) < 0.05
                          ? 'bg-teal-500 text-slate-950 font-bold border-teal-400'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Start Batch Synthesis Button */}
              <button
                onClick={handleStartBatchSynthesis}
                disabled={isProcessing || parsedSentences.length === 0}
                className="w-full flex items-center justify-center gap-2 py-3 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-teal-950 transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing Batch ({progressPercent}%)</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    <span>Synthesize {parsedSentences.length} Sentences</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: Queue & Individual Sentences Audition */}
        {activeTab === 'queue' && (
          <div className="space-y-4">
            {/* Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-xs">
              <div className="flex items-center gap-3">
                <span className="font-semibold text-slate-200">
                  Sentence Queue ({items.length} total)
                </span>
                <span className="text-slate-400">
                  Ready: {items.filter((i) => i.status === 'ready').length}
                </span>
                {isProcessing && (
                  <span className="text-teal-400 animate-pulse font-medium">
                    Synthesizing item {(currentlyProcessingIndex ?? 0) + 1}...
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleExportZip}
                  disabled={items.filter((i) => i.status === 'ready').length === 0 || isCreatingZip}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-teal-300 rounded-xl text-xs font-semibold border border-slate-700 transition active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Download all individual sentences packed in a single ZIP file"
                >
                  <Download className="w-3.5 h-3.5 text-teal-400" />
                  <span>{isCreatingZip ? 'Packaging ZIP...' : 'Export All as ZIP (.zip)'}</span>
                </button>

                {concatenatedBuffer && (
                  <button
                    onClick={() => setActiveTab('concatenated')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-bold transition active:scale-95 shadow-md"
                  >
                    <Music className="w-3.5 h-3.5" />
                    <span>View Concatenated Single Track →</span>
                  </button>
                )}
              </div>
            </div>

            {/* Progress Bar */}
            {isProcessing && (
              <div className="p-3 bg-slate-950 rounded-xl border border-teal-800/50 space-y-1.5">
                <div className="flex justify-between text-xs text-slate-300 font-mono">
                  <span>Batch Synthesis Progress</span>
                  <span className="text-teal-400 font-bold">{progressPercent}%</span>
                </div>
                <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-teal-500 transition-all duration-200 rounded-full"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            )}

            {/* Items Table / Cards */}
            {items.length === 0 ? (
              <div className="p-12 text-center rounded-2xl border border-slate-800 bg-slate-950/60 space-y-3">
                <FolderArchive className="w-10 h-10 text-slate-600 mx-auto" />
                <h3 className="text-sm font-bold text-slate-300">Queue is currently empty</h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Click '1. Text & Audio Setup' to enter or upload Hmong sentences, then press 'Synthesize Batch' to generate audio.
                </p>
                <button
                  onClick={() => setActiveTab('editor')}
                  className="px-4 py-2 bg-teal-600 text-white rounded-xl text-xs font-bold hover:bg-teal-500 transition"
                >
                  Go to Text Input
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {items.map((item, idx) => (
                  <div
                    key={item.id}
                    className={`p-3.5 rounded-xl border transition flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                      currentlyProcessingIndex === idx
                        ? 'border-teal-500 bg-teal-950/40 ring-1 ring-teal-500/50'
                        : item.status === 'ready'
                        ? 'border-slate-800/80 bg-slate-950/70 hover:border-slate-700'
                        : item.status === 'error'
                        ? 'border-rose-900/60 bg-rose-950/20'
                        : 'border-slate-900 bg-slate-950/40 opacity-70'
                    }`}
                  >
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-400">
                          #{(idx + 1).toString().padStart(2, '0')}
                        </span>
                        <span className="text-sm font-semibold text-slate-100 break-words">
                          {item.text}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500 font-mono">
                        <span>{item.syllablesCount} syllables</span>
                        {item.durationSec && (
                          <span className="text-teal-400 font-semibold">
                            · {item.durationSec.toFixed(2)}s
                          </span>
                        )}
                        <span className="hidden sm:inline">·</span>
                        <span className="flex items-center gap-1">
                          Tones:
                          {item.tonesUsed.map((t) => (
                            <span
                              key={t || 'mid'}
                              className="px-1 py-0.2 rounded bg-slate-900 text-teal-300 border border-slate-800"
                            >
                              -{t || 'ø'}
                            </span>
                          ))}
                        </span>
                        {item.status === 'ready' && (
                          <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                            <CheckCircle2 className="w-3 h-3" /> Ready
                          </span>
                        )}
                        {item.status === 'processing' && (
                          <span className="text-teal-400 flex items-center gap-1">
                            <Loader2 className="w-3 h-3 animate-spin" /> Synthesizing...
                          </span>
                        )}
                        {item.status === 'error' && (
                          <span className="text-rose-400">Failed: {item.errorMessage}</span>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons for this item */}
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      {/* Audition Play Button */}
                      <button
                        onClick={() => handlePlayAudition(item)}
                        disabled={item.status !== 'ready'}
                        className={`p-2 rounded-xl text-xs font-semibold border transition active:scale-95 disabled:opacity-30 ${
                          auditioningItemId === item.id
                            ? 'bg-rose-950 border-rose-500 text-rose-300 ring-2 ring-rose-500/50'
                            : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border-slate-700/80 hover:text-white'
                        }`}
                        title={auditioningItemId === item.id ? 'Stop Audition' : 'Play and audition this sentence'}
                      >
                        {auditioningItemId === item.id ? (
                          <Square className="w-3.5 h-3.5 fill-current" />
                        ) : (
                          <Play className="w-3.5 h-3.5 fill-current" />
                        )}
                      </button>

                      {/* Download Individual WAV */}
                      <button
                        onClick={() => handleDownloadItemWav(item, idx)}
                        disabled={item.status !== 'ready'}
                        className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700/80 hover:text-teal-300 transition active:scale-95 disabled:opacity-30"
                        title="Download this sentence as a .wav file"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>

                      {/* Send to Main Studio */}
                      {onUseSentenceInStudio && (
                        <button
                          onClick={() => {
                            stopAllAudition();
                            stopConcatPlayback();
                            onUseSentenceInStudio(item.text);
                            if (onClose) onClose();
                          }}
                          className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-teal-950 text-slate-300 hover:text-teal-300 border border-slate-800 hover:border-teal-700 text-xs font-medium transition"
                          title="Open this sentence in the main Studio editor"
                        >
                          Use in Studio
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: Concatenated Single Track with Pause Intervals */}
        {activeTab === 'concatenated' && (
          <div className="space-y-6">
            {!concatenatedBuffer ? (
              <div className="p-12 text-center rounded-2xl border border-slate-800 bg-slate-950/60 space-y-3">
                <Music className="w-10 h-10 text-slate-600 mx-auto" />
                <h3 className="text-sm font-bold text-slate-300">
                  Concatenated track not yet synthesized
                </h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Click 'Synthesize Batch' to compile all sentences into a single continuous audio track with {pauseIntervalSec.toFixed(2)}s pause intervals.
                </p>
                <button
                  onClick={handleStartBatchSynthesis}
                  disabled={parsedSentences.length === 0 || isProcessing}
                  className="px-4 py-2 bg-teal-600 text-white rounded-xl text-xs font-bold hover:bg-teal-500 transition"
                >
                  Synthesize Batch Now
                </button>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Concatenated Master Audio Player Card */}
                <div className="p-5 sm:p-6 rounded-2xl border border-teal-800/60 bg-gradient-to-b from-slate-900 to-slate-950 space-y-4 shadow-xl">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-teal-950 text-teal-300 border border-teal-700/60">
                          Single Concatenated Master Track
                        </span>
                        <span className="text-xs text-slate-400">
                          · {items.filter((i) => i.status === 'ready').length} sentences merged
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-white mt-1">
                        Full Hmong Continuous Speech Track
                      </h3>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-teal-300">
                        Total: {formatTime(concatenatedDurationSec)}
                      </span>
                    </div>
                  </div>

                  {/* Scrubber / Progress Bar with Sentence Ticks */}
                  <div className="space-y-1.5">
                    <div className="relative w-full h-4 bg-slate-950 rounded-lg overflow-hidden border border-slate-800 cursor-pointer">
                      {/* Active progress fill */}
                      <div
                        className="h-full bg-teal-500 transition-all duration-75 rounded-lg"
                        style={{
                          width: `${(concatCurrentTime / (concatenatedDurationSec || 1)) * 100}%`,
                        }}
                      />

                      {/* Sentence markers along timeline */}
                      {items
                        .filter((it) => it.concatStartSec !== undefined)
                        .map((it, idx) => (
                          <div
                            key={idx}
                            className="absolute top-0 bottom-0 w-0.5 bg-slate-700 pointer-events-none"
                            style={{
                              left: `${(it.concatStartSec! / (concatenatedDurationSec || 1)) * 100}%`,
                            }}
                            title={`Sentence ${idx + 1}: ${it.text}`}
                          />
                        ))}

                      {/* Click overlay */}
                      <input
                        type="range"
                        min="0"
                        max={concatenatedDurationSec || 1}
                        step="0.05"
                        value={concatCurrentTime}
                        onChange={(e) => handleSeekConcat(parseFloat(e.target.value))}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                    </div>

                    <div className="flex justify-between text-xs font-mono text-slate-400">
                      <span>{formatTime(concatCurrentTime)}</span>
                      <span>{formatTime(concatenatedDurationSec)}</span>
                    </div>
                  </div>

                  {/* Player Controls */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/80">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handlePlayConcat}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition active:scale-95 shadow-lg ${
                          isConcatPlaying
                            ? 'bg-rose-600 hover:bg-rose-500 text-white'
                            : 'bg-teal-600 hover:bg-teal-500 text-white shadow-teal-950'
                        }`}
                      >
                        {isConcatPlaying ? (
                          <>
                            <Pause className="w-4 h-4 fill-current" />
                            <span>Pause Track</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4 fill-current" />
                            <span>Play Concatenated Track</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => handleSeekConcat(0)}
                        className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:text-white transition active:scale-95"
                        title="Rewind to start"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>

                      {/* Speed selector */}
                      <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                        {[0.8, 1.0, 1.25, 1.5].map((spd) => (
                          <button
                            key={spd}
                            onClick={() => {
                              setConcatSpeed(spd);
                              if (concatSourceRef.current) {
                                concatSourceRef.current.playbackRate.value = spd;
                              }
                            }}
                            className={`px-2 py-0.5 rounded-lg font-mono text-[11px] transition ${
                              concatSpeed === spd
                                ? 'bg-teal-600 text-white font-bold'
                                : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            {spd}x
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Active Sentence Highlight */}
                    {activePlayingSentence && (
                      <div className="px-3 py-1.5 rounded-xl bg-teal-950/80 border border-teal-600/50 text-xs text-teal-200 animate-in fade-in duration-150 max-w-sm truncate">
                        <span className="font-bold text-teal-400 mr-1.5">Speaking:</span>
                        <span>{activePlayingSentence.text}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Export Concatenated Audio Section */}
                <div className="p-5 rounded-2xl border border-slate-800 bg-slate-950/70 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                        <Download className="w-4 h-4 text-teal-400" />
                        <span>Export Single Concatenated Track</span>
                      </h4>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Download the combined audio with {pauseIntervalSec.toFixed(2)}s pause intervals, or export timecoded subtitle cue sheets.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Concatenated WAV */}
                    <button
                      onClick={handleDownloadConcatWav}
                      className="p-3.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-left transition active:scale-95 shadow-md flex flex-col justify-between gap-2"
                    >
                      <div className="flex items-center justify-between">
                        <Download className="w-4 h-4" />
                        <span className="text-[10px] font-mono bg-teal-950 px-2 py-0.5 rounded text-teal-300 font-bold">
                          16-bit PCM WAV
                        </span>
                      </div>
                      <div>
                        <div className="text-xs font-bold">Download Full Audio (.wav)</div>
                        <div className="text-[10px] text-teal-100/80 mt-0.5">
                          {formatTime(concatenatedDurationSec)} total duration
                        </div>
                      </div>
                    </button>

                    {/* Subtitles SRT */}
                    <button
                      onClick={() => handleDownloadSubtitles('srt')}
                      className="p-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-200 text-left transition active:scale-95 flex flex-col justify-between gap-2"
                    >
                      <div className="flex items-center justify-between">
                        <FileCode className="w-4 h-4 text-amber-400" />
                        <span className="text-[10px] font-mono bg-slate-950 px-2 py-0.5 rounded text-amber-300 font-bold">
                          SubRip .srt
                        </span>
                      </div>
                      <div>
                        <div className="text-xs font-bold">Download Subtitles (.srt)</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Synchronized for DaVinci, Premiere, CapCut
                        </div>
                      </div>
                    </button>

                    {/* WebVTT */}
                    <button
                      onClick={() => handleDownloadSubtitles('vtt')}
                      className="p-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-200 text-left transition active:scale-95 flex flex-col justify-between gap-2"
                    >
                      <div className="flex items-center justify-between">
                        <FileSpreadsheet className="w-4 h-4 text-sky-400" />
                        <span className="text-[10px] font-mono bg-slate-950 px-2 py-0.5 rounded text-sky-300 font-bold">
                          WebVTT .vtt
                        </span>
                      </div>
                      <div>
                        <div className="text-xs font-bold">Download WebVTT (.vtt)</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Ready for HTML5 video & YouTube Captions
                        </div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Timeline Cue Breakdown Table */}
                <div className="p-4 rounded-2xl border border-slate-800 bg-slate-950/70 space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-300">
                    <span className="font-bold">Track Timeline Cue Schedule</span>
                    <span className="font-mono text-slate-500">
                      Pause between sentences: {pauseIntervalSec.toFixed(2)}s
                    </span>
                  </div>

                  <div className="max-h-60 overflow-y-auto space-y-1.5 text-xs font-mono">
                    {items
                      .filter((it) => it.concatStartSec !== undefined)
                      .map((it, idx) => (
                        <div
                          key={idx}
                          onClick={() => handleSeekConcat(it.concatStartSec!)}
                          className={`p-2 rounded-lg border transition cursor-pointer flex items-center justify-between gap-3 ${
                            activePlayingSentence?.id === it.id
                              ? 'bg-teal-950/80 border-teal-500 text-teal-200'
                              : 'bg-slate-900/60 border-slate-800/80 hover:bg-slate-900 text-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span className="text-slate-500 font-bold shrink-0">
                              #{(idx + 1).toString().padStart(2, '0')}
                            </span>
                            <span className="truncate font-sans font-medium">{it.text}</span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 text-[11px] text-slate-400">
                            <span>
                              {formatTime(it.concatStartSec!)} - {formatTime(it.concatEndSec!)}
                            </span>
                            <span className="text-teal-400 font-bold">
                              ({it.durationSec?.toFixed(2)}s)
                            </span>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Status Bar */}
      {statusMessage && (
        <div className="px-4 sm:px-6 py-2.5 bg-slate-950 border-t border-slate-800 text-xs text-slate-400 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 truncate">
            <span className="w-2 h-2 rounded-full bg-teal-400 shrink-0" />
            <span className="truncate">{statusMessage}</span>
          </div>

          {isProcessing && (
            <button
              onClick={() => {
                abortRef.current = true;
                taskCoordinator.stopAll('user_stopped');
              }}
              className="text-xs text-rose-400 hover:text-rose-300 font-semibold underline underline-offset-2 shrink-0"
            >
              Cancel Batch
            </button>
          )}
        </div>
      )}
    </div>
  );
};

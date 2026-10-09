/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Hmong Community Phrasebook Modal
 * Curated from Hmoob TTS Studio (https://lwazkaev.gensparkspace.com/)
 * 
 * Includes 75+ categorized phrases with instant audio playback,
 * IPA transcription, English translation, and 1-click loading into the speech studio.
 */

import React, { useState, useMemo } from 'react';
import {
  X,
  Search,
  Volume2,
  ArrowRight,
  BookOpen,
  Sparkles,
  MessageSquare,
  Users,
  Utensils,
  Compass,
  ShoppingBag,
  HeartPulse,
  Hash,
  Handshake,
} from 'lucide-react';
import {
  HMONG_PHRASES,
  HMONG_PHRASE_CATEGORIES,
  HmongPhraseItem,
} from '../engine/hmongPhrasebookData';
import { HmongDialect, parseHmongText } from '../engine/hmongPhonology';

interface PhrasebookDrawerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPhrase: (phrase: string, english?: string) => void;
  dialect: HmongDialect;
}

export const PhrasebookDrawerModal: React.FC<PhrasebookDrawerModalProps> = ({
  isOpen,
  onClose,
  onSelectPhrase,
  dialect = 'dawb',
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [playingPhraseId, setPlayingPhraseId] = useState<string | null>(null);

  const getCategoryIcon = (id: string) => {
    switch (id) {
      case 'greetings':
        return <Handshake className="w-4 h-4" />;
      case 'basics':
        return <MessageSquare className="w-4 h-4" />;
      case 'numbers':
        return <Hash className="w-4 h-4" />;
      case 'family':
        return <Users className="w-4 h-4" />;
      case 'food':
        return <Utensils className="w-4 h-4" />;
      case 'travel':
        return <Compass className="w-4 h-4" />;
      case 'shopping':
        return <ShoppingBag className="w-4 h-4" />;
      case 'health':
        return <HeartPulse className="w-4 h-4" />;
      case 'culture':
        return <Sparkles className="w-4 h-4" />;
      default:
        return <BookOpen className="w-4 h-4" />;
    }
  };

  const filteredPhrases = useMemo(() => {
    return HMONG_PHRASES.filter((item) => {
      const matchesCategory =
        selectedCategory === 'all' || item.category === selectedCategory;
      const matchesSearch =
        !searchQuery.trim() ||
        item.hmong.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.english.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.note && item.note.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesCategory && matchesSearch;
    });
  }, [selectedCategory, searchQuery]);

  const handlePlayPhrasePreview = (phrase: HmongPhraseItem) => {
    setPlayingPhraseId(phrase.id);
    // Use speech synthesis on the clean text
    const words = phrase.hmong.replace(/[^a-zA-Z\s]/g, '').trim().split(/\s+/);
    if (words.length === 1) {
      const audio = new Audio(`/api/audio/hmong-word/${encodeURIComponent(words[0])}`);
      audio.play().catch(() => {});
      setTimeout(() => setPlayingPhraseId(null), 1000);
    } else {
      // Load into studio player
      onSelectPhrase(phrase.hmong, phrase.english);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl max-h-[92vh] flex flex-col bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Hmoob Phrasebook & Cultural Idioms
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-300 border border-emerald-800/50">
                  {HMONG_PHRASES.length} Phrases
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Curated everyday phrases, family terms, numbers, dining, and greetings with English translations
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
            title="Close phrasebook"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter bar */}
        <div className="p-4 border-b border-slate-800 bg-slate-900/50 space-y-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search phrases in Hmong or English (e.g. nyob zoo, thank you, eat, hospital)..."
              className="w-full pl-10 pr-4 py-2 bg-slate-800/90 border border-slate-700/80 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400 transition"
            />
          </div>

          {/* Category Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1.5 rounded-xl font-medium shrink-0 transition flex items-center gap-1.5 ${
                selectedCategory === 'all'
                  ? 'bg-emerald-600 text-white font-semibold shadow-md'
                  : 'bg-slate-800/70 text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              All Categories
            </button>
            {HMONG_PHRASE_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-xl font-medium shrink-0 transition flex items-center gap-1.5 ${
                  selectedCategory === cat.id
                    ? 'bg-emerald-600 text-white font-semibold shadow-md'
                    : 'bg-slate-800/70 text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                {getCategoryIcon(cat.id)}
                <span>{cat.label.split('&')[0]}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Phrases List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {filteredPhrases.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-xs">
              No phrases matched your search.
            </div>
          ) : (
            filteredPhrases.map((phrase) => {
              const parsed = parseHmongText(phrase.hmong, dialect);
              const respelling = parsed.map((s) => s.englishRespelling || s.clean).join(' ');
              const ipa = parsed.map((s) => s.ipa).filter(Boolean).join(' ');

              return (
                <div
                  key={phrase.id}
                  className="p-3.5 bg-slate-800/50 hover:bg-slate-800/80 border border-slate-700/60 rounded-xl transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2.5">
                      <span className="font-bold text-white text-sm sm:text-base tracking-wide font-mono">
                        {phrase.hmong}
                      </span>
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-amber-950/60 text-amber-300 border border-amber-800/40 font-semibold">
                        {respelling}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-slate-300 font-medium">
                        {phrase.english}
                      </span>
                      {phrase.literalMeaning && (
                        <span className="text-slate-400 text-[11px] hidden md:inline">
                          (lit. &ldquo;{phrase.literalMeaning}&rdquo;)
                        </span>
                      )}
                    </div>

                    {phrase.note && (
                      <p className="text-[11px] text-slate-400 italic">
                        {phrase.note}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <button
                      onClick={() => handlePlayPhrasePreview(phrase)}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded-xl text-xs font-semibold border border-slate-700/60 transition active:scale-95 flex items-center gap-1.5"
                      title="Hear pronunciation"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                      <span>Hear</span>
                    </button>

                    <button
                      onClick={() => {
                        onSelectPhrase(phrase.hmong, phrase.english);
                        onClose();
                      }}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition active:scale-95 shadow-md flex items-center gap-1.5"
                    >
                      <span>Load Studio</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between text-xs text-slate-400">
          <span>
            Click &ldquo;Load Studio&rdquo; to analyze phonetics and listen with full sentence cadence.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition text-xs font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

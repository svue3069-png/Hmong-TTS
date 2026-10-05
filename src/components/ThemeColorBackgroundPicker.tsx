/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * ThemeColorBackgroundPicker
 * Microsoft Office style multi-color background palette popup with:
 * - Theme colors grid (10 base columns x 6 tint/shade levels)
 * - Standard colors row
 * - High-contrast toggle switch
 * - Live hover preview (background immediately updates as cursor hovers over color)
 * - Custom HEX / color picker
 * - Gradient selection
 * - Custom background image upload with opacity & blur adjustments
 * - Curated Hmong cultural & atmospheric wallpaper presets
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Palette,
  Image as ImageIcon,
  Upload,
  Check,
  RotateCcw,
  Sparkles,
  Sliders,
  X,
  Eye,
  SlidersHorizontal,
  ChevronRight,
  SunMoon,
} from 'lucide-react';

export interface BackgroundConfig {
  type: 'color' | 'gradient' | 'image';
  value: string; // HEX color, CSS gradient, or image URL
  name?: string;
  imageUrl?: string;
  imageOpacity?: number; // 0.1 to 1.0 (default 0.35 for dark glass UI)
  imageBlur?: number; // 0 to 20px (default 4px)
  imageFit?: 'cover' | 'repeat';
}

interface ThemeColorBackgroundPickerProps {
  currentBg: BackgroundConfig;
  onSelectBg: (config: BackgroundConfig) => void;
  onHoverPreview: (config: BackgroundConfig | null) => void;
}

// 10 Main Theme Color Columns (like Microsoft Office)
const THEME_COLUMNS = [
  { name: 'White', base: '#ffffff', shades: ['#ffffff', '#f2f2f2', '#d9d9d9', '#bfbfbf', '#a6a6a6', '#7f7f7f'] },
  { name: 'Black / Dark', base: '#000000', shades: ['#000000', '#1a1a1a', '#262626', '#3f3f3f', '#595959', '#7f7f7f'] },
  { name: 'Warm Slate', base: '#1a2233', shades: ['#0b0f19', '#111827', '#1f293d', '#374151', '#4b5563', '#6b7280'] },
  { name: 'Hmong Indigo', base: '#061733', shades: ['#030b19', '#06142e', '#0f2752', '#1a3d7c', '#2b58a6', '#4a7ad4'] },
  { name: 'Highland Teal', base: '#042a2b', shades: ['#021415', '#042426', '#063f42', '#0d5c60', '#148085', '#20b2aa'] },
  { name: 'Batik Emerald', base: '#042618', shades: ['#02130c', '#042115', '#083d27', '#0e5a3a', '#10b981', '#34d399'] },
  { name: 'Highland Amber', base: '#2b1a04', shades: ['#140c02', '#211403', '#3d2606', '#664009', '#d97706', '#f59e0b'] },
  { name: 'Hmong Rose / Pink', base: '#2b0616', shades: ['#14020a', '#240412', '#450a24', '#70103a', '#db2777', '#f472b6'] },
  { name: 'Royal Purple', base: '#1e0633', shades: ['#0e0317', '#1a052e', '#320a57', '#581396', '#9333ea', '#c084fc'] },
  { name: 'Highland Mountain Mist', base: '#141e24', shades: ['#0a0f12', '#10181d', '#1b2830', '#2d3f4a', '#475e6d', '#64748b'] },
];

// Standard Colors Row
const STANDARD_COLORS = [
  { name: 'Dark Red', hex: '#7f1d1d' },
  { name: 'Red', hex: '#dc2626' },
  { name: 'Amber Orange', hex: '#d97706' },
  { name: 'Gold Yellow', hex: '#ca8a04' },
  { name: 'Light Green', hex: '#65a30d' },
  { name: 'Deep Emerald', hex: '#059669' },
  { name: 'Cyan Sky', hex: '#0891b2' },
  { name: 'Classic Blue', hex: '#2563eb' },
  { name: 'Navy Blue', hex: '#1e3a8a' },
  { name: 'Purple', hex: '#7e22ce' },
];

// Curated Background Image Wallpapers (Cultural, Scenic & Modern)
const CURATED_WALLPAPERS = [
  {
    name: 'Hmong Batik Indigo Textile',
    thumb: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=300&auto=format&fit=crop&q=60',
    url: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=1600&auto=format&fit=crop&q=80',
    description: 'Traditional Hmong beeswax batik & geometric embroidery texture',
  },
  {
    name: 'Sa Pa Highland Mountains & Terraces',
    thumb: 'https://images.unsplash.com/photo-1528127269322-539801943592?w=300&auto=format&fit=crop&q=60',
    url: 'https://images.unsplash.com/photo-1528127269322-539801943592?w=1600&auto=format&fit=crop&q=80',
    description: 'Majestic misty mountains of northern highland homeland',
  },
  {
    name: 'Deep Twilight Obsidian Starlight',
    thumb: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?w=300&auto=format&fit=crop&q=60',
    url: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?w=1600&auto=format&fit=crop&q=80',
    description: 'Atmospheric starry night sky over mountain peaks',
  },
  {
    name: 'Emerald Bamboo Forest Mist',
    thumb: 'https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?w=300&auto=format&fit=crop&q=60',
    url: 'https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?w=1600&auto=format&fit=crop&q=80',
    description: 'Lush green mountain bamboo forest canopy',
  },
];

// Rich Curated Gradients
const CURATED_GRADIENTS = [
  { name: 'Indigo Midnight', value: 'linear-gradient(135deg, #030814 0%, #091b36 50%, #031424 100%)' },
  { name: 'Jade Rainforest', value: 'linear-gradient(135deg, #02120b 0%, #052e1f 50%, #081e28 100%)' },
  { name: 'Obsidian Amber', value: 'linear-gradient(135deg, #120905 0%, #291504 50%, #0e0712 100%)' },
  { name: 'Highland Aurora', value: 'linear-gradient(135deg, #041f22 0%, #0b1a38 50%, #240a2b 100%)' },
  { name: 'Deep Cyber Slate', value: 'linear-gradient(135deg, #090d16 0%, #141c2c 50%, #080c14 100%)' },
  { name: 'Sunset Crimson', value: 'linear-gradient(135deg, #1c050f 0%, #380c1e 50%, #0d0617 100%)' },
];

export const ThemeColorBackgroundPicker: React.FC<ThemeColorBackgroundPickerProps> = ({
  currentBg,
  onSelectBg,
  onHoverPreview,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'palette' | 'gradients' | 'image'>('palette');
  const [highContrastOnly, setHighContrastOnly] = useState<boolean>(false);
  const [customColor, setCustomColor] = useState<string>('#0b101b');
  const [imageOpacity, setImageOpacity] = useState<number>(currentBg.imageOpacity || 0.35);
  const [imageBlur, setImageBlur] = useState<number>(currentBg.imageBlur || 4);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        onHoverPreview(null); // Clear preview when closed
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onHoverPreview]);

  // Handle Local Image Upload
  const handleUploadImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        const newBg: BackgroundConfig = {
          type: 'image',
          value: '#060b14', // fallback underlay
          imageUrl: dataUrl,
          name: file.name,
          imageOpacity,
          imageBlur,
          imageFit: 'cover',
        };
        onSelectBg(newBg);
      };
      reader.readAsDataURL(file);
    }
  };

  // Helper for applying swatch selection
  const handleSelectColor = (hex: string, name: string) => {
    const newBg: BackgroundConfig = {
      type: 'color',
      value: hex,
      name,
    };
    onSelectBg(newBg);
  };

  // Helper for applying gradient
  const handleSelectGradient = (grad: { name: string; value: string }) => {
    const newBg: BackgroundConfig = {
      type: 'gradient',
      value: grad.value,
      name: grad.name,
    };
    onSelectBg(newBg);
  };

  // Helper for applying wallpaper
  const handleSelectWallpaper = (wp: (typeof CURATED_WALLPAPERS)[0]) => {
    const newBg: BackgroundConfig = {
      type: 'image',
      value: '#060b14',
      imageUrl: wp.url,
      name: wp.name,
      imageOpacity,
      imageBlur,
      imageFit: 'cover',
    };
    onSelectBg(newBg);
  };

  // Live hover preview trigger
  const handleHoverSwatch = (config: BackgroundConfig | null) => {
    onHoverPreview(config);
  };

  // Reset to default
  const handleResetDefault = () => {
    const defaultBg: BackgroundConfig = {
      type: 'color',
      value: '#060b14',
      name: 'Default Midnight',
    };
    onSelectBg(defaultBg);
    onHoverPreview(null);
  };

  return (
    <div className="relative inline-block" ref={containerRef}>
      {/* Hidden File Input for Custom Background Upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleUploadImage}
        className="hidden"
      />

      {/* Main Trigger Button Label (Matches Screenshot Header Label) */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700/80 shadow-md text-xs font-semibold transition active:scale-95 group"
        title="Change theme color or upload custom background picture"
      >
        <div className="relative flex items-center justify-center">
          <Palette className="w-4 h-4 text-teal-400 group-hover:scale-110 transition-transform" />
          {/* Active color preview indicator */}
          <span
            className="absolute -bottom-1 -right-1 w-2.5 h-2.5 rounded-full border border-slate-900 shadow"
            style={{
              background:
                currentBg.type === 'image'
                  ? 'url(' + currentBg.imageUrl + ') center/cover'
                  : currentBg.value,
            }}
          />
        </div>

        <span className="hidden sm:inline">Background Theme</span>
        <span className="sm:hidden">Theme</span>

        {/* Small chevron */}
        <span className="text-[10px] text-slate-400 ml-0.5">▼</span>
      </button>

      {/* Office-Style Multi-Color Background Popup Palette */}
      {isOpen && (
        <div
          onMouseLeave={() => onHoverPreview(null)}
          className="absolute right-0 mt-2 z-50 w-[360px] sm:w-[410px] rounded-2xl border border-slate-700 bg-slate-950/98 shadow-2xl backdrop-blur-xl p-4 text-slate-200 animate-in fade-in zoom-in-95 duration-150 space-y-3.5 select-none"
        >
          {/* Top Header: Title & High-Contrast Toggle Switch */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-100">
              <Palette className="w-4 h-4 text-teal-400" />
              <span>Theme & Background Colors</span>
            </div>

            {/* High-contrast only switch (matches screenshot) */}
            <label className="flex items-center gap-2 cursor-pointer text-[11px] text-slate-400 hover:text-slate-200">
              <span>High-contrast only</span>
              <div
                onClick={() => setHighContrastOnly((prev) => !prev)}
                className={`relative w-8 h-4 rounded-full transition-colors ${
                  highContrastOnly ? 'bg-teal-500' : 'bg-slate-800'
                }`}
              >
                <div
                  className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
                    highContrastOnly ? 'translate-x-4' : 'translate-x-0.5'
                  }`}
                />
              </div>
            </label>
          </div>

          {/* Tab Selector: Palette / Gradients / Custom Picture */}
          <div className="flex items-center p-1 bg-slate-900/90 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setActiveTab('palette')}
              className={`flex-1 py-1 rounded-lg font-medium transition ${
                activeTab === 'palette'
                  ? 'bg-teal-600 text-white shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Colors Palette
            </button>

            <button
              onClick={() => setActiveTab('gradients')}
              className={`flex-1 py-1 rounded-lg font-medium transition ${
                activeTab === 'gradients'
                  ? 'bg-teal-600 text-white shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Gradients
            </button>

            <button
              onClick={() => setActiveTab('image')}
              className={`flex-1 py-1 rounded-lg font-medium transition flex items-center justify-center gap-1 ${
                activeTab === 'image'
                  ? 'bg-teal-600 text-white shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <ImageIcon className="w-3 h-3" />
              <span>Custom Picture</span>
            </button>
          </div>

          {/* TAB 1: Office-style Palette (Theme Colors Grid + Standard Colors) */}
          {activeTab === 'palette' && (
            <div className="space-y-3">
              {/* Automatic / Default button */}
              <button
                onClick={handleResetDefault}
                onMouseEnter={() =>
                  handleHoverSwatch({
                    type: 'color',
                    value: '#060b14',
                    name: 'Automatic Midnight',
                  })
                }
                className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg hover:bg-slate-900 border border-slate-800 transition text-xs text-left"
              >
                <span className="w-4 h-4 rounded-sm bg-[#060b14] border border-slate-600 shadow-xs" />
                <span className="font-medium text-slate-200">Automatic (Hmong Midnight Dark)</span>
              </button>

              {/* Theme Colors Section */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-slate-400 block">
                  Theme Colors
                </span>

                {/* 10 Columns x 6 rows */}
                <div className="grid grid-cols-10 gap-1.5 p-2 rounded-xl bg-slate-900/60 border border-slate-800/80">
                  {THEME_COLUMNS.map((col, colIdx) => (
                    <div key={colIdx} className="flex flex-col gap-1.5 items-center">
                      {/* Base main swatch */}
                      <button
                        onClick={() => handleSelectColor(col.base, col.name)}
                        onMouseEnter={() =>
                          handleHoverSwatch({
                            type: 'color',
                            value: col.base,
                            name: col.name,
                          })
                        }
                        className={`w-6 h-6 rounded-sm border transition transform hover:scale-125 hover:z-20 hover:shadow-lg ${
                          currentBg.value === col.base
                            ? 'ring-2 ring-teal-400 border-white z-10'
                            : 'border-slate-700/60 hover:border-white'
                        }`}
                        style={{ backgroundColor: col.base }}
                        title={`${col.name} (${col.base})`}
                      />

                      {/* 5 Shaded Tints */}
                      {col.shades.slice(1).map((shade, rowIdx) => {
                        const isMatch = currentBg.value === shade;
                        const isDarkEnough = highContrastOnly
                          ? shade.startsWith('#0') || shade.startsWith('#1') || shade.startsWith('#2')
                          : true;

                        return (
                          <button
                            key={rowIdx}
                            disabled={!isDarkEnough}
                            onClick={() => handleSelectColor(shade, `${col.name} ${rowIdx + 1}`)}
                            onMouseEnter={() =>
                              isDarkEnough &&
                              handleHoverSwatch({
                                type: 'color',
                                value: shade,
                                name: `${col.name} tint`,
                              })
                            }
                            className={`w-6 h-5 rounded-xs border transition transform hover:scale-125 hover:z-20 hover:shadow-md ${
                              !isDarkEnough
                                ? 'opacity-20 cursor-not-allowed border-transparent'
                                : isMatch
                                ? 'ring-2 ring-teal-400 border-white z-10'
                                : 'border-slate-800/80 hover:border-white'
                            }`}
                            style={{ backgroundColor: shade }}
                            title={`${col.name} shade (${shade})`}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>

              {/* Standard Colors Section */}
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] font-semibold text-slate-400 block">
                  Standard Colors
                </span>

                <div className="flex items-center justify-between gap-1 p-2 rounded-xl bg-slate-900/60 border border-slate-800/80">
                  {STANDARD_COLORS.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSelectColor(item.hex, item.name)}
                      onMouseEnter={() =>
                        handleHoverSwatch({
                          type: 'color',
                          value: item.hex,
                          name: item.name,
                        })
                      }
                      className={`w-6 h-6 rounded-sm border transition transform hover:scale-125 hover:z-20 hover:shadow-lg ${
                        currentBg.value === item.hex
                          ? 'ring-2 ring-teal-400 border-white z-10'
                          : 'border-slate-700/60 hover:border-white'
                      }`}
                      style={{ backgroundColor: item.hex }}
                      title={`${item.name} (${item.hex})`}
                    />
                  ))}
                </div>
              </div>

              {/* Custom HEX Picker Row */}
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800 text-xs">
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={customColor}
                    onChange={(e) => {
                      setCustomColor(e.target.value);
                      handleHoverSwatch({
                        type: 'color',
                        value: e.target.value,
                        name: 'Custom Color',
                      });
                    }}
                    className="w-7 h-7 rounded cursor-pointer border border-slate-700 bg-transparent"
                  />
                  <span className="text-[11px] text-slate-400">Custom Color:</span>
                  <span className="font-mono text-[11px] text-teal-300 font-bold">{customColor}</span>
                </div>

                <button
                  onClick={() => handleSelectColor(customColor, 'Custom Color')}
                  className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold border border-slate-700 transition active:scale-95"
                >
                  Apply Color
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: Curated Rich Gradients */}
          {activeTab === 'gradients' && (
            <div className="space-y-3">
              <p className="text-[11px] text-slate-400">
                Hover over any gradient to preview live on the background:
              </p>

              <div className="grid grid-cols-2 gap-2.5 max-h-64 overflow-y-auto pr-1">
                {CURATED_GRADIENTS.map((grad, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSelectGradient(grad)}
                    onMouseEnter={() =>
                      handleHoverSwatch({
                        type: 'gradient',
                        value: grad.value,
                        name: grad.name,
                      })
                    }
                    className={`h-16 rounded-xl border p-2 flex flex-col justify-end text-left transition transform hover:scale-[1.02] shadow-md group ${
                      currentBg.value === grad.value
                        ? 'border-teal-400 ring-2 ring-teal-400/40'
                        : 'border-slate-800 hover:border-slate-600'
                    }`}
                    style={{ background: grad.value }}
                  >
                    <span className="text-xs font-bold text-white drop-shadow-md">
                      {grad.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: Custom & Curated Background Pictures */}
          {activeTab === 'image' && (
            <div className="space-y-3.5">
              {/* Upload Own Picture Card */}
              <div className="p-3 rounded-xl border border-dashed border-teal-500/50 bg-teal-950/20 hover:bg-teal-950/30 transition text-center space-y-2">
                <div className="flex items-center justify-center gap-2 text-teal-300 text-xs font-semibold">
                  <Upload className="w-4 h-4 text-teal-400" />
                  <span>Upload Your Own Background Picture</span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Select any PNG, JPG, or WebM photo from your device.
                </p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-bold shadow-md shadow-teal-950 transition active:scale-95"
                >
                  Choose Picture File
                </button>
              </div>

              {/* Curated Hmong Cultural & Scenic Wallpaper Presets */}
              <div className="space-y-2">
                <span className="text-[11px] font-semibold text-slate-400 block">
                  Cultural & Scenic Wallpapers (Hover to Preview):
                </span>

                <div className="grid grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-1">
                  {CURATED_WALLPAPERS.map((wp, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSelectWallpaper(wp)}
                      onMouseEnter={() =>
                        handleHoverSwatch({
                          type: 'image',
                          value: '#060b14',
                          imageUrl: wp.url,
                          name: wp.name,
                          imageOpacity,
                          imageBlur,
                          imageFit: 'cover',
                        })
                      }
                      className={`relative h-20 rounded-xl overflow-hidden border text-left group transition transform hover:scale-[1.02] shadow-md ${
                        currentBg.imageUrl === wp.url
                          ? 'border-teal-400 ring-2 ring-teal-400/40'
                          : 'border-slate-800 hover:border-slate-600'
                      }`}
                    >
                      <img
                        src={wp.thumb}
                        alt={wp.name}
                        className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition duration-300"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent p-2 flex flex-col justify-end">
                        <span className="text-[11px] font-bold text-white leading-tight drop-shadow">
                          {wp.name}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Image Fine-Tuning: Opacity & Blur Sliders */}
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2 text-xs">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>Background Tint Opacity:</span>
                  <span className="font-mono text-teal-300 font-bold">
                    {Math.round(imageOpacity * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={imageOpacity}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setImageOpacity(val);
                    if (currentBg.type === 'image') {
                      onSelectBg({ ...currentBg, imageOpacity: val });
                    }
                  }}
                  className="w-full accent-teal-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                />

                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                  <span>Glassmorphism Blur:</span>
                  <span className="font-mono text-teal-300 font-bold">{imageBlur}px</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="16"
                  step="1"
                  value={imageBlur}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setImageBlur(val);
                    if (currentBg.type === 'image') {
                      onSelectBg({ ...currentBg, imageBlur: val });
                    }
                  }}
                  className="w-full accent-teal-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                />
              </div>

              {/* Clear Picture button */}
              {currentBg.type === 'image' && (
                <button
                  onClick={handleResetDefault}
                  className="w-full py-1.5 rounded-xl bg-slate-900 hover:bg-rose-950/40 text-slate-400 hover:text-rose-300 border border-slate-800 text-xs transition"
                >
                  Remove Picture & Revert to Solid Color
                </button>
              )}
            </div>
          )}

          {/* Bottom Footer Info */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-[11px] text-slate-400">
            <span className="flex items-center gap-1 text-slate-500">
              <Eye className="w-3 h-3 text-teal-400" />
              <span>Hovering swatches live-previews background</span>
            </span>

            <button
              onClick={() => {
                setIsOpen(false);
                onHoverPreview(null);
              }}
              className="px-2.5 py-1 rounded bg-teal-600 hover:bg-teal-500 text-white font-semibold transition"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

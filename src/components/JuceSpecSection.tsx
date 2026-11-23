import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface JuceSpecSectionProps {
  onNotify: (msg: string) => void;
}

export const JuceSpecSection: React.FC<JuceSpecSectionProps> = ({ onNotify }) => {
  const [copied, setCopied] = useState(false);

  const juceHeaderCode = `// VektorTheme.h — Shared tokens for VektorDelay & Vektor Series (JUCE C++20 / VST3 & AU)
#pragma once
#include <juce_gui_basics/juce_gui_basics.h>

namespace VektorTheme
{
    // Official Vektor Series Palette (Obsidian + Phosphor Green + Mint)
    inline const juce::Colour chassisBg       { 0xff121416 };
    inline const juce::Colour panelBg         { 0xff15171a };
    inline const juce::Colour scopeBg         { 0xff0b0c0e };
    inline const juce::Colour borderHairline  { 0xff24272a };
    inline const juce::Colour gridLine        { 0xff181b1f };

    inline const juce::Colour accentGreen     { 0xff22e55e };
    inline const juce::Colour accentMint      { 0xff3ae39e };
    inline const juce::Colour trackInactive   { 0xff272a2e };
    inline const juce::Colour textPrimary     { 0xfff3f4f6 };
    inline const juce::Colour textMuted       { 0xff6b7280 };

    // VektorDelay 5-Mode Sequenced Architecture (Pattern + Vector Orb + Filters + Ducker)
    constexpr int editorWidth      = 1040;
    constexpr int editorHeight     = 720;
    constexpr int topBarHeight     = 54;
    constexpr int delayScopeHeight = 366;
    constexpr int engineBarHeight  = 128;
    constexpr int footerBarHeight  = 114;
    constexpr float panelRadius    = 8.0f;
}`;

  const handleCopy = () => {
    navigator.clipboard?.writeText(juceHeaderCode).catch(() => {});
    setCopied(true);
    onNotify('VektorTheme.h header copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full max-w-[1160px] mx-auto px-6 pb-20 space-y-16">
      <section id="anatomy" className="border-t border-[#1E2125] pt-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <p className="font-mono text-xs tracking-wider text-slate-500 uppercase">
              01 · Creative Delay Architecture
            </p>
            <h2 className="font-display text-2xl font-bold text-slate-100 mt-1 text-balance">
              5-Mode Vector Orb, 8-Step Sequencer &amp; Ducker Engine
            </h2>
          </div>
          <p className="text-sm text-slate-400 max-w-md">
            Combines five character delay algorithms (Air, Magnetic, Circuit, Aether, Reverse), an 8-step panning sequencer or Dual routing engine, pre/post EQ damping, and sidechain ducking inside the unified 1040px Vektor chassis.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="border border-[#24272A] bg-[#121416] p-5 rounded-lg">
            <div className="font-mono text-xs text-[#22E55E] tabular-nums">1040 × 54 px</div>
            <h3 className="font-display text-base font-semibold text-slate-100 mt-1.5">
              Unified Header
            </h3>
            <p className="text-sm text-slate-400 mt-2 leading-relaxed">
              Illuminated Bypass, <span className="text-slate-200">− BPM +</span> stepper, <span className="text-slate-200">AUDIO / MIDI / DUAL</span> routing, <span className="text-slate-200">RANDOM</span>, unified preset browser &amp; save, and <span className="text-slate-200">A | B</span> comparator.
            </p>
          </div>

          <div className="border border-[#24272A] bg-[#121416] p-5 rounded-lg">
            <div className="font-mono text-xs text-[#22E55E] tabular-nums">882 × 366 px</div>
            <h3 className="font-display text-base font-semibold text-slate-100 mt-1.5">
              Pattern, Orb, Filters &amp; Feedback Path
            </h3>
            <p className="text-sm text-slate-400 mt-2 leading-relaxed">
              <span className="text-slate-200">AIR · MAGNETIC · CIRCUIT · AETHER · REVERSE</span> modes with sub-types, <span className="text-slate-200">DUAL / SEQUENCE</span> 8-step panner, <span className="text-slate-200">TEST / FREEZE</span>, morphing vector orb, <span className="text-slate-200">PRE/POST</span> filter curve, and live <span className="text-slate-200">Feedback Path</span> canvas.
            </p>
          </div>

          <div className="border border-[#24272A] bg-[#121416] p-5 rounded-lg">
            <div className="font-mono text-xs text-[#22E55E] tabular-nums">882 × 128 px</div>
            <h3 className="font-display text-base font-semibold text-slate-100 mt-1.5">
              Groove &amp; Delay Engine
            </h3>
            <p className="text-sm text-slate-400 mt-2 leading-relaxed">
              Combines <span className="text-slate-200">SYNC/FREE</span>, <span className="text-slate-200">SWING</span>, <span className="text-slate-200">OFFSET</span>, <span className="text-slate-200">DELAY</span>, <span className="text-slate-200">FEEDBACK</span>, <span className="text-slate-200">MOD RATE</span>, and <span className="text-slate-200">MOD AMT</span> with a <span className="text-slate-200">6×2 TIMEBASE</span> matrix.
            </p>
          </div>

          <div className="border border-[#24272A] bg-[#121416] p-5 rounded-lg">
            <div className="font-mono text-xs text-[#22E55E] tabular-nums">114 × 608 px + Ducker</div>
            <h3 className="font-display text-base font-semibold text-slate-100 mt-1.5">
              Filters, Ducker &amp; I/O VU
            </h3>
            <p className="text-sm text-slate-400 mt-2 leading-relaxed">
              Mode-adaptive <span className="text-slate-200">CHARACTER / PITCH</span>, <span className="text-slate-200">WIDTH</span>, <span className="text-slate-200">LOW/HIGH CUT</span>, <span className="text-slate-200">DUCKER (POST/FB/BOTH + EXT SC)</span>, <span className="text-slate-200">OUT</span>, and <span className="text-slate-200">MIX</span> paired with the Stereo I/O VU Canvas.
            </p>
          </div>
        </div>
      </section>

      <section id="juce-spec" className="border-t border-[#1E2125] pt-12">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <p className="font-mono text-xs tracking-wider text-slate-500 uppercase">
              02 · C++ / JUCE Specification
            </p>
            <h2 className="font-display text-2xl font-bold text-slate-100 mt-1">
              Shared Constants (`VektorTheme.h`)
            </h2>
          </div>

          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-xs font-medium bg-[#22E55E] text-[#07090A] hover:bg-[#34F06D] transition-colors cursor-pointer whitespace-nowrap shrink-0 self-start sm:self-auto"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied' : 'Copy VektorTheme.h'}
          </button>
        </div>

        <pre className="rounded-lg border border-[#24272A] bg-[#0B0C0E] p-5 overflow-x-auto font-mono text-xs leading-relaxed text-slate-300">
          <code>{juceHeaderCode}</code>
        </pre>
      </section>
    </div>
  );
};

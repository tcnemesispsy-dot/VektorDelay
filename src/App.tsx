import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';
import { DELAY_PRESETS, VEKTOR_TREM_COLORS } from './data/vektorDelayData';
import { VektorDelayFaceplate, FaceplateState } from './components/VektorDelayFaceplate';
import { JuceSpecSection } from './components/JuceSpecSection';

const presetA = DELAY_PRESETS[0];
const presetB = DELAY_PRESETS[3];

const makeStateFromPreset = (presetIndex: number, slot: 'A' | 'B'): FaceplateState => {
  const p = DELAY_PRESETS[presetIndex];
  return {
    bypassed: false,
    bpm: 120,
    activeSlot: slot,
    presetIndex,
    presetName: p.name,
    delayMode: p.delayMode,
    subType: p.subType,
    patternMode: p.patternMode,
    dualRouting: p.dualRouting,
    dualRatio: p.dualRatio,
    lrOffsetMs: p.lrOffsetMs,
    seqPlayMode: p.seqPlayMode,
    seqStepCount: p.seqStepCount,
    seqSteps: p.seqSteps.map((s) => ({ ...s })),
    syncMode: p.syncMode,
    timebaseId: p.timebaseId,
    delayTimeMs: p.delayTimeMs,
    swing: p.swing,
    offsetMs: p.offsetMs,
    feedback: p.feedback,
    modRateHz: p.modRateHz,
    modAmt: p.modAmt,
    characterVal: p.characterVal,
    pitchSemitones: p.pitchSemitones,
    width: p.width,
    filterPos: p.filterPos,
    lowCutHz: p.lowCutHz,
    highCutHz: p.highCutHz,
    lowDampPct: p.lowDampPct,
    lowDampFreqHz: p.lowDampFreqHz,
    highDampPct: p.highDampPct,
    highDampFreqHz: p.highDampFreqHz,
    duckerTarget: p.duckerTarget,
    extSidechain: p.extSidechain,
    duckAmt: p.duckAmt,
    duckRelease: p.duckRelease,
    outTrimDb: p.outTrimDb,
    mix: p.mix,
    freeze: p.freeze,
    insertMode: 'hybrid',
  };
};

export default function App() {
  const [slotA, setSlotA] = useState<FaceplateState>(() => makeStateFromPreset(0, 'A'));
  const [slotB, setSlotB] = useState<FaceplateState>(() => makeStateFromPreset(3, 'B'));
  const [activeSlot, setActiveSlot] = useState<'A' | 'B'>('A');
  const [isPlaying, setIsPlaying] = useState(false);
  const [dawScale, setDawScale] = useState<number>(1);
  const [containerScale, setContainerScale] = useState<number>(1);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const stageWrapperRef = useRef<HTMLDivElement>(null);
  const toastTimerRef = useRef<number | null>(null);

  const currentState = activeSlot === 'A' ? slotA : slotB;
  const setCurrentState: React.Dispatch<React.SetStateAction<FaceplateState>> = (updater) => {
    if (activeSlot === 'A') {
      setSlotA(updater);
    } else {
      setSlotB(updater);
    }
  };

  const notify = (msg: string) => {
    setToastMsg(msg);
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setToastMsg(null);
    }, 2500);
  };

  // Fit 1040px plugin faceplate gracefully inside any viewport width
  useEffect(() => {
    const updateScale = () => {
      if (!stageWrapperRef.current) return;
      const availableWidth = stageWrapperRef.current.clientWidth - 32;
      const targetWidth = 1040 * dawScale;
      if (availableWidth < targetWidth) {
        setContainerScale(Math.max(0.32, availableWidth / 1040));
      } else {
        setContainerScale(dawScale);
      }
    };
    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, [dawScale]);

  const handleSwitchSlot = (nextSlot: 'A' | 'B') => {
    setActiveSlot(nextSlot);
    if (nextSlot === 'A') {
      setSlotA((prev) => ({ ...prev, activeSlot: 'A' }));
    } else {
      setSlotB((prev) => ({ ...prev, activeSlot: 'B' }));
    }
  };

  const handleReset = () => {
    if (activeSlot === 'A') {
      setSlotA(makeStateFromPreset(0, 'A'));
      notify(`Slot A reset (${presetA.name})`);
    } else {
      setSlotB(makeStateFromPreset(3, 'B'));
      notify(`Slot B reset (${presetB.name})`);
    }
  };

  const scrollToSpec = () => {
    document.getElementById('juce-spec')?.scrollIntoView({ behavior: 'smooth' });
  };

  const faceplateHeightPx = Math.round(740 * containerScale);

  return (
    <div className="min-h-screen flex flex-col bg-[#08090A] text-slate-100">
      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header className="w-full border-b border-[#1E2125] bg-[#08090A]/90 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-[1280px] mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <a
            href="#faceplate"
            className="font-display text-lg font-bold tracking-[0.18em] text-slate-100 whitespace-nowrap shrink-0 uppercase"
          >
            Vektor<span style={{ color: VEKTOR_TREM_COLORS.accentGreen }}>Delay</span>
          </a>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-400">
            <a
              href="#faceplate"
              className="hover:text-slate-100 transition-colors whitespace-nowrap shrink-0"
            >
              Faceplate
            </a>
            <a
              href="#anatomy"
              className="hover:text-slate-100 transition-colors whitespace-nowrap shrink-0"
            >
              Architecture
            </a>
            <a
              href="#juce-spec"
              className="hover:text-slate-100 transition-colors whitespace-nowrap shrink-0"
            >
              JUCE Spec
            </a>
          </nav>

          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={scrollToSpec}
              className="px-4 py-2 rounded-md text-xs font-semibold bg-[#22E55E] text-[#07090A] hover:bg-[#34F06D] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              View JUCE Tokens
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* ======================== HERO & STUDIO STAGE ======================== */}
        <section id="faceplate" className="max-w-[1280px] mx-auto px-6 pt-8 pb-14">
          {/* Editorial Intro + Studio Controls */}
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-7">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                <span>Vektor Series</span>
                <span aria-hidden="true">·</span>
                <span>VST3 &amp; AU</span>
                <span aria-hidden="true">·</span>
                <span>5-Mode Creative Sequenced Delay</span>
              </div>
              <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-slate-100 mt-1.5 text-balance">
                VektorDelay Faceplate · Unified Vektor Line
              </h1>
              <p className="text-sm text-slate-400 mt-2 leading-relaxed max-w-xl">
                Centered-value encoders, obsidian chassis, and phosphor green accents unified with the Vektor Series — featuring 5 delay algorithms, 8-step sequencer &amp; dual stereo routing, pre/post damping filters, freeze, and ducking.
              </p>
            </div>

            {/* Compact Studio Controls */}
            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setIsPlaying((v) => !v)}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md text-xs font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                style={{
                  borderColor: isPlaying ? VEKTOR_TREM_COLORS.accentGreen : '#2A2E33',
                  backgroundColor: isPlaying ? VEKTOR_TREM_COLORS.accentGreenSoft : '#121416',
                  color: isPlaying ? VEKTOR_TREM_COLORS.accentGreen : '#E5E7EB',
                }}
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                {isPlaying ? 'Pause Transport' : 'Simulate Transport'}
              </button>

              <div className="hidden sm:flex items-center gap-1 p-1 rounded-md bg-[#0E1012] border border-[#24272A]">
                {[0.85, 1, 1.1].map((scaleVal) => (
                  <button
                    key={scaleVal}
                    type="button"
                    onClick={() => setDawScale(scaleVal)}
                    className={`px-2.5 py-1 rounded text-xs font-mono tabular-nums transition-colors cursor-pointer ${
                      dawScale === scaleVal
                        ? 'bg-[#22252A] text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {Math.round(scaleVal * 100)}%
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium text-slate-300 hover:text-white bg-[#121416] border border-[#24272A] hover:border-[#3A3E45] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset
              </button>
            </div>
          </div>

          {/* Centerpiece VST3 / AU Plugin Faceplate Stage */}
          <div
            ref={stageWrapperRef}
            className="w-full flex flex-col items-center justify-center py-6 rounded-xl border border-[#1E2125] bg-[#060708]"
          >
            <div
              className="flex items-start justify-center transition-all duration-200"
              style={{ height: `${faceplateHeightPx}px` }}
            >
              <div
                style={{
                  transform: `scale(${containerScale})`,
                  transformOrigin: 'top center',
                }}
              >
                <VektorDelayFaceplate
                  state={currentState}
                  slotBState={slotB}
                  onChangeState={setCurrentState}
                  onSwitchSlot={handleSwitchSlot}
                  onReset={handleReset}
                  isPlaying={isPlaying}
                  onNotify={notify}
                />
              </div>
            </div>

            <p className="mt-4 text-xs text-slate-500 text-center px-4">
              Switch between AIR / MAGNETIC / CIRCUIT / AETHER / REVERSE modes, program the 8-step sequencer or Dual Ping-Pong/Criss-Cross ratios, trigger TEST tone or FREEZE, and right-click any control in MIDI Learn mode.
            </p>
          </div>
        </section>

        <JuceSpecSection onNotify={notify} />
      </main>

      <footer className="border-t border-[#1E2125] py-6 px-6">
        <div className="max-w-[1280px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <span>VektorDelay · VST3 / AU Faceplate Design (Vektor Series)</span>
          <span>Ready-to-port C++ / JUCE LookAndFeel specification</span>
        </div>
      </footer>

      {toastMsg && (
        <div
          role="status"
          className="fixed bottom-5 right-5 z-50 px-4 py-2.5 rounded-md bg-[#121416] border border-[#2D3136] text-xs text-slate-100 shadow-2xl"
        >
          {toastMsg}
        </div>
      )}
    </div>
  );
}

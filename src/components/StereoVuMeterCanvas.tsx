import React, { useEffect, useRef, useState } from 'react';
import { VEKTOR_TREM_COLORS } from '../data/vektorGateData';
import { evaluateSignalShape } from './SignalWaveformSvg';

interface StereoVuMeterCanvasProps {
  levels: number[];
  modes: number[];
  enabledSteps: boolean[];
  stepCount: number;
  bpm: number;
  beatsPerStep: number;
  envTime: number;
  smooth: number;
  depth: number;
  releaseMs: number;
  outTrimDb: number;
  mix: number;
  bypassed: boolean;
  isPlaying: boolean;
  activePlayheadStep: number;
}

const MIN_DB = -48;
const MAX_DB = 6;
const DB_RANGE = MAX_DB - MIN_DB;

function dbToNorm(db: number): number {
  return Math.min(1, Math.max(0, (db - MIN_DB) / DB_RANGE));
}

function gainToDb(linear: number): number {
  if (linear <= 0.0001) return MIN_DB;
  return Math.max(MIN_DB, Math.min(MAX_DB + 1.5, 20 * Math.log10(linear)));
}

const SCALE_TICKS = [6, 3, 0, -3, -6, -12, -18, -24, -36, -48];

/**
 * Dual-Pair Stereo Input / Output VU Meter rendered on HTML5 Canvas
 * for real-time gain staging inspection on the right side of VektorGate.
 */
export const StereoVuMeterCanvas: React.FC<StereoVuMeterCanvasProps> = ({
  levels,
  modes,
  enabledSteps,
  stepCount,
  bpm,
  beatsPerStep,
  envTime,
  smooth,
  depth,
  releaseMs,
  outTrimDb,
  mix,
  bypassed,
  isPlaying,
  activePlayheadStep,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [readout, setReadout] = useState({ inDb: -9.4, outDb: -9.4, clipped: false });
  const clipLatchedRef = useRef(false);

  const latestPropsRef = useRef({
    levels,
    modes,
    enabledSteps,
    stepCount,
    bpm,
    beatsPerStep,
    envTime,
    smooth,
    depth,
    releaseMs,
    outTrimDb,
    mix,
    bypassed,
    isPlaying,
    activePlayheadStep,
  });

  latestPropsRef.current = {
    levels,
    modes,
    enabledSteps,
    stepCount,
    bpm,
    beatsPerStep,
    envTime,
    smooth,
    depth,
    releaseMs,
    outTrimDb,
    mix,
    bypassed,
    isPlaying,
    activePlayheadStep,
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    const startTime = performance.now();
    let lastTime = startTime;
    let lastReadoutTime = 0;

    // Smoothed meter values in dB
    let vuInL = -18;
    let vuInR = -18;
    let vuOutL = -18;
    let vuOutR = -18;

    // Peak hold in dB + hold timers
    let peakInL = -18;
    let peakInR = -18;
    let peakOutL = -18;
    let peakOutR = -18;
    let holdInL = 0;
    let holdInR = 0;
    let holdOutL = 0;
    let holdOutR = 0;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      if (
        w > 0 &&
        h > 0 &&
        (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr))
      ) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
      }
    };

    resize();
    const observer = new ResizeObserver(resize);
    if (canvas.parentElement) {
      observer.observe(canvas.parentElement);
    }

    const render = (now: number) => {
      const p = latestPropsRef.current;
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
      lastTime = now;
      const elapsedSec = (now - startTime) / 1000;

      // Compute step phase synchronized with BPM & timebase
      const stepDurationSec = Math.max(0.04, (60 / p.bpm) * p.beatsPerStep);
      const continuousStep = p.isPlaying
        ? (elapsedSec / stepDurationSec) % Math.max(2, p.stepCount)
        : p.activePlayheadStep;
      const stepIdx = p.isPlaying
        ? p.activePlayheadStep % Math.max(2, p.stepCount)
        : Math.floor(elapsedSec * 2) % Math.max(2, p.stepCount);
      const frac = p.isPlaying
        ? (elapsedSec % stepDurationSec) / stepDurationSec
        : (elapsedSec * 1.4) % 1;

      // Simulated stereo input program signal (around -6 dBFS when playing, -10 dBFS idle monitor)
      const baseInputLin = p.isPlaying ? 0.56 : 0.34;
      const pulse = p.isPlaying
        ? 0.84 + 0.22 * Math.sin(continuousStep * Math.PI * 2)
        : 0.9 + 0.1 * Math.sin(elapsedSec * 3.1);
      const stereoDriftL = 1 + 0.08 * Math.sin(elapsedSec * 5.3);
      const stereoDriftR = 1 + 0.08 * Math.cos(elapsedSec * 4.7 + 0.7);

      const inLinL = baseInputLin * pulse * stereoDriftL;
      const inLinR = baseInputLin * pulse * stereoDriftR;

      // Compute gate gain for current step
      let gateGainL = 1;
      let gateGainR = 1;

      if (!p.bypassed) {
        const isStepEnabled = p.enabledSteps[stepIdx] ?? true;
        const lvl = isStepEnabled ? (p.levels[stepIdx] ?? 0.5) : 0;
        const modeId = p.modes[stepIdx] ?? 0;
        const shapedFrac = Math.min(1, frac / Math.max(0.25, p.envTime));
        const shapeVal =
          frac / Math.max(0.25, p.envTime) > 1 && (modeId === 1 || modeId === 2)
            ? 0.04
            : evaluateSignalShape(modeId, modeId === 1 || modeId === 2 ? shapedFrac : frac);

        const releaseTail = Math.min(0.28, (p.releaseMs / 100) * 0.28);
        const rawWet = isStepEnabled ? Math.max(releaseTail * lvl, lvl * shapeVal) : 0;
        const smoothedWet = rawWet * (1 - p.smooth * 0.12) + lvl * (p.smooth * 0.12);
        const gated = 1 - p.mix + p.mix * (1 - p.depth + p.depth * smoothedWet);

        gateGainL = gated;
        gateGainR = gated * (0.97 + 0.03 * Math.cos(elapsedSec * 3.4));
      }

      const outTrimLinear = p.bypassed ? 1 : Math.pow(10, p.outTrimDb / 20);
      const targetInDbL = gainToDb(inLinL);
      const targetInDbR = gainToDb(inLinR);
      const targetOutDbL = gainToDb(inLinL * gateGainL * outTrimLinear);
      const targetOutDbR = gainToDb(inLinR * gateGainR * outTrimLinear);

      // VU ballistic integration (fast attack, smooth release weighted by releaseMs)
      const smoothMeter = (cur: number, target: number) => {
        const rate = target > cur ? 24 : Math.max(5.5, 13 - (p.releaseMs / 100) * 6);
        return cur + (target - cur) * (1 - Math.exp(-rate * dt));
      };

      vuInL = smoothMeter(vuInL, targetInDbL);
      vuInR = smoothMeter(vuInR, targetInDbR);
      vuOutL = smoothMeter(vuOutL, targetOutDbL);
      vuOutR = smoothMeter(vuOutR, targetOutDbR);

      // Peak hold update
      const updatePeak = (
        val: number,
        peak: number,
        hold: number
      ): [number, number] => {
        if (val >= peak) return [val, 0.85];
        if (hold > 0) return [peak, hold - dt];
        return [Math.max(MIN_DB, peak - 18 * dt), 0];
      };

      [peakInL, holdInL] = updatePeak(vuInL, peakInL, holdInL);
      [peakInR, holdInR] = updatePeak(vuInR, peakInR, holdInR);
      [peakOutL, holdOutL] = updatePeak(vuOutL, peakOutL, holdOutL);
      [peakOutR, holdOutR] = updatePeak(vuOutR, peakOutR, holdOutR);

      if (vuOutL > 0 || vuOutR > 0) {
        clipLatchedRef.current = true;
      }

      // Throttle React readout updates to ~15Hz
      if (now - lastReadoutTime > 65) {
        lastReadoutTime = now;
        const maxIn = Math.max(vuInL, vuInR);
        const maxOut = Math.max(vuOutL, vuOutR);
        setReadout({
          inDb: Number(maxIn.toFixed(1)),
          outDb: Number(maxOut.toFixed(1)),
          clipped: clipLatchedRef.current || maxOut > 0,
        });
      }

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;

      if (width > 0 && height > 0) {
        ctx.save();
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, width, height);

        const padTop = 8;
        const padBottom = 14;
        const meterTop = padTop;
        const meterBottom = height - padBottom;
        const meterH = Math.max(40, meterBottom - meterTop);

        // Layout: [IN L][IN R]  [dB Scale]  [OUT L][OUT R]
        const barW = 9;
        const pairGap = 2;
        const scaleW = 24;
        const totalMeterW = barW * 4 + pairGap * 2 + scaleW + 10;
        const startX = Math.max(4, (width - totalMeterW) * 0.5);

        const inLX = startX;
        const inRX = inLX + barW + pairGap;
        const scaleCenterX = inRX + barW + 5 + scaleW * 0.5;
        const outLX = inRX + barW + 10 + scaleW;
        const outRX = outLX + barW + pairGap;

        const yForDb = (db: number) => meterBottom - dbToNorm(db) * meterH;
        const zeroDbY = yForDb(0);

        // Subtle 0 dB reference line spanning across all bars
        ctx.strokeStyle = 'rgba(249, 115, 22, 0.35)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(inLX - 2, zeroDbY);
        ctx.lineTo(outRX + barW + 2, zeroDbY);
        ctx.stroke();

        // Draw calibrated center dB scale ticks
        ctx.font = '500 8px "JetBrains Mono", ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        for (const tick of SCALE_TICKS) {
          const ty = yForDb(tick);
          ctx.strokeStyle = tick === 0 ? 'rgba(249, 115, 22, 0.55)' : 'rgba(255,255,255,0.08)';
          ctx.beginPath();
          ctx.moveTo(scaleCenterX - 10, ty);
          ctx.lineTo(scaleCenterX - 7, ty);
          ctx.moveTo(scaleCenterX + 7, ty);
          ctx.lineTo(scaleCenterX + 10, ty);
          ctx.stroke();

          ctx.fillStyle = tick > 0 ? '#F87171' : tick === 0 ? '#FBBF24' : '#64748B';
          ctx.fillText(tick > 0 ? `+${tick}` : `${tick}`, scaleCenterX, ty);
        }

        // Helper to draw a segmented LED VU bar
        const drawMeterBar = (
          x: number,
          dbVal: number,
          peakVal: number,
          isInputMeter: boolean
        ) => {
          // Track recess
          ctx.fillStyle = '#07080A';
          ctx.fillRect(x, meterTop, barW, meterH);
          ctx.strokeStyle = '#1B1E23';
          ctx.lineWidth = 1;
          ctx.strokeRect(x + 0.5, meterTop + 0.5, barW - 1, meterH - 1);

          const segments = 34;
          const segGap = 1.5;
          const segH = (meterH - 4 - segGap * (segments - 1)) / segments;
          const activeNorm = dbToNorm(dbVal);
          const activeCount = Math.round(activeNorm * segments);

          for (let s = 0; s < segments; s++) {
            const segNormTop = (s + 1) / segments;
            const segDb = MIN_DB + segNormTop * DB_RANGE;
            const sy = meterBottom - 2 - (s + 1) * segH - s * segGap;
            const lit = s < activeCount;

            if (isInputMeter) {
              if (segDb > 0) {
                ctx.fillStyle = lit ? '#F87171' : 'rgba(248, 113, 113, 0.12)';
              } else if (segDb > -3) {
                ctx.fillStyle = lit ? '#FBBF24' : 'rgba(251, 191, 36, 0.12)';
              } else {
                ctx.fillStyle = lit ? VEKTOR_TREM_COLORS.accentMint : 'rgba(58, 227, 158, 0.11)';
              }
            } else {
              if (segDb > 0) {
                ctx.fillStyle = lit ? '#EF4444' : 'rgba(239, 68, 68, 0.12)';
              } else if (segDb > -3) {
                ctx.fillStyle = lit ? '#F59E0B' : 'rgba(245, 158, 11, 0.13)';
              } else {
                ctx.fillStyle = lit
                  ? p.bypassed
                    ? '#94A3B8'
                    : VEKTOR_TREM_COLORS.accentGreen
                  : 'rgba(34, 229, 94, 0.11)';
              }
            }

            ctx.fillRect(x + 1.5, sy, barW - 3, Math.max(1.5, segH));
          }

          // Peak hold indicator hairline
          const peakNorm = dbToNorm(peakVal);
          if (peakNorm > 0.02) {
            const py = Math.max(
              meterTop + 2,
              Math.min(meterBottom - 3, meterBottom - 2 - peakNorm * (meterH - 4))
            );
            ctx.fillStyle =
              peakVal > 0
                ? '#FCA5A5'
                : peakVal > -3
                ? '#FDE68A'
                : isInputMeter
                ? '#A7F3D0'
                : '#DCFCE7';
            ctx.fillRect(x + 1, py, barW - 2, 1.5);
          }
        };

        drawMeterBar(inLX, vuInL, peakInL, true);
        drawMeterBar(inRX, vuInR, peakInR, true);
        drawMeterBar(outLX, vuOutL, peakOutL, false);
        drawMeterBar(outRX, vuOutR, peakOutR, false);

        // Channel footer labels (L R)
        ctx.font = '600 8px "JetBrains Mono", ui-monospace, monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = '#64748B';
        ctx.fillText('L', inLX + barW * 0.5, meterBottom + 4);
        ctx.fillText('R', inRX + barW * 0.5, meterBottom + 4);
        ctx.fillStyle = p.bypassed ? '#64748B' : '#94A3B8';
        ctx.fillText('L', outLX + barW * 0.5, meterBottom + 4);
        ctx.fillText('R', outRX + barW * 0.5, meterBottom + 4);

        ctx.restore();
      }

      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(rafId);
      observer.disconnect();
    };
  }, []);

  const handleClearClip = () => {
    clipLatchedRef.current = false;
    setReadout((prev) => ({ ...prev, clipped: false }));
  };

  return (
    <div className="h-full flex flex-col justify-between gap-2">
      {/* Header + Clip Indicator */}
      <div className="flex items-center justify-between gap-1">
        <span className="font-mono text-[9.5px] font-semibold tracking-[0.14em] text-slate-400 uppercase">
          I/O VU
        </span>
        <button
          type="button"
          onClick={handleClearClip}
          title={readout.clipped ? 'Peak exceeded 0 dB — click to reset clip latch' : 'Output headroom OK'}
          className={`px-1.5 py-[1px] rounded-[3px] font-mono text-[8px] font-semibold tracking-wider border transition-colors cursor-pointer ${
            readout.clipped
              ? 'bg-red-500/20 border-red-500/70 text-red-300'
              : 'bg-[#0B0C0E] border-[#22252A] text-slate-600'
          }`}
        >
          CLIP
        </button>
      </div>

      {/* Column Titles: IN vs OUT */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center text-center font-mono text-[8.5px] tracking-wider">
        <span style={{ color: VEKTOR_TREM_COLORS.accentMint }}>IN</span>
        <span className="text-slate-600 px-1">dB</span>
        <span style={{ color: bypassed ? '#9CA3AF' : VEKTOR_TREM_COLORS.accentGreen }}>OUT</span>
      </div>

      {/* Main Canvas Stereo Meter Stage */}
      <div className="relative flex-1 min-h-[360px] rounded-[6px] vektor-scope overflow-hidden">
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      </div>

      {/* Live Numeric Gain Staging Readouts */}
      <div className="rounded-[5px] bg-[#0B0C0E] border border-[#202328] px-2 py-1.5 grid grid-cols-2 gap-1.5 text-center font-mono tabular-nums">
        <div>
          <div className="text-[7.5px] text-slate-500 uppercase tracking-wider">IN PK</div>
          <div className="text-[10px] font-semibold text-[#3AE39E]">
            {readout.inDb > 0 ? `+${readout.inDb.toFixed(1)}` : readout.inDb.toFixed(1)}
          </div>
        </div>
        <div className="border-l border-[#1C1F24] pl-1.5">
          <div className="text-[7.5px] text-slate-500 uppercase tracking-wider">OUT PK</div>
          <div
            className="text-[10px] font-semibold"
            style={{
              color:
                readout.outDb > 0
                  ? '#F87171'
                  : readout.outDb > -3
                  ? '#FBBF24'
                  : bypassed
                  ? '#CBD5E1'
                  : VEKTOR_TREM_COLORS.accentGreen,
            }}
          >
            {readout.outDb > 0 ? `+${readout.outDb.toFixed(1)}` : readout.outDb.toFixed(1)}
          </div>
        </div>
      </div>
    </div>
  );
};

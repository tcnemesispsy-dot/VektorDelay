import React, { useEffect, useRef } from 'react';
import {
  VEKTOR_TREM_COLORS,
  DelayModeId,
  DelaySubType,
  PatternEngineMode,
  DualRoutingMode,
  DualRatioId,
  DUAL_RATIOS,
  SequenceStep,
  SequencePlayMode,
} from '../data/vektorDelayData';

interface PulsarDelayCanvasProps {
  mode: 'orb' | 'scope' | 'compact';
  delayMode: DelayModeId;
  subType: DelaySubType;
  patternMode: PatternEngineMode;
  dualRouting: DualRoutingMode;
  dualRatio: DualRatioId;
  lrOffsetMs: number;
  seqSteps: SequenceStep[];
  seqStepCount: number;
  seqPlayMode: SequencePlayMode;
  bpm: number;
  effectiveDelayMs: number;
  feedback: number;
  modRateHz: number;
  modAmt: number;
  characterVal: number;
  pitchSemitones: number;
  width: number;
  duckAmt: number;
  lowCutHz: number;
  highCutHz: number;
  mix: number;
  freeze: boolean;
  bypassed: boolean;
  isPlaying: boolean;
  testToneTriggerCount: number;
}

export const PulsarDelayCanvas: React.FC<PulsarDelayCanvasProps> = ({
  mode,
  delayMode,
  subType,
  patternMode,
  dualRouting,
  dualRatio,
  lrOffsetMs,
  seqSteps,
  seqStepCount,
  seqPlayMode,
  bpm,
  effectiveDelayMs,
  feedback,
  modRateHz,
  modAmt,
  characterVal,
  pitchSemitones,
  width: stereoWidth,
  duckAmt,
  lowCutHz,
  highCutHz,
  mix,
  freeze,
  bypassed,
  isPlaying,
  testToneTriggerCount,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastToneCountRef = useRef(testToneTriggerCount);
  const toneTimestampRef = useRef(-10000);

  if (testToneTriggerCount !== lastToneCountRef.current) {
    lastToneCountRef.current = testToneTriggerCount;
    toneTimestampRef.current = performance.now();
  }

  const latestRef = useRef({
    mode,
    delayMode,
    subType,
    patternMode,
    dualRouting,
    dualRatio,
    lrOffsetMs,
    seqSteps,
    seqStepCount,
    seqPlayMode,
    bpm,
    effectiveDelayMs,
    feedback,
    modRateHz,
    modAmt,
    characterVal,
    pitchSemitones,
    stereoWidth,
    duckAmt,
    lowCutHz,
    highCutHz,
    mix,
    freeze,
    bypassed,
    isPlaying,
  });

  latestRef.current = {
    mode,
    delayMode,
    subType,
    patternMode,
    dualRouting,
    dualRatio,
    lrOffsetMs,
    seqSteps,
    seqStepCount,
    seqPlayMode,
    bpm,
    effectiveDelayMs,
    feedback,
    modRateHz,
    modAmt,
    characterVal,
    pitchSemitones,
    stereoWidth,
    duckAmt,
    lowCutHz,
    highCutHz,
    mix,
    freeze,
    bypassed,
    isPlaying,
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    const startTime = performance.now();
    let frozenPhase = 0;
    let prevNow = startTime;

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
      const p = latestRef.current;
      const dt = Math.min(0.05, Math.max(0.001, (now - prevNow) / 1000));
      prevNow = now;
      const elapsedSec = (now - startTime) / 1000;
      const sinceToneSec = Math.max(0, (now - toneTimestampRef.current) / 1000);
      const toneBurst = sinceToneSec < 2.2 ? Math.exp(-sinceToneSec * 2.2) : 0;

      if (!p.freeze) {
        frozenPhase += dt * (0.65 + p.modRateHz * 0.45);
      } else {
        frozenPhase += dt * 0.08;
      }

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;

      if (width > 0 && height > 0) {
        ctx.save();
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, width, height);

        const c = VEKTOR_TREM_COLORS;

        if (p.mode === 'orb') {
          const cx = width * 0.5;
          const cy = height * 0.5;
          const baseRadius = Math.min(width, height) * 0.31;

          // Subtle ambient radial core behind the vector rings
          const glowGrad = ctx.createRadialGradient(
            cx,
            cy,
            baseRadius * 0.1,
            cx,
            cy,
            baseRadius * 1.48
          );
          if (p.bypassed) {
            glowGrad.addColorStop(0, 'rgba(148, 163, 184, 0.08)');
            glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
          } else if (p.freeze) {
            glowGrad.addColorStop(0, 'rgba(58, 227, 158, 0.24)');
            glowGrad.addColorStop(0.55, 'rgba(34, 229, 94, 0.08)');
            glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
          } else {
            glowGrad.addColorStop(0, `rgba(34, 229, 94, ${0.14 + toneBurst * 0.16})`);
            glowGrad.addColorStop(0.6, 'rgba(58, 227, 158, 0.05)');
            glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
          }
          ctx.fillStyle = glowGrad;
          ctx.fillRect(0, 0, width, height);

          // Subtle crosshair grid
          ctx.strokeStyle = 'rgba(255,255,255,0.035)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(cx, 8);
          ctx.lineTo(cx, height - 8);
          ctx.moveTo(12, cy);
          ctx.lineTo(width - 12, cy);
          ctx.stroke();

          const ringCount = 6;
          const pts = 96;
          const morphAmp = 0.08 + p.modAmt * 0.24 + p.characterVal * 0.09 + toneBurst * 0.12;
          const activeRatio = DUAL_RATIOS.find((r) => r.id === p.dualRatio)?.ratioR ?? 1.0;

          for (let ring = 0; ring < ringCount; ring++) {
            const ringNorm = ring / (ringCount - 1); // 0 inner .. 1 outer
            const ringScale = 0.62 + ringNorm * (0.48 + Math.min(0.28, p.feedback * 0.24));
            const phaseOffset = ring * 0.42 + frozenPhase;

            ctx.beginPath();
            for (let i = 0; i <= pts; i++) {
              const theta = (i / pts) * Math.PI * 2;
              let harmonic = 0;

              if (p.delayMode === 'air') {
                harmonic =
                  Math.sin(theta * 3 + phaseOffset) * 0.55 +
                  Math.cos(theta * 5 - phaseOffset * 0.7) * 0.35 +
                  Math.sin(theta * 2 + elapsedSec * 0.9) * 0.25;
              } else if (p.delayMode === 'magnetic') {
                harmonic =
                  Math.sin(theta * 2 + phaseOffset * 0.85) * 0.75 +
                  Math.sin(theta * 3 - phaseOffset * 0.55) * 0.45 +
                  Math.cos(theta * 4 + ring * 0.6) * (0.18 + p.characterVal * 0.22);
              } else if (p.delayMode === 'circuit') {
                const quantized = Math.round(Math.sin(theta * 4 + phaseOffset) * 3) / 3;
                harmonic =
                  quantized * 0.62 +
                  Math.cos(theta * 3 - phaseOffset * 0.9) * 0.48;
              } else if (p.delayMode === 'aether') {
                const pitchHarm = 4 + Math.round(Math.abs(p.pitchSemitones) / 4);
                harmonic =
                  Math.sin(theta * pitchHarm + phaseOffset * 1.15) * 0.52 +
                  Math.cos(theta * 2 - phaseOffset * 0.6) * 0.48;
              } else {
                // reverse
                const saw = ((theta / (Math.PI * 2) + phaseOffset * 0.12) % 1) * 2 - 1;
                harmonic =
                  saw * 0.42 +
                  Math.sin(theta * 3 - phaseOffset * 1.1) * 0.58;
              }

              const dualSkew =
                p.patternMode === 'dual'
                  ? 1 + 0.08 * (activeRatio - 1) * Math.cos(theta * 2)
                  : 1;

              const r =
                baseRadius *
                ringScale *
                dualSkew *
                (1 + morphAmp * harmonic);

              const x = cx + Math.cos(theta) * r;
              const y = cy + Math.sin(theta) * r;
              if (i === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
            }
            ctx.closePath();

            const alpha = p.bypassed
              ? 0.16 + (1 - ringNorm) * 0.2
              : p.freeze
              ? 0.28 + (1 - ringNorm) * 0.62
              : 0.22 + (1 - ringNorm) * 0.64;

            if (p.bypassed) {
              ctx.strokeStyle = `rgba(148, 163, 184, ${alpha.toFixed(2)})`;
            } else if (p.freeze) {
              ctx.strokeStyle =
                ring % 2 === 0
                  ? `rgba(58, 227, 158, ${alpha.toFixed(2)})`
                  : `rgba(125, 211, 252, ${alpha.toFixed(2)})`;
            } else {
              ctx.strokeStyle =
                ring % 2 === 0
                  ? `rgba(34, 229, 94, ${alpha.toFixed(2)})`
                  : `rgba(58, 227, 158, ${(alpha * 0.85).toFixed(2)})`;
            }

            ctx.lineWidth = ring === 0 ? 1.8 : 1.1;
            ctx.stroke();
          }

          // Aether / Air shimmer particles around the perimeter
          if (!p.bypassed && (p.delayMode === 'aether' || p.delayMode === 'air' || p.freeze)) {
            const dotCount = p.delayMode === 'aether' ? 10 : 6;
            for (let d = 0; d < dotCount; d++) {
              const a = (d / dotCount) * Math.PI * 2 + frozenPhase * 0.35;
              const rad = baseRadius * (0.95 + 0.22 * Math.sin(frozenPhase + d));
              const dx = cx + Math.cos(a) * rad;
              const dy = cy + Math.sin(a) * rad;
              ctx.beginPath();
              ctx.arc(dx, dy, 1.5, 0, Math.PI * 2);
              ctx.fillStyle = p.freeze ? 'rgba(125, 211, 252, 0.75)' : 'rgba(58, 227, 158, 0.65)';
              ctx.fill();
            }
          }

          // Expanding shockwave ring on Test Tone burst
          if (toneBurst > 0.04) {
            const pulseR = baseRadius * (0.4 + (1 - toneBurst) * 1.15);
            ctx.beginPath();
            ctx.arc(cx, cy, pulseR, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(34, 229, 94, ${(toneBurst * 0.65).toFixed(2)})`;
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }
        } else {
          // 'scope' or 'compact' dual-channel stereo output waveform
          const isCompact = p.mode === 'compact';
          const midY = height * 0.5;
          const samples = isCompact ? 76 : 220;

          if (!isCompact) {
            ctx.strokeStyle = 'rgba(255,255,255,0.04)';
            ctx.lineWidth = 1;
            for (let g = 1; g < 8; g++) {
              const gx = (g / 8) * width;
              ctx.beginPath();
              ctx.moveTo(gx, 0);
              ctx.lineTo(gx, height);
              ctx.stroke();
            }
            ctx.beginPath();
            ctx.moveTo(0, midY);
            ctx.lineTo(width, midY);
            ctx.stroke();
          }

          const delaySec = Math.max(0.03, p.effectiveDelayMs / 1000);
          const ratioMeta = DUAL_RATIOS.find((r) => r.id === p.dualRatio) ?? DUAL_RATIOS[0];
          const lpAtten = Math.min(
            1,
            0.45 + 0.55 * (Math.log10(Math.max(800, p.highCutHz) / 800) / Math.log10(20000 / 800))
          );
          const hpAtten = Math.max(0.55, 1 - (Math.max(20, p.lowCutHz) / 1200) * 0.4);
          const amp =
            (isCompact ? height * 0.36 : height * 0.34) *
            (p.bypassed ? 0.52 : 0.42 + p.mix * 0.58) *
            lpAtten *
            hpAtten;

          const drawChannel = (channel: 'L' | 'R') => {
            ctx.beginPath();
            const isLeft = channel === 'L';
            const channelRatio = isLeft ? 1 : ratioMeta.ratioR;
            const offsetShift = isLeft ? 0 : (p.lrOffsetMs / 1000) * 1.4;
            const widthSpread = 0.65 + p.stereoWidth * 0.25;

            for (let i = 0; i <= samples; i++) {
              const nx = i / samples;
              const x = nx * width;
              const t = nx * 1.8 - elapsedSec * (p.freeze ? 0.1 : p.isPlaying ? 1.45 : 0.72) + offsetShift;

              let env = 0.55;
              if (p.patternMode === 'sequence') {
                const sIdx = Math.floor(nx * Math.max(1, p.seqStepCount)) % Math.max(1, p.seqStepCount);
                const step = p.seqSteps[sIdx];
                if (step && step.enabled) {
                  const panGain = isLeft ? Math.max(0.2, 0.85 - step.pan * 0.6) : Math.max(0.2, 0.85 + step.pan * 0.6);
                  env = 0.75 * panGain;
                } else {
                  env = 0.12;
                }
              } else {
                const pingMod =
                  p.dualRouting === 'pingpong'
                    ? 0.55 + 0.45 * Math.sin(nx * Math.PI * 6 + (isLeft ? 0 : Math.PI))
                    : 0.72 + 0.28 * Math.cos(nx * Math.PI * 4 + (isLeft ? 0.4 : -0.4));
                env = pingMod;
              }

              const fbDecay = p.freeze ? 1.0 : 0.55 + p.feedback * 0.42;
              const flutter = p.modAmt * 0.35 * Math.sin(t * p.modRateHz * 6.2);
              const pitchFreq =
                p.delayMode === 'aether' ? Math.pow(2, p.pitchSemitones / 12) : 1;

              let carrier = Math.sin((t * 14 * channelRatio * pitchFreq + flutter) / Math.max(0.2, delaySec * 2));
              if (p.delayMode === 'circuit') {
                carrier = Math.tanh(carrier * (1.2 + p.characterVal * 2.2));
              } else if (p.delayMode === 'magnetic') {
                carrier = Math.tanh(carrier * (1.1 + p.characterVal * 1.5)) + 0.14 * Math.sin(t * 28);
              } else if (p.delayMode === 'reverse') {
                const saw = ((t * 4.5) % 1 + 1) % 1;
                carrier *= saw;
              }

              const duckMod = 1 - p.duckAmt * 0.32 * Math.max(0, Math.sin(elapsedSec * 4));
              const y =
                midY +
                carrier *
                  amp *
                  env *
                  fbDecay *
                  widthSpread *
                  duckMod *
                  (1 + toneBurst * 0.35);

              if (i === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
            }

            if (p.bypassed) {
              ctx.strokeStyle = isLeft ? 'rgba(148, 163, 184, 0.45)' : 'rgba(203, 213, 225, 0.55)';
            } else if (p.freeze) {
              ctx.strokeStyle = isLeft ? '#7DD3FC' : c.accentMint;
            } else {
              ctx.strokeStyle = isLeft ? c.accentMint : c.accentGreen;
            }
            ctx.lineWidth = isCompact ? 1.25 : 1.7;
            ctx.stroke();
          };

          drawChannel('L');
          drawChannel('R');
        }

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

  return <canvas ref={canvasRef} className="w-full h-full block pointer-events-none" />;
};

interface FilterResponseSvgProps {
  lowCutHz: number;
  highCutHz: number;
  lowDampPct: number;
  lowDampFreqHz: number;
  highDampPct: number;
  highDampFreqHz: number;
  bypassed: boolean;
}

export const FilterResponseSvg: React.FC<FilterResponseSvgProps> = ({
  lowCutHz,
  highCutHz,
  lowDampPct,
  lowDampFreqHz,
  highDampPct,
  highDampFreqHz,
  bypassed,
}) => {
  const w = 172;
  const h = 58;
  const minF = 20;
  const maxF = 20000;
  const baselineY = 18;

  const freqToX = (f: number) => {
    const norm = Math.log10(Math.min(maxF, Math.max(minF, f)) / minF) / Math.log10(maxF / minF);
    return norm * w;
  };

  const pts: string[] = [];
  const samples = 64;
  for (let i = 0; i <= samples; i++) {
    const norm = i / samples;
    const f = minF * Math.pow(maxF / minF, norm);
    const x = norm * w;

    // 12 dB/oct high-pass + low-pass rolloff
    const hpRatio = lowCutHz / f;
    const hpMag = 1 / Math.sqrt(1 + Math.pow(hpRatio, 4));
    const lpRatio = f / highCutHz;
    const lpMag = 1 / Math.sqrt(1 + Math.pow(lpRatio, 4));

    // Gentle low/high damping shelves
    const lowDampGain = f < lowDampFreqHz ? 1 - lowDampPct * 0.42 * (1 - f / lowDampFreqHz) : 1;
    const highDampGain =
      f > highDampFreqHz ? 1 - highDampPct * 0.45 * Math.min(1, Math.log2(f / highDampFreqHz) * 0.45) : 1;

    const totalMag = Math.min(1, Math.max(0.02, hpMag * lpMag * lowDampGain * highDampGain));
    const y = h - 4 - totalMag * (h - baselineY - 2);
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }

  const linePath = `M ${pts.join(' L ')}`;
  const areaPath = `${linePath} L ${w},${h} L 0,${h} Z`;
  const strokeColor = bypassed ? '#64748B' : VEKTOR_TREM_COLORS.accentGreen;

  return (
    <div className="flex flex-col items-center">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="w-full h-[54px] rounded-[4px] bg-[#08090B] border border-[#1E2228]"
        aria-label="Filter & Damping frequency response curve"
      >
        {[20, 100, 1000, 5000, 20000].map((tickF) => {
          const tx = freqToX(tickF);
          return (
            <line
              key={tickF}
              x1={tx}
              y1={0}
              x2={tx}
              y2={h}
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="0.8"
            />
          );
        })}
        <line x1={0} y1={baselineY} x2={w} y2={baselineY} stroke="rgba(255,255,255,0.07)" strokeWidth="0.8" />
        <path
          d={areaPath}
          fill={bypassed ? 'rgba(148, 163, 184, 0.08)' : 'rgba(34, 229, 94, 0.14)'}
        />
        <path d={linePath} fill="none" stroke={strokeColor} strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
      <div className="w-full flex items-center justify-between px-0.5 mt-1 font-mono text-[7.5px] text-slate-600 tabular-nums">
        <span>20</span>
        <span>100</span>
        <span>1k</span>
        <span>5k</span>
        <span>20k</span>
      </div>
    </div>
  );
};

interface FeedbackPathCanvasProps {
  bpm: number;
  effectiveDelayMs: number;
  feedback: number;
  modRateHz: number;
  modAmt: number;
  patternMode: PatternEngineMode;
  dualRouting: DualRoutingMode;
  duckAmt: number;
  mix: number;
  freeze: boolean;
  bypassed: boolean;
  isPlaying: boolean;
  testToneTriggerCount: number;
}

export const FeedbackPathCanvas: React.FC<FeedbackPathCanvasProps> = ({
  bpm,
  effectiveDelayMs,
  feedback,
  modRateHz,
  modAmt,
  patternMode,
  dualRouting,
  duckAmt,
  mix,
  freeze,
  bypassed,
  isPlaying,
  testToneTriggerCount,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastToneCountRef = useRef(testToneTriggerCount);
  const toneTimestampRef = useRef(-10000);

  if (testToneTriggerCount !== lastToneCountRef.current) {
    lastToneCountRef.current = testToneTriggerCount;
    toneTimestampRef.current = performance.now();
  }

  const latestRef = useRef({
    bpm,
    effectiveDelayMs,
    feedback,
    modRateHz,
    modAmt,
    patternMode,
    dualRouting,
    duckAmt,
    mix,
    freeze,
    bypassed,
    isPlaying,
  });

  latestRef.current = {
    bpm,
    effectiveDelayMs,
    feedback,
    modRateHz,
    modAmt,
    patternMode,
    dualRouting,
    duckAmt,
    mix,
    freeze,
    bypassed,
    isPlaying,
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    const startTime = performance.now();
    let prevTime = startTime;
    let loopPhase = 0;
    let smoothedIntensity = 0;

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

    const evalQuad = (
      p0x: number,
      p0y: number,
      cx: number,
      cy: number,
      p1x: number,
      p1y: number,
      t: number
    ) => {
      const inv = 1 - t;
      return {
        x: inv * inv * p0x + 2 * inv * t * cx + t * t * p1x,
        y: inv * inv * p0y + 2 * inv * t * cy + t * t * p1y,
      };
    };

    const render = (now: number) => {
      const p = latestRef.current;
      const dt = Math.min(0.05, Math.max(0.001, (now - prevTime) / 1000));
      prevTime = now;

      const elapsedSec = (now - startTime) / 1000;
      const sinceToneSec = Math.max(0, (now - toneTimestampRef.current) / 1000);
      const toneBurst = sinceToneSec < 2.4 ? Math.exp(-sinceToneSec * 1.9) : 0;

      const beatSec = 60 / Math.max(40, p.bpm);
      const delaySec = Math.max(0.06, Math.min(1.8, p.effectiveDelayMs / 1000));
      const beatPhase = (elapsedSec % beatSec) / beatSec;
      const transientHit = p.isPlaying ? Math.exp(-beatPhase * 4.4) : 0;

      // Instantaneous signal intensity driven by transport playback, feedback persistence, and test tone
      const targetIntensity = p.bypassed
        ? 0.08
        : p.freeze
        ? 0.92 + 0.08 * Math.sin(elapsedSec * 4.2)
        : p.isPlaying
        ? Math.min(
            1,
            (0.28 + transientHit * 0.68) *
              (0.55 + p.feedback * 0.52) *
              (1 - p.duckAmt * 0.25 * transientHit) +
              toneBurst * 0.55
          )
        : Math.min(1, 0.06 + toneBurst * 0.88);

      const rate = targetIntensity > smoothedIntensity ? 18 : Math.max(3.5, 9 - p.feedback * 5);
      smoothedIntensity += (targetIntensity - smoothedIntensity) * (1 - Math.exp(-rate * dt));

      const speedFactor = p.freeze ? 1.35 : 0.65 / Math.max(0.25, Math.min(1.4, delaySec));
      if (p.isPlaying || p.freeze || toneBurst > 0.03) {
        loopPhase = (loopPhase + dt * speedFactor * (0.85 + p.feedback * 0.35)) % 1;
      }

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;

      if (width > 0 && height > 0) {
        ctx.save();
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, width, height);

        const c = VEKTOR_TREM_COLORS;
        const leftPad = 104;
        const rightPad = 94;
        const pathStart = leftPad;
        const pathEnd = Math.max(leftPad + 120, width - rightPad);
        const midX = (pathStart + pathEnd) * 0.5;
        const forwardY = height * 0.34;
        const arcCtrlY = height * 1.06;

        const delayInX = pathStart + (pathEnd - pathStart) * 0.26;
        const delayOutX = pathStart + (pathEnd - pathStart) * 0.74;

        const isOverdriveFb = p.feedback > 0.95;
        const activeStroke = p.bypassed
          ? '#4B5563'
          : p.freeze
          ? '#38BDF8'
          : isOverdriveFb
          ? '#F97316'
          : c.accentGreen;

        // Forward dry/wet bus rail
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(pathStart, forwardY);
        ctx.lineTo(pathEnd, forwardY);
        ctx.stroke();

        // Active forward signal glow proportional to signal intensity
        if (!p.bypassed && (p.isPlaying || p.freeze || toneBurst > 0.04)) {
          const fwdGrad = ctx.createLinearGradient(pathStart, forwardY, pathEnd, forwardY);
          fwdGrad.addColorStop(0, `rgba(58, 227, 158, ${(0.18 + smoothedIntensity * 0.45).toFixed(2)})`);
          fwdGrad.addColorStop(0.5, `rgba(34, 229, 94, ${(0.25 + smoothedIntensity * 0.65).toFixed(2)})`);
          fwdGrad.addColorStop(1, `rgba(34, 229, 94, ${(0.14 + smoothedIntensity * 0.4).toFixed(2)})`);
          ctx.strokeStyle = fwdGrad;
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.moveTo(pathStart, forwardY);
          ctx.lineTo(pathEnd, forwardY);
          ctx.stroke();
        }

        // Feedback return loop curve (Delay Out -> back to Delay In)
        const fbNorm = Math.min(1, p.feedback / 1.1);
        const loopAlpha = p.bypassed
          ? 0.14
          : Math.min(0.95, 0.12 + fbNorm * 0.55 + smoothedIntensity * 0.28);

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(delayOutX, forwardY);
        ctx.quadraticCurveTo(midX, arcCtrlY, delayInX, forwardY);
        ctx.strokeStyle = p.bypassed
          ? 'rgba(100, 116, 139, 0.25)'
          : p.freeze
          ? `rgba(56, 189, 248, ${loopAlpha.toFixed(2)})`
          : isOverdriveFb
          ? `rgba(249, 115, 22, ${loopAlpha.toFixed(2)})`
          : `rgba(34, 229, 94, ${loopAlpha.toFixed(2)})`;
        ctx.lineWidth = 1.1 + fbNorm * 1.4;
        if (p.feedback < 0.04 && !p.freeze) {
          ctx.setLineDash([3, 3]);
        }
        ctx.stroke();
        ctx.restore();

        // Delay tap / loop anchor nodes
        const nodes = [
          { x: pathStart, label: 'IN', color: c.accentMint },
          { x: delayInX, label: 'SUM', color: activeStroke },
          { x: delayOutX, label: 'DLY', color: activeStroke },
          { x: pathEnd, label: 'OUT', color: c.accentGreen },
        ];

        for (const n of nodes) {
          ctx.beginPath();
          ctx.arc(n.x, forwardY, 2.7, 0, Math.PI * 2);
          ctx.fillStyle = '#08090B';
          ctx.fill();
          ctx.strokeStyle = p.bypassed ? '#4B5563' : n.color;
          ctx.lineWidth = 1.25;
          ctx.stroke();
        }

        // Traveling signal & feedback recirculation packets when transport plays (or freeze / test tone)
        if (!p.bypassed && (p.isPlaying || p.freeze || toneBurst > 0.04)) {
          // Forward traveling pulse
          const fwdCount = 2;
          for (let f = 0; f < fwdCount; f++) {
            const ft = (loopPhase + f / fwdCount) % 1;
            const fx = pathStart + ft * (pathEnd - pathStart);
            const r = 2.0 + smoothedIntensity * 2.2;

            ctx.beginPath();
            ctx.arc(fx, forwardY, r + 2.5, 0, Math.PI * 2);
            ctx.fillStyle = p.freeze
              ? 'rgba(56, 189, 248, 0.22)'
              : 'rgba(58, 227, 158, 0.22)';
            ctx.fill();

            ctx.beginPath();
            ctx.arc(fx, forwardY, r, 0, Math.PI * 2);
            ctx.fillStyle = p.freeze ? '#BAE6FD' : '#A7F3D0';
            ctx.fill();
          }

          // Recirculating packets along the Feedback Return Path
          const activePackets = p.freeze
            ? 5
            : p.feedback <= 0.02
            ? 0
            : Math.max(1, Math.min(6, Math.round(1 + fbNorm * 5)));

          for (let k = 0; k < activePackets; k++) {
            const t = (loopPhase + k / Math.max(1, activePackets)) % 1;
            const modRipple =
              p.modAmt * 2.2 * Math.sin(elapsedSec * p.modRateHz * 5 + k * 1.4);
            const pos = evalQuad(
              delayOutX,
              forwardY,
              midX,
              arcCtrlY + modRipple,
              delayInX,
              forwardY,
              t
            );

            const decayWeight = p.freeze ? 0.95 : Math.max(0.28, 1 - (k / 6) * (1 - fbNorm * 0.7));
            const packetRadius = (1.8 + smoothedIntensity * 2.1) * decayWeight;
            const isAltPingPong = p.patternMode === 'dual' && p.dualRouting === 'pingpong' && k % 2 === 1;

            const pktColor = p.freeze
              ? '#7DD3FC'
              : isOverdriveFb
              ? '#FB923C'
              : isAltPingPong
              ? c.accentMint
              : c.accentGreenBright;

            ctx.beginPath();
            ctx.arc(pos.x, pos.y, packetRadius + 2.8, 0, Math.PI * 2);
            ctx.fillStyle = p.freeze
              ? 'rgba(56, 189, 248, 0.20)'
              : isOverdriveFb
              ? 'rgba(249, 115, 22, 0.22)'
              : 'rgba(34, 229, 94, 0.22)';
            ctx.fill();

            ctx.beginPath();
            ctx.arc(pos.x, pos.y, packetRadius, 0, Math.PI * 2);
            ctx.fillStyle = pktColor;
            ctx.fill();
          }
        }

        // Right-side micro signal intensity meter bars reacting to live feedback loop energy
        const meterX = pathEnd + 16;
        const barCount = 10;
        const barW = 3.5;
        const barGap = 2;
        const litBars = p.bypassed ? 0 : Math.round(smoothedIntensity * barCount);
        for (let b = 0; b < barCount; b++) {
          const bx = meterX + b * (barW + barGap);
          const barH = 6 + (b / (barCount - 1)) * 12;
          const by = height * 0.5 - barH * 0.5;
          const lit = b < litBars;
          ctx.fillStyle = lit
            ? b >= 8 && isOverdriveFb
              ? '#F97316'
              : p.freeze
              ? '#38BDF8'
              : b % 2 === 0
              ? c.accentMint
              : c.accentGreen
            : 'rgba(255, 255, 255, 0.06)';
          ctx.fillRect(bx, by, barW, barH);
        }

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

  const fbPct = Math.round(feedback * 100);

  return (
    <div className="relative h-[36px] w-full rounded-[4px] bg-[#08090B] border border-[#1B1E24] overflow-hidden flex items-center">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />
      <div className="pointer-events-none relative z-10 w-full px-2.5 flex items-center justify-between font-mono text-[8px] uppercase tracking-wider">
        <div className="flex items-center gap-1.5">
          <span
            className="w-1.5 h-1.5 rounded-full transition-colors"
            style={{
              backgroundColor: bypassed
                ? '#4B5563'
                : freeze
                ? '#38BDF8'
                : feedback > 0.95
                ? '#F97316'
                : isPlaying
                ? VEKTOR_TREM_COLORS.accentGreen
                : '#374151',
              boxShadow:
                !bypassed && (isPlaying || freeze)
                  ? `0 0 6px ${freeze ? '#38BDF8' : VEKTOR_TREM_COLORS.accentGreen}`
                  : 'none',
            }}
          />
          <span className="text-slate-400 font-semibold">FEEDBACK PATH</span>
        </div>

        <span
          className="font-semibold tabular-nums pr-[64px]"
          style={{
            color: bypassed
              ? '#64748B'
              : freeze
              ? '#7DD3FC'
              : feedback > 0.95
              ? '#FB923C'
              : VEKTOR_TREM_COLORS.accentMint,
          }}
        >
          {freeze ? 'INF HOLD' : `${fbPct}%`}
        </span>
      </div>
    </div>
  );
};


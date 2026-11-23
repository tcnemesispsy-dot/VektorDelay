import React, { useEffect, useRef } from 'react';
import { VEKTOR_TREM_COLORS } from '../data/vektorGateData';
import { evaluateSignalShape } from './SignalWaveformSvg';

interface VektorScopeAudioCanvasProps {
  levels: number[];
  modes: number[];
  enabledSteps: boolean[];
  stepCount: number;
  bpm: number;
  beatsPerStep: number;
  envTime: number;
  smooth: number;
  depth: number;
  mix: number;
  bypassed: boolean;
  isPlaying: boolean;
  activePlayheadStep: number;
  compact?: boolean;
}

/**
 * High-FPS HTML5 Canvas component rendering a simplified real-time audio
 * waveform sculpted by the active 32-step rhythmic gate envelope.
 */
export const VektorScopeAudioCanvas: React.FC<VektorScopeAudioCanvasProps> = ({
  levels,
  modes,
  enabledSteps,
  stepCount,
  bpm,
  beatsPerStep,
  envTime,
  smooth,
  depth,
  mix,
  bypassed,
  isPlaying,
  activePlayheadStep,
  compact = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
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
    mix,
    bypassed,
    isPlaying,
    activePlayheadStep,
    compact,
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
    mix,
    bypassed,
    isPlaying,
    activePlayheadStep,
    compact,
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    const startTime = performance.now();

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
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;

      if (width > 0 && height > 0) {
        ctx.save();
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, width, height);

        const elapsedSec = (now - startTime) / 1000;
        const centerY = height * 0.5;
        const maxAmp = height * (p.compact ? 0.42 : 0.41);

        // Subtle center zero-crossing axis
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, centerY);
        ctx.lineTo(width, centerY);
        ctx.stroke();

        const samples = p.compact ? 96 : 256;
        const stepWidthRatio = 1 / 32;
        const carrierSpeed = p.isPlaying ? 18 : 7;
        const phaseOffset = elapsedSec * carrierSpeed;

        const upperPoints: Array<[number, number]> = [];
        const lowerPoints: Array<[number, number]> = [];

        for (let i = 0; i <= samples; i++) {
          const normX = i / samples;
          const x = normX * width;

          const stepFloat = Math.min(31.999, normX * 32);
          const stepIdx = Math.floor(stepFloat);
          const frac = stepFloat - stepIdx;
          const isWithin = stepIdx < p.stepCount;

          let gateGain = 1;
          if (!p.bypassed) {
            const isStepEnabled = p.enabledSteps[stepIdx] ?? true;
            const lvl = isStepEnabled ? (p.levels[stepIdx] ?? 0.5) : 0;
            const modeId = p.modes[stepIdx] ?? 0;
            const shapedFrac = Math.min(1, frac / Math.max(0.25, p.envTime));
            const shapeVal =
              frac / Math.max(0.25, p.envTime) > 1 && (modeId === 1 || modeId === 2)
                ? 0.04
                : evaluateSignalShape(modeId, modeId === 1 || modeId === 2 ? shapedFrac : frac);

            const wetGain = isStepEnabled ? lvl * shapeVal : 0;
            const dryBlended = 1 - p.mix + p.mix * (1 - p.depth + p.depth * wetGain);
            gateGain = isWithin ? dryBlended : dryBlended * 0.22;

            if (p.smooth > 0.05 && frac < p.smooth * 0.35) {
              const prevIdx = (stepIdx - 1 + p.stepCount) % p.stepCount;
              const prevEnabled = p.enabledSteps[prevIdx] ?? true;
              const prevLvl = prevEnabled ? (p.levels[prevIdx] ?? lvl) : 0;
              const blend = frac / (p.smooth * 0.35);
              gateGain = gateGain * blend + prevLvl * (1 - blend) * 0.5;
            }
          }

          const freqScale = p.compact ? 22 : 38;
          const wave =
            Math.sin(normX * Math.PI * freqScale - phaseOffset) * 0.68 +
            Math.sin(normX * Math.PI * (freqScale * 2.2) - phaseOffset * 1.7) * 0.24 +
            Math.cos(normX * Math.PI * (freqScale * 0.5) + phaseOffset * 0.4) * 0.08;

          const playheadBoost =
            p.isPlaying &&
            !p.bypassed &&
            Math.abs(normX - (p.activePlayheadStep + 0.5) * stepWidthRatio) < 0.028
              ? 1.12
              : 1.0;

          const amp = maxAmp * gateGain * Math.abs(wave) * playheadBoost;
          upperPoints.push([x, centerY - amp]);
          lowerPoints.push([x, centerY + amp]);
        }

        // Fill translucent audio body
        ctx.beginPath();
        for (let i = 0; i < upperPoints.length; i++) {
          const [x, y] = upperPoints[i];
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        for (let i = lowerPoints.length - 1; i >= 0; i--) {
          const [x, y] = lowerPoints[i];
          ctx.lineTo(x, y);
        }
        ctx.closePath();

        const grad = ctx.createLinearGradient(0, centerY - maxAmp, 0, centerY + maxAmp);
        if (p.bypassed) {
          grad.addColorStop(0, 'rgba(148, 163, 184, 0.08)');
          grad.addColorStop(0.5, 'rgba(148, 163, 184, 0.16)');
          grad.addColorStop(1, 'rgba(148, 163, 184, 0.08)');
        } else {
          grad.addColorStop(0, 'rgba(58, 227, 158, 0.28)');
          grad.addColorStop(0.5, 'rgba(34, 229, 94, 0.14)');
          grad.addColorStop(1, 'rgba(58, 227, 158, 0.28)');
        }
        ctx.fillStyle = grad;
        ctx.fill();

        // Crisp upper & lower simplified audio trace outlines
        ctx.strokeStyle = p.bypassed
          ? 'rgba(148, 163, 184, 0.4)'
          : VEKTOR_TREM_COLORS.accentMint;
        ctx.lineWidth = p.compact ? 1 : 1.25;
        ctx.globalAlpha = p.bypassed ? 0.5 : p.compact ? 0.85 : 0.78;

        ctx.beginPath();
        for (let i = 0; i < upperPoints.length; i++) {
          const [x, y] = upperPoints[i];
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        ctx.beginPath();
        for (let i = 0; i < lowerPoints.length; i++) {
          const [x, y] = lowerPoints[i];
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

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

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 w-full h-full"
      aria-hidden="true"
    />
  );
};

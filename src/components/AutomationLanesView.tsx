import React, { useEffect, useRef, useState } from 'react';
import { VEKTOR_TREM_COLORS } from '../data/vektorGateData';

export type AutomationShape = 'sine' | 'ramp' | 'triangle' | 'step' | 'custom';
export type AutomationParamKey = 'smooth' | 'env' | 'swing';

export interface AutomationLaneConfig {
  enabled: boolean;
  shape: AutomationShape;
  depth: number; // 0..1 modulation excursion around base knob value
  customPoints: number[]; // 32 normalized values (0..1)
}

export type AutomationLanesState = Record<AutomationParamKey, AutomationLaneConfig>;

export const createDefaultAutomationLanes = (): AutomationLanesState => ({
  smooth: {
    enabled: true,
    shape: 'sine',
    depth: 0.38,
    customPoints: Array.from({ length: 32 }, (_, i) =>
      Number((0.35 + 0.3 * Math.sin((i / 32) * Math.PI * 2)).toFixed(2))
    ),
  },
  env: {
    enabled: true,
    shape: 'ramp',
    depth: 0.42,
    customPoints: Array.from({ length: 32 }, (_, i) =>
      Number((0.25 + 0.6 * ((i % 16) / 15)).toFixed(2))
    ),
  },
  swing: {
    enabled: true,
    shape: 'triangle',
    depth: 0.34,
    customPoints: Array.from({ length: 32 }, (_, i) => {
      const p = (i % 16) / 16;
      const tri = p < 0.5 ? p * 2 : (1 - p) * 2;
      return Number((0.12 + 0.55 * tri).toFixed(2));
    }),
  },
});

const LANE_META: Array<{
  key: AutomationParamKey;
  label: string;
  color: string;
  fillRgba: string;
  formatValue: (norm: number) => string;
}> = [
  {
    key: 'smooth',
    label: 'SMOOTH',
    color: VEKTOR_TREM_COLORS.accentGreen,
    fillRgba: 'rgba(34, 229, 94, 0.16)',
    formatValue: (norm) => `${Math.round(norm * 100)}%`,
  },
  {
    key: 'env',
    label: 'ENV',
    color: VEKTOR_TREM_COLORS.accentMint,
    fillRgba: 'rgba(58, 227, 158, 0.16)',
    formatValue: (norm) => `${(0.1 + norm * 0.9).toFixed(2)}x`,
  },
  {
    key: 'swing',
    label: 'SWING',
    color: '#F59E0B',
    fillRgba: 'rgba(245, 158, 11, 0.16)',
    formatValue: (norm) => `${Math.round(norm * 75)}%`,
  },
];

const SHAPE_OPTIONS: Array<{ id: AutomationShape; label: string }> = [
  { id: 'sine', label: 'SINE' },
  { id: 'ramp', label: 'RAMP' },
  { id: 'triangle', label: 'TRI' },
  { id: 'step', label: 'STEP' },
  { id: 'custom', label: 'DRAW' },
];

export function evaluateAutomationLaneAt(
  lane: AutomationLaneConfig,
  baseNorm: number,
  stepFloat: number,
  stepCount: number
): number {
  const safeCount = Math.max(2, stepCount);
  const wrappedFloat = ((stepFloat % safeCount) + safeCount) % safeCount;
  const phase = wrappedFloat / safeCount; // 0..1 over active pattern length

  if (!lane.enabled) {
    return Math.min(1, Math.max(0, baseNorm));
  }

  if (lane.shape === 'custom') {
    const idxA = Math.floor(stepFloat) % 32;
    const idxB = (idxA + 1) % 32;
    const frac = stepFloat - Math.floor(stepFloat);
    const a = lane.customPoints[idxA] ?? baseNorm;
    const b = lane.customPoints[idxB] ?? a;
    return Math.min(1, Math.max(0, a + (b - a) * frac));
  }

  let mod = 0; // bipolar -1..1
  if (lane.shape === 'sine') {
    mod = Math.sin(phase * Math.PI * 2);
  } else if (lane.shape === 'ramp') {
    mod = phase * 2 - 1;
  } else if (lane.shape === 'triangle') {
    mod = phase < 0.5 ? phase * 4 - 1 : (1 - phase) * 4 - 1;
  } else if (lane.shape === 'step') {
    const quant = Math.floor(phase * 4) / 4;
    const stepLookup = [0.75, -0.4, 1.0, -0.85];
    mod = stepLookup[Math.floor(quant * 4) % 4] ?? 0;
  }

  const next = baseNorm + mod * lane.depth * 0.5;
  return Math.min(1, Math.max(0, next));
}

interface AutomationLanesViewProps {
  lanes: AutomationLanesState;
  onChangeLanes: React.Dispatch<React.SetStateAction<AutomationLanesState>>;
  baseSmooth: number;
  baseEnvTime: number;
  baseSwing: number;
  stepCount: number;
  bpm: number;
  beatsPerStep: number;
  isPlaying: boolean;
  simActive: boolean;
  activePlayheadStep: number;
  bypassed: boolean;
}

export const AutomationLanesView: React.FC<AutomationLanesViewProps> = ({
  lanes,
  onChangeLanes,
  baseSmooth,
  baseEnvTime,
  baseSwing,
  stepCount,
  bpm,
  beatsPerStep,
  isPlaying,
  simActive,
  activePlayheadStep,
  bypassed,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const paintingLaneRef = useRef<AutomationParamKey | null>(null);

  const baseNorms: Record<AutomationParamKey, number> = {
    smooth: Math.min(1, Math.max(0, baseSmooth)),
    env: Math.min(1, Math.max(0, (baseEnvTime - 0.1) / 0.9)),
    swing: Math.min(1, Math.max(0, baseSwing)),
  };

  const [liveValues, setLiveValues] = useState<Record<AutomationParamKey, number>>({
    smooth: baseNorms.smooth,
    env: baseNorms.env,
    swing: baseNorms.swing,
  });

  const latestRef = useRef({
    lanes,
    baseNorms,
    stepCount,
    bpm,
    beatsPerStep,
    isPlaying,
    simActive,
    activePlayheadStep,
    bypassed,
  });

  latestRef.current = {
    lanes,
    baseNorms,
    stepCount,
    bpm,
    beatsPerStep,
    isPlaying,
    simActive,
    activePlayheadStep,
    bypassed,
  };

  useEffect(() => {
    const handlePointerUp = () => {
      paintingLaneRef.current = null;
    };
    window.addEventListener('pointerup', handlePointerUp);
    return () => window.removeEventListener('pointerup', handlePointerUp);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    const startTime = performance.now();
    let lastUiSync = 0;

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
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;

      if (width > 0 && height > 0) {
        const elapsedSec = (now - startTime) / 1000;
        const stepDurationSec = Math.max(0.04, (60 / p.bpm) * p.beatsPerStep);
        const safeCount = Math.max(2, p.stepCount);

        // Compute continuous playhead step position (0 .. stepCount)
        const activeStepFloat = p.isPlaying
          ? (elapsedSec / stepDurationSec) % safeCount
          : p.simActive
          ? ((elapsedSec * 0.65) / stepDurationSec) % safeCount
          : p.activePlayheadStep % safeCount;

        // Sync numeric HUD values at ~15Hz
        if (now - lastUiSync > 65) {
          lastUiSync = now;
          setLiveValues({
            smooth: evaluateAutomationLaneAt(
              p.lanes.smooth,
              p.baseNorms.smooth,
              activeStepFloat,
              safeCount
            ),
            env: evaluateAutomationLaneAt(
              p.lanes.env,
              p.baseNorms.env,
              activeStepFloat,
              safeCount
            ),
            swing: evaluateAutomationLaneAt(
              p.lanes.swing,
              p.baseNorms.swing,
              activeStepFloat,
              safeCount
            ),
          });
        }

        ctx.save();
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, width, height);

        const laneH = height / 3;
        const padYTop = 20; // clearance for per-lane compact header overlay
        const padYBottom = 6;
        const plotH = Math.max(18, laneH - padYTop - padYBottom);
        const samples = 256;

        LANE_META.forEach((meta, laneIdx) => {
          const laneTop = laneIdx * laneH;
          const plotTop = laneTop + padYTop;
          const plotBottom = plotTop + plotH;
          const laneCfg = p.lanes[meta.key];
          const baseVal = p.baseNorms[meta.key];

          // Lane bottom divider
          if (laneIdx < 2) {
            ctx.strokeStyle = '#1E2228';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, laneTop + laneH);
            ctx.lineTo(width, laneTop + laneH);
            ctx.stroke();
          }

          // Subtle mid-range guide inside plot
          const midY = plotTop + plotH * 0.5;
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(0, midY);
          ctx.lineTo(width, midY);
          ctx.stroke();

          // Knob baseline dashed reference line
          const baseY = plotBottom - baseVal * plotH;
          ctx.save();
          ctx.setLineDash([3, 3]);
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(0, baseY);
          ctx.lineTo(width, baseY);
          ctx.stroke();
          ctx.restore();

          // Sample automation curve across all 32 step slots
          const activePoints: Array<[number, number]> = [];
          const inactivePoints: Array<[number, number]> = [];

          for (let i = 0; i <= samples; i++) {
            const normX = i / samples;
            const x = normX * width;
            const stepPos = normX * 32;
            const val = evaluateAutomationLaneAt(laneCfg, baseVal, stepPos, safeCount);
            const y = plotBottom - val * plotH;

            if (stepPos <= safeCount + 0.05) {
              activePoints.push([x, y]);
            } else {
              inactivePoints.push([x, y]);
            }
          }

          // Active region translucent fill
          if (activePoints.length > 1) {
            ctx.beginPath();
            ctx.moveTo(activePoints[0][0], plotBottom);
            for (const [px, py] of activePoints) {
              ctx.lineTo(px, py);
            }
            ctx.lineTo(activePoints[activePoints.length - 1][0], plotBottom);
            ctx.closePath();

            if (p.bypassed || !laneCfg.enabled) {
              ctx.fillStyle = 'rgba(148, 163, 184, 0.07)';
            } else {
              const grad = ctx.createLinearGradient(0, plotTop, 0, plotBottom);
              grad.addColorStop(0, meta.fillRgba);
              grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
              ctx.fillStyle = grad;
            }
            ctx.fill();

            // Active region crisp trace
            ctx.beginPath();
            activePoints.forEach(([px, py], idx) => {
              if (idx === 0) ctx.moveTo(px, py);
              else ctx.lineTo(px, py);
            });
            ctx.strokeStyle =
              p.bypassed || !laneCfg.enabled ? 'rgba(148, 163, 184, 0.45)' : meta.color;
            ctx.lineWidth = laneCfg.enabled ? 1.8 : 1.1;
            ctx.stroke();
          }

          // Dimmed continuation beyond active stepCount
          if (inactivePoints.length > 1 && activePoints.length > 0) {
            ctx.beginPath();
            const lastActive = activePoints[activePoints.length - 1];
            ctx.moveTo(lastActive[0], lastActive[1]);
            for (const [px, py] of inactivePoints) {
              ctx.lineTo(px, py);
            }
            ctx.strokeStyle = 'rgba(100, 116, 139, 0.25)';
            ctx.lineWidth = 1.2;
            ctx.stroke();
          }

          // Live time-based tracking cursor node on the curve
          const cursorNormX = activeStepFloat / 32;
          const cursorX = cursorNormX * width;
          const liveVal = evaluateAutomationLaneAt(laneCfg, baseVal, activeStepFloat, safeCount);
          const cursorY = plotBottom - liveVal * plotH;

          if ((p.isPlaying || p.simActive) && laneCfg.enabled) {
            // Subtle glow halo
            ctx.beginPath();
            ctx.arc(cursorX, cursorY, 5.5, 0, Math.PI * 2);
            ctx.fillStyle = p.bypassed ? 'rgba(148,163,184,0.2)' : meta.fillRgba;
            ctx.fill();

            // Solid node dot
            ctx.beginPath();
            ctx.arc(cursorX, cursorY, 2.8, 0, Math.PI * 2);
            ctx.fillStyle = p.bypassed ? '#94A3B8' : '#FFFFFF';
            ctx.fill();
            ctx.strokeStyle = p.bypassed ? '#64748B' : meta.color;
            ctx.lineWidth = 1.3;
            ctx.stroke();
          }
        });

        // Continuous time-scanner beam across all 3 lanes when simActive (and transport stopped)
        if (!p.isPlaying && p.simActive) {
          const scanX = (activeStepFloat / 32) * width;
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(scanX, 0);
          ctx.lineTo(scanX, height);
          ctx.stroke();
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

  const paintLaneAtPointer = (
    laneKey: AutomationParamKey,
    clientX: number,
    clientY: number
  ) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const laneIdx = LANE_META.findIndex((m) => m.key === laneKey);
    if (laneIdx === -1) return;

    const laneH = rect.height / 3;
    const padYTop = 20;
    const padYBottom = 6;
    const plotH = Math.max(18, laneH - padYTop - padYBottom);

    const relX = Math.min(Math.max(0, clientX - rect.left), rect.width - 1);
    const stepIdx = Math.min(31, Math.max(0, Math.floor((relX / rect.width) * 32)));

    const laneTop = rect.top + laneIdx * laneH + padYTop;
    const normVal = Math.min(1, Math.max(0, 1 - (clientY - laneTop) / plotH));

    onChangeLanes((prev) => {
      const current = prev[laneKey];
      const nextPoints = [...current.customPoints];
      nextPoints[stepIdx] = Number(normVal.toFixed(2));
      return {
        ...prev,
        [laneKey]: {
          ...current,
          enabled: true,
          shape: 'custom',
          customPoints: nextPoints,
        },
      };
    });
  };

  return (
    <div
      ref={containerRef}
      onPointerDown={(e) => {
        const el = containerRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const relY = e.clientY - rect.top;
        const laneIdx = Math.min(2, Math.max(0, Math.floor((relY / rect.height) * 3)));
        const laneKey = LANE_META[laneIdx].key;
        paintingLaneRef.current = laneKey;
        paintLaneAtPointer(laneKey, e.clientX, e.clientY);
      }}
      onPointerMove={(e) => {
        if (paintingLaneRef.current) {
          paintLaneAtPointer(paintingLaneRef.current, e.clientX, e.clientY);
        }
      }}
      className="relative w-full h-full cursor-crosshair touch-none select-none"
    >
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 w-full h-full" />

      {/* Per-lane non-blocking HUD strips aligned to the 3 equal rows */}
      <div className="pointer-events-none absolute inset-0 grid grid-rows-3">
        {LANE_META.map((meta) => {
          const laneCfg = lanes[meta.key];
          const baseVal = baseNorms[meta.key];
          const liveVal = liveValues[meta.key];
          return (
            <div key={meta.key} className="relative flex items-start justify-between px-1.5 pt-1">
              {/* Left HUD: Lane Enable + Parameter Name + Curve Shape Selector */}
              <div
                onPointerDown={(e) => e.stopPropagation()}
                className="pointer-events-auto flex items-center gap-1 px-1.5 py-[1px] rounded-[3px] bg-[#08090B]/90 border border-[#1E2228]"
              >
                <button
                  type="button"
                  onClick={() =>
                    onChangeLanes((prev) => ({
                      ...prev,
                      [meta.key]: { ...prev[meta.key], enabled: !prev[meta.key].enabled },
                    }))
                  }
                  title={`Toggle ${meta.label} automation lane`}
                  className="flex items-center gap-1 pr-1 border-r border-[#1F242B] cursor-pointer"
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full transition-colors"
                    style={{
                      backgroundColor: laneCfg.enabled ? meta.color : '#374151',
                    }}
                  />
                  <span
                    className="font-mono text-[8.5px] font-semibold tracking-wider"
                    style={{ color: laneCfg.enabled ? meta.color : '#6B7280' }}
                  >
                    {meta.label}
                  </span>
                </button>

                <div className="flex items-center gap-[2px]">
                  {SHAPE_OPTIONS.map((opt) => {
                    const active = laneCfg.shape === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() =>
                          onChangeLanes((prev) => ({
                            ...prev,
                            [meta.key]: { ...prev[meta.key], enabled: true, shape: opt.id },
                          }))
                        }
                        className="px-1 py-[0.5px] rounded-[2px] font-mono text-[7.5px] tracking-wider transition-colors cursor-pointer"
                        style={{
                          backgroundColor: active ? 'rgba(255,255,255,0.09)' : 'transparent',
                          color: active ? '#F3F4F6' : '#64748B',
                        }}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Right HUD: Base Knob Reference vs Live Simulated Automation Value */}
              <div className="px-1.5 py-[1px] rounded-[3px] bg-[#08090B]/90 border border-[#1E2228] flex items-center gap-1.5 font-mono text-[8px] tabular-nums">
                <span className="text-slate-500">BASE {meta.formatValue(baseVal)}</span>
                <span className="text-slate-700">·</span>
                <span
                  className="font-semibold"
                  style={{ color: laneCfg.enabled ? meta.color : '#64748B' }}
                >
                  {laneCfg.enabled ? `LIVE ${meta.formatValue(liveVal)}` : 'OFF'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

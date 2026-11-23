import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useReducedMotion,
} from 'motion/react';
import { VEKTOR_TREM_COLORS } from '../data/vektorDelayData';

interface RotaryEncoderProps {
  label: string;
  unit?: string;
  subLabel?: string;
  value: number; // normalized 0..1
  onChange: (next: number) => void;
  defaultValue: number;
  centerDisplay: string; // rendered inside the knob cap (matching VektorTrem)
  bipolar?: boolean; // arc starts from 12 o'clock center for trim/pan
  size?: 'md' | 'sm';
  clippingWarning?: boolean; // subtle amber-orange glow when exceeding 0 dB
  midiLearnEnabled?: boolean;
  isMidiArmed?: boolean;
  midiMapping?: { cc: number; channel: number } | null;
  onMidiContextMenu?: (e: React.MouseEvent<HTMLDivElement>) => void;
}

const START_ANGLE = -135;
const END_ANGLE = 135;
const ARC_RADIUS = 42;
const CLIP_WARN_COLOR = '#F97316';

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = Math.abs(endAngle - startAngle) <= 180 ? '0' : '1';
  const sweepFlag = endAngle >= startAngle ? '0' : '1';
  return ['M', start.x, start.y, 'A', r, r, 0, largeArcFlag, sweepFlag, end.x, end.y].join(' ');
}

export const RotaryEncoder: React.FC<RotaryEncoderProps> = ({
  label,
  unit,
  subLabel,
  value,
  onChange,
  defaultValue,
  centerDisplay,
  bipolar = false,
  size = 'md',
  clippingWarning = false,
  midiLearnEnabled = false,
  isMidiArmed = false,
  midiMapping = null,
  onMidiContextMenu,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef<number>(0);
  const dragStartValue = useRef<number>(value);
  const shouldReduceMotion = useReducedMotion();

  const clamped = Math.min(1, Math.max(0, value));
  const knobId = label.replace(/[^a-zA-Z0-9]/g, '');

  // Framer Motion spring for silky rotary inertia on drag, wheel, reset, and A/B preset changes
  const targetValue = useMotionValue(clamped);
  const smoothValue = useSpring(
    targetValue,
    shouldReduceMotion
      ? { stiffness: 10000, damping: 1000 }
      : { stiffness: 380, damping: 32, mass: 0.45 }
  );

  useEffect(() => {
    targetValue.set(clamped);
  }, [clamped, targetValue]);

  const animatedAngle = useTransform(smoothValue, [0, 1], [START_ANGLE, END_ANGLE]);

  const animatedArcPath = useTransform(smoothValue, (v) => {
    const angle = START_ANGLE + v * (END_ANGLE - START_ANGLE);
    if (bipolar) {
      if (Math.abs(v - 0.5) <= 0.005) {
        return describeArc(50, 50, ARC_RADIUS, 0, 0.2);
      }
      return v >= 0.5
        ? describeArc(50, 50, ARC_RADIUS, 0, angle)
        : describeArc(50, 50, ARC_RADIUS, angle, 0);
    }
    if (v <= 0.005) {
      return describeArc(50, 50, ARC_RADIUS, START_ANGLE, START_ANGLE + 0.2);
    }
    return describeArc(50, 50, ARC_RADIUS, START_ANGLE, angle);
  });

  const animatedArcOpacity = useTransform(smoothValue, (v) => {
    if (bipolar) {
      return Math.abs(v - 0.5) > 0.008 ? 1 : 0;
    }
    return v > 0.008 ? 1 : 0;
  });

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartY.current = e.clientY;
    dragStartValue.current = clamped;
  };

  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      e.preventDefault();
      const delta = -e.deltaY * 0.0012;
      onChange(Math.min(1, Math.max(0, clamped + delta)));
    },
    [clamped, onChange]
  );

  useEffect(() => {
    if (!isDragging) return;

    const handlePointerMove = (e: PointerEvent) => {
      const dy = dragStartY.current - e.clientY;
      const sensitivity = e.shiftKey ? 0.0015 : 0.005;
      const next = Math.min(1, Math.max(0, dragStartValue.current + dy * sensitivity));
      onChange(next);
    };

    const handlePointerUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isDragging, onChange]);

  const dim = size === 'md' ? 76 : 64;
  const bgArc = describeArc(50, 50, ARC_RADIUS, START_ANGLE, END_ANGLE);
  const glowTransition = shouldReduceMotion
    ? { duration: 0 }
    : { duration: 0.34, ease: [0.16, 1, 0.3, 1] as const };

  return (
    <div className="flex flex-col items-center select-none">
      <motion.div
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(clamped * 100)}
        onPointerDown={(e) => {
          if (e.button === 2) return;
          handlePointerDown(e);
        }}
        onContextMenu={(e) => {
          if (midiLearnEnabled && onMidiContextMenu) {
            e.preventDefault();
            e.stopPropagation();
            onMidiContextMenu(e);
          }
        }}
        onDoubleClick={() => onChange(defaultValue)}
        onWheel={handleWheel}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
            e.preventDefault();
            onChange(Math.min(1, clamped + 0.02));
          } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
            e.preventDefault();
            onChange(Math.max(0, clamped - 0.02));
          }
        }}
        whileHover={shouldReduceMotion ? undefined : { scale: 1.03 }}
        animate={shouldReduceMotion ? undefined : { scale: isDragging ? 1.045 : 1 }}
        transition={{ type: 'spring', stiffness: 460, damping: 28 }}
        style={{ width: `${dim}px`, height: `${dim}px` }}
        className={`relative flex items-center justify-center focus:outline-none focus-visible:ring-1 focus-visible:ring-[#22E55E] rounded-full ${
          midiLearnEnabled ? 'cursor-context-menu' : 'cursor-ns-resize'
        }`}
        title={`${label}: ${centerDisplay}${unit ? ` ${unit}` : ''}${
          clippingWarning ? ' · Clipping warning (> 0 dB)' : ''
        }${midiMapping ? ` · MIDI CC #${midiMapping.cc} (Ch ${midiMapping.channel})` : ''}${
          midiLearnEnabled
            ? ' (Right-click to map MIDI CC)'
            : ' (Drag vertically · Double-click to reset)'
        }`}
      >
        {/* MIDI Learn mode target ring & active armed glow */}
        {(midiLearnEnabled || isMidiArmed) && (
          <motion.div
            aria-hidden="true"
            initial={false}
            animate={{
              opacity: isMidiArmed ? 1 : 0.72,
              scale: isMidiArmed ? 1.09 : 1,
            }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="pointer-events-none absolute -inset-1 rounded-full border"
            style={{
              borderColor: isMidiArmed ? '#22E55E' : 'rgba(58, 227, 158, 0.48)',
              borderStyle: isMidiArmed ? 'solid' : 'dashed',
              boxShadow: isMidiArmed
                ? '0 0 16px rgba(34, 229, 94, 0.45)'
                : '0 0 8px rgba(58, 227, 158, 0.14)',
            }}
          />
        )}

        {/* Compact mapped MIDI CC indicator on top-right rim */}
        {midiMapping && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -top-1 -right-1.5 z-10 px-1 py-[0.5px] rounded-[3px] bg-[#0B0D10] border border-[#22E55E]/60 font-mono text-[7.5px] font-semibold text-[#3AE39E] tabular-nums leading-tight"
          >
            CC{midiMapping.cc}
          </span>
        )}
        {/* Subtle smooth ambient clipping-warning aura (> 0 dB) */}
        <motion.div
          aria-hidden="true"
          initial={false}
          animate={{
            opacity: clippingWarning ? 1 : 0,
            scale: clippingWarning ? 1.08 : 0.9,
          }}
          transition={glowTransition}
          className="pointer-events-none absolute -inset-1.5 rounded-full"
          style={{
            background:
              'radial-gradient(circle, rgba(249,115,22,0.26) 42%, rgba(249,115,22,0.10) 64%, rgba(249,115,22,0) 76%)',
            boxShadow: '0 0 18px rgba(249, 115, 22, 0.24)',
          }}
        />

        {/* Outer SVG Ring + Inner Metallic Dial Cap */}
        <svg viewBox="0 0 100 100" className="relative w-full h-full overflow-visible">
          <defs>
            <radialGradient id={`vektorKnobGrad-${knobId}`} cx="38%" cy="32%" r="70%">
              <stop offset="0%" stopColor="#26292E" />
              <stop offset="60%" stopColor="#17191C" />
              <stop offset="100%" stopColor="#0E1012" />
            </radialGradient>
            <filter id={`vektorArcGlow-${knobId}`} x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="2.2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Inactive track arc */}
          <path
            d={bgArc}
            fill="none"
            stroke="#272A2E"
            strokeWidth="4.2"
            strokeLinecap="round"
          />

          {/* Smooth spring-animated active arc (shifts smoothly to amber-orange on clipping > 0 dB) */}
          <motion.path
            d={animatedArcPath}
            fill="none"
            initial={false}
            animate={{
              stroke: clippingWarning ? CLIP_WARN_COLOR : VEKTOR_TREM_COLORS.accentGreen,
            }}
            transition={glowTransition}
            strokeWidth="4.2"
            strokeLinecap="round"
            filter={`url(#vektorArcGlow-${knobId})`}
            style={{ opacity: animatedArcOpacity }}
          />

          {/* Outer dial recess shadow */}
          <circle cx="50" cy="50" r="34" fill="#090A0C" />

          {/* Matte dark metallic knob cap */}
          <motion.circle
            cx="50"
            cy="50"
            r="31.5"
            fill={`url(#vektorKnobGrad-${knobId})`}
            initial={false}
            animate={{
              stroke: clippingWarning
                ? CLIP_WARN_COLOR
                : isDragging
                ? VEKTOR_TREM_COLORS.accentGreen
                : '#2A2E33',
              strokeOpacity: clippingWarning ? 0.72 : isDragging ? 0.65 : 1,
            }}
            transition={glowTransition}
            strokeWidth="1.2"
          />

          {/* Subtle inner clipping rim glow */}
          <motion.circle
            cx="50"
            cy="50"
            r="28.5"
            fill="none"
            stroke="#FB923C"
            strokeWidth="1"
            initial={false}
            animate={{ opacity: clippingWarning ? 0.34 : 0 }}
            transition={glowTransition}
          />

          {/* Subtle inner bevel circle */}
          <circle
            cx="50"
            cy="50"
            r="26"
            fill="none"
            stroke="rgba(255,255,255,0.04)"
            strokeWidth="0.8"
          />
        </svg>

        {/* GPU-composited rotating pointer notch synced with the spring arc */}
        <motion.div
          style={{ rotate: animatedAngle }}
          className="absolute inset-0 pointer-events-none"
          aria-hidden="true"
        >
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <line
              x1="50"
              y1="21"
              x2="50"
              y2="28"
              stroke={clippingWarning ? '#FDBA74' : isDragging ? '#FFFFFF' : '#F3F4F6'}
              strokeWidth="2.4"
              strokeLinecap="round"
            />
          </svg>
        </motion.div>

        {/* Centered numeric/division value inside the knob (VektorTrem signature) */}
        <motion.span
          initial={false}
          animate={{
            color: clippingWarning ? '#FDBA74' : isDragging ? '#FFFFFF' : '#E2E8F0',
          }}
          transition={glowTransition}
          className={`pointer-events-none absolute font-mono font-medium tabular-nums tracking-tight ${
            size === 'md' ? 'text-[12px]' : 'text-[11px]'
          }`}
        >
          {centerDisplay}
        </motion.span>
      </motion.div>

      {/* Uppercase label + unit suffix */}
      <div className="mt-1.5 flex items-baseline gap-1 leading-none">
        <span className="font-mono text-[10px] font-medium tracking-[0.14em] text-slate-300 uppercase">
          {label}
        </span>
        {unit && <span className="font-mono text-[9px] text-slate-500">{unit}</span>}
      </div>

      {subLabel && (
        <span className="mt-1 font-mono text-[10px] tabular-nums text-slate-500 leading-none">
          {subLabel}
        </span>
      )}
    </div>
  );
};

import React, { useRef, useState, useEffect } from 'react';
import { VEKTOR_TREM_COLORS } from '../data/vektorDelayData';

interface HorizontalSliderProps {
  label: string;
  value: number; // normalized 0..1
  onChange: (next: number) => void;
  defaultValue: number;
  displayValue: string;
  unit: string;
  ticks: string[];
}

export const HorizontalSlider: React.FC<HorizontalSliderProps> = ({
  label,
  value,
  onChange,
  defaultValue,
  displayValue,
  unit,
  ticks,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  const clamped = Math.min(1, Math.max(0, value));
  const pct = clamped * 100;

  const updateFromClientX = (clientX: number) => {
    if (!trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const rel = (clientX - rect.left) / rect.width;
    onChange(Math.min(1, Math.max(0, rel)));
  };

  useEffect(() => {
    if (!isDragging) return;
    const handleMove = (e: PointerEvent) => updateFromClientX(e.clientX);
    const handleUp = () => setIsDragging(false);

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  });

  return (
    <div className="select-none">
      {/* Top label + numeric readout */}
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="font-mono text-[10px] font-medium tracking-[0.14em] text-slate-300 uppercase">
          {label}
        </span>
        <div className="flex items-baseline gap-1 font-mono tabular-nums">
          <span className="text-[11px] font-semibold text-slate-100">{displayValue}</span>
          <span className="text-[10px] text-slate-500">{unit}</span>
        </div>
      </div>

      {/* Track + glowing green fill + hardware fader thumb */}
      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        onPointerDown={(e) => {
          e.preventDefault();
          setIsDragging(true);
          updateFromClientX(e.clientX);
        }}
        onDoubleClick={() => onChange(defaultValue)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
            e.preventDefault();
            onChange(Math.min(1, clamped + 0.02));
          } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
            e.preventDefault();
            onChange(Math.max(0, clamped - 0.02));
          }
        }}
        className="relative h-5 flex items-center cursor-ew-resize focus:outline-none"
        title={`${label}: ${displayValue} ${unit} (Double-click to reset)`}
      >
        {/* Groove */}
        <div className="w-full h-[5px] rounded-full bg-[#22252A] overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{
              width: `${pct}%`,
              backgroundColor: VEKTOR_TREM_COLORS.accentGreen,
              boxShadow: `0 0 8px ${VEKTOR_TREM_COLORS.accentGreenGlow}`,
            }}
          />
        </div>

        {/* Vertical hardware slider cap with center phosphor green hairline */}
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-[10px] h-[18px] rounded-[2px] flex items-center justify-center bg-[#2A2E33] border transition-colors"
          style={{
            left: `${pct}%`,
            borderColor: isDragging ? '#6B7280' : '#40454D',
            boxShadow: '0 2px 5px rgba(0,0,0,0.75)',
          }}
        >
          <div
            className="w-[2px] h-[11px] rounded-full"
            style={{ backgroundColor: VEKTOR_TREM_COLORS.accentGreen }}
          />
        </div>
      </div>

      {/* Bottom scale ticks */}
      <div className="flex items-center justify-between mt-0.5 font-mono text-[8.5px] text-slate-600 tabular-nums">
        {ticks.map((t, idx) => (
          <span key={idx}>{t}</span>
        ))}
      </div>
    </div>
  );
};

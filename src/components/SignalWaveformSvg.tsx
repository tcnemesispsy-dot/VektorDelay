import React from 'react';

interface SignalWaveformSvgProps {
  modeId: number;
  color: string;
  compact?: boolean;
  active?: boolean;
}

/**
 * Generates normalized envelope points (0..1) for the 7 rhythmic gate modes.
 */
export function evaluateSignalShape(modeId: number, t: number): number {
  const u = Math.min(1, Math.max(0, t));
  switch (modeId) {
    case 0: // GATE: full flat sustain with crisp vertical edges
      return u < 0.04 || u > 0.96 ? 0.15 : 0.96;
    case 1: // DECAY: sharp attack + linear ramp down
      return Math.max(0.04, 1 - u * 0.94);
    case 2: // SPIKE: ultra-fast exponential decay
      return Math.max(0.04, Math.pow(1 - u, 3.2));
    case 3: // REV: reverse ramp up
      return Math.max(0.04, 0.08 + u * 0.9);
    case 4: // SWELL: exponential swell up
      return Math.max(0.04, Math.pow(u, 1.9) * 0.94 + 0.04);
    case 5: // TRI: symmetric pyramid
      return Math.max(0.04, 1 - Math.abs(u - 0.5) * 1.9);
    case 6: // STUT: double micro-chop burst
    default: {
      const sub = (u * 2) % 1;
      return sub < 0.45 ? Math.max(0.05, 1 - sub * 1.85) : 0.05;
    }
  }
}

export const SignalWaveformSvg: React.FC<SignalWaveformSvgProps> = ({
  modeId,
  color,
  compact = false,
  active = false,
}) => {
  const width = compact ? 24 : 32;
  const height = compact ? 14 : 18;
  const samples = compact ? 16 : 24;

  const points: string[] = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const val = evaluateSignalShape(modeId, t);
    const x = (t * (width - 2) + 1).toFixed(1);
    const y = (height - 1.5 - val * (height - 3.5)).toFixed(1);
    points.push(`${x},${y}`);
  }

  const areaPoints = `1,${height - 1} ${points.join(' ')} ${width - 1},${height - 1}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible" aria-hidden="true">
      <polygon points={areaPoints} fill={color} opacity={active ? 0.24 : 0.12} />
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth={compact ? 1.3 : 1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={active ? 1 : 0.8}
      />
    </svg>
  );
};

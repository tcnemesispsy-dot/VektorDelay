export type InsertMode = 'audio' | 'midi' | 'hybrid';

export type PresetCategory = 'Bass' | 'Pad' | 'Rhythmic' | 'FX';

export const PRESET_CATEGORIES: PresetCategory[] = ['Bass', 'Pad', 'Rhythmic', 'FX'];

export interface VektorColors {
  chassisBg: string;
  panelBg: string;
  scopeBg: string;
  borderHairline: string;
  accentGreen: string;
  accentGreenBright: string;
  accentGreenSoft: string;
  accentGreenGlow: string;
  accentMint: string;
  accentMintSoft: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
}

/**
 * Exact VektorTrem VST3 color tokens
 */
export const VEKTOR_TREM_COLORS: VektorColors = {
  chassisBg: '#121416',
  panelBg: '#15171A',
  scopeBg: '#0B0C0E',
  borderHairline: '#24272A',
  accentGreen: '#22E55E',
  accentGreenBright: '#4ADE80',
  accentGreenSoft: 'rgba(34, 229, 94, 0.14)',
  accentGreenGlow: 'rgba(34, 229, 94, 0.45)',
  accentMint: '#3AE39E',
  accentMintSoft: 'rgba(58, 227, 158, 0.14)',
  textPrimary: '#F3F4F6',
  textSecondary: '#9CA3AF',
  textMuted: '#6B7280',
};

export interface SignalMode {
  id: number;
  code: string;
  label: string;
  description: string;
}

export const SIGNAL_MODES: SignalMode[] = [
  { id: 0, code: 'GATE', label: 'Full Gate', description: 'Constant solid sustain across the entire step' },
  { id: 1, code: 'DECAY', label: 'Linear Decay', description: 'Instant attack with controlled linear decay' },
  { id: 2, code: 'SPIKE', label: 'Exp Transient', description: 'Short percussive pulse with exponential decay' },
  { id: 3, code: 'REV', label: 'Reverse Ramp', description: 'Progressive crescendo like reverse sidechain' },
  { id: 4, code: 'SWELL', label: 'Exponential Swell', description: 'Smooth exponential rise with clean cut' },
  { id: 5, code: 'TRI', label: 'Symmetric Triangle', description: 'Balanced pyramidal attack and decay envelope' },
  { id: 6, code: 'STUT', label: 'Double Stutter', description: 'Rhythmic double micro-repeat within the step' },
];

export interface SpeedRate {
  id: string;
  label: string;
  beatsPerStep: number;
}

export const SPEED_RATES: SpeedRate[] = [
  { id: '1/2', label: '1/2', beatsPerStep: 2 },
  { id: '1/2.', label: '1/2.', beatsPerStep: 3 },
  { id: '1/4', label: '1/4', beatsPerStep: 1 },
  { id: '1/4.', label: '1/4.', beatsPerStep: 1.5 },
  { id: '1/4T', label: '1/4T', beatsPerStep: 2 / 3 },
  { id: '1/8', label: '1/8', beatsPerStep: 0.5 },
  { id: '1/8.', label: '1/8.', beatsPerStep: 0.75 },
  { id: '1/8T', label: '1/8T', beatsPerStep: 1 / 3 },
  { id: '1/16', label: '1/16', beatsPerStep: 0.25 },
  { id: '1/16T', label: '1/16T', beatsPerStep: 1 / 6 },
  { id: '1/32', label: '1/32', beatsPerStep: 0.125 },
  { id: '1/64', label: '1/64', beatsPerStep: 0.0625 },
];

export interface GatePreset {
  id: string;
  name: string;
  category: PresetCategory;
  stepCount: number;
  speedId: string;
  levels: number[]; // 32 values (0..1)
  modes: number[]; // 32 signal modes (0..6)
  enabledSteps: boolean[]; // 32 active/omitted flags
  smooth: number;
  envTime: number;
  swing: number;
  floor: number;
  depth: number;
  releaseMs: number;
  outTrimDb: number;
  mix: number;
}

const allStepsOn = (): boolean[] => Array.from({ length: 32 }, () => true);

const stepsMask = (offIndices1Based: number[]): boolean[] =>
  Array.from({ length: 32 }, (_, i) => !offIndices1Based.includes(i + 1));

export const GATE_PRESETS: GatePreset[] = [
  // ======================== RHYTHMIC (4) ========================
  {
    id: 'vektortrance',
    name: 'Vektor Trance 32',
    category: 'Rhythmic',
    stepCount: 32,
    speedId: '1/16',
    levels: [
      1.0, 0.92, 0.92, 0.42, 1.0, 0.94, 0.38, 0.92,
      0.98, 0.92, 0.92, 0.42, 1.0, 0.94, 0.38, 0.92,
      1.0, 0.92, 0.92, 0.42, 1.0, 0.94, 0.38, 0.92,
      1.0, 0.92, 0.98, 0.42, 1.0, 0.94, 0.92, 0.88,
    ],
    modes: [
      0, 1, 2, 0, 0, 1, 6, 2,
      0, 1, 2, 0, 0, 1, 6, 2,
      0, 1, 2, 0, 0, 1, 6, 2,
      0, 1, 5, 6, 0, 1, 2, 0,
    ],
    enabledSteps: allStepsOn(),
    smooth: 0.30,
    envTime: 0.68,
    swing: 0.08,
    floor: 0.0,
    depth: 1.0,
    releaseMs: 3.0,
    outTrimDb: 0.0,
    mix: 1.0,
  },
  {
    id: 'psystutter16',
    name: 'Psy Stutter 16',
    category: 'Rhythmic',
    stepCount: 16,
    speedId: '1/16',
    levels: [
      1.0, 0.35, 0.86, 0.25, 0.96, 0.62, 0.42, 0.92,
      1.0, 0.30, 0.88, 0.45, 0.95, 0.72, 0.55, 0.82,
      0.9, 0.4, 0.8, 0.3, 0.9, 0.4, 0.8, 0.3,
      0.9, 0.4, 0.8, 0.3, 0.9, 0.4, 0.8, 0.3,
    ],
    modes: [
      2, 6, 1, 2, 0, 3, 2, 6,
      2, 6, 1, 5, 0, 4, 6, 1,
      2, 6, 1, 2, 0, 3, 2, 6,
      2, 6, 1, 5, 0, 4, 6, 1,
    ],
    enabledSteps: stepsMask([4, 12]),
    smooth: 0.12,
    envTime: 0.38,
    swing: 0.15,
    floor: 0.0,
    depth: 0.95,
    releaseMs: 4.5,
    outTrimDb: 0.0,
    mix: 1.0,
  },
  {
    id: 'tripletchop',
    name: 'Triplet Groove 24',
    category: 'Rhythmic',
    stepCount: 24,
    speedId: '1/16T',
    levels: [
      1.0, 0.78, 0.32, 0.94, 0.68, 0.28, 0.98, 0.82,
      0.38, 0.95, 0.58, 0.88, 1.0, 0.74, 0.34, 0.92,
      0.64, 0.28, 0.96, 0.80, 0.46, 0.88, 0.70, 0.54,
      0.8, 0.5, 0.3, 0.8, 0.5, 0.3, 0.8, 0.5,
    ],
    modes: [
      1, 2, 6, 1, 2, 0, 1, 5,
      6, 1, 2, 3, 1, 2, 6, 1,
      2, 0, 1, 5, 6, 1, 3, 4,
      1, 2, 6, 1, 2, 0, 1, 5,
    ],
    enabledSteps: stepsMask([6, 18]),
    smooth: 0.20,
    envTime: 0.44,
    swing: 0.26,
    floor: 0.0,
    depth: 0.88,
    releaseMs: 7.0,
    outTrimDb: 0.0,
    mix: 0.9,
  },
  {
    id: 'euclidean12',
    name: 'Euclidean Sync 12',
    category: 'Rhythmic',
    stepCount: 12,
    speedId: '1/16',
    levels: [
      1.0, 0.55, 0.85, 1.0, 0.45, 0.90, 0.60, 1.0,
      0.50, 0.88, 0.75, 0.95, 0.8, 0.4, 0.7, 0.5,
      0.8, 0.4, 0.7, 0.5, 0.8, 0.4, 0.7, 0.5,
      0.8, 0.4, 0.7, 0.5, 0.8, 0.4, 0.7, 0.5,
    ],
    modes: [
      1, 2, 1, 0, 2, 1, 5, 0,
      2, 1, 6, 2, 0, 1, 2, 3,
      0, 1, 2, 3, 0, 1, 2, 3,
      0, 1, 2, 3, 0, 1, 2, 3,
    ],
    enabledSteps: stepsMask([2, 5, 9]),
    smooth: 0.14,
    envTime: 0.52,
    swing: 0.12,
    floor: 0.0,
    depth: 1.0,
    releaseMs: 3.5,
    outTrimDb: 0.0,
    mix: 1.0,
  },

  // ======================== BASS (4) ========================
  {
    id: 'subrolling16',
    name: 'Sub Rolling 16',
    category: 'Bass',
    stepCount: 16,
    speedId: '1/16',
    levels: [
      0.30, 0.96, 0.92, 0.88, 0.30, 0.96, 0.92, 0.88,
      0.30, 0.96, 0.92, 0.88, 0.30, 0.96, 0.92, 0.88,
      0.3, 0.9, 0.9, 0.8, 0.3, 0.9, 0.9, 0.8,
      0.3, 0.9, 0.9, 0.8, 0.3, 0.9, 0.9, 0.8,
    ],
    modes: [
      3, 1, 1, 2, 3, 1, 1, 2,
      3, 1, 1, 2, 3, 1, 1, 6,
      0, 1, 1, 2, 0, 1, 1, 2,
      0, 1, 1, 2, 0, 1, 1, 2,
    ],
    enabledSteps: stepsMask([1, 5, 9, 13]),
    smooth: 0.16,
    envTime: 0.58,
    swing: 0.0,
    floor: 0.0,
    depth: 1.0,
    releaseMs: 2.5,
    outTrimDb: 0.5,
    mix: 1.0,
  },
  {
    id: 'acidoffbeat08',
    name: 'Acid Offbeat 08',
    category: 'Bass',
    stepCount: 8,
    speedId: '1/8',
    levels: [
      0.35, 1.0, 0.35, 1.0, 0.35, 1.0, 0.35, 0.94,
      0.35, 1.0, 0.35, 1.0, 0.35, 1.0, 0.35, 0.94,
      0.35, 1.0, 0.35, 1.0, 0.35, 1.0, 0.35, 0.94,
      0.35, 1.0, 0.35, 1.0, 0.35, 1.0, 0.35, 0.94,
    ],
    modes: [
      2, 1, 2, 1, 2, 1, 2, 6,
      2, 1, 2, 1, 2, 1, 2, 6,
      2, 1, 2, 1, 2, 1, 2, 6,
      2, 1, 2, 1, 2, 1, 2, 6,
    ],
    enabledSteps: stepsMask([1, 3, 5, 7]),
    smooth: 0.18,
    envTime: 0.72,
    swing: 0.05,
    floor: 0.0,
    depth: 1.0,
    releaseMs: 4.0,
    outTrimDb: 0.0,
    mix: 1.0,
  },
  {
    id: 'tripletgallop',
    name: 'Triplet Gallop Bass',
    category: 'Bass',
    stepCount: 12,
    speedId: '1/16T',
    levels: [
      0.28, 0.92, 0.96, 0.28, 0.92, 0.96, 0.28, 0.92,
      0.96, 0.28, 0.92, 0.85, 0.3, 0.9, 0.9, 0.3,
      0.9, 0.9, 0.3, 0.9, 0.9, 0.3, 0.9, 0.9,
      0.3, 0.9, 0.9, 0.3, 0.9, 0.9, 0.3, 0.9,
    ],
    modes: [
      2, 1, 2, 2, 1, 2, 2, 1,
      2, 2, 1, 1, 2, 1, 2, 2,
      1, 2, 2, 1, 2, 2, 1, 2,
      2, 1, 2, 2, 1, 2, 2, 1,
    ],
    enabledSteps: stepsMask([1, 4, 7, 10]),
    smooth: 0.10,
    envTime: 0.48,
    swing: 0.0,
    floor: 0.0,
    depth: 1.0,
    releaseMs: 2.0,
    outTrimDb: 0.8,
    mix: 1.0,
  },
  {
    id: 'monopunch32',
    name: 'Mono Punch 32',
    category: 'Bass',
    stepCount: 32,
    speedId: '1/16',
    levels: [
      0.98, 0.76, 0.94, 0.45, 0.92, 0.82, 0.98, 0.60,
      0.96, 0.74, 0.90, 0.45, 0.95, 0.84, 0.65, 0.92,
      0.98, 0.76, 0.94, 0.45, 0.92, 0.82, 0.98, 0.60,
      0.96, 0.74, 0.90, 0.45, 0.95, 0.88, 0.72, 0.96,
    ],
    modes: [
      2, 2, 1, 2, 2, 1, 2, 6,
      2, 2, 1, 2, 2, 1, 2, 1,
      2, 2, 1, 2, 2, 1, 2, 6,
      2, 2, 1, 2, 2, 1, 6, 1,
    ],
    enabledSteps: stepsMask([4, 12, 20, 28]),
    smooth: 0.12,
    envTime: 0.42,
    swing: 0.10,
    floor: 0.0,
    depth: 0.94,
    releaseMs: 3.2,
    outTrimDb: 0.0,
    mix: 1.0,
  },

  // ======================== PAD (4) ========================
  {
    id: 'ambientswell04',
    name: 'Ambient Swell 04',
    category: 'Pad',
    stepCount: 16,
    speedId: '1/8',
    levels: [
      0.38, 0.58, 0.82, 0.98, 0.82, 0.58, 0.38, 0.48,
      0.66, 0.88, 1.0, 0.88, 0.66, 0.48, 0.38, 0.52,
      0.4, 0.6, 0.8, 1.0, 0.8, 0.6, 0.4, 0.5,
      0.7, 0.9, 1.0, 0.9, 0.7, 0.5, 0.4, 0.5,
    ],
    modes: [
      4, 4, 5, 0, 1, 1, 4, 4,
      5, 5, 0, 1, 1, 4, 4, 5,
      4, 4, 5, 0, 1, 1, 4, 4,
      5, 5, 0, 1, 1, 4, 4, 5,
    ],
    enabledSteps: allStepsOn(),
    smooth: 0.72,
    envTime: 0.92,
    swing: 0.0,
    floor: 0.0,
    depth: 0.68,
    releaseMs: 36.0,
    outTrimDb: 0.0,
    mix: 0.82,
  },
  {
    id: 'vectorsidechain08',
    name: 'Vector Sidechain 08',
    category: 'Pad',
    stepCount: 8,
    speedId: '1/8',
    levels: [
      0.24, 0.98, 0.24, 0.98, 0.24, 0.98, 0.30, 0.92,
      0.24, 0.98, 0.24, 0.98, 0.24, 0.98, 0.30, 0.92,
      0.24, 0.98, 0.24, 0.98, 0.24, 0.98, 0.30, 0.92,
      0.24, 0.98, 0.24, 0.98, 0.24, 0.98, 0.30, 0.92,
    ],
    modes: [
      3, 0, 3, 0, 3, 0, 4, 5,
      3, 0, 3, 0, 3, 0, 4, 5,
      3, 0, 3, 0, 3, 0, 4, 5,
      3, 0, 3, 0, 3, 0, 4, 5,
    ],
    enabledSteps: allStepsOn(),
    smooth: 0.56,
    envTime: 0.86,
    swing: 0.04,
    floor: 0.0,
    depth: 0.78,
    releaseMs: 18.0,
    outTrimDb: -0.5,
    mix: 0.92,
  },
  {
    id: 'dreamtremolo32',
    name: 'Dream Dotted 32',
    category: 'Pad',
    stepCount: 32,
    speedId: '1/8.',
    levels: [
      0.88, 0.65, 0.92, 0.54, 0.82, 0.70, 0.96, 0.48,
      0.86, 0.62, 0.90, 0.58, 0.84, 0.74, 0.94, 0.52,
      0.88, 0.65, 0.92, 0.54, 0.82, 0.70, 0.96, 0.48,
      0.86, 0.62, 0.90, 0.58, 0.84, 0.74, 0.94, 0.60,
    ],
    modes: [
      5, 4, 5, 3, 5, 4, 0, 5,
      5, 4, 5, 3, 5, 4, 0, 5,
      5, 4, 5, 3, 5, 4, 0, 5,
      5, 4, 5, 3, 5, 4, 0, 5,
    ],
    enabledSteps: allStepsOn(),
    smooth: 0.64,
    envTime: 0.80,
    swing: 0.08,
    floor: 0.0,
    depth: 0.62,
    releaseMs: 28.0,
    outTrimDb: 0.0,
    mix: 0.78,
  },
  {
    id: 'glassshimmer16',
    name: 'Glass Shimmer 16',
    category: 'Pad',
    stepCount: 16,
    speedId: '1/16',
    levels: [
      0.92, 0.48, 0.74, 0.88, 0.52, 0.96, 0.44, 0.82,
      0.90, 0.50, 0.78, 0.92, 0.48, 0.94, 0.56, 0.86,
      0.9, 0.5, 0.7, 0.9, 0.5, 0.9, 0.4, 0.8,
      0.9, 0.5, 0.7, 0.9, 0.5, 0.9, 0.5, 0.8,
    ],
    modes: [
      5, 3, 5, 4, 5, 0, 3, 5,
      5, 3, 5, 4, 5, 0, 3, 5,
      5, 3, 5, 4, 5, 0, 3, 5,
      5, 3, 5, 4, 5, 0, 3, 5,
    ],
    enabledSteps: stepsMask([8, 16]),
    smooth: 0.50,
    envTime: 0.74,
    swing: 0.10,
    floor: 0.0,
    depth: 0.74,
    releaseMs: 22.0,
    outTrimDb: 0.0,
    mix: 0.86,
  },

  // ======================== FX (4) ========================
  {
    id: 'hyperratchet32',
    name: 'Hyper Ratchet 32',
    category: 'FX',
    stepCount: 32,
    speedId: '1/32',
    levels: [
      1.0, 0.85, 0.70, 0.55, 0.40, 0.95, 0.80, 0.65,
      1.0, 0.90, 0.80, 0.70, 0.60, 0.50, 0.40, 0.30,
      0.95, 0.40, 0.95, 0.40, 1.0, 0.85, 0.70, 0.55,
      1.0, 1.0, 0.85, 0.70, 0.95, 0.80, 0.65, 0.50,
    ],
    modes: [
      6, 6, 2, 2, 2, 6, 6, 2,
      6, 2, 6, 2, 6, 2, 6, 2,
      2, 6, 2, 6, 6, 6, 2, 2,
      0, 6, 6, 2, 6, 6, 2, 2,
    ],
    enabledSteps: stepsMask([15, 16, 23, 24]),
    smooth: 0.05,
    envTime: 0.28,
    swing: 0.0,
    floor: 0.0,
    depth: 1.0,
    releaseMs: 1.5,
    outTrimDb: 0.0,
    mix: 1.0,
  },
  {
    id: 'micrograin64',
    name: 'Micro Grain 64',
    category: 'FX',
    stepCount: 16,
    speedId: '1/64',
    levels: [
      1.0, 0.50, 0.92, 0.35, 0.88, 0.60, 1.0, 0.42,
      0.94, 0.55, 0.84, 0.38, 0.98, 0.68, 0.76, 0.48,
      1.0, 0.5, 0.9, 0.3, 0.9, 0.6, 1.0, 0.4,
      0.9, 0.5, 0.8, 0.4, 1.0, 0.7, 0.8, 0.5,
    ],
    modes: [
      2, 6, 2, 6, 2, 6, 2, 6,
      2, 6, 2, 6, 2, 6, 2, 6,
      2, 6, 2, 6, 2, 6, 2, 6,
      2, 6, 2, 6, 2, 6, 2, 6,
    ],
    enabledSteps: stepsMask([4, 8, 12]),
    smooth: 0.02,
    envTime: 0.22,
    swing: 0.08,
    floor: 0.0,
    depth: 1.0,
    releaseMs: 1.2,
    outTrimDb: 0.5,
    mix: 0.95,
  },
  {
    id: 'reversevacuum',
    name: 'Reverse Vacuum',
    category: 'FX',
    stepCount: 16,
    speedId: '1/8.',
    levels: [
      0.95, 0.82, 0.98, 0.70, 0.92, 0.88, 1.0, 0.64,
      0.95, 0.82, 0.98, 0.70, 0.92, 0.88, 1.0, 0.64,
      0.9, 0.8, 1.0, 0.7, 0.9, 0.9, 1.0, 0.6,
      0.9, 0.8, 1.0, 0.7, 0.9, 0.9, 1.0, 0.6,
    ],
    modes: [
      3, 4, 3, 4, 3, 4, 3, 6,
      3, 4, 3, 4, 3, 4, 3, 6,
      3, 4, 3, 4, 3, 4, 3, 6,
      3, 4, 3, 4, 3, 4, 3, 6,
    ],
    enabledSteps: stepsMask([8, 16]),
    smooth: 0.24,
    envTime: 0.90,
    swing: 0.14,
    floor: 0.0,
    depth: 1.0,
    releaseMs: 9.0,
    outTrimDb: 0.0,
    mix: 1.0,
  },
  {
    id: 'glitchmatrix24',
    name: 'Glitch Matrix 24',
    category: 'FX',
    stepCount: 24,
    speedId: '1/16T',
    levels: [
      1.0, 0.42, 0.92, 0.75, 0.30, 0.98, 0.84, 0.50,
      0.95, 0.38, 0.88, 0.66, 1.0, 0.46, 0.94, 0.72,
      0.34, 0.96, 0.80, 0.56, 0.92, 0.40, 0.86, 0.98,
      0.8, 0.5, 0.7, 0.4, 0.9, 0.6, 0.8, 0.5,
    ],
    modes: [
      6, 2, 3, 6, 1, 0, 6, 4,
      2, 6, 3, 5, 6, 2, 0, 6,
      1, 4, 6, 2, 3, 6, 5, 0,
      6, 2, 3, 6, 1, 0, 6, 4,
    ],
    enabledSteps: stepsMask([5, 10, 17, 22]),
    smooth: 0.06,
    envTime: 0.36,
    swing: 0.32,
    floor: 0.0,
    depth: 1.0,
    releaseMs: 2.8,
    outTrimDb: 0.0,
    mix: 1.0,
  },
];

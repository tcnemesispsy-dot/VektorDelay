export type InsertMode = 'audio' | 'midi' | 'hybrid';

export type PresetCategory = 'Tape' | 'Stereo' | 'Rhythmic' | 'Ambient';

export const PRESET_CATEGORIES: PresetCategory[] = ['Tape', 'Stereo', 'Rhythmic', 'Ambient'];

export type DelayModeId = 'air' | 'magnetic' | 'circuit' | 'aether' | 'reverse';

export type MagneticSubType = 'Reel' | 'Space' | 'Cassette' | 'Dusty';
export type CircuitSubType = 'Studio' | 'Vintage' | 'Pedal' | 'Modded';
export type AirSubType = 'Clean' | 'Diffuse' | 'Sparkle';
export type AetherSubType = 'Shimmer' | 'Granular' | 'Sub';
export type ReverseSubType = 'Smooth' | 'Swell' | 'Chop';

export type DelaySubType =
  | MagneticSubType
  | CircuitSubType
  | AirSubType
  | AetherSubType
  | ReverseSubType;

export interface DelayModeMeta {
  id: DelayModeId;
  label: string;
  tagline: string;
  subTypes: DelaySubType[];
  characterLabel: string;
  characterUnit: string;
  isPitchBipolar?: boolean;
}

export const DELAY_MODES: DelayModeMeta[] = [
  {
    id: 'air',
    label: 'AIR',
    tagline: 'Transparent digital delay with diffusion & sparkle',
    subTypes: ['Clean', 'Diffuse', 'Sparkle'],
    characterLabel: 'DIFFUSION',
    characterUnit: '%',
  },
  {
    id: 'magnetic',
    label: 'MAGNETIC',
    tagline: 'Tape echo machines from studio reel to dusty cassette',
    subTypes: ['Reel', 'Space', 'Cassette', 'Dusty'],
    characterLabel: 'TAPE AGE',
    characterUnit: '%',
  },
  {
    id: 'circuit',
    label: 'CIRCUIT',
    tagline: 'Classic BBD analog bucket-brigade hardware delays',
    subTypes: ['Studio', 'Vintage', 'Pedal', 'Modded'],
    characterLabel: 'BBD GRIT',
    characterUnit: '%',
  },
  {
    id: 'aether',
    label: 'AETHER',
    tagline: 'Experimental pitch-shifted & granular delay textures',
    subTypes: ['Shimmer', 'Granular', 'Sub'],
    characterLabel: 'PITCH',
    characterUnit: 'st',
    isPitchBipolar: true,
  },
  {
    id: 'reverse',
    label: 'REVERSE',
    tagline: 'Reversed echo envelopes with transient smoothing',
    subTypes: ['Smooth', 'Swell', 'Chop'],
    characterLabel: 'SMOOTH',
    characterUnit: '%',
  },
];

export type PatternEngineMode = 'dual' | 'sequence';
export type DualRoutingMode = 'pingpong' | 'crisscross';
export type DualRatioId = '1:1' | 'golden' | 'plastic' | 'semitone';
export type SequencePlayMode = 'loop' | 'once';
export type FilterPosition = 'pre' | 'post';
export type DuckerTarget = 'post' | 'fb' | 'both';

export interface DualRatioMeta {
  id: DualRatioId;
  label: string;
  ratioR: number; // Multiplier for Right channel relative to Left delay time
}

export const DUAL_RATIOS: DualRatioMeta[] = [
  { id: '1:1', label: '1:1', ratioR: 1.0 },
  { id: 'golden', label: 'GOLDEN', ratioR: 1.618 },
  { id: 'plastic', label: 'PLASTIC', ratioR: 1.325 },
  { id: 'semitone', label: 'SEMI', ratioR: 1.059 },
];

export interface SequenceStep {
  enabled: boolean;
  pan: number; // -1 (L) .. 0 (C) .. +1 (R)
}

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
 * Exact Vektor Series color tokens
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

export interface TimebaseRate {
  id: string;
  label: string;
  beatsPerTap: number;
}

export const TIMEBASE_RATES: TimebaseRate[] = [
  { id: '1/1', label: '1/1', beatsPerTap: 4 },
  { id: '1/2', label: '1/2', beatsPerTap: 2 },
  { id: '1/2.', label: '1/2.', beatsPerTap: 3 },
  { id: '1/4', label: '1/4', beatsPerTap: 1 },
  { id: '1/4.', label: '1/4.', beatsPerTap: 1.5 },
  { id: '1/4T', label: '1/4T', beatsPerTap: 2 / 3 },
  { id: '1/8', label: '1/8', beatsPerTap: 0.5 },
  { id: '1/8.', label: '1/8.', beatsPerTap: 0.75 },
  { id: '1/8T', label: '1/8T', beatsPerTap: 1 / 3 },
  { id: '1/16', label: '1/16', beatsPerTap: 0.25 },
  { id: '1/16.', label: '1/16.', beatsPerTap: 0.375 },
  { id: '1/16T', label: '1/16T', beatsPerTap: 1 / 6 },
];

export const makeDefaultSequenceSteps = (
  activeMask: boolean[] = [true, true, false, false, true, false, true, false],
  pans: number[] = [0, 0, -0.5, 0.5, 0, -0.7, 0, 0.7]
): SequenceStep[] =>
  Array.from({ length: 8 }, (_, i) => ({
    enabled: activeMask[i] ?? true,
    pan: pans[i] ?? 0,
  }));

export interface DelayPreset {
  id: string;
  name: string;
  category: PresetCategory;
  delayMode: DelayModeId;
  subType: DelaySubType;
  patternMode: PatternEngineMode;
  dualRouting: DualRoutingMode;
  dualRatio: DualRatioId;
  lrOffsetMs: number;
  seqPlayMode: SequencePlayMode;
  seqStepCount: number;
  seqSteps: SequenceStep[];
  syncMode: 'sync' | 'free';
  timebaseId: string;
  delayTimeMs: number;
  swing: number; // 0..1 (50% = neutral)
  offsetMs: number; // -50..+50
  feedback: number; // 0..1.10
  modRateHz: number; // 0.05..10.0
  modAmt: number; // 0..1
  characterVal: number; // 0..1 (or pitch -12..+12 normalized inside preset)
  pitchSemitones: number; // -12..+12 for Aether mode
  width: number; // 0..2 (0%..200%)
  filterPos: FilterPosition;
  lowCutHz: number; // 20..1200
  highCutHz: number; // 800..20000
  lowDampPct: number; // 0..1
  lowDampFreqHz: number; // 60..800
  highDampPct: number; // 0..1
  highDampFreqHz: number; // 1200..14000
  duckerTarget: DuckerTarget;
  extSidechain: boolean;
  duckAmt: number; // 0..1
  duckRelease: number; // 0..1
  outTrimDb: number; // -12..+12
  mix: number; // 0..1
  freeze: boolean;
}

export const DELAY_PRESETS: DelayPreset[] = [
  // ======================== TAPE (3) ========================
  {
    id: 'magnetic-space-seq',
    name: 'Magnetic Space 1/8T',
    category: 'Tape',
    delayMode: 'magnetic',
    subType: 'Space',
    patternMode: 'sequence',
    dualRouting: 'pingpong',
    dualRatio: '1:1',
    lrOffsetMs: 0,
    seqPlayMode: 'loop',
    seqStepCount: 8,
    seqSteps: makeDefaultSequenceSteps(
      [true, true, false, false, true, false, true, false],
      [0, 0, -0.5, 0.5, 0, -0.6, 0, 0.6]
    ),
    syncMode: 'sync',
    timebaseId: '1/8T',
    delayTimeMs: 167,
    swing: 0.52,
    offsetMs: 0,
    feedback: 0.72,
    modRateHz: 1.0,
    modAmt: 0.24,
    characterVal: 0.42,
    pitchSemitones: 0,
    width: 1.0,
    filterPos: 'post',
    lowCutHz: 70,
    highCutHz: 10700,
    lowDampPct: 0.13,
    lowDampFreqHz: 200,
    highDampPct: 0.17,
    highDampFreqHz: 5000,
    duckerTarget: 'post',
    extSidechain: false,
    duckAmt: 0.46,
    duckRelease: 0.5,
    outTrimDb: 0.0,
    mix: 0.5,
    freeze: false,
  },
  {
    id: 'warm-reel-echo',
    name: 'Studio Reel 1/4',
    category: 'Tape',
    delayMode: 'magnetic',
    subType: 'Reel',
    patternMode: 'dual',
    dualRouting: 'pingpong',
    dualRatio: '1:1',
    lrOffsetMs: 6,
    seqPlayMode: 'loop',
    seqStepCount: 8,
    seqSteps: makeDefaultSequenceSteps(
      [true, false, true, false, true, false, true, false],
      [-0.5, 0, 0.5, 0, -0.5, 0, 0.5, 0]
    ),
    syncMode: 'sync',
    timebaseId: '1/4',
    delayTimeMs: 500,
    swing: 0.5,
    offsetMs: -4,
    feedback: 0.56,
    modRateHz: 0.75,
    modAmt: 0.18,
    characterVal: 0.28,
    pitchSemitones: 0,
    width: 1.15,
    filterPos: 'post',
    lowCutHz: 95,
    highCutHz: 7400,
    lowDampPct: 0.18,
    lowDampFreqHz: 180,
    highDampPct: 0.34,
    highDampFreqHz: 4200,
    duckerTarget: 'post',
    extSidechain: false,
    duckAmt: 0.32,
    duckRelease: 0.44,
    outTrimDb: 0.0,
    mix: 0.42,
    freeze: false,
  },
  {
    id: 'dusty-cassette-dub',
    name: 'Dusty Cassette Dub',
    category: 'Tape',
    delayMode: 'magnetic',
    subType: 'Dusty',
    patternMode: 'dual',
    dualRouting: 'crisscross',
    dualRatio: 'semitone',
    lrOffsetMs: 12,
    seqPlayMode: 'loop',
    seqStepCount: 8,
    seqSteps: makeDefaultSequenceSteps(
      [true, true, false, true, false, true, true, false],
      [-0.8, 0.8, 0, -0.4, 0.4, -0.9, 0.9, 0]
    ),
    syncMode: 'free',
    timebaseId: '1/8.',
    delayTimeMs: 318,
    swing: 0.56,
    offsetMs: 8,
    feedback: 0.78,
    modRateHz: 2.3,
    modAmt: 0.58,
    characterVal: 0.76,
    pitchSemitones: 0,
    width: 0.92,
    filterPos: 'pre',
    lowCutHz: 180,
    highCutHz: 4100,
    lowDampPct: 0.26,
    lowDampFreqHz: 260,
    highDampPct: 0.48,
    highDampFreqHz: 3200,
    duckerTarget: 'fb',
    extSidechain: false,
    duckAmt: 0.52,
    duckRelease: 0.58,
    outTrimDb: -0.4,
    mix: 0.48,
    freeze: false,
  },

  // ======================== STEREO (3) ========================
  {
    id: 'air-golden-pingpong',
    name: 'Air Golden Ping-Pong',
    category: 'Stereo',
    delayMode: 'air',
    subType: 'Sparkle',
    patternMode: 'dual',
    dualRouting: 'pingpong',
    dualRatio: 'golden',
    lrOffsetMs: 0,
    seqPlayMode: 'loop',
    seqStepCount: 8,
    seqSteps: makeDefaultSequenceSteps(
      [true, false, true, false, true, false, true, false],
      [-1.0, 0, 1.0, 0, -1.0, 0, 1.0, 0]
    ),
    syncMode: 'sync',
    timebaseId: '1/8.',
    delayTimeMs: 375,
    swing: 0.5,
    offsetMs: 0,
    feedback: 0.60,
    modRateHz: 0.85,
    modAmt: 0.22,
    characterVal: 0.48,
    pitchSemitones: 0,
    width: 1.45,
    filterPos: 'post',
    lowCutHz: 110,
    highCutHz: 16200,
    lowDampPct: 0.08,
    lowDampFreqHz: 150,
    highDampPct: 0.12,
    highDampFreqHz: 8500,
    duckerTarget: 'post',
    extSidechain: false,
    duckAmt: 0.36,
    duckRelease: 0.40,
    outTrimDb: 0.0,
    mix: 0.44,
    freeze: false,
  },
  {
    id: 'circuit-bbd-crisscross',
    name: 'Circuit Criss-Cross',
    category: 'Stereo',
    delayMode: 'circuit',
    subType: 'Vintage',
    patternMode: 'dual',
    dualRouting: 'crisscross',
    dualRatio: 'plastic',
    lrOffsetMs: -8,
    seqPlayMode: 'loop',
    seqStepCount: 8,
    seqSteps: makeDefaultSequenceSteps(
      [true, true, true, false, true, true, false, true],
      [-0.7, 0.7, -0.4, 0, 0.6, -0.6, 0, 0.8]
    ),
    syncMode: 'sync',
    timebaseId: '1/4',
    delayTimeMs: 500,
    swing: 0.53,
    offsetMs: 5,
    feedback: 0.64,
    modRateHz: 1.4,
    modAmt: 0.32,
    characterVal: 0.54,
    pitchSemitones: 0,
    width: 1.25,
    filterPos: 'post',
    lowCutHz: 130,
    highCutHz: 6200,
    lowDampPct: 0.20,
    lowDampFreqHz: 220,
    highDampPct: 0.38,
    highDampFreqHz: 3800,
    duckerTarget: 'both',
    extSidechain: false,
    duckAmt: 0.42,
    duckRelease: 0.48,
    outTrimDb: 0.0,
    mix: 0.46,
    freeze: false,
  },
  {
    id: 'circuit-studio-slap',
    name: 'BBD Studio Slapback',
    category: 'Stereo',
    delayMode: 'circuit',
    subType: 'Studio',
    patternMode: 'dual',
    dualRouting: 'pingpong',
    dualRatio: 'semitone',
    lrOffsetMs: 14,
    seqPlayMode: 'once',
    seqStepCount: 4,
    seqSteps: makeDefaultSequenceSteps(
      [true, true, false, false, false, false, false, false],
      [-0.85, 0.85, 0, 0, 0, 0, 0, 0]
    ),
    syncMode: 'free',
    timebaseId: '1/16',
    delayTimeMs: 96,
    swing: 0.5,
    offsetMs: 0,
    feedback: 0.22,
    modRateHz: 0.55,
    modAmt: 0.14,
    characterVal: 0.32,
    pitchSemitones: 0,
    width: 1.3,
    filterPos: 'post',
    lowCutHz: 120,
    highCutHz: 11800,
    lowDampPct: 0.10,
    lowDampFreqHz: 180,
    highDampPct: 0.22,
    highDampFreqHz: 5400,
    duckerTarget: 'post',
    extSidechain: false,
    duckAmt: 0.0,
    duckRelease: 0.35,
    outTrimDb: 0.2,
    mix: 0.34,
    freeze: false,
  },

  // ======================== RHYTHMIC (3) ========================
  {
    id: 'seq-trance-8step',
    name: 'Pulsar 8-Step Trance',
    category: 'Rhythmic',
    delayMode: 'air',
    subType: 'Clean',
    patternMode: 'sequence',
    dualRouting: 'pingpong',
    dualRatio: '1:1',
    lrOffsetMs: 0,
    seqPlayMode: 'loop',
    seqStepCount: 8,
    seqSteps: makeDefaultSequenceSteps(
      [true, false, true, true, false, true, true, false],
      [-0.9, 0, 0.85, -0.5, 0, 0.6, -0.85, 0]
    ),
    syncMode: 'sync',
    timebaseId: '1/16',
    delayTimeMs: 125,
    swing: 0.58,
    offsetMs: 0,
    feedback: 0.68,
    modRateHz: 1.8,
    modAmt: 0.2,
    characterVal: 0.25,
    pitchSemitones: 0,
    width: 1.2,
    filterPos: 'post',
    lowCutHz: 160,
    highCutHz: 14400,
    lowDampPct: 0.12,
    lowDampFreqHz: 210,
    highDampPct: 0.15,
    highDampFreqHz: 6800,
    duckerTarget: 'post',
    extSidechain: true,
    duckAmt: 0.64,
    duckRelease: 0.42,
    outTrimDb: 0.0,
    mix: 0.52,
    freeze: false,
  },
  {
    id: 'circuit-pedal-sync',
    name: 'Modded Pedal Polyrhythm',
    category: 'Rhythmic',
    delayMode: 'circuit',
    subType: 'Modded',
    patternMode: 'sequence',
    dualRouting: 'crisscross',
    dualRatio: 'golden',
    lrOffsetMs: 4,
    seqPlayMode: 'loop',
    seqStepCount: 6,
    seqSteps: makeDefaultSequenceSteps(
      [true, true, false, true, false, true, false, false],
      [-0.75, 0.75, 0, -0.45, 0, 0.85, 0, 0]
    ),
    syncMode: 'sync',
    timebaseId: '1/16.',
    delayTimeMs: 187.5,
    swing: 0.54,
    offsetMs: -6,
    feedback: 0.74,
    modRateHz: 2.6,
    modAmt: 0.45,
    characterVal: 0.68,
    pitchSemitones: 0,
    width: 1.1,
    filterPos: 'pre',
    lowCutHz: 210,
    highCutHz: 5900,
    lowDampPct: 0.24,
    lowDampFreqHz: 250,
    highDampPct: 0.40,
    highDampFreqHz: 3600,
    duckerTarget: 'both',
    extSidechain: false,
    duckAmt: 0.54,
    duckRelease: 0.52,
    outTrimDb: -0.3,
    mix: 0.48,
    freeze: false,
  },
  {
    id: 'reverse-oneshot-gate',
    name: 'Reverse Chop One-Shot',
    category: 'Rhythmic',
    delayMode: 'reverse',
    subType: 'Chop',
    patternMode: 'sequence',
    dualRouting: 'pingpong',
    dualRatio: '1:1',
    lrOffsetMs: 0,
    seqPlayMode: 'once',
    seqStepCount: 8,
    seqSteps: makeDefaultSequenceSteps(
      [true, false, true, false, true, true, false, true],
      [-0.6, 0, 0.6, 0, -0.9, 0.9, 0, 0]
    ),
    syncMode: 'sync',
    timebaseId: '1/8',
    delayTimeMs: 250,
    swing: 0.5,
    offsetMs: 0,
    feedback: 0.58,
    modRateHz: 1.2,
    modAmt: 0.16,
    characterVal: 0.62,
    pitchSemitones: 0,
    width: 1.35,
    filterPos: 'post',
    lowCutHz: 140,
    highCutHz: 12200,
    lowDampPct: 0.16,
    lowDampFreqHz: 200,
    highDampPct: 0.22,
    highDampFreqHz: 5600,
    duckerTarget: 'post',
    extSidechain: false,
    duckAmt: 0.38,
    duckRelease: 0.45,
    outTrimDb: 0.0,
    mix: 0.56,
    freeze: false,
  },

  // ======================== AMBIENT (3) ========================
  {
    id: 'aether-shimmer-12',
    name: 'Aether Shimmer +12',
    category: 'Ambient',
    delayMode: 'aether',
    subType: 'Shimmer',
    patternMode: 'dual',
    dualRouting: 'crisscross',
    dualRatio: 'golden',
    lrOffsetMs: 18,
    seqPlayMode: 'loop',
    seqStepCount: 8,
    seqSteps: makeDefaultSequenceSteps(
      [true, true, true, true, true, true, true, true],
      [-0.8, 0.8, -0.5, 0.5, -0.9, 0.9, -0.3, 0.3]
    ),
    syncMode: 'sync',
    timebaseId: '1/2',
    delayTimeMs: 1000,
    swing: 0.5,
    offsetMs: 0,
    feedback: 0.84,
    modRateHz: 0.45,
    modAmt: 0.48,
    characterVal: 0.72,
    pitchSemitones: 12,
    width: 1.7,
    filterPos: 'post',
    lowCutHz: 240,
    highCutHz: 15800,
    lowDampPct: 0.22,
    lowDampFreqHz: 240,
    highDampPct: 0.16,
    highDampFreqHz: 9200,
    duckerTarget: 'post',
    extSidechain: false,
    duckAmt: 0.52,
    duckRelease: 0.72,
    outTrimDb: -0.6,
    mix: 0.58,
    freeze: false,
  },
  {
    id: 'air-diffuse-cloud',
    name: 'Air Diffuse Cloud',
    category: 'Ambient',
    delayMode: 'air',
    subType: 'Diffuse',
    patternMode: 'dual',
    dualRouting: 'pingpong',
    dualRatio: 'plastic',
    lrOffsetMs: 22,
    seqPlayMode: 'loop',
    seqStepCount: 8,
    seqSteps: makeDefaultSequenceSteps(
      [true, true, false, true, true, false, true, true],
      [-0.6, 0.6, 0, -0.9, 0.9, 0, -0.4, 0.4]
    ),
    syncMode: 'sync',
    timebaseId: '1/2.',
    delayTimeMs: 1500,
    swing: 0.5,
    offsetMs: 10,
    feedback: 0.80,
    modRateHz: 0.62,
    modAmt: 0.42,
    characterVal: 0.86,
    pitchSemitones: 0,
    width: 1.6,
    filterPos: 'post',
    lowCutHz: 185,
    highCutHz: 8400,
    lowDampPct: 0.18,
    lowDampFreqHz: 220,
    highDampPct: 0.34,
    highDampFreqHz: 4600,
    duckerTarget: 'both',
    extSidechain: false,
    duckAmt: 0.68,
    duckRelease: 0.78,
    outTrimDb: 0.0,
    mix: 0.54,
    freeze: false,
  },
  {
    id: 'reverse-swell-pad',
    name: 'Reverse Swell Cavern',
    category: 'Ambient',
    delayMode: 'reverse',
    subType: 'Swell',
    patternMode: 'dual',
    dualRouting: 'crisscross',
    dualRatio: 'golden',
    lrOffsetMs: 15,
    seqPlayMode: 'loop',
    seqStepCount: 8,
    seqSteps: makeDefaultSequenceSteps(
      [true, false, true, true, false, true, false, true],
      [-0.7, 0, 0.7, -0.4, 0, 0.4, 0, 0]
    ),
    syncMode: 'free',
    timebaseId: '1/4.',
    delayTimeMs: 680,
    swing: 0.5,
    offsetMs: 0,
    feedback: 0.76,
    modRateHz: 0.5,
    modAmt: 0.36,
    characterVal: 0.78,
    pitchSemitones: 0,
    width: 1.5,
    filterPos: 'post',
    lowCutHz: 110,
    highCutHz: 9600,
    lowDampPct: 0.14,
    lowDampFreqHz: 190,
    highDampPct: 0.28,
    highDampFreqHz: 4800,
    duckerTarget: 'post',
    extSidechain: false,
    duckAmt: 0.44,
    duckRelease: 0.65,
    outTrimDb: -0.2,
    mix: 0.56,
    freeze: false,
  },
];

export function computeSyncedDelayMs(bpm: number, timebaseId: string): number {
  const rate = TIMEBASE_RATES.find((r) => r.id === timebaseId) ?? TIMEBASE_RATES[7];
  const ms = (60000 / Math.max(40, bpm)) * rate.beatsPerTap;
  return Math.min(2000, Math.max(10, Number(ms.toFixed(1))));
}

export function formatHz(hz: number): string {
  if (hz >= 1000) {
    const khz = hz / 1000;
    return khz >= 10 ? `${khz.toFixed(1)}k` : `${khz.toFixed(2)}k`;
  }
  return String(Math.round(hz));
}

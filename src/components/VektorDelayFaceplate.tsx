import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Power,
  Shuffle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Volume2,
  Snowflake,
  Save,
  Trash2,
  FolderOpen,
  Pencil,
  Check,
  X,
  Search,
  Settings,
} from 'lucide-react';
import {
  VEKTOR_TREM_COLORS,
  InsertMode,
  PresetCategory,
  PRESET_CATEGORIES,
  DELAY_MODES,
  DelayModeId,
  DelaySubType,
  PatternEngineMode,
  DualRoutingMode,
  DualRatioId,
  DUAL_RATIOS,
  SequenceStep,
  SequencePlayMode,
  FilterPosition,
  DuckerTarget,
  TIMEBASE_RATES,
  DELAY_PRESETS,
  makeDefaultSequenceSteps,
  computeSyncedDelayMs,
  formatHz,
} from '../data/vektorDelayData';
import { RotaryEncoder } from './RotaryEncoder';
import {
  PulsarDelayCanvas,
  FilterResponseSvg,
  FeedbackPathCanvas,
} from './PulsarDelayCanvas';
import { StereoVuMeterCanvas } from './StereoVuMeterCanvas';
import {
  MidiParamId,
  MidiMappingEntry,
  MIDI_MAPPINGS_STORAGE_KEY,
  MIDI_PARAM_META,
  readStoredMidiMappings,
  SettingsMenuPopover,
  MidiLearnOverlay,
} from './MidiLearnSystem';

export interface FaceplateState {
  bypassed: boolean;
  bpm: number;
  activeSlot: 'A' | 'B';
  presetIndex: number;
  presetName: string;
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
  swing: number;
  offsetMs: number;
  feedback: number;
  modRateHz: number;
  modAmt: number;
  characterVal: number;
  pitchSemitones: number;
  width: number;
  filterPos: FilterPosition;
  lowCutHz: number;
  highCutHz: number;
  lowDampPct: number;
  lowDampFreqHz: number;
  highDampPct: number;
  highDampFreqHz: number;
  duckerTarget: DuckerTarget;
  extSidechain: boolean;
  duckAmt: number;
  duckRelease: number;
  outTrimDb: number;
  mix: number;
  freeze: boolean;
  insertMode: InsertMode;
}

interface VektorDelayFaceplateProps {
  state: FaceplateState;
  slotBState: FaceplateState;
  onChangeState: React.Dispatch<React.SetStateAction<FaceplateState>>;
  onSwitchSlot: (slot: 'A' | 'B') => void;
  onReset: () => void;
  isPlaying: boolean;
  onNotify: (msg: string) => void;
}

const CornerScrew: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg viewBox="0 0 12 12" className={`w-2.5 h-2.5 pointer-events-none ${className}`} aria-hidden="true">
    <circle cx="6" cy="6" r="5" fill="#1C1F23" stroke="#0A0B0D" strokeWidth="1" />
    <line x1="3.5" y1="6" x2="8.5" y2="6" stroke="#0D0F12" strokeWidth="1.2" />
    <line x1="6" y1="3.5" x2="6" y2="8.5" stroke="#0D0F12" strokeWidth="1.2" />
  </svg>
);

const PresetDelaySparkbar: React.FC<{
  seqSteps: SequenceStep[];
  feedback: number;
  active?: boolean;
}> = ({ seqSteps, feedback, active = false }) => {
  return (
    <div
      className="w-[46px] h-[15px] px-[2px] py-[2px] rounded-[3px] bg-[#08090B] border border-[#1E2228] flex items-end gap-[1.5px] shrink-0"
      aria-hidden="true"
    >
      {Array.from({ length: 8 }).map((_, i) => {
        const step = seqSteps[i];
        const enabled = step ? step.enabled : i % 2 === 0;
        const lvl = enabled ? Math.max(0.28, 0.95 - i * 0.08 * (1.2 - Math.min(0.95, feedback))) : 0.14;
        const isLeft = step ? step.pan < 0 : i % 2 === 0;
        return (
          <span
            key={i}
            className="flex-1 rounded-[0.5px]"
            style={{
              height: `${Math.max(18, Math.round(lvl * 100))}%`,
              backgroundColor: !enabled
                ? '#262A30'
                : active
                ? isLeft
                  ? '#3AE39E'
                  : '#4ADE80'
                : isLeft
                ? 'rgba(58, 227, 158, 0.56)'
                : 'rgba(34, 229, 94, 0.58)',
            }}
          />
        );
      })}
    </div>
  );
};

const USER_PRESETS_STORAGE_KEY = 'vektordelay_user_presets_v1';

type UserPresetCategory = PresetCategory;
type PresetFilter = 'All' | PresetCategory;

const PRESET_FILTERS: PresetFilter[] = ['All', ...PRESET_CATEGORIES];

interface UserPresetEntry {
  id: string;
  name: string;
  category: UserPresetCategory;
  savedAt: string;
  state: Omit<FaceplateState, 'activeSlot'>;
}

function logToNorm(val: number, min: number, max: number): number {
  const clamped = Math.min(max, Math.max(min, val));
  return Math.log10(clamped / min) / Math.log10(max / min);
}

function normToLog(norm: number, min: number, max: number): number {
  const clamped = Math.min(1, Math.max(0, norm));
  return min * Math.pow(max / min, clamped);
}

function readStoredUserPresets(): UserPresetEntry[] {
  try {
    const raw = window.localStorage.getItem(USER_PRESETS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && item.state && typeof item.state.delayMode === 'string')
      .map((item) => ({
        ...item,
        category: PRESET_CATEGORIES.includes(item?.category) ? item.category : 'Tape',
        state: {
          ...item.state,
          seqSteps: Array.isArray(item?.state?.seqSteps)
            ? item.state.seqSteps
            : makeDefaultSequenceSteps(),
        },
      }));
  } catch {
    return [];
  }
}

export const VektorDelayFaceplate: React.FC<VektorDelayFaceplateProps> = ({
  state,
  onChangeState,
  onSwitchSlot,
  onReset,
  isPlaying,
  onNotify,
}) => {
  const [showPresetMenu, setShowPresetMenu] = useState(false);
  const [userPresets, setUserPresets] = useState<UserPresetEntry[]>(() => readStoredUserPresets());
  const [userPresetInput, setUserPresetInput] = useState('');
  const [presetSearch, setPresetSearch] = useState('');
  const [saveCategory, setSaveCategory] = useState<UserPresetCategory>('Tape');
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<PresetFilter>('All');
  const [activeUserPresetId, setActiveUserPresetId] = useState<string | null>(null);
  const [renamingTarget, setRenamingTarget] = useState<'loaded' | string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [testToneTriggerCount, setTestToneTriggerCount] = useState(0);
  const [activePlayStep, setActivePlayStep] = useState<number>(0);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [midiLearnEnabled, setMidiLearnEnabled] = useState(false);
  const [armedMidiParam, setArmedMidiParam] = useState<MidiParamId | null>(null);
  const [confirmedMidiMapping, setConfirmedMidiMapping] = useState<MidiMappingEntry | null>(null);
  const [midiMappings, setMidiMappings] = useState<Partial<Record<MidiParamId, MidiMappingEntry>>>(
    () => readStoredMidiMappings()
  );
  const [webMidiStatus, setWebMidiStatus] = useState<
    'unrequested' | 'connected' | 'unsupported' | 'denied'
  >('unrequested');
  const [midiDeviceNames, setMidiDeviceNames] = useState<string[]>([]);

  const midiConfirmTimerRef = useRef<number | null>(null);
  const presetMenuRef = useRef<HTMLDivElement>(null);
  const settingsMenuRef = useRef<HTMLDivElement>(null);
  const presetInputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const armedMidiParamRef = useRef<MidiParamId | null>(null);
  const midiMappingsRef = useRef(midiMappings);

  armedMidiParamRef.current = armedMidiParam;
  midiMappingsRef.current = midiMappings;

  const c = VEKTOR_TREM_COLORS;

  const effectiveDelayMs =
    state.syncMode === 'sync'
      ? computeSyncedDelayMs(state.bpm, state.timebaseId)
      : state.delayTimeMs;

  const activeModeMeta =
    DELAY_MODES.find((m) => m.id === state.delayMode) ?? DELAY_MODES[1];

  const activeRatioMeta =
    DUAL_RATIOS.find((r) => r.id === state.dualRatio) ?? DUAL_RATIOS[0];

  // Sequence playhead ticker when transport is running
  useEffect(() => {
    if (!isPlaying || state.freeze || state.bypassed) return;
    const stepMs = Math.max(90, Math.min(750, effectiveDelayMs));
    const timer = window.setInterval(() => {
      setActivePlayStep((prev) => (prev + 1) % Math.max(2, state.seqStepCount));
    }, stepMs);
    return () => window.clearInterval(timer);
  }, [isPlaying, state.freeze, state.bypassed, effectiveDelayMs, state.seqStepCount]);

  useEffect(() => {
    const handleMouseDownOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (presetMenuRef.current && !presetMenuRef.current.contains(target)) {
        setShowPresetMenu(false);
        setRenamingTarget(null);
      }
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(target)) {
        setShowSettingsMenu(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setArmedMidiParam(null);
        setConfirmedMidiMapping(null);
        setShowSettingsMenu(false);
      }
    };
    window.addEventListener('mousedown', handleMouseDownOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handleMouseDownOutside);
      window.removeEventListener('keydown', handleKeyDown);
      if (midiConfirmTimerRef.current) window.clearTimeout(midiConfirmTimerRef.current);
    };
  }, []);

  const persistMidiMappings = (next: Partial<Record<MidiParamId, MidiMappingEntry>>) => {
    setMidiMappings(next);
    try {
      window.localStorage.setItem(MIDI_MAPPINGS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage quota errors
    }
  };

  const applyMidiValueToParam = (paramId: MidiParamId, ccVal: number) => {
    const norm = Math.min(1, Math.max(0, ccVal / 127));
    onChangeState((prev) => {
      switch (paramId) {
        case 'bpm':
          return { ...prev, bpm: Math.round(40 + norm * 200) };
        case 'swing':
          return { ...prev, swing: Number(norm.toFixed(2)) };
        case 'offsetMs':
          return { ...prev, offsetMs: Math.round(-50 + norm * 100) };
        case 'delayTime':
          return {
            ...prev,
            syncMode: 'free',
            delayTimeMs: Number((10 + norm * 1990).toFixed(1)),
          };
        case 'timebase': {
          const idx = Math.min(TIMEBASE_RATES.length - 1, Math.floor(norm * TIMEBASE_RATES.length));
          return {
            ...prev,
            syncMode: 'sync',
            timebaseId: TIMEBASE_RATES[idx]?.id ?? prev.timebaseId,
          };
        }
        case 'syncMode':
          return { ...prev, syncMode: ccVal >= 64 ? 'sync' : 'free' };
        case 'feedback':
          return { ...prev, feedback: Number((norm * 1.1).toFixed(2)) };
        case 'modRate':
          return { ...prev, modRateHz: Number(normToLog(norm, 0.05, 10).toFixed(2)) };
        case 'modAmt':
          return { ...prev, modAmt: Number(norm.toFixed(2)) };
        case 'character':
          if (prev.delayMode === 'aether') {
            return { ...prev, pitchSemitones: Math.round(-12 + norm * 24) };
          }
          return { ...prev, characterVal: Number(norm.toFixed(2)) };
        case 'width':
          return { ...prev, width: Number((norm * 2).toFixed(2)) };
        case 'lowCut':
          return { ...prev, lowCutHz: Math.round(normToLog(norm, 20, 1200)) };
        case 'highCut':
          return { ...prev, highCutHz: Math.round(normToLog(norm, 800, 20000)) };
        case 'duckAmt':
          return { ...prev, duckAmt: Number(norm.toFixed(2)) };
        case 'duckRel':
          return { ...prev, duckRelease: Number(norm.toFixed(2)) };
        case 'outTrimDb':
          return { ...prev, outTrimDb: Number((-12 + norm * 24).toFixed(2)) };
        case 'mix':
          return { ...prev, mix: Number(norm.toFixed(2)) };
        case 'freeze':
          return { ...prev, freeze: ccVal >= 64 };
        case 'bypassed':
          return { ...prev, bypassed: ccVal >= 64 };
        default:
          return prev;
      }
    });
  };

  const bindCcToParam = (paramId: MidiParamId, cc: number, channel = 1) => {
    const entry: MidiMappingEntry = { paramId, cc, channel };
    const nextMappings: Partial<Record<MidiParamId, MidiMappingEntry>> = {
      ...midiMappingsRef.current,
      [paramId]: entry,
    };
    persistMidiMappings(nextMappings);
    setConfirmedMidiMapping(entry);
    setArmedMidiParam(null);
    onNotify(`Mapped ${MIDI_PARAM_META[paramId].label} to CC #${cc} (Ch ${channel})`);

    if (midiConfirmTimerRef.current) window.clearTimeout(midiConfirmTimerRef.current);
    midiConfirmTimerRef.current = window.setTimeout(() => {
      setConfirmedMidiMapping(null);
    }, 950);
  };

  const handleIncomingMidiMessage = (data: Uint8Array | number[] | null) => {
    if (!data || data.length < 3) return;
    const status = data[0];
    if ((status & 0xf0) !== 0xb0) return;

    const channel = (status & 0x0f) + 1;
    const cc = data[1] & 0x7f;
    const value = data[2] & 0x7f;

    const currentlyArmed = armedMidiParamRef.current;
    if (currentlyArmed) {
      bindCcToParam(currentlyArmed, cc, channel);
      return;
    }

    const entries = Object.values(midiMappingsRef.current).filter(
      (entry): entry is MidiMappingEntry => Boolean(entry)
    );
    for (const entry of entries) {
      if (entry.cc === cc && entry.channel === channel) {
        applyMidiValueToParam(entry.paramId, value);
      }
    }
  };

  const connectWebMidi = async () => {
    const nav = navigator as Navigator & {
      requestMIDIAccess?: () => Promise<{
        inputs: {
          forEach: (
            cb: (input: {
              name?: string;
              onmidimessage: ((ev: { data: Uint8Array | null }) => void) | null;
            }) => void
          ) => void;
        };
        onstatechange: (() => void) | null;
      }>;
    };

    if (!nav.requestMIDIAccess) {
      setWebMidiStatus('unsupported');
      return;
    }

    try {
      const access = await nav.requestMIDIAccess();
      const bindInputs = () => {
        const names: string[] = [];
        access.inputs.forEach((input) => {
          if (input.name) names.push(input.name);
          input.onmidimessage = (ev) => handleIncomingMidiMessage(ev.data);
        });
        setMidiDeviceNames(names);
      };
      bindInputs();
      access.onstatechange = bindInputs;
      setWebMidiStatus('connected');
    } catch {
      setWebMidiStatus('denied');
    }
  };

  const handleToggleMidiLearn = () => {
    setMidiLearnEnabled((prev) => {
      const next = !prev;
      if (next) {
        if (webMidiStatus === 'unrequested') {
          void connectWebMidi();
        }
        onNotify('MIDI Learn enabled — right-click any knob or control to map');
      } else {
        setArmedMidiParam(null);
        setConfirmedMidiMapping(null);
        onNotify('MIDI Learn disabled');
      }
      return next;
    });
  };

  const armParamForMidi = (paramId: MidiParamId, e?: React.MouseEvent) => {
    if (!midiLearnEnabled) return;
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setConfirmedMidiMapping(null);
    setShowSettingsMenu(false);
    setArmedMidiParam(paramId);
  };

  const persistUserPresets = (nextList: UserPresetEntry[]) => {
    setUserPresets(nextList);
    try {
      window.localStorage.setItem(USER_PRESETS_STORAGE_KEY, JSON.stringify(nextList));
    } catch {
      // Ignore storage errors cleanly
    }
  };

  const isPresetModified = useMemo(() => {
    if (state.presetName === 'Vektor Random') return true;
    const activeUser = activeUserPresetId
      ? userPresets.find((u) => u.id === activeUserPresetId)
      : null;
    const baseline = activeUser
      ? activeUser.state
      : DELAY_PRESETS[state.presetIndex] ?? DELAY_PRESETS[0];

    if (!baseline) return false;
    if (state.delayMode !== baseline.delayMode) return true;
    if (state.subType !== baseline.subType) return true;
    if (state.patternMode !== baseline.patternMode) return true;
    if (state.dualRouting !== baseline.dualRouting) return true;
    if (state.dualRatio !== baseline.dualRatio) return true;
    if (state.seqPlayMode !== baseline.seqPlayMode) return true;
    if (state.seqStepCount !== baseline.seqStepCount) return true;
    if (state.syncMode !== baseline.syncMode) return true;
    if (state.timebaseId !== baseline.timebaseId) return true;
    if (state.filterPos !== baseline.filterPos) return true;
    if (state.duckerTarget !== baseline.duckerTarget) return true;
    if (state.extSidechain !== baseline.extSidechain) return true;
    if (state.freeze !== baseline.freeze) return true;
    if (Math.abs(state.delayTimeMs - baseline.delayTimeMs) > 0.5) return true;
    if (Math.abs(state.swing - baseline.swing) > 0.005) return true;
    if (Math.abs(state.offsetMs - baseline.offsetMs) > 0.5) return true;
    if (Math.abs(state.feedback - baseline.feedback) > 0.005) return true;
    if (Math.abs(state.modRateHz - baseline.modRateHz) > 0.02) return true;
    if (Math.abs(state.modAmt - baseline.modAmt) > 0.005) return true;
    if (Math.abs(state.characterVal - baseline.characterVal) > 0.005) return true;
    if (Math.abs(state.pitchSemitones - baseline.pitchSemitones) > 0.1) return true;
    if (Math.abs(state.width - baseline.width) > 0.01) return true;
    if (Math.abs(state.lowCutHz - baseline.lowCutHz) > 2) return true;
    if (Math.abs(state.highCutHz - baseline.highCutHz) > 10) return true;
    if (Math.abs(state.duckAmt - baseline.duckAmt) > 0.005) return true;
    if (Math.abs(state.duckRelease - baseline.duckRelease) > 0.005) return true;
    if (Math.abs(state.outTrimDb - baseline.outTrimDb) > 0.05) return true;
    if (Math.abs(state.mix - baseline.mix) > 0.005) return true;

    for (let i = 0; i < Math.max(state.seqSteps.length, baseline.seqSteps.length); i++) {
      const a = state.seqSteps[i];
      const b = baseline.seqSteps[i];
      if (!a || !b) return true;
      if (a.enabled !== b.enabled || Math.abs(a.pan - b.pan) > 0.02) return true;
    }
    return false;
  }, [state, activeUserPresetId, userPresets]);

  const canSavePreset = isPresetModified || userPresetInput.trim().length > 0;

  const handleSaveUserPreset = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!canSavePreset) return;

    const trimmed = userPresetInput.trim();
    const baseCleanName = state.presetName.replace(/\s*\*$/, '');
    const nextName =
      trimmed ||
      (baseCleanName === 'Vektor Random'
        ? `User Delay ${String(userPresets.length + 1).padStart(2, '0')}`
        : `${baseCleanName} Edit`);
    const { activeSlot: _omitSlot, ...stateSnapshot } = state;

    const entry: UserPresetEntry = {
      id: `up_${Date.now()}`,
      name: nextName,
      category: saveCategory,
      savedAt: new Date().toLocaleDateString('en-US', { day: '2-digit', month: 'short' }),
      state: {
        ...stateSnapshot,
        presetName: nextName,
        seqSteps: stateSnapshot.seqSteps.map((s) => ({ ...s })),
      },
    };

    const nextList = [entry, ...userPresets];
    persistUserPresets(nextList);
    setActiveUserPresetId(entry.id);
    setUserPresetInput('');
    setRenamingTarget(null);
    if (activeCategoryFilter !== 'All' && activeCategoryFilter !== saveCategory) {
      setActiveCategoryFilter(saveCategory);
    }
    onChangeState((prev) => ({ ...prev, presetName: nextName }));
    onNotify(`Preset "${nextName}" saved in ${saveCategory} category`);
  };

  const beginRename = (target: 'loaded' | string, currentName: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setRenamingTarget(target);
    setRenameDraft(currentName.replace(/\s*\*$/, ''));
    window.setTimeout(() => {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }, 30);
  };

  const confirmRename = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const nextName = renameDraft.trim();
    if (!nextName || !renamingTarget) {
      setRenamingTarget(null);
      return;
    }

    if (renamingTarget === 'loaded') {
      if (activeUserPresetId) {
        const nextList = userPresets.map((item) =>
          item.id === activeUserPresetId
            ? { ...item, name: nextName, state: { ...item.state, presetName: nextName } }
            : item
        );
        persistUserPresets(nextList);
        onChangeState((prev) => ({ ...prev, presetName: nextName }));
        onNotify(`Loaded preset renamed to "${nextName}"`);
      } else {
        const { activeSlot: _omitSlot, ...stateSnapshot } = state;
        const entry: UserPresetEntry = {
          id: `up_${Date.now()}`,
          name: nextName,
          category: saveCategory,
          savedAt: new Date().toLocaleDateString('en-US', { day: '2-digit', month: 'short' }),
          state: {
            ...stateSnapshot,
            presetName: nextName,
            seqSteps: stateSnapshot.seqSteps.map((s) => ({ ...s })),
          },
        };
        persistUserPresets([entry, ...userPresets]);
        setActiveUserPresetId(entry.id);
        onChangeState((prev) => ({ ...prev, presetName: nextName }));
        onNotify(`Saved & renamed preset as "${nextName}"`);
      }
    } else {
      const targetId = renamingTarget;
      const nextList = userPresets.map((item) =>
        item.id === targetId
          ? { ...item, name: nextName, state: { ...item.state, presetName: nextName } }
          : item
      );
      persistUserPresets(nextList);
      if (activeUserPresetId === targetId) {
        onChangeState((prev) => ({ ...prev, presetName: nextName }));
      }
      onNotify(`Preset renamed to "${nextName}"`);
    }

    setRenamingTarget(null);
    setRenameDraft('');
  };

  const normalizedSearch = presetSearch.trim().toLowerCase();

  const filteredFactoryPresets = useMemo(() => {
    return DELAY_PRESETS.map((preset, index) => ({ preset, index })).filter(({ preset }) => {
      const matchesCat =
        activeCategoryFilter === 'All' || preset.category === activeCategoryFilter;
      const matchesSearch =
        !normalizedSearch ||
        preset.name.toLowerCase().includes(normalizedSearch) ||
        preset.delayMode.toLowerCase().includes(normalizedSearch) ||
        preset.subType.toLowerCase().includes(normalizedSearch) ||
        preset.timebaseId.toLowerCase().includes(normalizedSearch) ||
        preset.category.toLowerCase().includes(normalizedSearch);
      return matchesCat && matchesSearch;
    });
  }, [activeCategoryFilter, normalizedSearch]);

  const filteredUserPresets = useMemo(() => {
    return userPresets.filter((item) => {
      const matchesCat = activeCategoryFilter === 'All' || item.category === activeCategoryFilter;
      const matchesSearch =
        !normalizedSearch ||
        item.name.toLowerCase().includes(normalizedSearch) ||
        item.state.delayMode.toLowerCase().includes(normalizedSearch) ||
        item.state.timebaseId.toLowerCase().includes(normalizedSearch) ||
        item.category.toLowerCase().includes(normalizedSearch);
      return matchesCat && matchesSearch;
    });
  }, [userPresets, activeCategoryFilter, normalizedSearch]);

  const handleLoadUserPreset = (entry: UserPresetEntry) => {
    onChangeState((prev) => ({
      ...entry.state,
      activeSlot: prev.activeSlot,
      seqSteps: entry.state.seqSteps.map((s) => ({ ...s })),
    }));
    setActiveUserPresetId(entry.id);
    setSaveCategory(entry.category);
    setRenamingTarget(null);
    setShowPresetMenu(false);
    onNotify(`Preset "${entry.name}" loaded`);
  };

  const handleDeleteUserPreset = (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const nextList = userPresets.filter((item) => item.id !== id);
    persistUserPresets(nextList);
    if (activeUserPresetId === id) {
      setActiveUserPresetId(null);
    }
    if (renamingTarget === id) {
      setRenamingTarget(null);
    }
    onNotify(`Preset "${name}" deleted`);
  };

  const stepPresetBy = (direction: -1 | 1) => {
    type CombinedPreset =
      | { kind: 'user'; entry: UserPresetEntry }
      | { kind: 'factory'; index: number };

    const combined: CombinedPreset[] = [
      ...userPresets.map((entry) => ({ kind: 'user' as const, entry })),
      ...DELAY_PRESETS.map((_, index) => ({ kind: 'factory' as const, index })),
    ];
    if (combined.length === 0) return;

    const currentPos = activeUserPresetId
      ? combined.findIndex((cItem) => cItem.kind === 'user' && cItem.entry.id === activeUserPresetId)
      : combined.findIndex((cItem) => cItem.kind === 'factory' && cItem.index === state.presetIndex);

    const safePos = currentPos === -1 ? 0 : currentPos;
    const nextPos = (safePos + direction + combined.length) % combined.length;
    const target = combined[nextPos];

    if (target.kind === 'user') {
      handleLoadUserPreset(target.entry);
    } else {
      setActiveUserPresetId(null);
      loadPreset(target.index);
      onNotify(`Preset "${DELAY_PRESETS[target.index].name}" loaded`);
    }
  };

  const loadPreset = (index: number) => {
    const safeIdx = (index + DELAY_PRESETS.length) % DELAY_PRESETS.length;
    const p = DELAY_PRESETS[safeIdx];
    onChangeState((prev) => ({
      ...prev,
      presetIndex: safeIdx,
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
    }));
    setSaveCategory(p.category);
    setShowPresetMenu(false);
  };

  const handleSelectDelayMode = (modeId: DelayModeId) => {
    const meta = DELAY_MODES.find((m) => m.id === modeId) ?? DELAY_MODES[0];
    onChangeState((prev) => ({
      ...prev,
      delayMode: modeId,
      subType: meta.subTypes.includes(prev.subType) ? prev.subType : meta.subTypes[0],
    }));
  };

  const handleRandomize = () => {
    const rate = TIMEBASE_RATES[Math.floor(Math.random() * TIMEBASE_RATES.length)];
    const modeMeta = DELAY_MODES[Math.floor(Math.random() * DELAY_MODES.length)];
    const sub = modeMeta.subTypes[Math.floor(Math.random() * modeMeta.subTypes.length)];
    const patternMode: PatternEngineMode = Math.random() > 0.45 ? 'sequence' : 'dual';
    const dualRouting: DualRoutingMode = Math.random() > 0.5 ? 'pingpong' : 'crisscross';
    const ratioMeta = DUAL_RATIOS[Math.floor(Math.random() * DUAL_RATIOS.length)];
    const stepCount = 4 + Math.floor(Math.random() * 5);
    const panOptions = [-0.85, 0, 0.85];
    const randSteps: SequenceStep[] = Array.from({ length: 8 }, (_, idx) => ({
      enabled: idx === 0 ? true : Math.random() > 0.35,
      pan: panOptions[Math.floor(Math.random() * panOptions.length)],
    }));

    const pitchChoices = [-12, -7, -5, 0, 5, 7, 12];
    const nextPitch = pitchChoices[Math.floor(Math.random() * pitchChoices.length)];

    onChangeState((prev) => ({
      ...prev,
      presetName: 'Vektor Random',
      delayMode: modeMeta.id,
      subType: sub,
      patternMode,
      dualRouting,
      dualRatio: ratioMeta.id,
      lrOffsetMs: Math.round((Math.random() - 0.5) * 32),
      seqStepCount: stepCount,
      seqSteps: randSteps,
      timebaseId: rate.id,
      delayTimeMs: computeSyncedDelayMs(prev.bpm, rate.id),
      swing: Number((0.46 + Math.random() * 0.16).toFixed(2)),
      feedback: Number((0.35 + Math.random() * 0.52).toFixed(2)),
      modRateHz: Number((0.3 + Math.random() * 3.2).toFixed(2)),
      modAmt: Number((0.1 + Math.random() * 0.55).toFixed(2)),
      characterVal: Number((0.2 + Math.random() * 0.65).toFixed(2)),
      pitchSemitones: nextPitch,
      width: Number((0.8 + Math.random() * 0.8).toFixed(2)),
      duckAmt: Number((Math.random() * 0.65).toFixed(2)),
    }));
    setTestToneTriggerCount((n) => n + 1);
    onNotify(`Generated ${modeMeta.label} (${sub}) delay matrix`);
  };

  const handleToggleSeqStep = (idx: number) => {
    onChangeState((prev) => ({
      ...prev,
      seqSteps: prev.seqSteps.map((s, i) => (i === idx ? { ...s, enabled: !s.enabled } : s)),
    }));
  };

  const handleCycleSeqPan = (idx: number) => {
    onChangeState((prev) => ({
      ...prev,
      seqSteps: prev.seqSteps.map((s, i) => {
        if (i !== idx) return s;
        const nextPan = s.pan < -0.2 ? 0 : s.pan > 0.2 ? -0.85 : 0.85;
        return { ...s, pan: nextPan };
      }),
    }));
  };

  const dualLeftMs = Math.round(effectiveDelayMs);
  const dualRightMs = Math.max(
    10,
    Math.round(effectiveDelayMs * activeRatioMeta.ratioR + state.lrOffsetMs)
  );

  return (
    <div
      className="relative w-[1040px] select-none rounded-[10px] vektor-chassis text-slate-100 border border-[#25282C]"
      style={{
        boxShadow: '0 30px 80px rgba(0, 0, 0, 0.85), inset 0 1px 0 rgba(255, 255, 255, 0.06)',
      }}
    >
      {/* 4 Vektor Series corner screws */}
      <CornerScrew className="absolute top-2.5 left-2.5" />
      <CornerScrew className="absolute top-2.5 right-2.5" />
      <CornerScrew className="absolute bottom-2.5 left-2.5" />
      <CornerScrew className="absolute bottom-2.5 right-2.5" />

      {/* ======================== TOP HEADER BAR ======================== */}
      <div className="h-[54px] px-5 flex items-center justify-between border-b border-[#222528]">
        {/* Left: Glowing Power Button + VEKTORDELAY Wordmark */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onChangeState((prev) => ({ ...prev, bypassed: !prev.bypassed }))}
            title={state.bypassed ? 'Enable Delay processing' : 'Bypass Delay'}
            className="w-7 h-7 rounded-full flex items-center justify-center border transition-all cursor-pointer"
            style={{
              borderColor: state.bypassed ? '#374151' : c.accentGreen,
              backgroundColor: state.bypassed ? '#16181B' : c.accentGreenSoft,
              color: state.bypassed ? '#6B7280' : c.accentGreen,
              boxShadow: state.bypassed ? 'none' : `0 0 12px ${c.accentGreenGlow}`,
            }}
          >
            <Power className="w-3.5 h-3.5" />
          </button>

          <span className="font-display text-[15px] font-bold tracking-[0.26em] text-slate-100 uppercase">
            VEKTOR<span style={{ color: state.bypassed ? '#6B7280' : c.accentGreen }}>DELAY</span>
          </span>
        </div>

        {/* Center: - 120 BPM + Stepper & Audio/MIDI Insert Selector */}
        <div className="flex items-center gap-3">
          <div
            onContextMenu={(e) => armParamForMidi('bpm', e)}
            title={
              midiLearnEnabled
                ? 'Right-click to map BPM to MIDI CC'
                : midiMappings.bpm
                ? `BPM · MIDI CC #${midiMappings.bpm.cc} (Ch ${midiMappings.bpm.channel})`
                : 'Tempo BPM'
            }
            className={`relative h-7 px-1.5 rounded-[5px] bg-[#0B0C0E] border flex items-center gap-2 transition-colors ${
              midiLearnEnabled ? 'cursor-context-menu' : ''
            }`}
            style={{
              borderColor:
                armedMidiParam === 'bpm'
                  ? c.accentGreen
                  : midiLearnEnabled
                  ? 'rgba(58, 227, 158, 0.55)'
                  : '#25282C',
              boxShadow:
                armedMidiParam === 'bpm' ? '0 0 12px rgba(34, 229, 94, 0.4)' : 'none',
            }}
          >
            {midiMappings.bpm && (
              <span className="pointer-events-none absolute -top-1.5 -right-1.5 px-1 rounded-[2px] bg-[#0B0D10] border border-[#22E55E]/60 font-mono text-[7px] text-[#3AE39E] tabular-nums">
                CC{midiMappings.bpm.cc}
              </span>
            )}
            <button
              type="button"
              onClick={() =>
                onChangeState((prev) => ({ ...prev, bpm: Math.max(40, prev.bpm - 1) }))
              }
              className="w-5 h-5 flex items-center justify-center text-slate-400 hover:text-white cursor-pointer text-xs font-mono"
              aria-label="Decrease BPM"
            >
              −
            </button>
            <span className="font-mono text-[11px] font-semibold tracking-wider text-slate-200 tabular-nums px-1">
              {state.bpm} <span className="text-slate-500 font-normal">BPM</span>
            </span>
            <button
              type="button"
              onClick={() =>
                onChangeState((prev) => ({ ...prev, bpm: Math.min(240, prev.bpm + 1) }))
              }
              className="w-5 h-5 flex items-center justify-center text-slate-400 hover:text-white cursor-pointer text-xs font-mono"
              aria-label="Increase BPM"
            >
              +
            </button>
          </div>

          {/* Audio / MIDI / Dual Insert Toggle */}
          <div
            className="h-7 p-[2px] rounded-[5px] bg-[#0B0C0E] border border-[#25282C] flex items-center"
            title="DAW insert routing mode: Audio, MIDI, or Dual"
          >
            {(['audio', 'midi', 'hybrid'] as InsertMode[]).map((mode) => {
              const active = state.insertMode === mode;
              const label = mode === 'audio' ? 'AUDIO' : mode === 'midi' ? 'MIDI' : 'DUAL';
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => onChangeState((prev) => ({ ...prev, insertMode: mode }))}
                  className="px-2 h-full rounded-[3px] font-mono text-[9.5px] font-medium tracking-wider transition-colors cursor-pointer"
                  style={{
                    backgroundColor: active ? c.accentGreenSoft : 'transparent',
                    color: active ? c.accentGreen : '#6B7280',
                    boxShadow: active ? `inset 0 0 0 1px ${c.accentGreen}` : 'none',
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: RANDOM + Unified Preset Browser & Save + A/B + BYPASS + Settings + Reset */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleRandomize}
            className="h-7 px-2.5 rounded-[5px] bg-[#1A1D21] border border-[#2B2E33] hover:border-[#3E434B] text-[9.5px] font-mono font-medium tracking-[0.1em] text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Generate random delay mode & sequencer matrix"
          >
            <Shuffle className="w-3 h-3 text-slate-400" />
            RANDOM
          </button>

          {/* Unified Presets + Save Browser */}
          <div ref={presetMenuRef} className="relative">
            <div
              className="h-7 w-[228px] rounded-[5px] bg-[#0B0C0E] border flex items-center overflow-hidden transition-colors"
              style={{
                borderColor: showPresetMenu
                  ? c.accentGreen
                  : isPresetModified
                  ? 'rgba(34, 229, 94, 0.45)'
                  : '#25282C',
              }}
            >
              <button
                type="button"
                onClick={() => stepPresetBy(-1)}
                title="Previous preset"
                aria-label="Previous preset"
                className="h-full px-1 flex items-center justify-center text-slate-500 hover:text-slate-200 hover:bg-white/[0.04] border-r border-[#1C1F24] transition-colors cursor-pointer shrink-0"
              >
                <ChevronLeft className="w-3 h-3" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setRenamingTarget(null);
                  setShowSettingsMenu(false);
                  setShowPresetMenu((v) => !v);
                }}
                className="flex-1 min-w-0 h-full px-2 flex items-center gap-1.5 text-[11px] font-sans text-slate-200 hover:bg-white/[0.03] transition-colors cursor-pointer text-left"
                title="Browse, rename & save presets"
              >
                <FolderOpen className="w-3 h-3 shrink-0 text-slate-400" />
                <span className="truncate">
                  {state.presetName}
                  {isPresetModified ? ' *' : ''}
                </span>
              </button>

              <button
                type="button"
                disabled={!isPresetModified}
                onClick={() => {
                  setRenamingTarget(null);
                  setShowSettingsMenu(false);
                  setShowPresetMenu(true);
                  window.setTimeout(() => presetInputRef.current?.focus(), 40);
                }}
                title={
                  isPresetModified
                    ? 'Preset modified — click to save'
                    : 'Modify preset parameters to enable saving'
                }
                className={`h-full px-1.5 flex items-center justify-center border-l border-[#1C1F24] transition-colors shrink-0 ${
                  isPresetModified
                    ? 'text-[#22E55E] hover:bg-[#22E55E]/15 cursor-pointer'
                    : 'text-slate-600 opacity-40 cursor-default'
                }`}
              >
                <Save className="w-3 h-3" />
              </button>

              <button
                type="button"
                onClick={() => stepPresetBy(1)}
                title="Next preset"
                aria-label="Next preset"
                className="h-full px-1 flex items-center justify-center text-slate-500 hover:text-slate-200 hover:bg-white/[0.04] border-l border-[#1C1F24] transition-colors cursor-pointer shrink-0"
              >
                <ChevronRight className="w-3 h-3" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setRenamingTarget(null);
                  setShowSettingsMenu(false);
                  setShowPresetMenu((v) => !v);
                }}
                aria-label="Toggle preset menu"
                className="h-full px-1.5 flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] border-l border-[#1C1F24] transition-colors cursor-pointer shrink-0"
              >
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-150 ${
                    showPresetMenu ? 'rotate-180' : ''
                  }`}
                />
              </button>
            </div>

            <AnimatePresence>
              {showPresetMenu && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.985 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.985 }}
                  transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute right-0 top-8 w-[392px] z-30 rounded-[8px] bg-[#111317] border border-[#2C313A] shadow-[0_24px_56px_rgba(0,0,0,0.88)] overflow-hidden"
                >
                  {/* 1. Currently Loaded Preset Header + Inline Rename Action */}
                  <div className="px-3 py-2 bg-[#0B0D10] border-b border-[#1E2229] flex items-center justify-between gap-2">
                    {renamingTarget === 'loaded' ? (
                      <form onSubmit={confirmRename} className="flex items-center gap-1.5 w-full">
                        <input
                          ref={renameInputRef}
                          type="text"
                          value={renameDraft}
                          onChange={(e) => setRenameDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') {
                              e.preventDefault();
                              setRenamingTarget(null);
                            }
                          }}
                          placeholder="Descriptive preset name..."
                          maxLength={32}
                          className="flex-1 min-w-0 h-7 px-2 rounded-[4px] bg-[#07080A] border border-[#22E55E] focus:outline-none text-[11px] font-sans text-slate-100 placeholder:text-slate-600"
                        />
                        <button
                          type="submit"
                          title="Confirm rename"
                          className="h-7 px-2 rounded-[4px] bg-[#22E55E] hover:bg-[#34F06D] text-[#07090A] font-mono text-[10px] font-semibold flex items-center gap-1 cursor-pointer shrink-0"
                        >
                          <Check className="w-3 h-3" />
                          Apply
                        </button>
                        <button
                          type="button"
                          onClick={() => setRenamingTarget(null)}
                          title="Cancel rename"
                          className="h-7 w-7 rounded-[4px] bg-[#181B20] border border-[#2A2F37] text-slate-400 hover:text-white flex items-center justify-center cursor-pointer shrink-0"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </form>
                    ) : (
                      <>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-[8.5px] uppercase tracking-[0.14em] text-slate-500">
                              Loaded
                            </span>
                            {isPresetModified && (
                              <span className="px-1 py-[0.5px] rounded bg-amber-500/15 text-amber-300 font-mono text-[8px] uppercase tracking-wider">
                                Modified
                              </span>
                            )}
                          </div>
                          <div className="text-[12px] font-medium text-slate-100 truncate mt-0.5">
                            {state.presetName}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => beginRename('loaded', state.presetName)}
                          title={
                            activeUserPresetId
                              ? 'Rename currently loaded preset'
                              : 'Save & rename loaded preset with a custom name'
                          }
                          className="h-7 px-2.5 rounded-[4px] bg-[#171A1F] hover:bg-[#1F242B] border border-[#2B3038] hover:border-[#3E4552] font-mono text-[9.5px] text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                        >
                          <Pencil className="w-3 h-3 text-[#22E55E]" />
                          Rename
                        </button>
                      </>
                    )}
                  </div>

                  {/* 2. Save Configuration Form + Category Assignment */}
                  <form
                    onSubmit={handleSaveUserPreset}
                    className="p-2.5 border-b border-[#1E2228] bg-[#0D0F13] space-y-2"
                  >
                    <div className="flex items-center gap-1.5">
                      <input
                        ref={presetInputRef}
                        type="text"
                        value={userPresetInput}
                        onChange={(e) => setUserPresetInput(e.target.value)}
                        placeholder="Save as new preset..."
                        maxLength={28}
                        className="flex-1 min-w-0 h-7 px-2.5 rounded-[4px] bg-[#08090B] border border-[#24282E] focus:border-[#22E55E] focus:outline-none text-[11px] font-sans text-slate-100 placeholder:text-slate-600"
                      />
                      <button
                        type="submit"
                        disabled={!canSavePreset}
                        className={`h-7 px-3 rounded-[4px] font-mono text-[10px] font-semibold flex items-center gap-1.5 transition-colors shrink-0 ${
                          canSavePreset
                            ? 'bg-[#22E55E] hover:bg-[#34F06D] text-[#07090A] cursor-pointer'
                            : 'bg-[#171A1F] text-slate-500 border border-[#252930] cursor-not-allowed opacity-65'
                        }`}
                      >
                        <Save className="w-3 h-3" />
                        Save
                      </button>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[9px] text-slate-500 uppercase tracking-wider shrink-0">
                        Category
                      </span>
                      <div className="flex items-center gap-1 p-0.5 rounded-[4px] bg-[#08090B] border border-[#1E2228]">
                        {PRESET_CATEGORIES.map((cat) => {
                          const selected = saveCategory === cat;
                          return (
                            <button
                              key={cat}
                              type="button"
                              onClick={() => setSaveCategory(cat)}
                              className="px-2 py-0.5 rounded-[3px] font-mono text-[9.5px] transition-colors cursor-pointer whitespace-nowrap"
                              style={{
                                backgroundColor: selected ? c.accentGreenSoft : 'transparent',
                                color: selected ? c.accentGreenBright : '#6B7280',
                              }}
                            >
                              {cat}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </form>

                  {/* 3. Instant Search + Clean 5-Column Category Tabs */}
                  <div className="px-2.5 pt-2 pb-1.5 border-b border-[#1E2228] bg-[#101216] space-y-1.5">
                    <div className="relative flex items-center">
                      <Search className="w-3 h-3 text-slate-500 absolute left-2 pointer-events-none" />
                      <input
                        type="text"
                        value={presetSearch}
                        onChange={(e) => setPresetSearch(e.target.value)}
                        placeholder="Search presets, mode (Magnetic, Aether...)"
                        className="w-full h-6 pl-6 pr-6 rounded-[4px] bg-[#08090B] border border-[#20242A] focus:border-[#374151] focus:outline-none text-[10.5px] font-sans text-slate-200 placeholder:text-slate-600"
                      />
                      {presetSearch && (
                        <button
                          type="button"
                          onClick={() => setPresetSearch('')}
                          aria-label="Clear search"
                          className="absolute right-1.5 text-slate-500 hover:text-slate-300 cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-5 gap-1">
                      {PRESET_FILTERS.map((filter) => {
                        const active = activeCategoryFilter === filter;
                        const count =
                          filter === 'All'
                            ? DELAY_PRESETS.length + userPresets.length
                            : DELAY_PRESETS.filter((p) => p.category === filter).length +
                              userPresets.filter((item) => item.category === filter).length;
                        return (
                          <button
                            key={filter}
                            type="button"
                            onClick={() => setActiveCategoryFilter(filter)}
                            className="py-1 px-1 rounded-[4px] font-mono text-[9px] text-center transition-colors cursor-pointer truncate"
                            style={{
                              backgroundColor: active ? c.accentGreen : '#15181D',
                              color: active ? '#07090A' : '#9CA3AF',
                              fontWeight: active ? 600 : 500,
                            }}
                          >
                            {filter} ({count})
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 4. Scrollable Unified Preset List */}
                  <div className="max-h-[256px] overflow-y-auto vektor-scrollbar py-1.5">
                    {filteredUserPresets.length === 0 && filteredFactoryPresets.length === 0 ? (
                      <div className="px-4 py-6 text-center text-[11px] text-slate-500">
                        No presets match "{presetSearch}".
                      </div>
                    ) : (
                      <>
                        {filteredUserPresets.length > 0 && (
                          <div className="px-3 pt-1 pb-1 font-mono text-[8.5px] uppercase tracking-[0.14em] text-slate-500">
                            User Presets ({filteredUserPresets.length})
                          </div>
                        )}

                        {filteredUserPresets.map((entry) => {
                          const isActive = activeUserPresetId === entry.id;
                          const isRowRenaming = renamingTarget === entry.id;
                          return (
                            <div
                              key={entry.id}
                              onClick={() => {
                                if (!isRowRenaming) handleLoadUserPreset(entry);
                              }}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => {
                                if (!isRowRenaming && (e.key === 'Enter' || e.key === ' ')) {
                                  e.preventDefault();
                                  handleLoadUserPreset(entry);
                                }
                              }}
                              className={`group px-3 py-1.5 flex items-center justify-between gap-2.5 transition-colors cursor-pointer ${
                                isActive ? 'bg-[#22E55E]/[0.07]' : 'hover:bg-white/[0.04]'
                              }`}
                            >
                              <PresetDelaySparkbar
                                seqSteps={entry.state.seqSteps}
                                feedback={entry.state.feedback}
                                active={isActive}
                              />

                              <div className="min-w-0 flex-1">
                                {isRowRenaming ? (
                                  <form
                                    onSubmit={confirmRename}
                                    onClick={(e) => e.stopPropagation()}
                                    className="flex items-center gap-1"
                                  >
                                    <input
                                      ref={renameInputRef}
                                      type="text"
                                      value={renameDraft}
                                      onChange={(e) => setRenameDraft(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Escape') {
                                          e.preventDefault();
                                          setRenamingTarget(null);
                                        }
                                      }}
                                      maxLength={32}
                                      className="flex-1 min-w-0 h-6 px-1.5 rounded-[3px] bg-[#07080A] border border-[#22E55E] focus:outline-none text-[11px] font-sans text-slate-100"
                                    />
                                    <button
                                      type="submit"
                                      title="Save name"
                                      className="p-1 rounded bg-[#22E55E] text-[#07090A] hover:bg-[#34F06D] cursor-pointer"
                                    >
                                      <Check className="w-3 h-3" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setRenamingTarget(null)}
                                      title="Cancel"
                                      className="p-1 rounded text-slate-400 hover:text-white cursor-pointer"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </form>
                                ) : (
                                  <>
                                    <div className="flex items-center gap-1.5">
                                      <span
                                        className="text-[11px] font-medium truncate"
                                        style={{ color: isActive ? c.accentGreen : '#E5E7EB' }}
                                      >
                                        {entry.name}
                                      </span>
                                      <span className="px-1 py-[1px] rounded bg-[#22E55E]/15 text-[#4ADE80] font-mono text-[7.5px] uppercase tracking-wider shrink-0">
                                        USER
                                      </span>
                                    </div>
                                    <div className="font-mono text-[9px] text-slate-500 tabular-nums">
                                      {entry.state.delayMode.toUpperCase()} · {entry.state.subType} · {entry.state.syncMode === 'sync' ? entry.state.timebaseId : `${Math.round(entry.state.delayTimeMs)}ms`} · {entry.savedAt}
                                    </div>
                                  </>
                                )}
                              </div>

                              {!isRowRenaming && (
                                <div className="flex items-center gap-0.5 shrink-0">
                                  <button
                                    type="button"
                                    onClick={(e) => beginRename(entry.id, entry.name, e)}
                                    title={`Rename ${entry.name}`}
                                    className="p-1 rounded text-slate-500 hover:text-[#22E55E] hover:bg-[#22E55E]/10 transition-colors cursor-pointer"
                                  >
                                    <Pencil className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => handleDeleteUserPreset(entry.id, entry.name, e)}
                                    title={`Delete ${entry.name}`}
                                    className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {filteredFactoryPresets.length > 0 && (
                          <div
                            className={`px-3 pb-1 font-mono text-[8.5px] uppercase tracking-[0.14em] text-slate-500 ${
                              filteredUserPresets.length > 0
                                ? 'pt-2 mt-1 border-t border-[#1C2026]'
                                : 'pt-1'
                            }`}
                          >
                            Default Presets ({filteredFactoryPresets.length})
                          </div>
                        )}

                        {filteredFactoryPresets.map(({ preset: p, index: idx }) => {
                          const isSelected =
                            idx === state.presetIndex &&
                            !activeUserPresetId &&
                            state.presetName !== 'Vektor Random';
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => {
                                setActiveUserPresetId(null);
                                loadPreset(idx);
                              }}
                              className={`w-full px-3 py-1.5 flex items-center justify-between gap-2.5 text-left transition-colors cursor-pointer ${
                                isSelected ? 'bg-[#22E55E]/[0.07]' : 'hover:bg-white/[0.04]'
                              }`}
                            >
                              <PresetDelaySparkbar
                                seqSteps={p.seqSteps}
                                feedback={p.feedback}
                                active={isSelected}
                              />

                              <div className="min-w-0 flex-1">
                                <div
                                  className="text-[11px] font-medium truncate"
                                  style={{
                                    color: isSelected ? c.accentGreen : '#E5E7EB',
                                  }}
                                >
                                  {p.name}
                                </div>
                                <div className="font-mono text-[9px] text-slate-500 tabular-nums">
                                  {p.delayMode.toUpperCase()} ({p.subType}) · {p.patternMode.toUpperCase()} · {p.syncMode === 'sync' ? p.timebaseId : `${Math.round(p.delayTimeMs)}ms`}
                                </div>
                              </div>

                              <span className="px-1.5 py-[1px] rounded bg-[#181B20] text-slate-500 font-mono text-[7.5px] uppercase tracking-wider shrink-0">
                                DEFAULT
                              </span>
                            </button>
                          );
                        })}
                      </>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="h-7 p-[2px] rounded-[5px] bg-[#0B0C0E] border border-[#25282C] flex items-center">
            {(['A', 'B'] as const).map((slot) => {
              const active = state.activeSlot === slot;
              return (
                <button
                  key={slot}
                  type="button"
                  onClick={() => onSwitchSlot(slot)}
                  className="w-6 h-full rounded-[3px] font-mono text-[10px] font-bold transition-colors cursor-pointer"
                  style={{
                    backgroundColor: active ? c.accentGreen : 'transparent',
                    color: active ? '#07090A' : '#6B7280',
                  }}
                >
                  {slot}
                </button>
              );
            })}
          </div>

          {/* Dedicated BYPASS button */}
          <button
            type="button"
            aria-pressed={state.bypassed}
            onContextMenu={(e) => armParamForMidi('bypassed', e)}
            onClick={() =>
              onChangeState((prev) => {
                const nextBypassed = !prev.bypassed;
                onNotify(
                  nextBypassed
                    ? 'Bypass enabled (dry unprocessed signal)'
                    : 'Delay active (processed stereo echo)'
                );
                return { ...prev, bypassed: nextBypassed };
              })
            }
            title={
              midiLearnEnabled
                ? 'Right-click to map BYPASS to MIDI CC'
                : state.bypassed
                ? 'Disable Bypass (return to processed signal)'
                : 'Enable Bypass (compare with dry signal)'
            }
            className={`relative h-7 px-2.5 rounded-[5px] border flex items-center gap-1.5 font-mono text-[10px] font-semibold tracking-[0.12em] transition-all whitespace-nowrap ${
              midiLearnEnabled ? 'cursor-context-menu' : 'cursor-pointer'
            }`}
            style={{
              backgroundColor: state.bypassed ? 'rgba(249, 115, 22, 0.14)' : '#1A1D21',
              borderColor:
                armedMidiParam === 'bypassed'
                  ? c.accentGreen
                  : midiLearnEnabled
                  ? 'rgba(58, 227, 158, 0.55)'
                  : state.bypassed
                  ? '#F97316'
                  : '#2B2E33',
              color: state.bypassed ? '#FDBA74' : '#9CA3AF',
              boxShadow:
                armedMidiParam === 'bypassed'
                  ? '0 0 12px rgba(34, 229, 94, 0.4)'
                  : state.bypassed
                  ? '0 0 10px rgba(249, 115, 22, 0.25)'
                  : 'none',
            }}
          >
            {midiMappings.bypassed && (
              <span className="pointer-events-none absolute -top-1.5 -right-1 px-1 rounded-[2px] bg-[#0B0D10] border border-[#22E55E]/60 font-mono text-[7px] text-[#3AE39E] tabular-nums">
                CC{midiMappings.bypassed.cc}
              </span>
            )}
            <span className="w-2.5 h-2.5 rounded-full bg-[#07080A] border border-[#22252A] flex items-center justify-center shrink-0">
              <motion.span
                className="block w-1.5 h-1.5 rounded-full"
                animate={{
                  scale: state.bypassed ? [1, 1.25, 1] : 1,
                  backgroundColor: state.bypassed ? '#F97316' : '#2E343D',
                  boxShadow: state.bypassed
                    ? '0 0 7px rgba(249, 115, 22, 0.95)'
                    : '0 0 0px rgba(0, 0, 0, 0)',
                }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
              />
            </span>
            BYPASS
          </button>

          {/* Settings Menu */}
          <div ref={settingsMenuRef} className="relative">
            <button
              type="button"
              onClick={() => {
                setShowPresetMenu(false);
                setShowSettingsMenu((v) => !v);
              }}
              aria-expanded={showSettingsMenu}
              aria-label="Open plugin settings and MIDI Learn menu"
              title={midiLearnEnabled ? 'Settings (MIDI Learn Active)' : 'Settings & MIDI Learn'}
              className="relative w-7 h-7 rounded-[5px] border flex items-center justify-center transition-colors cursor-pointer"
              style={{
                backgroundColor: midiLearnEnabled
                  ? c.accentGreenSoft
                  : showSettingsMenu
                  ? '#20242A'
                  : '#1A1D21',
                borderColor: midiLearnEnabled
                  ? c.accentGreen
                  : showSettingsMenu
                  ? '#3E434B'
                  : '#2B2E33',
                color: midiLearnEnabled ? c.accentGreen : '#94A3B8',
              }}
            >
              <Settings className="w-3.5 h-3.5" />
            </button>

            <AnimatePresence>
              {showSettingsMenu && (
                <SettingsMenuPopover
                  midiLearnEnabled={midiLearnEnabled}
                  onToggleMidiLearn={handleToggleMidiLearn}
                  webMidiStatus={webMidiStatus}
                  midiDeviceNames={midiDeviceNames}
                  onConnectWebMidi={() => void connectWebMidi()}
                  mappings={midiMappings}
                  onRemoveMapping={(paramId) => {
                    const next = { ...midiMappings };
                    delete next[paramId];
                    persistMidiMappings(next);
                    onNotify(`Removed MIDI mapping for ${MIDI_PARAM_META[paramId].label}`);
                  }}
                  onClearAllMappings={() => {
                    persistMidiMappings({});
                    onNotify('Cleared all MIDI CC mappings');
                  }}
                  onClose={() => setShowSettingsMenu(false)}
                />
              )}
            </AnimatePresence>
          </div>

          <button
            type="button"
            onClick={onReset}
            title="Reset to default state"
            className="w-7 h-7 rounded-[5px] bg-[#1A1D21] border border-[#2B2E33] hover:border-[#3E434B] flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Floating Active MIDI Learn Mode Guide Strip */}
      <AnimatePresence>
        {midiLearnEnabled && !armedMidiParam && !confirmedMidiMapping && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute top-[56px] left-1/2 -translate-x-1/2 z-20 px-3 py-1 rounded-[5px] bg-[#0B1210]/95 border border-[#22E55E]/55 shadow-[0_10px_28px_rgba(0,0,0,0.75)] flex items-center gap-3 whitespace-nowrap"
          >
            <div className="flex items-center gap-2 text-[10.5px] font-mono text-[#A7F3D0]">
              <span className="font-semibold text-[#22E55E] uppercase tracking-wider">
                MIDI Learn Active
              </span>
              <span className="text-slate-500">·</span>
              <span>Right-click any highlighted knob or control to map a hardware MIDI CC.</span>
            </div>
            <button
              type="button"
              onClick={handleToggleMidiLearn}
              className="px-2 py-0.5 rounded-[3px] bg-[#22E55E] text-[#07090A] font-mono text-[9.5px] font-semibold hover:bg-[#34F06D] transition-colors cursor-pointer shrink-0"
            >
              Done
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ======================== BODY: LEFT PROCESSING STACK + RIGHT STEREO I/O VU BAY ======================== */}
      <div className="p-4 grid grid-cols-[1fr_114px] gap-3 items-stretch">
        <div
          className="min-w-0 flex flex-col gap-3 transition-opacity duration-200"
          style={{ opacity: state.bypassed ? 0.65 : 1 }}
        >
          {/* 1. CENTRAL BAY: 5 DELAY MODES · PATTERN ENGINE (DUAL/SEQUENCE) · VECTOR ORB · FILTER CURVE */}
          <div className="rounded-[8px] vektor-subpanel border border-[#24272A] p-3.5 flex flex-col gap-2.5">
            {/* Top Toolbar */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 shrink-0">
                {/* TEST TONE Noise Burst Preview */}
                <button
                  type="button"
                  onClick={() => {
                    setTestToneTriggerCount((n) => n + 1);
                    onNotify(`Test Tone burst sent through ${activeModeMeta.label} (${state.subType})`);
                  }}
                  title="Send short noise burst for real-time delay tail & filter preview"
                  className="h-7 px-2.5 rounded-[5px] bg-[#0E1012] border border-[#25282C] hover:border-[#3AE39E]/70 font-mono text-[9px] text-[#3AE39E] flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Volume2 className="w-3 h-3" />
                  TEST
                </button>

                {/* FREEZE Toggle Button */}
                <button
                  type="button"
                  aria-pressed={state.freeze}
                  onContextMenu={(e) => armParamForMidi('freeze', e)}
                  onClick={() =>
                    onChangeState((prev) => {
                      const nextFreeze = !prev.freeze;
                      onNotify(nextFreeze ? 'Delay buffer FROZEN (infinite sustain)' : 'Freeze released');
                      return { ...prev, freeze: nextFreeze };
                    })
                  }
                  title={
                    midiLearnEnabled
                      ? 'Right-click to map FREEZE to MIDI CC'
                      : 'Freeze & sustain the current delay buffer infinitely'
                  }
                  className={`relative h-7 px-2.5 rounded-[5px] border font-mono text-[9px] font-semibold tracking-wider flex items-center gap-1 transition-all ${
                    midiLearnEnabled ? 'cursor-context-menu' : 'cursor-pointer'
                  }`}
                  style={{
                    backgroundColor: state.freeze ? 'rgba(56, 189, 248, 0.14)' : '#0E1012',
                    borderColor:
                      armedMidiParam === 'freeze'
                        ? c.accentGreen
                        : state.freeze
                        ? '#38BDF8'
                        : '#25282C',
                    color: state.freeze ? '#7DD3FC' : '#9CA3AF',
                  }}
                >
                  {midiMappings.freeze && (
                    <span className="pointer-events-none absolute -top-1.5 -right-1 px-1 rounded-[2px] bg-[#0B0D10] border border-[#22E55E]/60 font-mono text-[6.5px] text-[#3AE39E] tabular-nums">
                      CC{midiMappings.freeze.cc}
                    </span>
                  )}
                  <Snowflake className="w-3 h-3" />
                  FREEZE
                </button>

                {/* Dedicated Compact Stereo Output Waveform Monitor */}
                <div
                  title="Real-time stereo output waveform monitor"
                  className="relative h-7 w-[92px] rounded-[4px] bg-[#090A0C] border border-[#23262B] overflow-hidden flex items-center"
                >
                  <PulsarDelayCanvas
                    mode="compact"
                    delayMode={state.delayMode}
                    subType={state.subType}
                    patternMode={state.patternMode}
                    dualRouting={state.dualRouting}
                    dualRatio={state.dualRatio}
                    lrOffsetMs={state.lrOffsetMs}
                    seqSteps={state.seqSteps}
                    seqStepCount={state.seqStepCount}
                    seqPlayMode={state.seqPlayMode}
                    bpm={state.bpm}
                    effectiveDelayMs={effectiveDelayMs}
                    feedback={state.feedback}
                    modRateHz={state.modRateHz}
                    modAmt={state.modAmt}
                    characterVal={state.characterVal}
                    pitchSemitones={state.pitchSemitones}
                    width={state.width}
                    duckAmt={state.duckAmt}
                    lowCutHz={state.lowCutHz}
                    highCutHz={state.highCutHz}
                    mix={state.mix}
                    freeze={state.freeze}
                    bypassed={state.bypassed}
                    isPlaying={isPlaying}
                    testToneTriggerCount={testToneTriggerCount}
                  />
                  <span className="relative z-10 ml-1 px-1 rounded bg-[#090A0C]/75 font-mono text-[7.5px] tracking-wider text-slate-400 uppercase pointer-events-none">
                    OUT
                  </span>
                </div>
              </div>

              {/* Right: 5 Delay Mode Algorithms + Character Sub-Type Selector */}
              <div className="flex items-center gap-1.5 shrink-0">
                <div className="h-7 p-[2px] rounded-[5px] bg-[#0B0C0E] border border-[#24272A] flex items-center">
                  {DELAY_MODES.map((m) => {
                    const active = state.delayMode === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => handleSelectDelayMode(m.id)}
                        title={m.tagline}
                        className="px-2 h-full rounded-[3px] font-mono text-[9px] font-semibold tracking-wider transition-colors cursor-pointer"
                        style={{
                          backgroundColor: active ? c.accentGreenSoft : 'transparent',
                          color: active ? c.accentGreen : '#6B7280',
                          boxShadow: active ? `inset 0 0 0 1px ${c.accentGreen}` : 'none',
                        }}
                      >
                        {m.label}
                      </button>
                    );
                  })}
                </div>

                {/* Sub-Type Selector */}
                <div className="relative h-7 flex items-center">
                  <select
                    aria-label="Character Sub-Type"
                    value={state.subType}
                    onChange={(e) =>
                      onChangeState((prev) => ({
                        ...prev,
                        subType: e.target.value as DelaySubType,
                      }))
                    }
                    className="h-7 pl-2 pr-6 rounded-[5px] bg-[#0B0C0E] border border-[#25282C] hover:border-[#3A3E45] focus:border-[#22E55E] focus:outline-none font-mono text-[9.5px] text-[#3AE39E] uppercase tracking-wider appearance-none cursor-pointer"
                  >
                    {activeModeMeta.subTypes.map((st) => (
                      <option key={st} value={st} className="bg-[#111317] text-slate-100">
                        {st.toUpperCase()}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3 h-3 text-slate-400 pointer-events-none absolute right-1.5" />
                </div>
              </div>
            </div>

            {/* PURE-BLACK VECTOR DISPLAY STAGE */}
            <div className="rounded-[6px] vektor-scope p-3 flex flex-col justify-between">
              {/* Scope Top Sub-Header: DUAL | SEQUENCE + Routing/Steps + PRE | POST */}
              <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-[#181B20]">
                <div className="flex items-center gap-2">
                  {/* DUAL | SEQUENCE Toggle */}
                  <div className="h-[24px] p-[2px] rounded-[4px] bg-[#07080A] border border-[#22252A] flex items-center">
                    {(['dual', 'sequence'] as PatternEngineMode[]).map((pm) => {
                      const active = state.patternMode === pm;
                      return (
                        <button
                          key={pm}
                          type="button"
                          onClick={() => onChangeState((prev) => ({ ...prev, patternMode: pm }))}
                          className="px-2 h-full rounded-[2.5px] font-mono text-[8.5px] font-semibold tracking-wider uppercase transition-colors cursor-pointer"
                          style={{
                            backgroundColor: active ? c.accentGreenSoft : 'transparent',
                            color: active ? c.accentGreen : '#6B7280',
                            boxShadow: active ? `inset 0 0 0 1px ${c.accentGreen}` : 'none',
                          }}
                        >
                          {pm}
                        </button>
                      );
                    })}
                  </div>

                  {state.patternMode === 'sequence' ? (
                    <div className="flex items-center gap-1.5">
                      <div className="h-[24px] p-[2px] rounded-[4px] bg-[#07080A] border border-[#22252A] flex items-center">
                        {(['loop', 'once'] as SequencePlayMode[]).map((spm) => {
                          const active = state.seqPlayMode === spm;
                          return (
                            <button
                              key={spm}
                              type="button"
                              onClick={() => onChangeState((prev) => ({ ...prev, seqPlayMode: spm }))}
                              className="px-1.5 h-full rounded-[2.5px] font-mono text-[8px] font-semibold tracking-wider uppercase transition-colors cursor-pointer"
                              style={{
                                backgroundColor: active ? c.accentMintSoft : 'transparent',
                                color: active ? c.accentMint : '#6B7280',
                              }}
                            >
                              {spm}
                            </button>
                          );
                        })}
                      </div>

                      <div className="h-[24px] px-1.5 rounded-[4px] bg-[#07080A] border border-[#22252A] flex items-center gap-1.5 font-mono text-[8.5px]">
                        <span className="text-slate-500">STEPS</span>
                        <button
                          type="button"
                          onClick={() =>
                            onChangeState((prev) => ({
                              ...prev,
                              seqStepCount: Math.max(2, prev.seqStepCount - 1),
                            }))
                          }
                          className="text-slate-400 hover:text-white cursor-pointer px-0.5"
                          aria-label="Decrease sequence steps"
                        >
                          −
                        </button>
                        <span className="text-slate-200 font-semibold tabular-nums">
                          {state.seqStepCount}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            onChangeState((prev) => ({
                              ...prev,
                              seqStepCount: Math.min(8, prev.seqStepCount + 1),
                            }))
                          }
                          className="text-slate-400 hover:text-white cursor-pointer px-0.5"
                          aria-label="Increase sequence steps"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      {/* PING PONG | CRISS CROSS */}
                      <div className="h-[24px] p-[2px] rounded-[4px] bg-[#07080A] border border-[#22252A] flex items-center">
                        {(['pingpong', 'crisscross'] as DualRoutingMode[]).map((dr) => {
                          const active = state.dualRouting === dr;
                          return (
                            <button
                              key={dr}
                              type="button"
                              onClick={() => onChangeState((prev) => ({ ...prev, dualRouting: dr }))}
                              className="px-1.5 h-full rounded-[2.5px] font-mono text-[8px] font-semibold tracking-wider uppercase transition-colors cursor-pointer"
                              style={{
                                backgroundColor: active ? c.accentMintSoft : 'transparent',
                                color: active ? c.accentMint : '#6B7280',
                              }}
                            >
                              {dr === 'pingpong' ? 'PING PONG' : 'CRISS CROSS'}
                            </button>
                          );
                        })}
                      </div>

                      {/* Ratio Presets: 1:1 | GOLDEN | PLASTIC | SEMI */}
                      <div className="h-[24px] p-[2px] rounded-[4px] bg-[#07080A] border border-[#22252A] flex items-center">
                        {DUAL_RATIOS.map((r) => {
                          const active = state.dualRatio === r.id;
                          return (
                            <button
                              key={r.id}
                              type="button"
                              onClick={() => onChangeState((prev) => ({ ...prev, dualRatio: r.id }))}
                              title={`Right channel ratio ×${r.ratioR}`}
                              className="px-1.5 h-full rounded-[2.5px] font-mono text-[8px] font-semibold tracking-wider transition-colors cursor-pointer"
                              style={{
                                backgroundColor: active ? 'rgba(255,255,255,0.08)' : 'transparent',
                                color: active ? '#F3F4F6' : '#6B7280',
                              }}
                            >
                              {r.label}
                            </button>
                          );
                        })}
                      </div>

                      {/* L/R Time Offset Stepper */}
                      <div className="h-[24px] px-1.5 rounded-[4px] bg-[#07080A] border border-[#22252A] flex items-center gap-1 font-mono text-[8px]">
                        <span className="text-slate-500">L/R</span>
                        <button
                          type="button"
                          onClick={() =>
                            onChangeState((prev) => ({
                              ...prev,
                              lrOffsetMs: Math.max(-50, prev.lrOffsetMs - 2),
                            }))
                          }
                          className="text-slate-400 hover:text-white cursor-pointer"
                        >
                          −
                        </button>
                        <span className="text-[#3AE39E] tabular-nums w-8 text-center">
                          {state.lrOffsetMs > 0 ? `+${state.lrOffsetMs}` : state.lrOffsetMs}ms
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            onChangeState((prev) => ({
                              ...prev,
                              lrOffsetMs: Math.min(50, prev.lrOffsetMs + 2),
                            }))
                          }
                          className="text-slate-400 hover:text-white cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right: Filter Routing Position [ PRE | POST ] */}
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[8px] tracking-wider text-slate-500 uppercase">
                    FILTERS
                  </span>
                  <div className="h-[24px] p-[2px] rounded-[4px] bg-[#07080A] border border-[#22252A] flex items-center">
                    {(['pre', 'post'] as FilterPosition[]).map((fp) => {
                      const active = state.filterPos === fp;
                      return (
                        <button
                          key={fp}
                          type="button"
                          onClick={() => onChangeState((prev) => ({ ...prev, filterPos: fp }))}
                          className="px-2 h-full rounded-[2.5px] font-mono text-[8px] font-semibold tracking-wider uppercase transition-colors cursor-pointer"
                          style={{
                            backgroundColor: active ? c.accentGreenSoft : 'transparent',
                            color: active ? c.accentGreen : '#6B7280',
                          }}
                        >
                          {fp}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* MAIN VISUALIZATION & INTERACTION STAGE */}
              <div className="relative h-[192px] w-full overflow-hidden rounded-[3px]">
                  <div className="h-full w-full grid grid-cols-[1.08fr_1fr_1.08fr] gap-3 items-stretch">
                    {/* LEFT ZONE: 8-Step Sequencer OR Dual Stereo Matrix */}
                    <div className="rounded-[5px] bg-[#0E1013]/80 border border-[#1B1E24] p-2.5 flex flex-col justify-between">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[8.5px] uppercase tracking-[0.14em] text-slate-500">
                          {state.patternMode === 'sequence' ? '8-STEP SEQUENCER' : 'DUAL STEREO LINE'}
                        </span>
                        <span className="font-mono text-[8.5px] text-[#3AE39E] tabular-nums">
                          {state.patternMode === 'sequence'
                            ? `${state.seqSteps.slice(0, state.seqStepCount).filter((s) => s.enabled).length}/${state.seqStepCount} ON`
                            : `×${activeRatioMeta.ratioR.toFixed(3)}`}
                        </span>
                      </div>

                      {state.patternMode === 'sequence' ? (
                        <>
                          {/* 8 Circular Pads + Per-Step Pan */}
                          <div className="grid grid-cols-8 gap-1 items-center my-auto">
                            {state.seqSteps.map((step, idx) => {
                              const inRange = idx < state.seqStepCount;
                              const isCurrent = isPlaying && inRange && activePlayStep === idx;
                              const panLetter =
                                step.pan < -0.2 ? 'L' : step.pan > 0.2 ? 'R' : 'C';
                              return (
                                <div
                                  key={idx}
                                  className="flex flex-col items-center gap-1.5"
                                  style={{ opacity: inRange ? 1 : 0.22 }}
                                >
                                  <button
                                    type="button"
                                    disabled={!inRange}
                                    onClick={() => handleToggleSeqStep(idx)}
                                    title={`Step ${idx + 1} · Click to enable/mute`}
                                    className="w-7 h-7 rounded-full border flex items-center justify-center font-mono text-[9px] font-semibold transition-all cursor-pointer"
                                    style={{
                                      backgroundColor:
                                        inRange && step.enabled
                                          ? c.accentGreenSoft
                                          : '#08090B',
                                      borderColor: isCurrent
                                        ? '#FFFFFF'
                                        : inRange && step.enabled
                                        ? c.accentGreen
                                        : '#252930',
                                      color:
                                        inRange && step.enabled ? c.accentGreenBright : '#4B5563',
                                      boxShadow:
                                        inRange && step.enabled
                                          ? isCurrent
                                            ? `0 0 12px ${c.accentGreen}`
                                            : `0 0 8px rgba(34,229,94,0.28)`
                                          : 'none',
                                    }}
                                  >
                                    {idx + 1}
                                  </button>

                                  <button
                                    type="button"
                                    disabled={!inRange}
                                    onClick={() => handleCycleSeqPan(idx)}
                                    title={`Step ${idx + 1} pan: ${panLetter} (click to cycle L / C / R)`}
                                    className="w-6 h-4 rounded-[2px] bg-[#08090B] border border-[#1E2228] hover:border-[#343A44] font-mono text-[8px] font-semibold transition-colors cursor-pointer"
                                    style={{
                                      color:
                                        panLetter === 'L'
                                          ? c.accentMint
                                          : panLetter === 'R'
                                          ? c.accentGreen
                                          : '#9CA3AF',
                                    }}
                                  >
                                    {panLetter}
                                  </button>
                                </div>
                              );
                            })}
                          </div>

                          <div className="flex items-center justify-between text-[8.5px] font-mono text-slate-500 pt-1 border-t border-[#181B20]">
                            <span>Click pad: Step · Click L/C/R: Pan</span>
                            <span className="text-slate-400 uppercase">{state.seqPlayMode}</span>
                          </div>
                        </>
                      ) : (
                        <>
                          {/* DUAL MODE L/R STEREO VISUALIZER */}
                          <div className="space-y-2.5 my-auto">
                            <div className="rounded-[4px] bg-[#08090B] border border-[#1D2127] p-2 space-y-1.5">
                              <div className="flex items-center justify-between font-mono text-[9px]">
                                <span style={{ color: c.accentMint }}>LEFT LINE</span>
                                <span className="text-slate-200 tabular-nums font-semibold">
                                  {dualLeftMs} ms
                                </span>
                              </div>
                              <div className="h-1.5 w-full rounded-full bg-[#14171B] overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all duration-150"
                                  style={{
                                    width: `${Math.min(100, Math.max(12, (dualLeftMs / 1500) * 100))}%`,
                                    backgroundColor: c.accentMint,
                                  }}
                                />
                              </div>
                            </div>

                            <div className="rounded-[4px] bg-[#08090B] border border-[#1D2127] p-2 space-y-1.5">
                              <div className="flex items-center justify-between font-mono text-[9px]">
                                <span style={{ color: c.accentGreen }}>
                                  RIGHT LINE ({activeRatioMeta.label})
                                </span>
                                <span className="text-slate-200 tabular-nums font-semibold">
                                  {dualRightMs} ms
                                </span>
                              </div>
                              <div className="h-1.5 w-full rounded-full bg-[#14171B] overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all duration-150"
                                  style={{
                                    width: `${Math.min(100, Math.max(12, (dualRightMs / 1500) * 100))}%`,
                                    backgroundColor: c.accentGreen,
                                  }}
                                />
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-[8.5px] font-mono text-slate-500 pt-1 border-t border-[#181B20]">
                            <span>
                              Routing:{' '}
                              <span className="text-slate-300">
                                {state.dualRouting === 'pingpong' ? 'L ↔ R PING PONG' : 'CROSS FEEDBACK'}
                              </span>
                            </span>
                            <span className="text-[#3AE39E]">W {Math.round(state.width * 100)}%</span>
                          </div>
                        </>
                      )}
                    </div>

                    {/* CENTER ZONE: Morphing Vector Mode Orb Canvas */}
                    <div className="relative rounded-[5px] bg-[#08090B] border border-[#1B1E24] overflow-hidden flex flex-col">
                      <PulsarDelayCanvas
                        mode="orb"
                        delayMode={state.delayMode}
                        subType={state.subType}
                        patternMode={state.patternMode}
                        dualRouting={state.dualRouting}
                        dualRatio={state.dualRatio}
                        lrOffsetMs={state.lrOffsetMs}
                        seqSteps={state.seqSteps}
                        seqStepCount={state.seqStepCount}
                        seqPlayMode={state.seqPlayMode}
                        bpm={state.bpm}
                        effectiveDelayMs={effectiveDelayMs}
                        feedback={state.feedback}
                        modRateHz={state.modRateHz}
                        modAmt={state.modAmt}
                        characterVal={state.characterVal}
                        pitchSemitones={state.pitchSemitones}
                        width={state.width}
                        duckAmt={state.duckAmt}
                        lowCutHz={state.lowCutHz}
                        highCutHz={state.highCutHz}
                        mix={state.mix}
                        freeze={state.freeze}
                        bypassed={state.bypassed}
                        isPlaying={isPlaying}
                        testToneTriggerCount={testToneTriggerCount}
                      />
                      <div className="pointer-events-none absolute top-2 left-2.5 right-2.5 flex items-center justify-between font-mono text-[8px] uppercase tracking-wider">
                        <span className="text-slate-400">
                          {activeModeMeta.label} · <span className="text-[#3AE39E]">{state.subType}</span>
                        </span>
                        {state.freeze && (
                          <span className="px-1.5 py-[0.5px] rounded bg-sky-500/20 border border-sky-400/50 text-sky-300">
                            FROZEN
                          </span>
                        )}
                      </div>
                      <div className="pointer-events-none absolute bottom-1.5 left-0 right-0 text-center font-mono text-[8.5px] text-slate-400 tracking-[0.14em] uppercase">
                        {activeModeMeta.characterLabel}:{' '}
                        <span className="text-[#22E55E] font-semibold">
                          {activeModeMeta.isPitchBipolar
                            ? `${state.pitchSemitones > 0 ? '+' : ''}${state.pitchSemitones} st`
                            : `${Math.round(state.characterVal * 100)}%`}
                        </span>
                      </div>
                    </div>

                    {/* RIGHT ZONE: Filter Response Curve + Low/High Damping Steppers */}
                    <div className="rounded-[5px] bg-[#0E1013]/80 border border-[#1B1E24] p-2.5 flex flex-col justify-between">
                      <div className="flex items-center justify-between font-mono text-[8.5px] tabular-nums">
                        <span className="text-slate-400">
                          LC <span className="text-[#3AE39E] font-semibold">{formatHz(state.lowCutHz)}</span>Hz
                        </span>
                        <span className="text-slate-500 uppercase tracking-wider">
                          {state.filterPos} EQ
                        </span>
                        <span className="text-slate-400">
                          HC <span className="text-[#22E55E] font-semibold">{formatHz(state.highCutHz)}</span>Hz
                        </span>
                      </div>

                      <FilterResponseSvg
                        lowCutHz={state.lowCutHz}
                        highCutHz={state.highCutHz}
                        lowDampPct={state.lowDampPct}
                        lowDampFreqHz={state.lowDampFreqHz}
                        highDampPct={state.highDampPct}
                        highDampFreqHz={state.highDampFreqHz}
                        bypassed={state.bypassed}
                      />

                      {/* Low Damp & High Damp Steppers */}
                      <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-[#181B20]">
                        <div className="rounded-[4px] bg-[#08090B] border border-[#1C2026] px-1.5 py-1">
                          <div className="flex items-center justify-between font-mono text-[8px]">
                            <span className="text-slate-500">LO DAMP</span>
                            <span className="text-[#3AE39E] font-semibold tabular-nums">
                              {Math.round(state.lowDampPct * 100)}%
                            </span>
                          </div>
                          <div className="flex items-center justify-between mt-0.5 font-mono text-[8px] text-slate-400">
                            <button
                              type="button"
                              onClick={() =>
                                onChangeState((prev) => ({
                                  ...prev,
                                  lowDampPct: Number(Math.max(0, prev.lowDampPct - 0.05).toFixed(2)),
                                }))
                              }
                              className="px-1 hover:text-white cursor-pointer"
                            >
                              −
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                onChangeState((prev) => ({
                                  ...prev,
                                  lowDampFreqHz: prev.lowDampFreqHz >= 400 ? 120 : prev.lowDampFreqHz + 60,
                                }))
                              }
                              title="Cycle Low Damp corner frequency"
                              className="text-slate-300 hover:text-[#3AE39E] tabular-nums cursor-pointer"
                            >
                              {formatHz(state.lowDampFreqHz)}Hz
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                onChangeState((prev) => ({
                                  ...prev,
                                  lowDampPct: Number(Math.min(1, prev.lowDampPct + 0.05).toFixed(2)),
                                }))
                              }
                              className="px-1 hover:text-white cursor-pointer"
                            >
                              +
                            </button>
                          </div>
                        </div>

                        <div className="rounded-[4px] bg-[#08090B] border border-[#1C2026] px-1.5 py-1">
                          <div className="flex items-center justify-between font-mono text-[8px]">
                            <span className="text-slate-500">HI DAMP</span>
                            <span className="text-[#22E55E] font-semibold tabular-nums">
                              {Math.round(state.highDampPct * 100)}%
                            </span>
                          </div>
                          <div className="flex items-center justify-between mt-0.5 font-mono text-[8px] text-slate-400">
                            <button
                              type="button"
                              onClick={() =>
                                onChangeState((prev) => ({
                                  ...prev,
                                  highDampPct: Number(Math.max(0, prev.highDampPct - 0.05).toFixed(2)),
                                }))
                              }
                              className="px-1 hover:text-white cursor-pointer"
                            >
                              −
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                onChangeState((prev) => ({
                                  ...prev,
                                  highDampFreqHz:
                                    prev.highDampFreqHz >= 10000 ? 2500 : prev.highDampFreqHz + 1500,
                                }))
                              }
                              title="Cycle High Damp corner frequency"
                              className="text-slate-300 hover:text-[#22E55E] tabular-nums cursor-pointer"
                            >
                              {formatHz(state.highDampFreqHz)}Hz
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                onChangeState((prev) => ({
                                  ...prev,
                                  highDampPct: Number(Math.min(1, prev.highDampPct + 0.05).toFixed(2)),
                                }))
                              }
                              className="px-1 hover:text-white cursor-pointer"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
              </div>

              {/* Real-Time Canvas Feedback Path Animation */}
              <div className="mt-2">
                <FeedbackPathCanvas
                  bpm={state.bpm}
                  effectiveDelayMs={effectiveDelayMs}
                  feedback={state.feedback}
                  modRateHz={state.modRateHz}
                  modAmt={state.modAmt}
                  patternMode={state.patternMode}
                  dualRouting={state.dualRouting}
                  duckAmt={state.duckAmt}
                  mix={state.mix}
                  freeze={state.freeze}
                  bypassed={state.bypassed}
                  isPlaying={isPlaying}
                  testToneTriggerCount={testToneTriggerCount}
                />
              </div>

              {/* Scope Footer Hint & Legend */}
              <div className="mt-2 pt-1.5 border-t border-[#181B20] flex items-center justify-between text-[10px] font-sans text-slate-500">
                <span>
                  {activeModeMeta.tagline} · Feedback {Math.round(state.feedback * 100)}% · Ducker {Math.round(state.duckAmt * 100)}% ({state.duckerTarget.toUpperCase()})
                </span>

                <div className="flex items-center gap-3 font-mono text-[9.5px] shrink-0">
                  <span className="flex items-center gap-1.5 text-slate-400">
                    <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: c.accentMint }} />
                    Left
                  </span>
                  <span className="flex items-center gap-1.5 text-slate-400">
                    <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: c.accentGreen }} />
                    Right
                  </span>
                  <span className="flex items-center gap-1.5 text-slate-400">
                    <span className="inline-block w-2.5 h-[2px]" style={{ backgroundColor: c.accentGreen }} />
                    FB Path
                  </span>
                  {state.freeze && (
                    <span className="flex items-center gap-1.5 text-sky-300">
                      <span className="inline-block w-2 h-2 rounded-full bg-sky-400" />
                      Freeze
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 2. HORIZONTAL DELAY ENGINE MODULE (GROOVE · TIMING · MOD · 6×2 TIMEBASE) */}
          <div className="rounded-[8px] vektor-subpanel border border-[#24272A] px-4 py-3.5 grid grid-cols-[1fr_auto] items-center gap-3.5">
            <div className="flex items-center gap-3 min-w-0">
              {/* Left Timing Mode Column */}
              <div className="w-[104px] flex flex-col items-stretch gap-1.5 pr-3 border-r border-[#22252A] shrink-0">
                <div className="flex flex-col">
                  <span className="font-mono text-[10px] font-semibold tracking-[0.14em] text-slate-300 uppercase leading-tight">
                    DELAY ENGINE
                  </span>
                  <span className="font-mono text-[9.5px] text-[#3AE39E] tabular-nums mt-0.5">
                    {effectiveDelayMs.toFixed(1)} ms
                  </span>
                </div>

                {/* SYNC / FREE Mode Switch */}
                <div
                  onContextMenu={(e) => armParamForMidi('syncMode', e)}
                  title={
                    midiLearnEnabled
                      ? 'Right-click to map SYNC/FREE to MIDI CC'
                      : 'Toggle BPM Sync vs Free ms timing'
                  }
                  className={`relative h-[24px] p-[2px] rounded-[4px] bg-[#0B0C0E] border grid grid-cols-2 transition-colors ${
                    midiLearnEnabled ? 'cursor-context-menu' : ''
                  }`}
                  style={{
                    borderColor:
                      armedMidiParam === 'syncMode'
                        ? c.accentGreen
                        : midiLearnEnabled
                        ? 'rgba(58, 227, 158, 0.55)'
                        : '#25282C',
                  }}
                >
                  {midiMappings.syncMode && (
                    <span className="pointer-events-none absolute -top-1.5 -right-1 px-1 rounded-[2px] bg-[#0B0D10] border border-[#22E55E]/60 font-mono text-[6.5px] text-[#3AE39E] tabular-nums">
                      CC{midiMappings.syncMode.cc}
                    </span>
                  )}
                  {(['sync', 'free'] as const).map((mode) => {
                    const active = state.syncMode === mode;
                    return (
                      <button
                        key={mode}
                        type="button"
                        onClick={() =>
                          onChangeState((prev) => ({
                            ...prev,
                            syncMode: mode,
                            delayTimeMs:
                              mode === 'free' && prev.syncMode === 'sync'
                                ? computeSyncedDelayMs(prev.bpm, prev.timebaseId)
                                : prev.delayTimeMs,
                          }))
                        }
                        className="rounded-[2.5px] font-mono text-[8.5px] font-semibold tracking-wider uppercase transition-colors cursor-pointer"
                        style={{
                          backgroundColor: active ? c.accentGreenSoft : 'transparent',
                          color: active ? c.accentGreen : '#6B7280',
                          boxShadow: active ? `inset 0 0 0 1px ${c.accentGreen}` : 'none',
                        }}
                      >
                        {mode}
                      </button>
                    );
                  })}
                </div>

                {/* Active Mode Badge */}
                <div className="h-[24px] px-2 rounded-[4px] bg-[#0B0C0E] border border-[#22252A] flex items-center justify-center font-mono text-[8px] tracking-wider text-slate-400 uppercase truncate">
                  {activeModeMeta.label} · {state.subType}
                </div>
              </div>

              {/* 6 Delay Engine Encoders: SWING, OFFSET, DELAY, FEEDBACK, MOD RATE, MOD AMT */}
              <div className="flex-1 grid grid-cols-6 gap-1.5 items-center">
                <RotaryEncoder
                  label="SWING"
                  unit="%"
                  size="sm"
                  bipolar
                  value={state.swing}
                  defaultValue={0.5}
                  centerDisplay={String(Math.round(state.swing * 100))}
                  midiLearnEnabled={midiLearnEnabled}
                  isMidiArmed={armedMidiParam === 'swing'}
                  midiMapping={midiMappings.swing ?? null}
                  onMidiContextMenu={(e) => armParamForMidi('swing', e)}
                  onChange={(v) =>
                    onChangeState((prev) => ({ ...prev, swing: Number(v.toFixed(2)) }))
                  }
                />

                <RotaryEncoder
                  label="OFFSET"
                  unit="ms"
                  size="sm"
                  bipolar
                  value={(state.offsetMs + 50) / 100}
                  defaultValue={0.5}
                  centerDisplay={state.offsetMs > 0 ? `+${state.offsetMs}` : String(state.offsetMs)}
                  midiLearnEnabled={midiLearnEnabled}
                  isMidiArmed={armedMidiParam === 'offsetMs'}
                  midiMapping={midiMappings.offsetMs ?? null}
                  onMidiContextMenu={(e) => armParamForMidi('offsetMs', e)}
                  onChange={(v) =>
                    onChangeState((prev) => ({
                      ...prev,
                      offsetMs: Math.round(-50 + v * 100),
                    }))
                  }
                />

                <RotaryEncoder
                  label="DELAY"
                  unit={state.syncMode === 'sync' ? state.timebaseId : 'ms'}
                  size="sm"
                  value={(effectiveDelayMs - 10) / 1990}
                  defaultValue={(167 - 10) / 1990}
                  centerDisplay={
                    state.syncMode === 'sync' ? state.timebaseId : String(Math.round(effectiveDelayMs))
                  }
                  midiLearnEnabled={midiLearnEnabled}
                  isMidiArmed={armedMidiParam === 'delayTime'}
                  midiMapping={midiMappings.delayTime ?? null}
                  onMidiContextMenu={(e) => armParamForMidi('delayTime', e)}
                  onChange={(norm) =>
                    onChangeState((prev) => ({
                      ...prev,
                      syncMode: 'free',
                      delayTimeMs: Number((10 + norm * 1990).toFixed(1)),
                    }))
                  }
                />

                <RotaryEncoder
                  label="FEEDBACK"
                  unit="%"
                  size="sm"
                  clippingWarning={state.feedback > 0.95}
                  value={state.feedback / 1.1}
                  defaultValue={0.72 / 1.1}
                  centerDisplay={String(Math.round(state.feedback * 100))}
                  midiLearnEnabled={midiLearnEnabled}
                  isMidiArmed={armedMidiParam === 'feedback'}
                  midiMapping={midiMappings.feedback ?? null}
                  onMidiContextMenu={(e) => armParamForMidi('feedback', e)}
                  onChange={(v) =>
                    onChangeState((prev) => ({
                      ...prev,
                      feedback: Number((v * 1.1).toFixed(2)),
                    }))
                  }
                />

                <RotaryEncoder
                  label="MOD RATE"
                  unit="Hz"
                  size="sm"
                  value={logToNorm(state.modRateHz, 0.05, 10)}
                  defaultValue={logToNorm(1.0, 0.05, 10)}
                  centerDisplay={state.modRateHz.toFixed(1)}
                  midiLearnEnabled={midiLearnEnabled}
                  isMidiArmed={armedMidiParam === 'modRate'}
                  midiMapping={midiMappings.modRate ?? null}
                  onMidiContextMenu={(e) => armParamForMidi('modRate', e)}
                  onChange={(v) =>
                    onChangeState((prev) => ({
                      ...prev,
                      modRateHz: Number(normToLog(v, 0.05, 10).toFixed(2)),
                    }))
                  }
                />

                <RotaryEncoder
                  label="MOD AMT"
                  unit="%"
                  size="sm"
                  value={state.modAmt}
                  defaultValue={0.24}
                  centerDisplay={String(Math.round(state.modAmt * 100))}
                  midiLearnEnabled={midiLearnEnabled}
                  isMidiArmed={armedMidiParam === 'modAmt'}
                  midiMapping={midiMappings.modAmt ?? null}
                  onMidiContextMenu={(e) => armParamForMidi('modAmt', e)}
                  onChange={(v) =>
                    onChangeState((prev) => ({ ...prev, modAmt: Number(v.toFixed(2)) }))
                  }
                />
              </div>
            </div>

            {/* Right: 6×2 TIMEBASE Matrix */}
            <div
              onContextMenu={(e) => armParamForMidi('timebase', e)}
              title={
                midiLearnEnabled
                  ? 'Right-click to map TIMEBASE to MIDI CC'
                  : midiMappings.timebase
                  ? `TIMEBASE · MIDI CC #${midiMappings.timebase.cc} (Ch ${midiMappings.timebase.channel})`
                  : undefined
              }
              className={`relative pl-3.5 border-l border-[#22252A] rounded-[4px] transition-all ${
                midiLearnEnabled ? 'cursor-context-menu ring-1 ring-[#3AE39E]/35 p-1.5 -m-1.5' : ''
              }`}
              style={{
                boxShadow:
                  armedMidiParam === 'timebase'
                    ? '0 0 14px rgba(34, 229, 94, 0.35), inset 0 0 0 1px #22E55E'
                    : undefined,
              }}
            >
              {midiMappings.timebase && (
                <span className="pointer-events-none absolute -top-1.5 right-0 px-1 rounded-[2px] bg-[#0B0D10] border border-[#22E55E]/60 font-mono text-[7px] text-[#3AE39E] tabular-nums">
                  CC{midiMappings.timebase.cc}
                </span>
              )}
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-mono text-[9.5px] font-semibold tracking-[0.14em] text-slate-400 uppercase">
                  TIMEBASE · SYNC
                </span>
                <span
                  className="font-mono text-[9.5px] tabular-nums"
                  style={{ color: state.syncMode === 'sync' ? c.accentGreen : '#64748B' }}
                >
                  {state.syncMode === 'sync' ? state.timebaseId : 'FREE'}
                </span>
              </div>
              <div className="grid grid-cols-6 gap-1.5">
                {TIMEBASE_RATES.map((rate) => {
                  const active = state.syncMode === 'sync' && state.timebaseId === rate.id;
                  return (
                    <button
                      key={rate.id}
                      type="button"
                      onClick={() =>
                        onChangeState((prev) => ({
                          ...prev,
                          syncMode: 'sync',
                          timebaseId: rate.id,
                          delayTimeMs: computeSyncedDelayMs(prev.bpm, rate.id),
                        }))
                      }
                      className="w-[41px] h-[27px] rounded-[4px] font-mono text-[10px] font-medium tabular-nums transition-colors cursor-pointer"
                      style={{
                        backgroundColor: active ? c.accentGreenSoft : '#0D0E10',
                        color: active ? c.accentGreen : state.syncMode === 'free' ? '#64748B' : '#9CA3AF',
                        boxShadow: active
                          ? `inset 0 0 0 1px ${c.accentGreen}`
                          : 'inset 0 0 0 1px #24272B',
                      }}
                    >
                      {rate.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 3. BOTTOM ROW: CHARACTER, WIDTH, FILTERS, DUCKER (TARGET + EXT SC + AMT + REL), OUT & MIX */}
          <div className="rounded-[8px] vektor-subpanel border border-[#24272A] px-4 py-3 flex items-center gap-3">
            {/* Left Ducker Controls Column */}
            <div className="w-[104px] flex flex-col items-stretch gap-1.5 pr-3 border-r border-[#22252A] shrink-0">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[9.5px] font-semibold tracking-[0.14em] text-slate-300 uppercase">
                  DUCKER
                </span>
                <span className="font-mono text-[8.5px] text-[#3AE39E] tabular-nums">
                  {Math.round(state.duckAmt * 100)}%
                </span>
              </div>

              {/* TARGET: POST | FB | BOTH */}
              <div className="h-[24px] p-[2px] rounded-[4px] bg-[#0B0C0E] border border-[#25282C] grid grid-cols-3">
                {(['post', 'fb', 'both'] as DuckerTarget[]).map((tgt) => {
                  const active = state.duckerTarget === tgt;
                  return (
                    <button
                      key={tgt}
                      type="button"
                      onClick={() => onChangeState((prev) => ({ ...prev, duckerTarget: tgt }))}
                      className="rounded-[2px] font-mono text-[7.5px] font-semibold uppercase tracking-wider transition-colors cursor-pointer"
                      style={{
                        backgroundColor: active ? c.accentGreenSoft : 'transparent',
                        color: active ? c.accentGreen : '#6B7280',
                      }}
                    >
                      {tgt}
                    </button>
                  );
                })}
              </div>

              {/* EXT SC Toggle */}
              <button
                type="button"
                aria-pressed={state.extSidechain}
                onClick={() =>
                  onChangeState((prev) => ({ ...prev, extSidechain: !prev.extSidechain }))
                }
                title="Trigger ducking compressor from external sidechain input"
                className="h-[24px] px-2 rounded-[4px] border flex items-center justify-center gap-1.5 font-mono text-[8.5px] font-semibold tracking-wider uppercase transition-all cursor-pointer"
                style={{
                  backgroundColor: state.extSidechain ? c.accentMintSoft : '#0B0C0E',
                  borderColor: state.extSidechain ? c.accentMint : '#25282C',
                  color: state.extSidechain ? c.accentMint : '#6B7280',
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{
                    backgroundColor: state.extSidechain ? c.accentMint : '#374151',
                    boxShadow: state.extSidechain ? `0 0 6px ${c.accentMint}` : 'none',
                  }}
                />
                EXT SC
              </button>
            </div>

            {/* 8 Encoders: CHARACTER/PITCH, WIDTH, LOW CUT, HIGH CUT, DUCK AMT, DUCK REL, OUT, MIX */}
            <div className="flex-1 grid grid-cols-8 gap-1.5 items-center">
              <RotaryEncoder
                label={activeModeMeta.characterLabel}
                unit={activeModeMeta.characterUnit}
                size="sm"
                bipolar={Boolean(activeModeMeta.isPitchBipolar)}
                value={
                  activeModeMeta.isPitchBipolar
                    ? (state.pitchSemitones + 12) / 24
                    : state.characterVal
                }
                defaultValue={activeModeMeta.isPitchBipolar ? 0.5 : 0.42}
                centerDisplay={
                  activeModeMeta.isPitchBipolar
                    ? `${state.pitchSemitones > 0 ? '+' : ''}${Math.round(state.pitchSemitones)}`
                    : String(Math.round(state.characterVal * 100))
                }
                midiLearnEnabled={midiLearnEnabled}
                isMidiArmed={armedMidiParam === 'character'}
                midiMapping={midiMappings.character ?? null}
                onMidiContextMenu={(e) => armParamForMidi('character', e)}
                onChange={(v) =>
                  onChangeState((prev) =>
                    activeModeMeta.isPitchBipolar
                      ? { ...prev, pitchSemitones: Math.round(-12 + v * 24) }
                      : { ...prev, characterVal: Number(v.toFixed(2)) }
                  )
                }
              />

              <RotaryEncoder
                label="WIDTH"
                unit="%"
                size="sm"
                value={state.width / 2}
                defaultValue={0.5}
                centerDisplay={String(Math.round(state.width * 100))}
                midiLearnEnabled={midiLearnEnabled}
                isMidiArmed={armedMidiParam === 'width'}
                midiMapping={midiMappings.width ?? null}
                onMidiContextMenu={(e) => armParamForMidi('width', e)}
                onChange={(v) =>
                  onChangeState((prev) => ({ ...prev, width: Number((v * 2).toFixed(2)) }))
                }
              />

              <RotaryEncoder
                label="LOW CUT"
                unit="Hz"
                size="sm"
                value={logToNorm(state.lowCutHz, 20, 1200)}
                defaultValue={logToNorm(70, 20, 1200)}
                centerDisplay={formatHz(state.lowCutHz)}
                midiLearnEnabled={midiLearnEnabled}
                isMidiArmed={armedMidiParam === 'lowCut'}
                midiMapping={midiMappings.lowCut ?? null}
                onMidiContextMenu={(e) => armParamForMidi('lowCut', e)}
                onChange={(v) =>
                  onChangeState((prev) => ({
                    ...prev,
                    lowCutHz: Math.round(normToLog(v, 20, 1200)),
                  }))
                }
              />

              <RotaryEncoder
                label="HIGH CUT"
                unit="Hz"
                size="sm"
                value={logToNorm(state.highCutHz, 800, 20000)}
                defaultValue={logToNorm(10700, 800, 20000)}
                centerDisplay={formatHz(state.highCutHz)}
                midiLearnEnabled={midiLearnEnabled}
                isMidiArmed={armedMidiParam === 'highCut'}
                midiMapping={midiMappings.highCut ?? null}
                onMidiContextMenu={(e) => armParamForMidi('highCut', e)}
                onChange={(v) =>
                  onChangeState((prev) => ({
                    ...prev,
                    highCutHz: Math.round(normToLog(v, 800, 20000)),
                  }))
                }
              />

              <RotaryEncoder
                label="DUCK AMT"
                unit="%"
                size="sm"
                value={state.duckAmt}
                defaultValue={0.46}
                centerDisplay={String(Math.round(state.duckAmt * 100))}
                midiLearnEnabled={midiLearnEnabled}
                isMidiArmed={armedMidiParam === 'duckAmt'}
                midiMapping={midiMappings.duckAmt ?? null}
                onMidiContextMenu={(e) => armParamForMidi('duckAmt', e)}
                onChange={(v) =>
                  onChangeState((prev) => ({ ...prev, duckAmt: Number(v.toFixed(2)) }))
                }
              />

              <RotaryEncoder
                label="DUCK REL"
                unit="%"
                size="sm"
                value={state.duckRelease}
                defaultValue={0.5}
                centerDisplay={String(Math.round(state.duckRelease * 100))}
                midiLearnEnabled={midiLearnEnabled}
                isMidiArmed={armedMidiParam === 'duckRel'}
                midiMapping={midiMappings.duckRel ?? null}
                onMidiContextMenu={(e) => armParamForMidi('duckRel', e)}
                onChange={(v) =>
                  onChangeState((prev) => ({ ...prev, duckRelease: Number(v.toFixed(2)) }))
                }
              />

              <RotaryEncoder
                label="OUT"
                unit="dB"
                size="sm"
                bipolar
                clippingWarning={state.outTrimDb > 0}
                value={(state.outTrimDb + 12) / 24}
                defaultValue={0.5}
                centerDisplay={
                  state.outTrimDb > 0
                    ? `+${state.outTrimDb.toFixed(1)}`
                    : state.outTrimDb.toFixed(1)
                }
                midiLearnEnabled={midiLearnEnabled}
                isMidiArmed={armedMidiParam === 'outTrimDb'}
                midiMapping={midiMappings.outTrimDb ?? null}
                onMidiContextMenu={(e) => armParamForMidi('outTrimDb', e)}
                onChange={(v) =>
                  onChangeState((prev) => ({
                    ...prev,
                    outTrimDb: Number((-12 + v * 24).toFixed(1)),
                  }))
                }
              />

              <RotaryEncoder
                label="MIX"
                unit="%"
                size="sm"
                value={state.mix}
                defaultValue={0.5}
                centerDisplay={String(Math.round(state.mix * 100))}
                midiLearnEnabled={midiLearnEnabled}
                isMidiArmed={armedMidiParam === 'mix'}
                midiMapping={midiMappings.mix ?? null}
                onMidiContextMenu={(e) => armParamForMidi('mix', e)}
                onChange={(v) => onChangeState((prev) => ({ ...prev, mix: Number(v.toFixed(2)) }))}
              />
            </div>
          </div>
        </div>

        {/* ======================== RIGHT STEREO I/O VU METER BAY ======================== */}
        <div className="rounded-[8px] vektor-subpanel border border-[#24272A] p-2.5 flex flex-col">
          <StereoVuMeterCanvas
            delayMode={state.delayMode}
            patternMode={state.patternMode}
            dualRouting={state.dualRouting}
            seqSteps={state.seqSteps}
            seqStepCount={state.seqStepCount}
            bpm={state.bpm}
            effectiveDelayMs={effectiveDelayMs}
            feedback={state.feedback}
            modAmt={state.modAmt}
            characterVal={state.characterVal}
            width={state.width}
            duckAmt={state.duckAmt}
            duckRelease={state.duckRelease}
            duckerTarget={state.duckerTarget}
            lowCutHz={state.lowCutHz}
            highCutHz={state.highCutHz}
            outTrimDb={state.outTrimDb}
            mix={state.mix}
            freeze={state.freeze}
            bypassed={state.bypassed}
            isPlaying={isPlaying}
            testToneTriggerCount={testToneTriggerCount}
          />
        </div>
      </div>

      {/* Visual Confirmation Overlay when MIDI Learn mapping is active or just bound */}
      <AnimatePresence>
        {(armedMidiParam || confirmedMidiMapping) && (
          <MidiLearnOverlay
            armedParam={armedMidiParam}
            confirmedMapping={confirmedMidiMapping}
            existingMapping={armedMidiParam ? midiMappings[armedMidiParam] ?? null : null}
            webMidiStatus={webMidiStatus}
            midiDeviceNames={midiDeviceNames}
            onSimulateCcBind={(cc, ch = 1) => {
              if (armedMidiParam) {
                bindCcToParam(armedMidiParam, cc, ch);
              }
            }}
            onUnmapArmed={() => {
              if (!armedMidiParam) return;
              const next = { ...midiMappings };
              delete next[armedMidiParam];
              persistMidiMappings(next);
              onNotify(`Removed MIDI mapping for ${MIDI_PARAM_META[armedMidiParam].label}`);
              setArmedMidiParam(null);
            }}
            onCancel={() => {
              setArmedMidiParam(null);
              setConfirmedMidiMapping(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

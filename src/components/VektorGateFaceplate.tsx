import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Power,
  Shuffle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Undo2,
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
  SIGNAL_MODES,
  SPEED_RATES,
  GATE_PRESETS,
} from '../data/vektorGateData';
import { SignalWaveformSvg, evaluateSignalShape } from './SignalWaveformSvg';
import { RotaryEncoder } from './RotaryEncoder';
import { VektorScopeAudioCanvas } from './VektorScopeAudioCanvas';
import { StereoVuMeterCanvas } from './StereoVuMeterCanvas';
import {
  AutomationLanesView,
  AutomationLanesState,
  createDefaultAutomationLanes,
} from './AutomationLanesView';
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
  stepCount: number;
  levels: number[];
  modes: number[];
  enabledSteps: boolean[];
  activeSignalMode: number;
  speedId: string;
  viewMode: 'bars' | 'curve' | 'auto';
  smooth: number;
  envTime: number;
  swing: number;
  floor: number;
  depth: number;
  releaseMs: number;
  outTrimDb: number;
  mix: number;
  insertMode: InsertMode;
}

interface VektorGateFaceplateProps {
  state: FaceplateState;
  slotBState: FaceplateState;
  onChangeState: React.Dispatch<React.SetStateAction<FaceplateState>>;
  onSwitchSlot: (slot: 'A' | 'B') => void;
  onReset: () => void;
  isPlaying: boolean;
  activePlayheadStep: number;
  onNotify: (msg: string) => void;
}

const CornerScrew: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg viewBox="0 0 12 12" className={`w-2.5 h-2.5 pointer-events-none ${className}`} aria-hidden="true">
    <circle cx="6" cy="6" r="5" fill="#1C1F23" stroke="#0A0B0D" strokeWidth="1" />
    <line x1="3.5" y1="6" x2="8.5" y2="6" stroke="#0D0F12" strokeWidth="1.2" />
    <line x1="6" y1="3.5" x2="6" y2="8.5" stroke="#0D0F12" strokeWidth="1.2" />
  </svg>
);

const PresetPatternSparkbar: React.FC<{
  levels: number[];
  enabledSteps: boolean[];
  stepCount: number;
  active?: boolean;
}> = ({ levels, enabledSteps, stepCount, active = false }) => {
  const sampleCount = 16;
  const stride = Math.max(1, Math.floor(Math.min(32, stepCount) / sampleCount));
  return (
    <div
      className="w-[46px] h-[15px] px-[2px] py-[2px] rounded-[3px] bg-[#08090B] border border-[#1E2228] flex items-end gap-[1px] shrink-0"
      aria-hidden="true"
    >
      {Array.from({ length: sampleCount }).map((_, i) => {
        const stepIdx = (i * stride) % Math.max(2, stepCount);
        const isEnabled = enabledSteps[stepIdx] ?? true;
        const lvl = isEnabled ? levels[stepIdx] ?? 0.5 : 0.14;
        return (
          <span
            key={i}
            className="flex-1 rounded-[0.5px]"
            style={{
              height: `${Math.max(18, Math.round(lvl * 100))}%`,
              backgroundColor: !isEnabled
                ? '#262A30'
                : active
                ? '#4ADE80'
                : 'rgba(34, 229, 94, 0.58)',
            }}
          />
        );
      })}
    </div>
  );
};

const USER_PRESETS_STORAGE_KEY = 'vektorgate_user_presets_v1';

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

const defaultEnabledSteps = (): boolean[] => Array.from({ length: 32 }, () => true);

function readStoredUserPresets(): UserPresetEntry[] {
  try {
    const raw = window.localStorage.getItem(USER_PRESETS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => ({
      ...item,
      category: PRESET_CATEGORIES.includes(item?.category) ? item.category : 'Rhythmic',
      state: {
        ...item.state,
        enabledSteps: Array.isArray(item?.state?.enabledSteps)
          ? item.state.enabledSteps
          : defaultEnabledSteps(),
      },
    }));
  } catch {
    return [];
  }
}

export const VektorGateFaceplate: React.FC<VektorGateFaceplateProps> = ({
  state,
  onChangeState,
  onSwitchSlot,
  onReset,
  isPlaying,
  activePlayheadStep,
  onNotify,
}) => {
  const [showPresetMenu, setShowPresetMenu] = useState(false);
  const [userPresets, setUserPresets] = useState<UserPresetEntry[]>(() => readStoredUserPresets());
  const [userPresetInput, setUserPresetInput] = useState('');
  const [presetSearch, setPresetSearch] = useState('');
  const [saveCategory, setSaveCategory] = useState<UserPresetCategory>('Rhythmic');
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<PresetFilter>('All');
  const [activeUserPresetId, setActiveUserPresetId] = useState<string | null>(null);
  const [renamingTarget, setRenamingTarget] = useState<'loaded' | string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [isPaintingBars, setIsPaintingBars] = useState(false);
  const [hoveredStep, setHoveredStep] = useState<number | null>(null);
  const [flashedStep, setFlashedStep] = useState<number | null>(null);
  const [automationLanes, setAutomationLanes] = useState<AutomationLanesState>(() =>
    createDefaultAutomationLanes()
  );
  const [autoSimActive, setAutoSimActive] = useState(true);
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

  const flashTimerRef = useRef<number | null>(null);
  const midiConfirmTimerRef = useRef<number | null>(null);
  const sequencerRef = useRef<HTMLDivElement>(null);
  const presetMenuRef = useRef<HTMLDivElement>(null);
  const settingsMenuRef = useRef<HTMLDivElement>(null);
  const presetInputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const armedMidiParamRef = useRef<MidiParamId | null>(null);
  const midiMappingsRef = useRef(midiMappings);

  armedMidiParamRef.current = armedMidiParam;
  midiMappingsRef.current = midiMappings;

  const c = VEKTOR_TREM_COLORS;

  useEffect(() => {
    const handlePointerUp = () => setIsPaintingBars(false);
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
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('mousedown', handleMouseDownOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('mousedown', handleMouseDownOutside);
      window.removeEventListener('keydown', handleKeyDown);
      if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
      if (midiConfirmTimerRef.current) window.clearTimeout(midiConfirmTimerRef.current);
    };
  }, []);

  const persistMidiMappings = (next: Partial<Record<MidiParamId, MidiMappingEntry>>) => {
    setMidiMappings(next);
    try {
      window.localStorage.setItem(MIDI_MAPPINGS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage quota errors cleanly
    }
  };

  const applyMidiValueToParam = (paramId: MidiParamId, ccVal: number) => {
    const norm = Math.min(1, Math.max(0, ccVal / 127));
    onChangeState((prev) => {
      switch (paramId) {
        case 'bpm':
          return { ...prev, bpm: Math.round(40 + norm * 200) };
        case 'steps':
          return { ...prev, stepCount: Math.round(2 + norm * 30) };
        case 'smooth':
          return { ...prev, smooth: Number(norm.toFixed(2)) };
        case 'envTime':
          return { ...prev, envTime: Number((0.1 + norm * 0.9).toFixed(2)) };
        case 'swing':
          return { ...prev, swing: Number(norm.toFixed(2)) };
        case 'timebase': {
          const idx = Math.min(SPEED_RATES.length - 1, Math.floor(norm * SPEED_RATES.length));
          return { ...prev, speedId: SPEED_RATES[idx]?.id ?? prev.speedId };
        }
        case 'depth':
          return { ...prev, depth: Number(norm.toFixed(2)) };
        case 'releaseMs':
          return { ...prev, releaseMs: Number((1 + norm * 99).toFixed(2)) };
        case 'outTrimDb':
          return { ...prev, outTrimDb: Number((-12 + norm * 24).toFixed(2)) };
        case 'mix':
          return { ...prev, mix: Number(norm.toFixed(2)) };
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
    if ((status & 0xf0) !== 0xb0) return; // MIDI Control Change only

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
        inputs: { forEach: (cb: (input: { name?: string; onmidimessage: ((ev: { data: Uint8Array | null }) => void) | null }) => void) => void };
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
      // Ignore storage quota issues safely
    }
  };

  // Detect any parameter modification vs the active Factory or User baseline preset
  const isPresetModified = useMemo(() => {
    if (state.presetName === 'Vektor Random') return true;
    const activeUser = activeUserPresetId
      ? userPresets.find((u) => u.id === activeUserPresetId)
      : null;
    const baseline = activeUser
      ? activeUser.state
      : GATE_PRESETS[state.presetIndex] ?? GATE_PRESETS[0];

    if (!baseline) return false;
    if (state.stepCount !== baseline.stepCount) return true;
    if (state.speedId !== baseline.speedId) return true;
    if (Math.abs(state.smooth - baseline.smooth) > 0.005) return true;
    if (Math.abs(state.envTime - baseline.envTime) > 0.005) return true;
    if (Math.abs(state.swing - baseline.swing) > 0.005) return true;
    if (Math.abs(state.depth - baseline.depth) > 0.005) return true;
    if (Math.abs(state.releaseMs - baseline.releaseMs) > 0.05) return true;
    if (Math.abs(state.outTrimDb - baseline.outTrimDb) > 0.05) return true;
    if (Math.abs(state.mix - baseline.mix) > 0.005) return true;

    for (let i = 0; i < 32; i++) {
      if (Math.abs((state.levels[i] ?? 0) - (baseline.levels[i] ?? 0)) > 0.005) return true;
      if ((state.modes[i] ?? 0) !== (baseline.modes[i] ?? 0)) return true;
      if ((state.enabledSteps[i] ?? true) !== (baseline.enabledSteps[i] ?? true)) return true;
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
        ? `User Gate ${String(userPresets.length + 1).padStart(2, '0')}`
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
        levels: [...stateSnapshot.levels],
        modes: [...stateSnapshot.modes],
        enabledSteps: [...stateSnapshot.enabledSteps],
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
        // Currently loaded preset is a Default/Factory preset: save a custom-named User copy and load it
        const { activeSlot: _omitSlot, ...stateSnapshot } = state;
        const entry: UserPresetEntry = {
          id: `up_${Date.now()}`,
          name: nextName,
          category: saveCategory,
          savedAt: new Date().toLocaleDateString('en-US', { day: '2-digit', month: 'short' }),
          state: {
            ...stateSnapshot,
            presetName: nextName,
            levels: [...stateSnapshot.levels],
            modes: [...stateSnapshot.modes],
            enabledSteps: [...stateSnapshot.enabledSteps],
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
    return GATE_PRESETS.map((preset, index) => ({ preset, index })).filter(({ preset }) => {
      const matchesCat =
        activeCategoryFilter === 'All' || preset.category === activeCategoryFilter;
      const matchesSearch =
        !normalizedSearch ||
        preset.name.toLowerCase().includes(normalizedSearch) ||
        preset.speedId.toLowerCase().includes(normalizedSearch) ||
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
        item.state.speedId.toLowerCase().includes(normalizedSearch) ||
        item.category.toLowerCase().includes(normalizedSearch);
      return matchesCat && matchesSearch;
    });
  }, [userPresets, activeCategoryFilter, normalizedSearch]);

  const handleLoadUserPreset = (entry: UserPresetEntry) => {
    onChangeState((prev) => ({
      ...entry.state,
      activeSlot: prev.activeSlot,
      levels: [...entry.state.levels],
      modes: [...entry.state.modes],
      enabledSteps: Array.isArray(entry.state.enabledSteps)
        ? [...entry.state.enabledSteps]
        : defaultEnabledSteps(),
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
      ...GATE_PRESETS.map((_, index) => ({ kind: 'factory' as const, index })),
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
      onNotify(`Preset "${GATE_PRESETS[target.index].name}" loaded`);
    }
  };

  const triggerStepFlash = (stepIdx: number) => {
    setFlashedStep(stepIdx);
    if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
    flashTimerRef.current = window.setTimeout(() => {
      setFlashedStep(null);
    }, 260);
  };

  const toggleStepEnabled = (stepIdx: number) => {
    onChangeState((prev) => {
      const nextEnabled = [...prev.enabledSteps];
      const willEnable = !nextEnabled[stepIdx];
      nextEnabled[stepIdx] = willEnable;
      if (willEnable) {
        triggerStepFlash(stepIdx);
      }
      return {
        ...prev,
        enabledSteps: nextEnabled,
      };
    });
  };

  const updateBarFromPointer = (clientX: number, clientY: number, container: HTMLElement) => {
    const rect = container.getBoundingClientRect();
    const relX = Math.min(Math.max(0, clientX - rect.left), rect.width - 1);
    const relY = Math.min(Math.max(0, clientY - rect.top), rect.height);
    const stepIndex = Math.min(31, Math.max(0, Math.floor((relX / rect.width) * 32)));
    const level = Math.min(1, Math.max(0.04, 1 - relY / rect.height));

    setHoveredStep(stepIndex);
    triggerStepFlash(stepIndex);
    onChangeState((prev) => {
      const nextLevels = [...prev.levels];
      nextLevels[stepIndex] = Number(level.toFixed(2));
      return {
        ...prev,
        levels: nextLevels,
      };
    });
  };

  const loadPreset = (index: number) => {
    const safeIdx = (index + GATE_PRESETS.length) % GATE_PRESETS.length;
    const p = GATE_PRESETS[safeIdx];
    onChangeState((prev) => ({
      ...prev,
      presetIndex: safeIdx,
      presetName: p.name,
      stepCount: p.stepCount,
      speedId: p.speedId,
      levels: [...p.levels],
      modes: [...p.modes],
      enabledSteps: [...p.enabledSteps],
      smooth: p.smooth,
      envTime: p.envTime,
      swing: p.swing,
      floor: p.floor,
      depth: p.depth,
      releaseMs: p.releaseMs,
      outTrimDb: p.outTrimDb,
      mix: p.mix,
    }));
    setSaveCategory(p.category);
    setShowPresetMenu(false);
  };

  const handleRandomize = () => {
    const stepOptions = [8, 12, 16, 24, 32];
    const nextSteps = stepOptions[Math.floor(Math.random() * stepOptions.length)];
    const nextLevels = Array.from({ length: 32 }, (_, i) => {
      if (i % 4 === 0) return Number((0.78 + Math.random() * 0.22).toFixed(2));
      return Number((0.15 + Math.random() * 0.85).toFixed(2));
    });
    const nextModes = Array.from({ length: 32 }, () => Math.floor(Math.random() * 7));
    const nextEnabled = Array.from({ length: 32 }, (_, i) =>
      i % 4 === 0 ? true : Math.random() > 0.18
    );

    onChangeState((prev) => ({
      ...prev,
      presetName: 'Vektor Random',
      stepCount: nextSteps,
      levels: nextLevels,
      modes: nextModes,
      enabledSteps: nextEnabled,
    }));
    onNotify('Random sequence generated on faceplate');
  };

  const applyModeToAllSteps = () => {
    onChangeState((prev) => ({
      ...prev,
      modes: prev.modes.map(() => prev.activeSignalMode),
    }));
    onNotify(`${SIGNAL_MODES[state.activeSignalMode].code} envelope applied to all 32 steps`);
  };

  const invertPattern = () => {
    onChangeState((prev) => ({
      ...prev,
      levels: prev.levels.map((l) => Number(Math.max(0.05, 1.05 - l).toFixed(2))),
    }));
  };

  const activeRateObj =
    SPEED_RATES.find((r) => r.id === state.speedId) ?? SPEED_RATES[8];
  const stepDurationMs = Math.round((60000 / state.bpm) * activeRateObj.beatsPerStep);

  // Dual continuous envelope curves rendered ONLY inside the dedicated SCOPE view
  const { primaryCurvePath, primaryFillPath, smoothedCurvePath } = useMemo(() => {
    const svgW = 960;
    const svgH = 220;
    const samplesPerStep = 8;
    const totalSamples = 32 * samplesPerStep;

    const rawPoints: number[] = [];
    for (let s = 0; s <= totalSamples; s++) {
      const stepFloat = Math.min(31.999, (s / totalSamples) * 32);
      const stepIdx = Math.floor(stepFloat);
      const frac = stepFloat - stepIdx;

      const stepEnabled = state.enabledSteps[stepIdx] ?? true;
      const stepLevel = stepEnabled ? (state.levels[stepIdx] ?? 0.5) : 0;
      const modeId = state.modes[stepIdx] ?? 0;

      const shapedFrac = Math.min(1, frac / Math.max(0.25, state.envTime));
      const shapeVal =
        frac / Math.max(0.25, state.envTime) > 1 && (modeId === 1 || modeId === 2)
          ? 0.04
          : evaluateSignalShape(modeId, modeId === 1 || modeId === 2 ? shapedFrac : frac);

      const effectiveLevel = stepEnabled
        ? state.floor + (1 - state.floor) * (stepLevel * shapeVal * state.depth)
        : 0.02;
      rawPoints.push(Math.min(1, Math.max(0.02, effectiveLevel)));
    }

    const smoothRadius = Math.max(1, Math.round(state.smooth * 10));
    const smoothedPoints = rawPoints.map((_, idx) => {
      let acc = 0;
      let cnt = 0;
      for (let k = -smoothRadius; k <= smoothRadius; k++) {
        const j = Math.min(rawPoints.length - 1, Math.max(0, idx + k));
        acc += rawPoints[j];
        cnt++;
      }
      return acc / cnt;
    });

    const toCoords = (arr: number[]) =>
      arr.map((val, i) => {
        const x = ((i / totalSamples) * svgW).toFixed(1);
        const y = (svgH - 4 - val * (svgH - 12)).toFixed(1);
        return `${x},${y}`;
      });

    const pCoords = toCoords(rawPoints);
    const sCoords = toCoords(smoothedPoints);

    return {
      primaryCurvePath: `M ${pCoords.join(' L ')}`,
      primaryFillPath: `M 0,${svgH} L ${pCoords.join(' L ')} L ${svgW},${svgH} Z`,
      smoothedCurvePath: `M ${sCoords.join(' L ')}`,
    };
  }, [state.levels, state.modes, state.enabledSteps, state.envTime, state.floor, state.depth, state.smooth]);

  const currentStepInfo = hoveredStep !== null ? hoveredStep : isPlaying ? activePlayheadStep : 0;

  return (
    <div
      className="relative w-[1040px] select-none rounded-[10px] vektor-chassis text-slate-100 border border-[#25282C]"
      style={{
        boxShadow: '0 30px 80px rgba(0, 0, 0, 0.85), inset 0 1px 0 rgba(255, 255, 255, 0.06)',
      }}
    >
      {/* 4 VektorTrem corner screws */}
      <CornerScrew className="absolute top-2.5 left-2.5" />
      <CornerScrew className="absolute top-2.5 right-2.5" />
      <CornerScrew className="absolute bottom-2.5 left-2.5" />
      <CornerScrew className="absolute bottom-2.5 right-2.5" />

      {/* ======================== TOP HEADER BAR ======================== */}
      <div className="h-[54px] px-5 flex items-center justify-between border-b border-[#222528]">
        {/* Left: Glowing Power Button + VEKTORGATE Wordmark */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onChangeState((prev) => ({ ...prev, bypassed: !prev.bypassed }))}
            title={state.bypassed ? 'Enable Gate processing' : 'Bypass Gate'}
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
            VEKTOR<span style={{ color: state.bypassed ? '#6B7280' : c.accentGreen }}>GATE</span>
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

        {/* Right: RANDOM + Unified Preset Browser & Save + A/B + BYPASS + Reset */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleRandomize}
            className="h-7 px-2.5 rounded-[5px] bg-[#1A1D21] border border-[#2B2E33] hover:border-[#3E434B] text-[9.5px] font-mono font-medium tracking-[0.1em] text-slate-200 flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Generate random pattern"
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

              {/* Inline Save icon button: enabled whenever the active preset is modified */}
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
                        title={
                          canSavePreset
                            ? 'Save current preset to localStorage'
                            : 'Modify the current preset or enter a name to save'
                        }
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

                  {/* 3. Instant Search + Clean 5-Column Category Tabs (Zero horizontal scrollbar) */}
                  <div className="px-2.5 pt-2 pb-1.5 border-b border-[#1E2228] bg-[#101216] space-y-1.5">
                    <div className="relative flex items-center">
                      <Search className="w-3 h-3 text-slate-500 absolute left-2 pointer-events-none" />
                      <input
                        type="text"
                        value={presetSearch}
                        onChange={(e) => setPresetSearch(e.target.value)}
                        placeholder="Search presets or division (1/16, Bass...)"
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
                            ? GATE_PRESETS.length + userPresets.length
                            : GATE_PRESETS.filter((p) => p.category === filter).length +
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

                  {/* 4. Dark-Themed Scrollable Unified Preset List with Pattern Mini-Previews */}
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
                              <PresetPatternSparkbar
                                levels={entry.state.levels}
                                enabledSteps={entry.state.enabledSteps}
                                stepCount={entry.state.stepCount}
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
                                      {entry.category} · {entry.state.speedId} · {entry.state.stepCount} st · {entry.savedAt}
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
                              <PresetPatternSparkbar
                                levels={p.levels}
                                enabledSteps={p.enabledSteps}
                                stepCount={p.stepCount}
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
                                  {p.category} · {p.speedId} · {p.stepCount} st
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

          {/* Dedicated BYPASS button with Orange LED indicator */}
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
                    : 'Gate active (processed signal)'
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

          {/* Settings Menu (MIDI Learn Mode Toggle & Active Mappings) */}
          <div ref={settingsMenuRef} className="relative">
            <button
              type="button"
              onClick={() => {
                setShowPresetMenu(false);
                setShowSettingsMenu((v) => !v);
              }}
              aria-expanded={showSettingsMenu}
              aria-label="Open plugin settings and MIDI Learn menu"
              title={
                midiLearnEnabled
                  ? 'Settings (MIDI Learn Active)'
                  : 'Settings & MIDI Learn'
              }
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

      {/* Floating Active MIDI Learn Mode Guide Strip (zero layout shift) */}
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
          {/* 1. 32-STEP GATE SEQUENCER / DEDICATED SCOPE */}
          <div className="rounded-[8px] vektor-subpanel border border-[#24272A] p-3.5 flex flex-col gap-2.5">
            {/* Top Toolbar: [ BARS | SCOPE | AUTO ] + [ INVERT ] + [ Live Mini Audio Scope ] + [ 7 Signal Shapes ] */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 shrink-0">
                <div className="h-7 p-[2px] rounded-[5px] bg-[#0B0C0E] border border-[#24272A] flex items-center">
                  <button
                    type="button"
                    onClick={() => onChangeState((prev) => ({ ...prev, viewMode: 'bars' }))}
                    className="px-2 h-full rounded-[3px] font-mono text-[10px] font-semibold tracking-wider transition-colors cursor-pointer"
                    style={{
                      backgroundColor: state.viewMode === 'bars' ? c.accentGreenSoft : 'transparent',
                      color: state.viewMode === 'bars' ? c.accentGreen : '#6B7280',
                      boxShadow:
                        state.viewMode === 'bars' ? `inset 0 0 0 1px ${c.accentGreen}` : 'none',
                    }}
                  >
                    BARS
                  </button>
                  <button
                    type="button"
                    onClick={() => onChangeState((prev) => ({ ...prev, viewMode: 'curve' }))}
                    className="px-2 h-full rounded-[3px] font-mono text-[10px] font-semibold tracking-wider transition-colors cursor-pointer"
                    style={{
                      backgroundColor: state.viewMode === 'curve' ? c.accentGreenSoft : 'transparent',
                      color: state.viewMode === 'curve' ? c.accentGreen : '#6B7280',
                      boxShadow:
                        state.viewMode === 'curve' ? `inset 0 0 0 1px ${c.accentGreen}` : 'none',
                    }}
                  >
                    SCOPE
                  </button>
                  <button
                    type="button"
                    onClick={() => onChangeState((prev) => ({ ...prev, viewMode: 'auto' }))}
                    title="View & sketch simulated automation lanes for Smooth, Env, and Swing"
                    className="px-2 h-full rounded-[3px] font-mono text-[10px] font-semibold tracking-wider transition-colors cursor-pointer"
                    style={{
                      backgroundColor: state.viewMode === 'auto' ? c.accentGreenSoft : 'transparent',
                      color: state.viewMode === 'auto' ? c.accentGreen : '#6B7280',
                      boxShadow:
                        state.viewMode === 'auto' ? `inset 0 0 0 1px ${c.accentGreen}` : 'none',
                    }}
                  >
                    AUTO
                  </button>
                </div>

                <button
                  type="button"
                  onClick={invertPattern}
                  title="Invert pattern amplitudes"
                  className="h-7 px-2 rounded-[5px] bg-[#0E1012] border border-[#25282C] hover:border-[#3A3E45] font-mono text-[9.5px] text-slate-300 flex items-center gap-1 cursor-pointer"
                >
                  <Undo2 className="w-3 h-3 text-slate-400" />
                  INVERT
                </button>

                {/* Dedicated Compact Output Audio Scope monitor (separated from the bars!) */}
                <button
                  type="button"
                  onClick={() =>
                    onChangeState((prev) => ({
                      ...prev,
                      viewMode: prev.viewMode === 'bars' ? 'curve' : 'bars',
                    }))
                  }
                  title="Real-time audio waveform monitor (click to toggle full Scope view)"
                  className="relative h-7 w-[88px] rounded-[4px] bg-[#090A0C] border border-[#23262B] hover:border-[#343940] overflow-hidden flex items-center cursor-pointer"
                >
                  <VektorScopeAudioCanvas
                    levels={state.levels}
                    modes={state.modes}
                    enabledSteps={state.enabledSteps}
                    stepCount={state.stepCount}
                    bpm={state.bpm}
                    beatsPerStep={activeRateObj.beatsPerStep}
                    envTime={state.envTime}
                    smooth={state.smooth}
                    depth={state.depth}
                    mix={state.mix}
                    bypassed={state.bypassed}
                    isPlaying={isPlaying}
                    activePlayheadStep={activePlayheadStep}
                    compact
                  />
                  <span className="relative z-10 ml-1.5 px-1 rounded bg-[#090A0C]/75 font-mono text-[8px] tracking-wider text-slate-400 uppercase pointer-events-none">
                    OUT
                  </span>
                </button>
              </div>

              {/* 7 Signal Shape Brushes */}
              <div className="flex items-center gap-1 shrink-0">
                {SIGNAL_MODES.map((mode) => {
                  const isSelected = state.activeSignalMode === mode.id;
                  return (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() =>
                        onChangeState((prev) => ({ ...prev, activeSignalMode: mode.id }))
                      }
                      title={`${mode.label}: ${mode.description}`}
                      className="h-7 px-1.5 rounded-[4px] flex items-center gap-1 transition-colors cursor-pointer"
                      style={{
                        backgroundColor: isSelected ? c.accentGreenSoft : '#0B0C0E',
                        boxShadow: isSelected
                          ? `inset 0 0 0 1px ${c.accentGreen}`
                          : 'inset 0 0 0 1px #222529',
                      }}
                    >
                      <div className="w-3.5 h-3.5">
                        <SignalWaveformSvg
                          modeId={mode.id}
                          color={isSelected ? c.accentGreen : '#6B7280'}
                          compact
                          active={isSelected}
                        />
                      </div>
                      <span
                        className="font-mono text-[8.5px] font-medium tracking-wider"
                        style={{ color: isSelected ? c.accentGreenBright : '#9CA3AF' }}
                      >
                        {mode.code}
                      </span>
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={applyModeToAllSteps}
                  title="Apply selected shape to all 32 steps"
                  className="ml-0.5 h-7 px-2 rounded-[4px] bg-[#191C20] border border-[#2C3036] hover:border-[#40464F] font-mono text-[8.5px] text-slate-300 cursor-pointer"
                >
                  ALL 32
                </button>
              </div>
            </div>

          {/* FULL-WIDTH PURE-BLACK VEKTOR-SCOPE / SEQUENCER STAGE */}
          <div className="rounded-[6px] vektor-scope p-3 flex flex-col justify-between">
            {/* 32 Clickable Circular Step LED Indicators (On = bright green / Off = dim omitted) */}
            <div className="pl-7 grid grid-cols-[repeat(32,minmax(0,1fr))] gap-[4px] mb-1">
              {Array.from({ length: 32 }).map((_, idx) => {
                const isWithin = idx < state.stepCount;
                const isStepEnabled = state.enabledSteps[idx] ?? true;
                const stepLevel = state.levels[idx] ?? 0;
                const isOn = isWithin && isStepEnabled && stepLevel > 0.04;
                const isLiveHit = isPlaying && activePlayheadStep === idx && isOn && !state.bypassed;
                const isEditHit = flashedStep === idx && isOn && !state.bypassed;
                const isBlinking = isLiveHit || isEditHit;

                return (
                  <button
                    key={idx}
                    type="button"
                    aria-pressed={isStepEnabled}
                    onClick={() => toggleStepEnabled(idx)}
                    title={
                      isStepEnabled
                        ? `Step ${idx + 1}: Active (click to omit this step)`
                        : `Step ${idx + 1}: Omitted / Off (click to enable)`
                    }
                    className="flex items-center justify-center h-3.5 cursor-pointer group focus:outline-none"
                  >
                    <span className="w-2.5 h-2.5 rounded-full bg-[#07080A] border border-[#1E2228] group-hover:border-slate-500 transition-colors flex items-center justify-center">
                      <motion.span
                        className="block w-1.5 h-1.5 rounded-full"
                        animate={
                          isBlinking
                            ? {
                                scale: [1, 1.38, 1],
                                opacity: 1,
                                backgroundColor: '#86EFAC',
                                boxShadow: `0 0 8px ${c.accentGreen}`,
                              }
                            : isOn
                            ? {
                                scale: 1,
                                opacity: state.bypassed ? 0.45 : 1,
                                backgroundColor: c.accentGreen,
                                boxShadow: state.bypassed
                                  ? '0 0 0px rgba(0,0,0,0)'
                                  : `0 0 5px rgba(34, 229, 94, 0.55)`,
                              }
                            : {
                                scale: 1,
                                opacity: isWithin ? 0.55 : 0.25,
                                backgroundColor: '#1A7A3A',
                                boxShadow: '0 0 0px rgba(0,0,0,0)',
                              }
                        }
                        transition={{ duration: 0.15, ease: 'easeOut' }}
                      />
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Step Ruler (1..32) */}
            <div className="pl-7 grid grid-cols-[repeat(32,minmax(0,1fr))] gap-[4px] mb-1.5">
              {Array.from({ length: 32 }).map((_, idx) => {
                const stepNum = idx + 1;
                const active = stepNum <= state.stepCount;
                const isStepEnabled = state.enabledSteps[idx] ?? true;
                const isPlayhead = isPlaying && activePlayheadStep === idx;
                const isBeat = idx % 4 === 0;
                return (
                  <button
                    key={stepNum}
                    type="button"
                    onClick={() => {
                      if (stepNum >= 2) {
                        onChangeState((prev) => ({ ...prev, stepCount: stepNum }));
                      }
                    }}
                    title={stepNum >= 2 ? `Length: ${stepNum} steps` : 'Step 1'}
                    className="h-[17px] flex items-center justify-center rounded-[2px] font-mono text-[9.5px] tabular-nums cursor-pointer transition-colors"
                    style={{
                      color: isPlayhead
                        ? '#07090A'
                        : !active
                        ? '#374151'
                        : !isStepEnabled
                        ? '#4B5563'
                        : isBeat
                        ? c.accentGreen
                        : '#9CA3AF',
                      textDecoration: active && !isStepEnabled ? 'line-through' : 'none',
                      backgroundColor: isPlayhead
                        ? c.accentGreen
                        : stepNum === state.stepCount
                        ? 'rgba(255,255,255,0.06)'
                        : 'transparent',
                    }}
                  >
                    {stepNum}
                  </button>
                );
              })}
            </div>

            {/* Interactive Canvas Area: BARS | SCOPE | AUTO */}
            <div className="relative flex h-[222px]">
              {/* Left Y-axis scale */}
              {state.viewMode === 'auto' ? (
                <div className="w-7 pr-2 grid grid-rows-3 font-mono text-[8px] text-slate-600 tabular-nums text-right select-none">
                  <div className="flex flex-col justify-between pt-5 pb-1.5">
                    <span>100</span>
                    <span>0</span>
                  </div>
                  <div className="flex flex-col justify-between pt-5 pb-1.5">
                    <span>1.0</span>
                    <span>0.1</span>
                  </div>
                  <div className="flex flex-col justify-between pt-5 pb-1.5">
                    <span>75</span>
                    <span>0</span>
                  </div>
                </div>
              ) : (
                <div className="w-7 pr-2 flex flex-col justify-between py-1 font-mono text-[9px] text-slate-600 tabular-nums text-right select-none">
                  <span>100</span>
                  <span>50</span>
                  <span>0</span>
                </div>
              )}

              <div
                ref={sequencerRef}
                onPointerDown={(e) => {
                  if (state.viewMode === 'auto') return;
                  setIsPaintingBars(true);
                  if (sequencerRef.current) {
                    updateBarFromPointer(e.clientX, e.clientY, sequencerRef.current);
                  }
                }}
                onPointerMove={(e) => {
                  if (state.viewMode === 'auto') return;
                  if (isPaintingBars && sequencerRef.current) {
                    updateBarFromPointer(e.clientX, e.clientY, sequencerRef.current);
                  }
                }}
                onPointerLeave={() => setHoveredStep(null)}
                className="relative flex-1 cursor-crosshair touch-none overflow-hidden rounded-[3px]"
              >
                {/* Scope Gridlines */}
                <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
                  <div className="w-full h-px bg-[#181B1F]" />
                  <div className="w-full h-px bg-[#181B1F]" />
                  <div className="w-full h-px bg-[#181B1F]" />
                </div>
                <div className="pointer-events-none absolute inset-0 grid grid-cols-8">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="h-full border-r border-[#14171A] last:border-r-0" />
                  ))}
                </div>

                {/* VIEW 1: BARS — Clean, crisp 32 gate bars ONLY (dimmed when step is omitted via LED dot) */}
                {state.viewMode === 'bars' && (
                  <div className="absolute inset-0 grid grid-cols-[repeat(32,minmax(0,1fr))] gap-[4px] items-end">
                    {state.levels.map((lvl, idx) => {
                      const within = idx < state.stepCount;
                      const isStepEnabled = state.enabledSteps[idx] ?? true;
                      const isPlayhead = isPlaying && activePlayheadStep === idx;
                      const pct = Math.round(lvl * 100);
                      return (
                        <div
                          key={idx}
                          className="h-full flex items-end rounded-[2px] overflow-hidden transition-opacity duration-150"
                          style={{
                            opacity: !within ? 0.16 : !isStepEnabled ? 0.22 : 1,
                            backgroundColor:
                              isPlayhead && isStepEnabled
                                ? 'rgba(34,229,94,0.10)'
                                : 'rgba(255,255,255,0.015)',
                          }}
                        >
                          <div
                            className="w-full transition-[height] duration-75"
                            style={{
                              height: `${pct}%`,
                              background: !isStepEnabled
                                ? 'linear-gradient(180deg, rgba(100,116,139,0.28) 0%, rgba(100,116,139,0.06) 100%)'
                                : isPlayhead
                                ? 'linear-gradient(180deg, rgba(74,222,128,0.72) 0%, rgba(34,229,94,0.16) 100%)'
                                : 'linear-gradient(180deg, rgba(34,229,94,0.52) 0%, rgba(34,229,94,0.08) 100%)',
                              borderTop: `2px solid ${
                                !isStepEnabled
                                  ? '#475569'
                                  : isPlayhead
                                  ? '#FFFFFF'
                                  : c.accentGreen
                              }`,
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* VIEW 2: SCOPE — Dedicated Full Oscilloscope (Real-time Canvas Audio Waveform + Dual Envelope Curves) */}
                {state.viewMode === 'curve' && (
                  <>
                    <VektorScopeAudioCanvas
                      levels={state.levels}
                      modes={state.modes}
                      enabledSteps={state.enabledSteps}
                      stepCount={state.stepCount}
                      bpm={state.bpm}
                      beatsPerStep={activeRateObj.beatsPerStep}
                      envTime={state.envTime}
                      smooth={state.smooth}
                      depth={state.depth}
                      mix={state.mix}
                      bypassed={state.bypassed}
                      isPlaying={isPlaying}
                      activePlayheadStep={activePlayheadStep}
                    />

                    <svg
                      viewBox="0 0 960 220"
                      preserveAspectRatio="none"
                      className="pointer-events-none absolute inset-0 w-full h-full"
                    >
                      <defs>
                        <linearGradient id="vektorScopeFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={c.accentGreen} stopOpacity="0.20" />
                          <stop offset="100%" stopColor={c.accentGreen} stopOpacity="0.01" />
                        </linearGradient>
                        <filter id="vektorTraceGlow" x="-10%" y="-20%" width="120%" height="140%">
                          <feGaussianBlur stdDeviation="2.5" result="blur" />
                          <feMerge>
                            <feMergeNode in="blur" />
                            <feMergeNode in="SourceGraphic" />
                          </feMerge>
                        </filter>
                      </defs>

                      <path d={primaryFillPath} fill="url(#vektorScopeFill)" />

                      <path
                        d={smoothedCurvePath}
                        fill="none"
                        stroke={c.accentMint}
                        strokeWidth="1.6"
                        strokeOpacity="0.7"
                      />

                      <path
                        d={primaryCurvePath}
                        fill="none"
                        stroke={c.accentGreen}
                        strokeWidth="2.3"
                        filter="url(#vektorTraceGlow)"
                      />
                    </svg>
                  </>
                )}

                {/* VIEW 3: AUTO — Simulated Automation Lanes for Smooth, Env, and Swing */}
                {state.viewMode === 'auto' && (
                  <AutomationLanesView
                    lanes={automationLanes}
                    onChangeLanes={setAutomationLanes}
                    baseSmooth={state.smooth}
                    baseEnvTime={state.envTime}
                    baseSwing={state.swing}
                    stepCount={state.stepCount}
                    bpm={state.bpm}
                    beatsPerStep={activeRateObj.beatsPerStep}
                    isPlaying={isPlaying}
                    simActive={autoSimActive}
                    activePlayheadStep={activePlayheadStep}
                    bypassed={state.bypassed}
                  />
                )}

                {/* Step Length Boundary Line */}
                {state.stepCount < 32 && (
                  <div
                    className="pointer-events-none absolute top-0 bottom-0 border-r border-dashed border-slate-600"
                    style={{ left: `${(state.stepCount / 32) * 100}%` }}
                  />
                )}

                {/* Live Playhead Beam */}
                {isPlaying && (
                  <div
                    className="pointer-events-none absolute top-0 bottom-0 w-[2px]"
                    style={{
                      left: `calc(${((activePlayheadStep + 0.5) / 32) * 100}%)`,
                      backgroundColor: c.accentGreenBright,
                      boxShadow: `0 0 10px ${c.accentGreen}`,
                    }}
                  />
                )}
              </div>
            </div>

            {/* Per-Step Signal Shape Selector Strip */}
            <div className="pl-7 grid grid-cols-[repeat(32,minmax(0,1fr))] gap-[4px] mt-2 pt-2 border-t border-[#181B20]">
              {state.modes.map((modeId, idx) => {
                const within = idx < state.stepCount;
                const isStepEnabled = state.enabledSteps[idx] ?? true;
                const isPlayhead = isPlaying && activePlayheadStep === idx && isStepEnabled;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      triggerStepFlash(idx);
                      onChangeState((prev) => {
                        const nextModes = [...prev.modes];
                        nextModes[idx] =
                          prev.modes[idx] === prev.activeSignalMode
                            ? (prev.modes[idx] + 1) % SIGNAL_MODES.length
                            : prev.activeSignalMode;
                        return { ...prev, modes: nextModes };
                      });
                    }}
                    title={`Step ${idx + 1}: ${SIGNAL_MODES[modeId]?.label}${!isStepEnabled ? ' (Omitted)' : ''}`}
                    className="h-[22px] p-[2px] rounded-[2px] bg-[#101215] hover:bg-[#191C21] transition-colors cursor-pointer"
                    style={{
                      opacity: !within || !isStepEnabled ? 0.22 : 1,
                      boxShadow: isPlayhead
                        ? `inset 0 0 0 1px ${c.accentGreen}`
                        : 'inset 0 0 0 1px #1E2227',
                    }}
                  >
                    <SignalWaveformSvg
                      modeId={modeId}
                      color={c.accentGreen}
                      compact
                      active={isPlayhead}
                    />
                  </button>
                );
              })}
            </div>

            {/* Scope Footer Hint & Legend */}
            <div className="mt-2 pt-1.5 flex items-center justify-between text-[10px] font-sans text-slate-500">
              {state.viewMode === 'auto' ? (
                <span>
                  Drag any lane to draw curve · Select SINE / RAMP / TRI / STEP · Cycle:{' '}
                  {((state.stepCount * stepDurationMs) / 1000).toFixed(2)}s ({state.stepCount} steps @ {state.bpm} BPM)
                </span>
              ) : (
                <span>
                  Click LED: omit step · Drag bars: level · Click number (2–32): length · Step {String(currentStepInfo + 1).padStart(2, '0')} ({(state.enabledSteps[currentStepInfo] ?? true) ? `${Math.round((state.levels[currentStepInfo] ?? 0) * 100)}%` : 'Omitted'})
                </span>
              )}

              <div className="flex items-center gap-3 font-mono text-[9.5px] shrink-0">
                {state.viewMode === 'bars' ? (
                  <span className="flex items-center gap-1.5 text-slate-400">
                    <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: c.accentGreen }} />
                    Step Gate Active
                  </span>
                ) : state.viewMode === 'curve' ? (
                  <>
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <span className="inline-block w-2.5 h-[2px]" style={{ backgroundColor: c.accentGreen }} />
                      Gate Env
                    </span>
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <span className="inline-block w-2.5 h-[2px]" style={{ backgroundColor: c.accentMint }} />
                      Audio Scope
                    </span>
                  </>
                ) : (
                  <>
                    {!isPlaying && (
                      <button
                        type="button"
                        onClick={() => setAutoSimActive((v) => !v)}
                        className="px-1.5 py-[1px] rounded-[3px] border text-[8.5px] tracking-wider transition-colors cursor-pointer"
                        style={{
                          backgroundColor: autoSimActive ? c.accentGreenSoft : '#0D0E10',
                          borderColor: autoSimActive ? c.accentGreen : '#262A30',
                          color: autoSimActive ? c.accentGreen : '#9CA3AF',
                        }}
                      >
                        {autoSimActive ? 'SIM LIVE' : 'SIM PAUSED'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setAutomationLanes(createDefaultAutomationLanes());
                        onNotify('Automation lanes reset to default waveforms');
                      }}
                      className="px-1.5 py-[1px] rounded-[3px] bg-[#121519] border border-[#262A30] hover:border-[#3A404A] text-[8.5px] text-slate-300 cursor-pointer"
                    >
                      RESET
                    </button>
                    <span className="flex items-center gap-1 text-slate-400">
                      <span className="inline-block w-2 h-[2px]" style={{ backgroundColor: c.accentGreen }} />
                      SM
                    </span>
                    <span className="flex items-center gap-1 text-slate-400">
                      <span className="inline-block w-2 h-[2px]" style={{ backgroundColor: c.accentMint }} />
                      EN
                    </span>
                    <span className="flex items-center gap-1 text-slate-400">
                      <span className="inline-block w-2 h-[2px] bg-amber-500" />
                      SW
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

          {/* 2. HORIZONTAL OPTIMIZED GATE ENGINE MODULE */}
          <div className="rounded-[8px] vektor-subpanel border border-[#24272A] px-4 py-3.5 grid grid-cols-[1fr_auto] items-center gap-4">
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-start gap-1 pr-3 border-r border-[#22252A] shrink-0">
                <span className="font-mono text-[10.5px] font-semibold tracking-[0.16em] text-slate-400 uppercase">
                  GATE ENGINE
                </span>
                <span className="font-mono text-[9.5px] text-slate-500 tabular-nums">
                  {stepDurationMs} ms/step
                </span>
              </div>

              <div className="flex-1 grid grid-cols-4 gap-3 items-center">
                <RotaryEncoder
                  label="STEPS"
                  unit="LEN"
                  size="sm"
                  value={(state.stepCount - 2) / 30}
                  defaultValue={1}
                  centerDisplay={String(state.stepCount)}
                  midiLearnEnabled={midiLearnEnabled}
                  isMidiArmed={armedMidiParam === 'steps'}
                  midiMapping={midiMappings.steps ?? null}
                  onMidiContextMenu={(e) => armParamForMidi('steps', e)}
                  onChange={(norm) => {
                    const count = Math.round(2 + norm * 30);
                    onChangeState((prev) => ({ ...prev, stepCount: count }));
                  }}
                />

                <RotaryEncoder
                  label="SMOOTHING"
                  unit="%"
                  size="sm"
                  value={state.smooth}
                  defaultValue={0.30}
                  centerDisplay={String(Math.round(state.smooth * 100))}
                  midiLearnEnabled={midiLearnEnabled}
                  isMidiArmed={armedMidiParam === 'smooth'}
                  midiMapping={midiMappings.smooth ?? null}
                  onMidiContextMenu={(e) => armParamForMidi('smooth', e)}
                  onChange={(v) => onChangeState((prev) => ({ ...prev, smooth: v }))}
                />

                <RotaryEncoder
                  label="ENV"
                  unit="x"
                  size="sm"
                  value={(state.envTime - 0.1) / 0.9}
                  defaultValue={(0.68 - 0.1) / 0.9}
                  centerDisplay={state.envTime.toFixed(2)}
                  midiLearnEnabled={midiLearnEnabled}
                  isMidiArmed={armedMidiParam === 'envTime'}
                  midiMapping={midiMappings.envTime ?? null}
                  onMidiContextMenu={(e) => armParamForMidi('envTime', e)}
                  onChange={(v) =>
                    onChangeState((prev) => ({
                      ...prev,
                      envTime: Number((0.1 + v * 0.9).toFixed(2)),
                    }))
                  }
                />

                <RotaryEncoder
                  label="SWING"
                  unit="%"
                  size="sm"
                  value={state.swing}
                  defaultValue={0.08}
                  centerDisplay={String(Math.round(state.swing * 75))}
                  midiLearnEnabled={midiLearnEnabled}
                  isMidiArmed={armedMidiParam === 'swing'}
                  midiMapping={midiMappings.swing ?? null}
                  onMidiContextMenu={(e) => armParamForMidi('swing', e)}
                  onChange={(v) => onChangeState((prev) => ({ ...prev, swing: v }))}
                />
              </div>
            </div>

            <div
              onContextMenu={(e) => armParamForMidi('timebase', e)}
              title={
                midiLearnEnabled
                  ? 'Right-click to map TIMEBASE to MIDI CC'
                  : midiMappings.timebase
                  ? `TIMEBASE · MIDI CC #${midiMappings.timebase.cc} (Ch ${midiMappings.timebase.channel})`
                  : undefined
              }
              className={`relative pl-4 border-l border-[#22252A] rounded-[4px] transition-all ${
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
                  TIMEBASE · TRIPLETS
                </span>
                <span className="font-mono text-[9.5px] tabular-nums" style={{ color: c.accentGreen }}>
                  {state.speedId}
                </span>
              </div>
              <div className="grid grid-cols-6 gap-1.5">
                {SPEED_RATES.map((rate) => {
                  const active = state.speedId === rate.id;
                  return (
                    <button
                      key={rate.id}
                      type="button"
                      onClick={() => onChangeState((prev) => ({ ...prev, speedId: rate.id }))}
                      className="w-[41px] h-[27px] rounded-[4px] font-mono text-[10px] font-medium tabular-nums transition-colors cursor-pointer"
                      style={{
                        backgroundColor: active ? c.accentGreenSoft : '#0D0E10',
                        color: active ? c.accentGreen : '#9CA3AF',
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

          {/* 3. BOTTOM MASTER STRIP (4 VektorTrem Knobs) */}
          <div className="rounded-[8px] vektor-subpanel border border-[#24272A] py-3 px-10 grid grid-cols-4 gap-6 items-center">
            <RotaryEncoder
              label="GATE DEPTH"
              unit="%"
              size="sm"
              value={state.depth}
              defaultValue={1.0}
              centerDisplay={String(Math.round(state.depth * 100))}
              midiLearnEnabled={midiLearnEnabled}
              isMidiArmed={armedMidiParam === 'depth'}
              midiMapping={midiMappings.depth ?? null}
              onMidiContextMenu={(e) => armParamForMidi('depth', e)}
              onChange={(v) => onChangeState((prev) => ({ ...prev, depth: v }))}
            />

            <RotaryEncoder
              label="RELEASE"
              unit="ms"
              size="sm"
              value={(state.releaseMs - 1) / 99}
              defaultValue={2 / 99}
              centerDisplay={state.releaseMs.toFixed(2)}
              midiLearnEnabled={midiLearnEnabled}
              isMidiArmed={armedMidiParam === 'releaseMs'}
              midiMapping={midiMappings.releaseMs ?? null}
              onMidiContextMenu={(e) => armParamForMidi('releaseMs', e)}
              onChange={(v) =>
                onChangeState((prev) => ({ ...prev, releaseMs: Number((1 + v * 99).toFixed(2)) }))
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
                  ? `+${state.outTrimDb.toFixed(2)}`
                  : state.outTrimDb.toFixed(2)
              }
              midiLearnEnabled={midiLearnEnabled}
              isMidiArmed={armedMidiParam === 'outTrimDb'}
              midiMapping={midiMappings.outTrimDb ?? null}
              onMidiContextMenu={(e) => armParamForMidi('outTrimDb', e)}
              onChange={(v) =>
                onChangeState((prev) => ({
                  ...prev,
                  outTrimDb: Number((-12 + v * 24).toFixed(2)),
                }))
              }
            />

            <RotaryEncoder
              label="MIX"
              unit="%"
              size="sm"
              value={state.mix}
              defaultValue={1.0}
              centerDisplay={String(Math.round(state.mix * 100))}
              midiLearnEnabled={midiLearnEnabled}
              isMidiArmed={armedMidiParam === 'mix'}
              midiMapping={midiMappings.mix ?? null}
              onMidiContextMenu={(e) => armParamForMidi('mix', e)}
              onChange={(v) => onChangeState((prev) => ({ ...prev, mix: v }))}
            />
          </div>
        </div>

        {/* ======================== RIGHT STEREO I/O VU METER BAY ======================== */}
        <div className="rounded-[8px] vektor-subpanel border border-[#24272A] p-2.5 flex flex-col">
          <StereoVuMeterCanvas
            levels={state.levels}
            modes={state.modes}
            enabledSteps={state.enabledSteps}
            stepCount={state.stepCount}
            bpm={state.bpm}
            beatsPerStep={activeRateObj.beatsPerStep}
            envTime={state.envTime}
            smooth={state.smooth}
            depth={state.depth}
            releaseMs={state.releaseMs}
            outTrimDb={state.outTrimDb}
            mix={state.mix}
            bypassed={state.bypassed}
            isPlaying={isPlaying}
            activePlayheadStep={activePlayheadStep}
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

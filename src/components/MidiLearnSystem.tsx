import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Radio, CheckCircle2, Trash2, X, Cable, Sliders } from 'lucide-react';
import { VEKTOR_TREM_COLORS } from '../data/vektorDelayData';

export type MidiParamId =
  | 'bpm'
  | 'swing'
  | 'offsetMs'
  | 'delayTime'
  | 'timebase'
  | 'syncMode'
  | 'feedback'
  | 'modRate'
  | 'modAmt'
  | 'character'
  | 'width'
  | 'lowCut'
  | 'highCut'
  | 'duckAmt'
  | 'duckRel'
  | 'outTrimDb'
  | 'mix'
  | 'freeze'
  | 'bypassed';

export interface MidiMappingEntry {
  paramId: MidiParamId;
  cc: number;
  channel: number; // 1..16
  lastValue?: number; // 0..127
}

export const MIDI_MAPPINGS_STORAGE_KEY = 'vektordelay_midi_mappings_v1';

export const MIDI_PARAM_META: Record<
  MidiParamId,
  { label: string; group: string; rangeHint: string }
> = {
  bpm: { label: 'BPM', group: 'Header', rangeHint: '40 – 240 BPM' },
  swing: { label: 'SWING', group: 'Delay Engine', rangeHint: '0% – 100%' },
  offsetMs: { label: 'OFFSET', group: 'Delay Engine', rangeHint: '-50 – +50 ms' },
  delayTime: { label: 'DELAY', group: 'Delay Engine', rangeHint: '10 – 2000 ms' },
  timebase: { label: 'TIMEBASE', group: 'Delay Engine', rangeHint: '1/1 – 1/16T' },
  syncMode: { label: 'SYNC / FREE', group: 'Delay Engine', rangeHint: 'Switch (CC >= 64)' },
  feedback: { label: 'FEEDBACK', group: 'Delay Engine', rangeHint: '0% – 110%' },
  modRate: { label: 'MOD RATE', group: 'Delay Engine', rangeHint: '0.05 – 10.0 Hz' },
  modAmt: { label: 'MOD AMT', group: 'Delay Engine', rangeHint: '0% – 100%' },
  character: { label: 'CHARACTER / PITCH', group: 'Filters & Ducker', rangeHint: 'Mode-dependent' },
  width: { label: 'WIDTH', group: 'Filters & Ducker', rangeHint: '0% – 200%' },
  lowCut: { label: 'LOW CUT', group: 'Filters & Ducker', rangeHint: '20 Hz – 1.2 kHz' },
  highCut: { label: 'HIGH CUT', group: 'Filters & Ducker', rangeHint: '800 Hz – 20.0 kHz' },
  duckAmt: { label: 'DUCK AMT', group: 'Filters & Ducker', rangeHint: '0% – 100%' },
  duckRel: { label: 'DUCK REL', group: 'Filters & Ducker', rangeHint: '0% – 100%' },
  outTrimDb: { label: 'OUT', group: 'Master', rangeHint: '-12.0 – +12.0 dB' },
  mix: { label: 'MIX', group: 'Master', rangeHint: '0% – 100%' },
  freeze: { label: 'FREEZE', group: 'Scope', rangeHint: 'Switch (CC >= 64)' },
  bypassed: { label: 'BYPASS', group: 'Header', rangeHint: 'Switch (CC >= 64)' },
};

export const QUICK_TEST_CCS = [
  { cc: 1, tag: 'Mod' },
  { cc: 7, tag: 'Vol' },
  { cc: 14, tag: 'Enc' },
  { cc: 21, tag: 'Knob' },
  { cc: 74, tag: 'Cut' },
];

export function readStoredMidiMappings(): Partial<Record<MidiParamId, MidiMappingEntry>> {
  try {
    const raw = window.localStorage.getItem(MIDI_MAPPINGS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as Partial<Record<MidiParamId, MidiMappingEntry>>;
  } catch {
    return {};
  }
}

interface SettingsMenuPopoverProps {
  midiLearnEnabled: boolean;
  onToggleMidiLearn: () => void;
  webMidiStatus: 'unrequested' | 'connected' | 'unsupported' | 'denied';
  midiDeviceNames: string[];
  onConnectWebMidi: () => void;
  mappings: Partial<Record<MidiParamId, MidiMappingEntry>>;
  onRemoveMapping: (paramId: MidiParamId) => void;
  onClearAllMappings: () => void;
  onClose: () => void;
}

export const SettingsMenuPopover: React.FC<SettingsMenuPopoverProps> = ({
  midiLearnEnabled,
  onToggleMidiLearn,
  webMidiStatus,
  midiDeviceNames,
  onConnectWebMidi,
  mappings,
  onRemoveMapping,
  onClearAllMappings,
  onClose,
}) => {
  const c = VEKTOR_TREM_COLORS;
  const mappingList = Object.values(mappings).filter(
    (entry): entry is MidiMappingEntry => Boolean(entry)
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: -6, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.985 }}
      transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
      className="absolute right-0 top-8 w-[332px] z-40 rounded-[8px] bg-[#111317] border border-[#2C313A] shadow-[0_24px_56px_rgba(0,0,0,0.9)] overflow-hidden"
    >
      <div className="px-3.5 py-2.5 bg-[#0B0D10] border-b border-[#1E2229] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sliders className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-200">
            Plugin Settings
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close settings menu"
          className="p-1 rounded text-slate-500 hover:text-slate-200 hover:bg-white/[0.05] transition-colors cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="p-3.5 border-b border-[#1E2228] space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[12px] font-semibold text-slate-100">MIDI Learn Mode</span>
              <span
                className="font-mono text-[9px] uppercase tracking-wider font-semibold"
                style={{ color: midiLearnEnabled ? c.accentGreen : '#64748B' }}
              >
                {midiLearnEnabled ? 'Active' : 'Off'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
              Right-click any knob or control on the faceplate to assign a hardware MIDI CC.
            </p>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={midiLearnEnabled}
            aria-label="Toggle MIDI Learn mode"
            onClick={onToggleMidiLearn}
            className="relative w-10 h-5 rounded-full border transition-colors cursor-pointer shrink-0 mt-0.5"
            style={{
              backgroundColor: midiLearnEnabled ? 'rgba(34, 229, 94, 0.22)' : '#0B0D10',
              borderColor: midiLearnEnabled ? c.accentGreen : '#2A2F37',
            }}
          >
            <motion.span
              layout
              transition={{ type: 'spring', stiffness: 520, damping: 32 }}
              className="block w-3.5 h-3.5 rounded-full"
              style={{
                marginLeft: midiLearnEnabled ? '21px' : '2px',
                backgroundColor: midiLearnEnabled ? c.accentGreen : '#64748B',
                boxShadow: midiLearnEnabled ? '0 0 8px rgba(34, 229, 94, 0.7)' : 'none',
              }}
            />
          </button>
        </div>

        <div className="rounded-[5px] bg-[#0B0D10] border border-[#1E2228] px-2.5 py-2 flex items-center justify-between gap-2">
          <div className="min-w-0 flex items-center gap-2">
            <Cable
              className="w-3.5 h-3.5 shrink-0"
              style={{
                color:
                  webMidiStatus === 'connected' && midiDeviceNames.length > 0
                    ? c.accentMint
                    : '#64748B',
              }}
            />
            <div className="min-w-0">
              <div className="font-mono text-[9.5px] text-slate-300 truncate">
                {webMidiStatus === 'connected'
                  ? midiDeviceNames.length > 0
                    ? midiDeviceNames.join(', ')
                    : 'Web MIDI ready (0 inputs)'
                  : webMidiStatus === 'unsupported'
                  ? 'Web MIDI unavailable'
                  : webMidiStatus === 'denied'
                  ? 'MIDI permission denied'
                  : 'Hardware MIDI Input'}
              </div>
              <div className="text-[10px] text-slate-500">
                {webMidiStatus === 'connected'
                  ? 'Listening for CC messages'
                  : 'Connect controller or test CC in overlay'}
              </div>
            </div>
          </div>

          {webMidiStatus !== 'connected' && webMidiStatus !== 'unsupported' && (
            <button
              type="button"
              onClick={onConnectWebMidi}
              className="px-2 py-1 rounded-[4px] bg-[#181C22] hover:bg-[#20262F] border border-[#2B313B] font-mono text-[9px] text-slate-200 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              Connect
            </button>
          )}
        </div>
      </div>

      <div className="px-3.5 py-2.5 bg-[#0E1014]">
        <div className="flex items-center justify-between mb-2">
          <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-slate-500">
            Active Mappings ({mappingList.length})
          </span>
          {mappingList.length > 0 && (
            <button
              type="button"
              onClick={onClearAllMappings}
              className="font-mono text-[9px] text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
            >
              Clear All
            </button>
          )}
        </div>

        {mappingList.length === 0 ? (
          <div className="py-3 text-center text-[11px] text-slate-500">
            No MIDI CC mappings assigned yet.
          </div>
        ) : (
          <div className="max-h-[168px] overflow-y-auto vektor-scrollbar space-y-1 pr-0.5">
            {mappingList.map((entry) => {
              const meta = MIDI_PARAM_META[entry.paramId];
              return (
                <div
                  key={entry.paramId}
                  className="px-2.5 py-1.5 rounded-[4px] bg-[#14171C] border border-[#22262E] flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="text-[11px] font-medium text-slate-200 truncate">
                      {meta?.label ?? entry.paramId}
                    </div>
                    <div className="font-mono text-[9px] text-slate-500 tabular-nums">
                      CC #{entry.cc} · Ch {entry.channel} · {meta?.group}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemoveMapping(entry.paramId)}
                    title={`Unmap ${meta?.label ?? entry.paramId}`}
                    className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer shrink-0"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
};

interface MidiLearnOverlayProps {
  armedParam: MidiParamId | null;
  confirmedMapping: MidiMappingEntry | null;
  existingMapping: MidiMappingEntry | null;
  webMidiStatus: 'unrequested' | 'connected' | 'unsupported' | 'denied';
  midiDeviceNames: string[];
  onSimulateCcBind: (cc: number, channel?: number) => void;
  onUnmapArmed: () => void;
  onCancel: () => void;
}

export const MidiLearnOverlay: React.FC<MidiLearnOverlayProps> = ({
  armedParam,
  confirmedMapping,
  existingMapping,
  webMidiStatus,
  midiDeviceNames,
  onSimulateCcBind,
  onUnmapArmed,
  onCancel,
}) => {
  const [customCcInput, setCustomCcInput] = useState('24');
  const c = VEKTOR_TREM_COLORS;

  const activeParam = confirmedMapping?.paramId ?? armedParam;
  if (!activeParam) return null;

  const meta = MIDI_PARAM_META[activeParam];
  const isConfirmed = Boolean(confirmedMapping);

  const handleCustomBind = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = Number(customCcInput);
    if (!Number.isFinite(parsed)) return;
    const clampedCc = Math.min(127, Math.max(0, Math.round(parsed)));
    onSimulateCcBind(clampedCc, 1);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.16 }}
      onClick={onCancel}
      className="absolute inset-0 z-30 rounded-[10px] bg-[#07090C]/75 backdrop-blur-[2px] flex items-center justify-center p-6"
      role="dialog"
      aria-modal="true"
      aria-label="MIDI Learn Mapping Confirmation"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 4 }}
        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[430px] rounded-[8px] bg-[#111418] border shadow-[0_24px_64px_rgba(0,0,0,0.9)] overflow-hidden"
        style={{
          borderColor: isConfirmed ? c.accentGreen : 'rgba(58, 227, 158, 0.55)',
          boxShadow: isConfirmed
            ? '0 24px 64px rgba(0,0,0,0.9), 0 0 28px rgba(34, 229, 94, 0.25)'
            : '0 24px 64px rgba(0,0,0,0.9), 0 0 24px rgba(58, 227, 158, 0.15)',
        }}
      >
        <div
          className="px-4 py-3 border-b flex items-center justify-between gap-3"
          style={{
            backgroundColor: isConfirmed ? 'rgba(34, 229, 94, 0.12)' : '#0B0D11',
            borderColor: isConfirmed ? 'rgba(34, 229, 94, 0.35)' : '#1E232A',
          }}
        >
          <div className="flex items-center gap-2.5">
            {isConfirmed ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: c.accentGreen }} />
            ) : (
              <Radio className="w-4 h-4 shrink-0" style={{ color: c.accentMint }} />
            )}
            <div>
              <div
                className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em]"
                style={{ color: isConfirmed ? c.accentGreen : c.accentMint }}
              >
                {isConfirmed ? 'MIDI Mapping Confirmed' : 'MIDI Learn Mapping Active'}
              </div>
              <div className="text-[11px] text-slate-400">
                {isConfirmed
                  ? 'Hardware controller bound to parameter'
                  : 'Waiting for incoming hardware CC signal'}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onCancel}
            aria-label="Close MIDI learn overlay"
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3.5">
          <div className="rounded-[6px] bg-[#0A0C0F] border border-[#22262E] px-3.5 py-2.5 flex items-center justify-between gap-3">
            <div>
              <div className="font-mono text-[9px] uppercase tracking-wider text-slate-500">
                Target · {meta.group}
              </div>
              <div className="font-display text-base font-bold text-slate-100 mt-0.5">
                {meta.label}
              </div>
              <div className="font-mono text-[10px] text-slate-400 tabular-nums mt-0.5">
                Range: {meta.rangeHint}
              </div>
            </div>

            <div className="text-right font-mono tabular-nums">
              {isConfirmed && confirmedMapping ? (
                <div>
                  <div className="text-[9px] uppercase tracking-wider text-[#22E55E]">Assigned</div>
                  <div className="text-sm font-bold text-[#22E55E] mt-0.5">
                    CC #{confirmedMapping.cc}
                  </div>
                  <div className="text-[9.5px] text-slate-400">Ch {confirmedMapping.channel}</div>
                </div>
              ) : existingMapping ? (
                <div>
                  <div className="text-[9px] uppercase tracking-wider text-slate-500">Current</div>
                  <div className="text-xs font-semibold text-[#3AE39E] mt-0.5">
                    CC #{existingMapping.cc}
                  </div>
                  <div className="text-[9px] text-slate-500">Ch {existingMapping.channel}</div>
                </div>
              ) : (
                <div>
                  <div className="text-[9px] uppercase tracking-wider text-slate-500">Status</div>
                  <div className="text-xs font-semibold text-amber-300 mt-0.5">Listening</div>
                </div>
              )}
            </div>
          </div>

          {!isConfirmed && (
            <>
              <p className="text-[11.5px] text-slate-300 leading-relaxed">
                Move any knob, fader, or button on your MIDI hardware controller
                {webMidiStatus === 'connected' && midiDeviceNames.length > 0
                  ? ` (${midiDeviceNames[0]})`
                  : ''}{' '}
                to bind it to <span className="font-semibold text-white">{meta.label}</span>.
              </p>

              <div className="rounded-[6px] bg-[#0B0D11] border border-[#1E222A] p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[9px] uppercase tracking-wider text-slate-400">
                    Simulate / Quick-Assign CC
                  </span>
                  <span className="font-mono text-[9px] text-slate-500">Ch 1</span>
                </div>

                <div className="grid grid-cols-5 gap-1.5">
                  {QUICK_TEST_CCS.map((item) => (
                    <button
                      key={item.cc}
                      type="button"
                      onClick={() => onSimulateCcBind(item.cc, 1)}
                      className="py-1.5 px-1 rounded-[4px] bg-[#15181E] hover:bg-[#1D222B] border border-[#262B34] hover:border-[#22E55E]/70 font-mono text-[9.5px] text-slate-200 tabular-nums transition-colors cursor-pointer text-center"
                    >
                      <div className="font-semibold text-[#3AE39E]">CC {item.cc}</div>
                      <div className="text-[8px] text-slate-500">{item.tag}</div>
                    </button>
                  ))}
                </div>

                <form onSubmit={handleCustomBind} className="flex items-center gap-1.5 pt-1">
                  <label className="font-mono text-[9.5px] text-slate-400 shrink-0" htmlFor="vd-cc-num">
                    Custom CC #
                  </label>
                  <input
                    id="vd-cc-num"
                    type="number"
                    min={0}
                    max={127}
                    value={customCcInput}
                    onChange={(e) => setCustomCcInput(e.target.value)}
                    className="w-16 h-7 px-2 rounded-[4px] bg-[#07080A] border border-[#252A32] focus:border-[#22E55E] focus:outline-none font-mono text-[11px] text-slate-100 tabular-nums"
                  />
                  <button
                    type="submit"
                    className="h-7 px-3 rounded-[4px] bg-[#22E55E] hover:bg-[#34F06D] text-[#07090A] font-mono text-[10px] font-semibold transition-colors cursor-pointer whitespace-nowrap"
                  >
                    Assign CC
                  </button>
                </form>
              </div>

              <div className="flex items-center justify-between pt-1">
                {existingMapping ? (
                  <button
                    type="button"
                    onClick={onUnmapArmed}
                    className="px-2.5 py-1.5 rounded-[4px] bg-rose-500/10 border border-rose-500/35 text-rose-300 hover:bg-rose-500/20 font-mono text-[10px] transition-colors cursor-pointer"
                  >
                    Remove Mapping
                  </button>
                ) : (
                  <span className="font-mono text-[9.5px] text-slate-500">Esc to cancel</span>
                )}

                <button
                  type="button"
                  onClick={onCancel}
                  className="px-3 py-1.5 rounded-[4px] bg-[#181B21] hover:bg-[#22262E] border border-[#2B3038] font-mono text-[10px] text-slate-200 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

import { DEFAULT_A4_HZ, identifyPitch, noteFrequency } from '../music/pitch.ts';

export const TOOLS = [
  { id: 'tuner', label: 'Tuner' },
  { id: 'tone', label: 'Reference tone' },
  { id: 'metronome', label: 'Metronome' },
] as const;
export type Focus = typeof TOOLS[number]['id'];
export const TRANSPOSITIONS = [
  { value: 0, label: 'Concert pitch' },
  { value: 2, label: 'B-flat instrument (+2)' },
  { value: 9, label: 'E-flat instrument (+9)' },
  { value: 7, label: 'F instrument (+7)' },
] as const;
export const METERS = [
  { value: 'free', label: 'Free pulse', beats: 0, unit: 'Quarter note' },
  { value: '3/4', label: '3/4', beats: 3, unit: 'Quarter note' },
  { value: '4/4', label: '4/4', beats: 4, unit: 'Quarter note' },
  { value: '6/8', label: '6/8', beats: 2, unit: 'Dotted quarter' },
] as const;
export type Meter = typeof METERS[number]['value'];
export const LIMITS = {
  frequency: { min: 1, max: 24000 },
  a4: { min: 400, max: 480 },
  octave: { min: 1, max: 6 },
  tempo: { min: 30, max: 240 },
} as const;
export type Settings = Readonly<{ a4: number; transposition: number; showUno: boolean }>;
export type MicStatus = 'idle' | 'requesting' | 'listening' | 'no-signal' | 'unreliable' | 'error' | 'interrupted';
export type AudioState = Readonly<{ micStatus: MicStatus; liveHz: number | null; rms: number; quality: number; tonePlaying: boolean; audioError: string }>;
export type PracticeState = Settings & AudioState & Readonly<{
  focus: Focus;
  manualHz: number | null;
  toneNote: number;
  octave: number;
  sustain: boolean;
  toneVolume: number;
  tempo: number;
  meter: Meter;
  numbered: boolean;
}>;
export type Action =
  | { type: 'audio'; value: Partial<AudioState> }
  | { type: 'focus'; value: Focus }
  | { type: 'pitch'; value: number | null }
  | { type: 'settings'; value: Settings }
  | { type: 'tone-note'; value: number }
  | { type: 'octave'; value: number }
  | { type: 'sustain'; value: boolean }
  | { type: 'tone-volume'; value: number }
  | { type: 'tempo'; value: number }
  | { type: 'meter'; value: Meter }
  | { type: 'numbered'; value: boolean };

function inRange(value: number, min: number, max: number, integer = false): boolean {
  return Number.isFinite(value) && value >= min && value <= max && (!integer || Number.isInteger(value));
}

export function createPracticeStore() {
  let state: PracticeState = Object.freeze({
    micStatus: 'idle', liveHz: null, rms: 0, quality: 0, tonePlaying: false, audioError: '',
    focus: 'tuner', manualHz: null, a4: DEFAULT_A4_HZ, transposition: 0,
    showUno: true, toneNote: 58, octave: 3, sustain: true, toneVolume: 40,
    tempo: 96, meter: 'free', numbered: false,
  });
  const listeners = new Set<(state: PracticeState) => void>();
  return {
    get: () => state,
    subscribe(listener: (state: PracticeState) => void) {
      listeners.add(listener);
      listener(state);
      return () => listeners.delete(listener);
    },
    dispatch(action: Action) {
      let patch: Partial<PracticeState>;
      switch (action.type) {
        case 'audio': patch = action.value; break;
        case 'focus': patch = { focus: action.value }; break;
        case 'pitch':
          if (action.value !== null && !inRange(action.value, LIMITS.frequency.min, LIMITS.frequency.max)) return;
          patch = { manualHz: action.value }; break;
        case 'settings':
          if (!inRange(action.value.a4, LIMITS.a4.min, LIMITS.a4.max)
            || !TRANSPOSITIONS.some((item) => item.value === action.value.transposition)) return;
          patch = action.value; break;
        case 'tone-note':
          if (!inRange(action.value, 24, 96, true)) return;
          patch = { toneNote: action.value }; break;
        case 'octave':
          if (!inRange(action.value, LIMITS.octave.min, LIMITS.octave.max, true)) return;
          patch = { octave: action.value }; break;
        case 'sustain': patch = { sustain: action.value }; break;
        case 'tone-volume':
          if (!inRange(action.value, 0, 100, true)) return;
          patch = { toneVolume: action.value }; break;
        case 'tempo':
          if (!inRange(action.value, LIMITS.tempo.min, LIMITS.tempo.max, true)) return;
          patch = { tempo: action.value }; break;
        case 'meter':
          if (!METERS.some((meter) => meter.value === action.value)) return;
          patch = { meter: action.value, numbered: action.value !== 'free' }; break;
        case 'numbered': patch = { numbered: action.value }; break;
      }
      state = Object.freeze({ ...state, ...patch });
      listeners.forEach((listener) => listener(state));
    },
  };
}
export type PracticeStore = ReturnType<typeof createPracticeStore>;
export const displayedHz = (state: PracticeState) => state.micStatus === 'idle' ? state.manualHz : state.liveHz;
export const pitchReading = (state: PracticeState) => {
  const hz = displayedHz(state);
  return hz === null ? null : identifyPitch(hz, state.a4, state.transposition);
};
export const toneHz = (state: PracticeState) => noteFrequency(state.toneNote, state.a4);
export const meterInfo = (state: PracticeState) => METERS.find((meter) => meter.value === state.meter)!;

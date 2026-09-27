import { diatonic, pitchAt, pitchLabel, spelling } from '../domain/notation.ts';
import type { WrittenPitch } from '../domain/notation.ts';
import { normalizePreset, presets } from '../domain/presets.ts';
import type { Preset } from '../domain/presets.ts';
import type { Observation } from './practice.ts';

export const ALGORITHM_VERSION = 1;
export interface Learning { algorithmVersion: number; expansionCount: number }
export type NoteHistory = Record<string, readonly Observation[]>;
export const mastered = (records: readonly Observation[] = []) => records.length >= 5 && records.slice(-5).every(o => o.correct);
export const errorRate = (records: readonly Observation[] = []) => records.length ? records.filter(o => !o.correct).length / records.length : 0;
export const weight = (records: readonly Observation[] = []) => 1 + 3 * errorRate(records) + (records.length ? 0 : 1);
export function observe(notes: NoteHistory, observation: Observation): NoteHistory {
  const label = pitchLabel(observation.pitch);
  return { ...notes, [label]: [...(notes[label] ?? []), observation].slice(-10) };
}
/** Only catalog envelopes are approved; instrument limits follow the Phase 3 range decision.
 * Custom (including edited catalog copies) has no implicit expansion permission. */
const plans = new WeakMap<Preset, readonly (readonly WrittenPitch[])[]>();
export function expansionPlan(preset: Preset): readonly (readonly WrittenPitch[])[] {
  const cached = plans.get(preset); if (cached) return cached;
  const catalog = presets.find(p => p === preset || p.id === preset.id && JSON.stringify(p) === JSON.stringify(preset));
  if (!catalog) return [];
  const envelope = normalizePreset({ ...preset, range: preset.instrument ? preset.expansion! : [pitchLabel(pitchAt(-8,preset.clef)), pitchLabel(pitchAt(16,preset.clef))] });
  const low = Math.min(...preset.pool.map(diatonic)), high = Math.max(...preset.pool.map(diatonic));
  const groups = new Map<number, WrittenPitch[]>();
  for (const p of envelope.pool) { const pos = diatonic(p); if (pos < low || pos > high) groups.set(pos,[...(groups.get(pos) ?? []),p]); }
  const lower = [...groups.keys()].filter(p => p < low).sort((a,b) => b-a);
  const upper = [...groups.keys()].filter(p => p > high).sort((a,b) => a-b);
  // Above/below ledger catalog levels preserve their one-sided direction.
  const direction = preset.id.endsWith('-above') ? 'upper' : preset.id.endsWith('-below') ? 'lower' : 'both';
  const plan: WrittenPitch[][] = [];
  while (lower.length || upper.length) {
    if (direction !== 'upper' && lower.length) plan.push(groups.get(lower.shift()!)!); else lower.length = 0;
    if (direction !== 'lower' && upper.length) plan.push(groups.get(upper.shift()!)!); else upper.length = 0;
  }
  const result = Object.freeze(plan.map(group => Object.freeze(group)));
  plans.set(preset,result); return result;
}
export function activePool(preset: Preset, learning?: Learning) {
  const plan = expansionPlan(preset);
  const count = learning?.algorithmVersion === ALGORITHM_VERSION ? Math.min(plan.length,Math.max(0,learning.expansionCount)) : 0;
  return [...preset.pool, ...plan.slice(0,count).flat()];
}
export interface AdaptiveState {
  notes: NoteHistory;
  expansionCount: number;
  recent: readonly Observation[];
  answers: number;
  sinceExpansion: number;
  focus: readonly string[];
  focusRemaining: number;
  focusPrompt: boolean;
  contrast: readonly string[];
  contrastRemaining: number;
  previous: string;
  prompts: number;
}
export function initialAdaptive(notes: NoteHistory = {}, learning?: Learning): AdaptiveState {
  const compatible = !learning || learning.algorithmVersion === ALGORITHM_VERSION;
  return { notes: compatible ? structuredClone(notes) : {}, expansionCount: compatible ? learning?.expansionCount ?? 0 : 0, recent: [], answers: 0, sinceExpansion: 0, focus: [], focusRemaining: 0, focusPrompt: false, contrast: [], contrastRemaining: 0, previous: '', prompts: 0 };
}
export function learn(state: AdaptiveState, observation: Observation, preset: Preset): { state: AdaptiveState; added: readonly WrittenPitch[] } {
  let next = { ...state, notes: observe(state.notes,observation), recent: [...state.recent,observation].slice(-20), answers: state.answers+1, sinceExpansion: state.sinceExpansion+1 };
  const pool = activePool(preset,{ algorithmVersion: ALGORITHM_VERSION, expansionCount: next.expansionCount });
  let added: readonly WrittenPitch[] = [];
  const accuracy = next.recent.filter(o => o.correct).length / next.recent.length;
  if (!next.focusRemaining && !next.focusPrompt && next.sinceExpansion >= 20 && next.recent.length === 20 && accuracy >= .9 && pool.every(p => mastered(next.notes[pitchLabel(p)]))) {
    added = expansionPlan(preset)[next.expansionCount] ?? [];
    if (added.length) next = { ...next, expansionCount: next.expansionCount+1, sinceExpansion: 0 };
  }
  if (next.answers % 10 === 0) {
    if (next.recent.length === 20 && accuracy < .7) {
      next.focus = [...pool].sort((a,b) => errorRate(next.notes[pitchLabel(b)]) - errorRate(next.notes[pitchLabel(a)]) || pitchLabel(a).localeCompare(pitchLabel(b),'en')).slice(0,4).map(pitchLabel);
      next.focusRemaining = 10;
    }
    const counts = new Map<string, number>();
    for (const o of next.recent.filter(o => !o.correct)) {
      const pair = `${spelling(o.pitch)}→${spelling(o.answer)}`;
      counts.set(pair,(counts.get(pair) ?? 0)+1);
    }
    const pair = [...counts].filter(([pair,n]) => n >= 3 && pair.split('→').every(s => pool.some(p => spelling(p) === s))).sort((a,b) => b[1]-a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))[0];
    next.contrast = pair ? pair[0].split('→') : [];
    next.contrastRemaining = 10;
  }
  return { state: next, added };
}
/** Review takes precedence over contrasts. All choices exclude the preceding pitch. */
export function selectAdaptive(state: AdaptiveState, pool: readonly WrittenPitch[], random: () => number): { state: AdaptiveState; pitch: WrittenPitch; kind: 'weighted' | 'focus' | 'review' | 'contrast' } {
  if (!pool.length) throw new Error('Adaptive selection needs a pool.');
  let candidates = pool.filter(p => pool.length === 1 || pitchLabel(p) !== state.previous);
  let kind: 'weighted' | 'focus' | 'review' | 'contrast' = 'weighted';
  let contrast = state.contrast;
  const review = (state.prompts+1) % 5 === 0;
  if (review) {
    kind = 'review';
    const rest = state.focusRemaining ? candidates.filter(p => !state.focus.includes(pitchLabel(p))) : candidates;
    if (rest.length) candidates = rest;
  } else if (state.contrastRemaining && contrast.length) {
    const matches = candidates.filter(p => spelling(p) === contrast[0]);
    if (matches.length) { candidates = matches; kind = 'contrast'; contrast = contrast.slice(1); }
  }
  if (kind === 'weighted' && state.focusRemaining) {
    const focused = candidates.filter(p => state.focus.includes(pitchLabel(p)));
    if (focused.length) { candidates = focused; kind = 'focus'; }
  }
  const sample = random(); if (!Number.isFinite(sample) || sample < 0 || sample >= 1) throw new Error('Random sample must be in [0, 1).');
  let remaining = sample * candidates.reduce((sum,p) => sum+weight(state.notes[pitchLabel(p)]),0);
  const pitch = candidates.find(p => { remaining -= weight(state.notes[pitchLabel(p)]); return remaining < 0; }) ?? candidates.at(-1)!;
  return { pitch, kind, state: { ...state, previous: pitchLabel(pitch), prompts: state.prompts+1, focusPrompt: state.focusRemaining > 0, focusRemaining: Math.max(0,state.focusRemaining-1), contrastRemaining: Math.max(0,state.contrastRemaining-1), contrast } };
}
export function recommendation(attempts: number, correct: number, notes: NoteHistory, misses?: Readonly<Record<string,number>>) {
  if (attempts >= 20 && correct / attempts >= .9) return 'Ready for more? Try a broader preset next time.';
  if (attempts >= 20 && correct / attempts < .7) {
    const missed = (misses ? Object.entries(misses) : Object.entries(notes).map(([p,records]) => [p,records.filter(o => !o.correct).length] as const)).filter(([,n]) => n).sort((a,b) => b[1]-a[1] || a[0].localeCompare(b[0],'en')).slice(0,2).map(([p]) => p);
    return `Try revisiting ${missed.join(' and ') || 'these notes'} next time. Take your time.`;
  }
  return 'Every note is a step forward. Keep practicing at your own pace.';
}

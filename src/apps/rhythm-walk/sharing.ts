import { bool, choice, list, number, record, text } from '../../shared/sharing/activity-link.ts';
import type { ActivityAdapter } from '../../shared/sharing/activity-link.ts';
import { createScore } from '../../music/score.ts';
import type { RhythmScore } from '../../music/score.ts';
import { captureCountingPreferences } from '../../music/counting/preferences.ts';
import { buildCountingPlan } from '../../music/counting/plan.ts';
import { defaultPreferences, readPreferences } from './activity.ts';
import type { Activity, Preferences } from './activity.ts';
import { generationIssue, selectedSixteenthPatterns } from './shared/generation.ts';
import { teachingPresetLabel } from './shared/teaching-presets.ts';

const fields = ['mode','generation','counting','bpm','metronome','showCounts','wrapped','playStyle'] as const;
export type SharedRhythmPreferences = Pick<Preferences,typeof fields[number]>;
export interface RhythmActivity { score: RhythmScore; preferences: SharedRhythmPreferences }
function stable(value: unknown): string {
  const sort = (v: unknown): unknown => Array.isArray(v) ? v.map(sort) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).filter(([,v]) => v !== undefined).sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => [k,sort(v)])) : v;
  return JSON.stringify(sort(value));
}
export function hasPendingGeneration(activity: Activity): boolean {
  const comparable = (generation: Preferences['generation']) => stable({...generation,sixteenthPatterns:[...selectedSixteenthPatterns(generation)].sort()});
  return comparable(activity.preferences.generation) !== comparable(activity.exerciseGeneration);
}
export function captureRhythm(activity: Activity): RhythmActivity {
  const preferences = Object.fromEntries(fields.map(k => [k,structuredClone(activity.preferences[k])])) as unknown as SharedRhythmPreferences;
  preferences.counting = activity.countingPlan.preferences;
  preferences.generation = activity.exerciseGeneration;
  return rhythmAdapter.validate({score:activity.exercise.score,preferences});
}
export const rhythmAdapter: ActivityAdapter<RhythmActivity> = {
  app:'rhythm',version:1,path:() => '/rhythm/',
  validate(input) {
    const raw = record(input,['score','preferences']); const p = record(raw.preferences,fields);
    if (Object.keys(p).length !== fields.length) throw new Error('Incomplete rhythm settings.');
    choice(p.mode,['write','tap']); choice(p.playStyle,['tap','hold']); number(p.bpm,40,180,false);
    for (const key of ['metronome','showCounts','wrapped']) bool(p[key]);
    captureCountingPreferences(p.counting as Preferences['counting']);
    record(p.generation,['meters','measures','ingredients','allowUnintuitiveNotation','ties','syncopation','sixteenthPatterns','figureProfile','teachingPreset','restrictions']);
    const restored = readPreferences(JSON.stringify({...defaultPreferences(),...p}));
    if (stable(restored.generation) !== stable(p.generation)) throw new Error('Unsupported rhythm generation settings.');
    const issue = generationIssue(restored.generation); if (issue) throw new Error(issue);
    const scoreInput = record(raw.score,['measures']); const measures = list(scoreInput.measures,4);
    if (!measures.length) throw new Error('Empty rhythm passage.');
    for (const measure of measures) {
      const m = record(measure,['meter','notes']); const meter = list(m.meter,2);
      if (meter.length !== 2) throw new Error('Unsupported meter.');
      for (const note of list(m.notes,64)) {
        const n = record(note,['id','kind','type','dots','timeModification','tieNext']); text(n.id,80);
        if (n.timeModification !== undefined && (JSON.stringify(n.timeModification) !== '[3,2]' || n.type !== 'eighth' || meter[1] !== 4)) throw new Error('This tuplet is not supported by this activity.');
      }
    }
    const score = createScore(raw.score as RhythmScore); buildCountingPlan(score,restored.counting);
    const preferences = Object.fromEntries(fields.map(k => [k,restored[k]])) as unknown as SharedRhythmPreferences;
    return {score,preferences};
  },
  describe:value => `Uno234 · ${teachingPresetLabel(value.preferences.generation.teachingPreset)} · ${value.preferences.mode === 'tap' ? 'Perform' : 'Counts'} · ${value.score.measures.length} measures · ${value.preferences.bpm} BPM`,
};

import { createPracticeStore, LIMITS } from './state.ts';
import type { Action, PracticeStore } from './state.ts';
import { bool, number, record } from '../shared/sharing/activity-link.ts';
import type { ActivityAdapter } from '../shared/sharing/activity-link.ts';

const actions = {
  focus:'focus', tunerAccuracy:'tuner-accuracy', toneNote:'tone-note', octave:'octave', sustain:'sustain', toneSound:'tone-sound',
  tempo:'tempo', meter:'meter', numbered:'numbered', subdivision:'subdivision', accent:'accent', clickSound:'click-sound',
} as const;
const keys = ['a4','transposition','showUno','manualHz',...Object.keys(actions),'beatAccents'] as const;
export type ToolActivity = Pick<ReturnType<PracticeStore['get']>, 'a4' | 'transposition' | 'showUno' | 'manualHz' | 'beatAccents' | keyof typeof actions>;
export function captureTools(store: PracticeStore): ToolActivity {
  return Object.fromEntries(keys.map(k => [k,structuredClone(store.get()[k as keyof ReturnType<PracticeStore['get']>])])) as ToolActivity;
}
export function applyTools(store: PracticeStore, value: ToolActivity) {
  store.dispatch({type:'settings',value:{a4:value.a4,transposition:value.transposition,showUno:value.showUno}});
  for (const [key,type] of Object.entries(actions)) store.dispatch({type,value:value[key as keyof typeof actions]} as Action);
  store.dispatch({type:'pitch',value:value.manualHz});
  value.beatAccents.forEach((v,i) => { if (store.get().beatAccents[i] !== v) store.dispatch({type:'beat-accent',value:i}); });
}
export const toolAdapter: ActivityAdapter<ToolActivity> = {
  app:'tuno',version:1,
  path:value => ({tuner:'/tune/',tone:'/tone/',metronome:'/tempo/'}[value.focus]),
  validate(input) {
    const raw = record(input,keys);
    if (Object.keys(raw).length !== keys.length) throw new Error('Incomplete tool settings.');
    for (const key of ['showUno','sustain','numbered','accent']) bool(raw[key]);
    number(raw.a4,LIMITS.a4.min,LIMITS.a4.max,false); bool(raw.showUno);
    if (raw.manualHz !== null) number(raw.manualHz,LIMITS.frequency.min,LIMITS.frequency.max,false);
    if (!Array.isArray(raw.beatAccents) || raw.beatAccents.length !== 7) throw new Error('Invalid accents.'); raw.beatAccents.forEach(bool);
    const store = createPracticeStore(); applyTools(store,raw as unknown as ToolActivity);
    const value = captureTools(store);
    if (keys.some(k => JSON.stringify(raw[k]) !== JSON.stringify(value[k as keyof ToolActivity]))) throw new Error('Unsupported tool settings.');
    return value;
  },
  describe:value => `${{tuner:'Tune',tone:'Tone',metronome:'UnoMet'}[value.focus]} · A4 ${value.a4} Hz · ${value.tempo} BPM · ${value.meter}`,
};

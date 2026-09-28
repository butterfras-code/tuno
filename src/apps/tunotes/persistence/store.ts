import { Challenge, validateRules } from '../engine/challenge.ts';
import type { ChallengeRules, ChallengeEnd } from '../engine/challenge.ts';
import { ALGORITHM_VERSION, activePool, expansionPlan } from '../engine/adaptive.ts';
import type { Learning } from '../engine/adaptive.ts';
import { normalizePreset, presets, fingerprint } from '../domain/presets.ts';
import type { PresetSource, Preset } from '../domain/presets.ts';
import { keySignature, keyName, parsePitch, pitchLabel, letters } from '../domain/notation.ts';
import type { ContinueAfter, Observation, Practice } from '../engine/practice.ts';
export const STORAGE_KEY = 'tunotes:data:v1';
export const MAX_BYTES = 5 * 1024 * 1024;
export interface Result { version: 1; context: string; attempts: number; correct: number; first20: number; interrupted: boolean; at: number; activeMs: number; challenge?: { rules: ChallengeRules; end: ChallengeEnd; bestStreak: number }; preview?: { shown: boolean; skipped: boolean; completed: boolean } }
export interface Context { fingerprint: string; version: 1; updated: number; notes: Record<string, Observation[]>; learning?: Learning }
export interface Profile { id: string; name: string; results: Result[]; contexts: Context[]; adaptive?: boolean; preview?: boolean }
export interface Snapshot { appId: 'tunotes'; schemaVersion: 4; profiles: Profile[]; customPresets: PresetSource[]; configuration: { remember: boolean; profileId: string | null; presetId: string; selfPaced: boolean; continueAfter?: ContinueAfter } }
export const emptySnapshot = (): Snapshot => ({ appId: 'tunotes', schemaVersion: 4, profiles: [], customPresets: [], configuration: { remember: false, profileId: null, presetId: 'treble-lines-and-spaces', selfPaced: false } });
function fail(message: string): never { throw new Error(message); }
function object(v: unknown, keys: string[]): Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) fail('Expected an object.');
  const o = v as Record<string, unknown>;
  if (Object.keys(o).some(k => !keys.includes(k))) fail('Backup contains unsupported fields.');
  return o;
}
function string(v: unknown, max = 200): string { if (typeof v !== 'string' || !v.length || v.length > max) fail('Invalid or oversized text.'); return v; }
function number(v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): number { if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) fail('Invalid number.'); return v; }
function integer(v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER) { const n = number(v,min,max); if (!Number.isInteger(n)) fail('Expected an integer.'); return n; }
function boolean(v: unknown): boolean { if (typeof v !== 'boolean') fail('Expected true or false.'); return v; }
function array(v: unknown, max: number): unknown[] { if (!Array.isArray(v) || v.length > max) fail('Invalid or oversized collection.'); return v; }
function id(v: unknown) { const s = string(v,80); if (!/^[a-zA-Z0-9_-]+$/.test(s)) fail('Invalid ID.'); return s; }
function unique(values: string[]) { if (new Set(values).size !== values.length) fail('Duplicate IDs or contexts.'); }
function source(v: unknown): PresetSource {
  const o = object(v,['id','name','clef','range','content','key','accidentals','ledgerBelow','ledgerAbove','editorVersion','modifiers','availableClefs','endpointClefs']);
  const range = array(o.range,2); if (range.length !== 2) fail('A range needs two boundaries.');
  const key = object(o.key,['tonic','fifths','mode']); const tonic = object(key.tonic,['letter','accidental','octave']);
  const canonical = keySignature(keyName({ fifths: integer(key.fifths,-7,7), tonic: { letter: 'C', accidental: 0 }, mode: 'major' }));
  if (key.mode !== 'major' || tonic.letter !== canonical.tonic.letter || tonic.accidental !== canonical.tonic.accidental || tonic.octave !== undefined && tonic.octave !== 4) fail('Invalid key signature.');
  const result: PresetSource = { id: id(o.id), name: string(o.name,80), clef: string(o.clef) as PresetSource['clef'], range: [string(range[0],3),string(range[1],3)], content: string(o.content) as PresetSource['content'], key: canonical, accidentals: string(o.accidentals) as PresetSource['accidentals'], ledgerBelow: o.ledgerBelow === undefined ? undefined : integer(o.ledgerBelow,0,4), ledgerAbove: o.ledgerAbove === undefined ? undefined : integer(o.ledgerAbove,0,4) };
  if (o.editorVersion !== undefined) {
    if (o.editorVersion !== 2) fail('Unsupported custom editor version.');
    Object.assign(result, { editorVersion: 2, modifiers: array(o.modifiers,4).map(v => string(v)), availableClefs: array(o.availableClefs,4).map(v => string(v)), endpointClefs: array(o.endpointClefs,2).map(v => string(v)) });
  } else if (o.modifiers !== undefined || o.availableClefs !== undefined || o.endpointClefs !== undefined) fail('Missing custom editor version.');
  // Keep earlier saved configurations/history importable even if their spelling pool is no longer playable.
  normalizePreset(result, { legacySpellings: true }); return result;
}
function observation(v: unknown): Observation {
  const o = object(v,['pitch','answer','correct','responseMs','activity','preset']);
  const p = object(o.pitch,['letter','accidental','octave']), a = object(o.answer,['letter','accidental']);
  if (!letters.includes(p.letter as never) || !letters.includes(a.letter as never) || !['practice','challenge'].includes(String(o.activity))) fail('Invalid observation.');
  const pitch = parsePitch(`${p.letter}${integer(p.accidental,-1,1) === 1 ? '#' : p.accidental === -1 ? 'b' : ''}${integer(p.octave,0,8)}`);
  const answer = { letter: a.letter as typeof pitch.letter, accidental: integer(a.accidental,-1,1) as typeof pitch.accidental };
  const correct = boolean(o.correct);
  if (correct !== (pitch.letter === answer.letter && pitch.accidental === answer.accidental)) fail('Inconsistent observation.');
  return { pitch, answer, correct, responseMs: number(o.responseMs), activity: o.activity as Observation['activity'], preset: id(o.preset) };
}
function exposure(value: unknown) {
  const p = object(value,['shown','skipped','completed']);
  const result = { shown: boolean(p.shown), skipped: boolean(p.skipped), completed: boolean(p.completed) };
  if (!result.shown && (result.skipped || result.completed)) fail('Invalid preview exposure.');
  return result;
}
/** Version 0 is the supported early backup shape: identical records, without configuration. */
export function validateSnapshot(input: unknown): Snapshot {
  const o = object(input,['appId','schemaVersion','profiles','customPresets','configuration']);
  if (o.appId !== 'tunotes') fail('This is not a tuNotes backup.');
  const version = integer(o.schemaVersion);
  if (version > 4) fail('This backup needs a newer version of tuNotes.');
  if (version === 0) {
    if (o.configuration !== undefined) fail('Version 0 backups cannot contain configuration.');
    return validateSnapshot({ ...o, schemaVersion: 4, configuration: emptySnapshot().configuration });
  }
  const customPresets = array(o.customPresets,100).map(source);
  unique([...presets.map(p => p.id), ...customPresets.map(p => p.id)]);
  const validPresets = new Set([...presets.map(p => p.id), ...customPresets.map(p => p.id)]);
  const profiles = array(o.profiles,32).map(value => {
    const p = object(value,['id','name','results','contexts','adaptive','preview']);
    const results = array(p.results,100).map(value => {
      const r = object(value,['version','context','attempts','correct','first20','interrupted','at','activeMs','preview','challenge']);
      if (r.version !== 1) fail('Unsupported result version.');
      const attempts = integer(r.attempts), correct = integer(r.correct,0,attempts);
      let challenge: Result['challenge'];
      if (r.challenge !== undefined) {
        const c = object(r.challenge,['rules','end','bestStreak']);
        const rules = validateRules(c.rules);
        if (!['completed','timeout','partial'].includes(String(c.end))) fail('Invalid Challenge outcome.');
        const end = c.end as ChallengeEnd, activeMs = integer(r.activeMs);
        const limit = (rules.goal === 'timed' ? rules.seconds : rules.timeout) * 1000;
        if (activeMs > limit || end === 'timeout' && (rules.goal !== 'target' || activeMs !== limit) || end === 'completed' && (rules.goal === 'timed' ? activeMs !== limit : correct !== rules.target || activeMs >= limit) || rules.goal === 'target' && (correct > rules.target || end !== 'completed' && correct >= rules.target)) fail('Inconsistent Challenge outcome.');
        challenge = { rules, end, bestStreak: integer(c.bestStreak,0,correct) };
      }
      const context = validateContext(string(r.context,10000),validPresets);
      if ((JSON.parse(context)[6] === 'challenge') !== Boolean(challenge)) fail('Challenge result needs rules and outcome.');
      return { ...(challenge ? { challenge } : {}), version: 1 as const, context, attempts, correct, first20: integer(r.first20,Math.max(0,correct-Math.max(0,attempts-20)),Math.min(20,correct)), interrupted: boolean(r.interrupted), at: integer(r.at), activeMs: number(r.activeMs), ...(r.preview === undefined ? {} : { preview: exposure(r.preview) }) };
    });
    const contexts = array(p.contexts,128).map(value => {
      const c = object(value,['fingerprint','version','updated','notes','learning']);
      if (c.version !== 1) fail('Unsupported observation version.');
      const fp = validateContext(string(c.fingerprint,10000),validPresets);
      if (!c.notes || typeof c.notes !== 'object' || Array.isArray(c.notes)) fail('Invalid note history.');
      const parts = JSON.parse(fp);
      const builtin = presets.find(preset => fingerprint(preset,true,parts[6]) === fp);
      let learning: Learning | undefined;
      if (c.learning !== undefined) {
        const state = object(c.learning,['algorithmVersion','expansionCount']);
        learning = { algorithmVersion: integer(state.algorithmVersion,1), expansionCount: integer(state.expansionCount,0,189) };
        if (parts[7] !== true) fail('Learning state requires adaptation.');
        if (learning.algorithmVersion === ALGORITHM_VERSION && learning.expansionCount > (builtin ? expansionPlan(builtin).length : 0)) fail('Expansion exceeds approved bounds.');
      }
      const allowed: string[] = builtin ? activePool(builtin,learning && learning.algorithmVersion !== ALGORITHM_VERSION ? { algorithmVersion: ALGORITHM_VERSION, expansionCount: expansionPlan(builtin).length } : learning).map(pitchLabel) : parts[5];
      const entries = Object.entries(c.notes); if (entries.length > 189) fail('Too many tracked pitches.');
      const notes: Record<string,Observation[]> = {};
      for (const [label, records] of entries) {
        const values = array(records,10).map(observation);
        if (!allowed.includes(label) || !values.length || values.some(r => pitchLabel(r.pitch) !== label || r.preset !== parts[0] || r.activity !== parts[6])) fail('Note history references the wrong pitch or preset.');
        notes[label] = values;
      }
      return { fingerprint: fp, version: 1 as const, updated: integer(c.updated), notes, ...(learning ? { learning } : {}) };
    });
    unique(contexts.map(c => c.fingerprint));
    const name = string(p.name,40); if (name !== name.trim()) fail('Names must be trimmed.');
    return { id: id(p.id), name, results, contexts, ...(p.adaptive === undefined ? {} : { adaptive: boolean(p.adaptive) }), ...(p.preview === undefined ? {} : { preview: boolean(p.preview) }) };
  });
  unique(profiles.map(p => p.id));
  const c = object(o.configuration,['remember','profileId','presetId','selfPaced','continueAfter']);
  if (c.continueAfter !== undefined && (typeof c.continueAfter !== 'string' || !['instant','delay','click','correct'].includes(c.continueAfter))) fail('Invalid feedback pacing.');
  const profileId = c.profileId === null ? null : id(c.profileId);
  if (profileId !== null && !profiles.some(p => p.id === profileId)) fail('Selected profile does not exist.');
  const presetId = id(c.presetId); if (!validPresets.has(presetId)) fail('Selected preset does not exist.');
  return { appId: 'tunotes', schemaVersion: 4, profiles, customPresets, configuration: { remember: boolean(c.remember), profileId, presetId, selfPaced: boolean(c.selfPaced), ...(c.continueAfter === undefined ? {} : { continueAfter: c.continueAfter as ContinueAfter }) } };
}
function validateContext(value: string, validPresets: Set<string>) {
  const parts: unknown = JSON.parse(value);
  if (!Array.isArray(parts) || ![9,10].includes(parts.length)) fail('Invalid practice context.');
  const [preset,version,clef,key,policy,pool,activity,adaptive,input] = parts;
  if (!validPresets.has(id(preset))) fail('History refers to a missing preset.');
  if (version !== 1 || !['treble','bass','alto','tenor'].includes(String(clef)) || !['key-only','sharps','flats','both'].includes(String(policy)) || !['practice','challenge'].includes(String(activity)) || typeof adaptive !== 'boolean' || input !== 'letters') fail('Unsupported practice context.');
  if (parts.length === 10) {
    const extra = object(parts[9],['version','clefs','modifiers']);
    const clefs = array(extra.clefs,4).map(v => string(v));
    const modifiers = array(extra.modifiers,4).map(v => string(v));
    if (extra.version !== 2 || !clefs.length || clefs.some(c => !['treble','bass','alto','tenor'].includes(c)) || !modifiers.length || modifiers.some(m => !['key','flat','natural','sharp'].includes(m))) fail('Invalid graphical practice context.');
    unique(clefs); unique(modifiers);
  }
  keySignature(string(key));
  const pitches = array(pool,189).map(v => string(v,5));
  if (!pitches.length) fail('Empty context pool.'); unique(pitches);
  pitches.forEach(v => { const p = parsePitch(v.replace('♯','#').replace('♭','b')); if (pitchLabel(p) !== v) fail('Invalid pitch label.'); });
  return value;
}
export function parseBackup(text: string) { if (new TextEncoder().encode(text).length > MAX_BYTES) fail('Backup exceeds 5 MiB.'); return validateSnapshot(JSON.parse(text)); }
export interface StorageAdapter { getItem(key: string): string | null; setItem(key: string,value: string): void; removeItem(key: string): void }
export class NotesStore {
  data = emptySnapshot(); message = ''; durable = true;
  private storage: StorageAdapter | undefined;
  private pending: ReturnType<typeof setTimeout> | undefined;
  constructor(storage?: StorageAdapter) {
    this.storage = storage;
    try { if (!storage) throw new Error(); const raw = storage.getItem(STORAGE_KEY); if (raw !== null) this.data = parseBackup(raw); }
    catch { this.durable = false; this.message = 'Saved data could not be read. Using memory only; you can export a backup. Existing saved data has been preserved.'; }
  }
  update(change: (data: Snapshot) => void, deferred = false) {
    const next = structuredClone(this.data); change(next); this.data = validateSnapshot(next);
    while (new TextEncoder().encode(JSON.stringify(this.data)).length > MAX_BYTES) {
      const oldest = this.data.profiles.filter(p => p.contexts.length).sort((a,b) => a.contexts[0]!.updated - b.contexts[0]!.updated)[0];
      if (oldest) oldest.contexts.shift();
      else {
        const history = this.data.profiles.filter(p => p.results.length).sort((a,b) => a.results[0]!.at - b.results[0]!.at)[0];
        if (!history) throw new Error('Data exceeds the backup size limit.');
        history.results.shift();
      }
    }
    if (deferred) { if (!this.pending) this.pending = setTimeout(() => this.flush(),400); } else this.flush();
  }
  flush() {
    if (this.pending) clearTimeout(this.pending); this.pending = undefined;
    if (!this.durable) return;
    try { this.storage!.setItem(STORAGE_KEY,JSON.stringify(this.data)); }
    catch { this.durable = false; this.message = 'Storage is unavailable or full. Progress is kept in memory; export a backup before closing.'; }
  }
  replace(candidate: Snapshot) {
    const next = validateSnapshot(candidate);
    // Keep both the previous memory snapshot and the durable snapshot on a failed import.
    if (this.durable) {
      try { this.storage!.setItem(STORAGE_KEY,JSON.stringify(next)); }
      catch { throw new Error('Import was not committed: storage write failed. Existing data is unchanged.'); }
    }
    if (this.pending) clearTimeout(this.pending); this.pending = undefined; this.data = next;
    this.message = this.durable ? 'Backup imported.' : 'Backup replaced in memory only. Export before closing.';
  }
  clear() {
    if (this.pending) clearTimeout(this.pending); this.pending = undefined;
    this.data = emptySnapshot();
    try { if (!this.storage) throw new Error(); this.storage.removeItem(STORAGE_KEY); this.durable = true; this.message = 'All tuNotes data in this storage context was deleted.'; }
    catch { this.durable = false; this.message = 'In-memory data was deleted. Browser storage is unavailable, so previously saved data could not be deleted; clear site data in your browser to remove it.'; }
  }
  export() { return JSON.stringify(this.data); }
  profile() { return this.data.configuration.remember ? this.data.profiles.find(p => p.id === this.data.configuration.profileId) : undefined; }
  benchmark(preset: Preset, adaptive = false) { return Math.max(10,...(this.profile()?.results.filter(r => r.context === fingerprint(preset,adaptive) && r.attempts >= 20 && !r.interrupted).slice(-5).map(r => r.first20) ?? [])); }
  challengeBenchmark(preset: Preset, adaptive: boolean, rules: ChallengeRules) {
    return this.challengeBenchmarkFor(this.profile()?.id,preset,adaptive,rules);
  }
  challengeBenchmarkFor(profileId: string | undefined, preset: Preset, adaptive: boolean, rules: ChallengeRules) {
    if (rules.goal === 'target') return rules.target;
    return Math.max(10,...(this.data.profiles.find(p => p.id === profileId)?.results.filter(r => r.context === fingerprint(preset,adaptive,'challenge') && r.challenge?.end === 'completed' && !r.interrupted && r.attempts > 0 && JSON.stringify(r.challenge.rules) === JSON.stringify(rules)).slice(-5).map(r => r.correct) ?? []));
  }
  observe(profileId: string | undefined, preset: Preset, observation: Observation, adaptive = false, learning?: Learning) {
    if (!profileId) return;
    this.update(data => {
      const p = data.profiles.find(p => p.id === profileId); if (!p) return;
      const fp = fingerprint(preset,adaptive,observation.activity); let context = p.contexts.find(c => c.fingerprint === fp);
      if (!context) { context = { fingerprint: fp, version: 1, updated: Date.now(), notes: {} }; p.contexts.push(context); }
      if (adaptive && learning) { if (context.learning && context.learning.algorithmVersion !== learning.algorithmVersion) context.notes = {}; context.learning = learning; }
      context.updated = Date.now(); const label = pitchLabel(observation.pitch);
      context.notes[label] = [...(context.notes[label] ?? []),observation].slice(-10);
      p.contexts.sort((a,b) => a.updated - b.updated); p.contexts = p.contexts.slice(-128);
    },true);
  }
  record(profileId: string | undefined, session: Practice) {
    if (!profileId || !session.attempts && !(session instanceof Challenge)) return;
    this.update(data => {
      const p = data.profiles.find(p => p.id === profileId); if (!p) return;
      p.results.push({ version: 1, context: fingerprint(session.preset,session.adaptive,session.activity), attempts: session.attempts, correct: session.correct, first20: session.first20Correct, interrupted: session.interrupted, at: Date.now(), activeMs: session instanceof Challenge ? Math.floor(session.activeMs) : session.activeMs, ...(session instanceof Challenge ? { challenge: { rules: session.rules, end: session.end ?? 'partial', bestStreak: session.bestStreak } } : {}), preview: session.preview });
      p.results = p.results.slice(-100);
    });
  }
}

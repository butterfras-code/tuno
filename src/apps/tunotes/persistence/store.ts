import { applyObservation, changes } from './operations.ts';
import type { Mutation, Operation, Repository, SavedState } from './operations.ts';
import { migrateLegacyFingering } from './legacy-fingering.ts';
import { canonicalFingering } from '../../../shared/input/fingering-code.ts';
import { acceptsFingering, acceptsKeyboard, fingeringFor, validFingering } from '../domain/fingering.ts';
import type { NoteAnswer } from '../domain/fingering.ts';
import { Challenge, validateRules } from '../engine/challenge.ts';
import type { ChallengeRules, ChallengeEnd } from '../engine/challenge.ts';
import { ALGORITHM_VERSION, activePool, expansionPlan } from '../engine/adaptive.ts';
import type { Learning } from '../engine/adaptive.ts';
import { normalizePreset, presets, fingerprint } from '../domain/presets.ts';
import type { PresetSource, Preset } from '../domain/presets.ts';
import { chromatic, keySignature, keyName, parsePitch, pitchLabel, letters } from '../domain/notation.ts';
import type { ContinueAfter, Observation, Practice } from '../engine/practice.ts';
export const STORAGE_KEY = 'tunotes:data:v1';
export const MAX_BYTES = 5 * 1024 * 1024;
export interface Result { version: 1; context: string; attempts: number; correct: number; first20: number; interrupted: boolean; at: number; activeMs: number; challenge?: { rules: ChallengeRules; end: ChallengeEnd; bestStreak: number }; preview?: { shown: boolean; skipped: boolean; completed: boolean } }
export interface Context { fingerprint: string; version: 1; updated: number; notes: Record<string, Observation[]>; learning?: Learning }
export interface Profile { id: string; name: string; results: Result[]; contexts: Context[]; adaptive?: boolean; preview?: boolean; defaultPresetId: string }
export interface Snapshot { appId: 'tunotes'; schemaVersion: 7; profiles: Profile[]; customPresets: PresetSource[]; configuration: { remember: boolean; profileId: string | null; presetId: string; selfPaced: boolean; continueAfter?: ContinueAfter; showKeySignature?: boolean } }
export const emptySnapshot = (): Snapshot => ({ appId: 'tunotes', schemaVersion: 7, profiles: [], customPresets: [], configuration: { remember: false, profileId: null, presetId: 'treble-lines-and-spaces', selfPaced: false } });
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
  const o = object(v,['id','name','clef','range','content','key','keyless','exactRange','accidentals','ledgerBelow','ledgerAbove','editorVersion','modifiers','availableClefs','endpointClefs']);
  const range = array(o.range,2); if (range.length !== 2) fail('A range needs two boundaries.');
  const key = object(o.key,['tonic','fifths','mode']); const tonic = object(key.tonic,['letter','accidental','octave']);
  const canonical = keySignature(keyName({ fifths: integer(key.fifths,-7,7), tonic: { letter: 'C', accidental: 0 }, mode: 'major' }));
  if (key.mode !== 'major' || tonic.letter !== canonical.tonic.letter || tonic.accidental !== canonical.tonic.accidental || tonic.octave !== undefined && tonic.octave !== 4) fail('Invalid key signature.');
  const result: PresetSource = { id: id(o.id), name: string(o.name,80), clef: string(o.clef) as PresetSource['clef'], range: [string(range[0],3),string(range[1],3)], content: string(o.content) as PresetSource['content'], key: canonical, accidentals: string(o.accidentals) as PresetSource['accidentals'], ledgerBelow: o.ledgerBelow === undefined ? undefined : integer(o.ledgerBelow,0,4), ledgerAbove: o.ledgerAbove === undefined ? undefined : integer(o.ledgerAbove,0,4) };
  if (o.keyless !== undefined) Object.assign(result,{keyless:boolean(o.keyless)});
  if (o.exactRange !== undefined) Object.assign(result,{exactRange:boolean(o.exactRange)});
  if (o.editorVersion !== undefined) {
    if (o.editorVersion !== 2) fail('Unsupported custom editor version.');
    Object.assign(result, { editorVersion: 2, modifiers: array(o.modifiers,4).map(v => string(v)), availableClefs: array(o.availableClefs,4).map(v => string(v)), endpointClefs: array(o.endpointClefs,2).map(v => string(v)) });
  } else if (o.modifiers !== undefined || o.availableClefs !== undefined || o.endpointClefs !== undefined) fail('Missing custom editor version.');
  // Keep earlier saved configurations/history importable even if their spelling pool is no longer playable.
  normalizePreset(result, { legacySpellings: true }); return result;
}
function observation(v: unknown, version: number): Observation {
  const o = object(v,['pitch','answer','correct','responseMs','activity','preset']);
  const p = object(o.pitch,['letter','accidental','octave']);
  if (!letters.includes(p.letter as never) || !['practice','challenge'].includes(String(o.activity))) fail('Invalid observation.');
  const pitch = parsePitch(`${p.letter}${integer(p.accidental,-1,1) === 1 ? '#' : p.accidental === -1 ? 'b' : ''}${integer(p.octave,0,8)}`);
  const a = object(o.answer,['letter','accidental','kind','mask','code','note','matchOctave','instrument']);
  const correct = boolean(o.correct);
  let answer: NoteAnswer;
  if (a.kind === 'fingering') {
    const field = version < 7 ? 'mask' : 'code';
    object(a,['kind',field,'instrument']);
    const instrument = a.instrument === undefined ? undefined : string(a.instrument,40);
    const config = fingeringFor(instrument ?? presets.find(p => p.id === o.preset)?.instrument, 4);
    const raw = string(a[field],120);
    const code = version < 6 ? migrateLegacyFingering(raw, config?.instrument ?? '') : validFingering(raw) ? canonicalFingering(raw) : raw;
    if (!config || !config.pitches[chromatic(pitch)] || !validFingering(code) || correct !== acceptsFingering(config,pitch,code)) fail('Invalid fingering observation.');
    answer = { kind: 'fingering', code, ...(instrument ? {instrument} : {}) };
  } else if (a.kind === 'keyboard') {
    object(a,['kind','note','matchOctave']);
    const note = integer(a.note,12,119);
    // Earlier backups graded exact octaves; retain that historical scoring rule.
    const matchOctave = a.matchOctave === undefined ? true : boolean(a.matchOctave);
    answer = { kind: 'keyboard', note, matchOctave };
    if (correct !== acceptsKeyboard(pitch,answer)) fail('Invalid keyboard observation.');
  } else {
    object(a,['letter','accidental']);
    if (!letters.includes(a.letter as never)) fail('Invalid observation.');
    answer = { letter: a.letter as typeof pitch.letter, accidental: integer(a.accidental,-1,1) as typeof pitch.accidental };
    if (correct !== (pitch.letter === answer.letter && pitch.accidental === answer.accidental)) fail('Inconsistent observation.');
  }
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
  if (version > 7) fail('This backup needs a newer version of tuNotes.');
  if (version === 0) {
    if (o.configuration !== undefined) fail('Version 0 backups cannot contain configuration.');
    return validateSnapshot({ ...o, schemaVersion: 5, configuration: emptySnapshot().configuration });
  }
  const customPresets = array(o.customPresets,100).map(source);
  unique([...presets.map(p => p.id), ...customPresets.map(p => p.id)]);
  const validPresets = new Set([...presets.map(p => p.id), ...customPresets.map(p => p.id)]);
  const profiles = array(o.profiles,32).map(value => {
    const p = object(value,['id','name','results','contexts','adaptive','preview','defaultPresetId']);
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
        const values = array(records,10).map(value => observation(value, version));
        if (!allowed.includes(label) || !values.length || values.some(r => pitchLabel(r.pitch) !== label || r.preset !== parts[0] || r.activity !== parts[6])) fail('Note history references the wrong pitch or preset.');
        notes[label] = values;
      }
      return { fingerprint: fp, version: 1 as const, updated: integer(c.updated), notes, ...(learning ? { learning } : {}) };
    });
    unique(contexts.map(c => c.fingerprint));
    const name = string(p.name,40); if (name !== name.trim()) fail('Names must be trimmed.');
    const defaultPresetId = id(p.defaultPresetId);
    if (!validPresets.has(defaultPresetId)) fail('Profile default preset does not exist.');
    return { id: id(p.id), name, results, contexts, defaultPresetId, ...(p.adaptive === undefined ? {} : { adaptive: boolean(p.adaptive) }), ...(p.preview === undefined ? {} : { preview: boolean(p.preview) }) };
  });
  unique(profiles.map(p => p.id));
  const c = object(o.configuration,['remember','profileId','presetId','selfPaced','continueAfter','showKeySignature']);
  if (c.continueAfter !== undefined && (typeof c.continueAfter !== 'string' || !['instant','delay','click','correct'].includes(c.continueAfter))) fail('Invalid feedback pacing.');
  const profileId = c.profileId === null ? null : id(c.profileId);
  if (profileId !== null && !profiles.some(p => p.id === profileId)) fail('Selected profile does not exist.');
  const presetId = id(c.presetId); if (!validPresets.has(presetId)) fail('Selected preset does not exist.');
  return { appId: 'tunotes', schemaVersion: 7, profiles, customPresets, configuration: { remember: boolean(c.remember), profileId, presetId, selfPaced: boolean(c.selfPaced), ...(c.showKeySignature === undefined ? {} : { showKeySignature: boolean(c.showKeySignature) }), ...(c.continueAfter === undefined ? {} : { continueAfter: c.continueAfter as ContinueAfter }) } };
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
    if (extra.version !== 2 || !clefs.length || clefs.some(c => !['treble','bass','alto','tenor'].includes(c)) || modifiers.some(m => !['key','flat','natural','sharp'].includes(m))) fail('Invalid graphical practice context.');
    unique(clefs); unique(modifiers);
  }
  if (key !== 'none') keySignature(string(key));
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
  private saved: string | null = null;
  private writeAllowed = true;
  private statusListeners = new Set<() => void>();
  private sharedDefaults: Snapshot | undefined;
  private transientPresets = new Set<string>();
  beginSharedSession() { this.sharedDefaults = structuredClone(this.data); }
  saveProfileDefault(profileId: string, presetId: string) {
    this.update(data => {
      data.profiles.find(p => p.id === profileId)!.defaultPresetId = presetId;
      if (data.configuration.remember) data.configuration.presetId = presetId;
    });
    if (this.sharedDefaults) {
      const before = structuredClone(this.durableData());
      const saved = this.sharedDefaults.profiles.find(p => p.id === profileId);
      if (saved) saved.defaultPresetId = presetId;
      this.transientPresets.delete(presetId);
      for (const mutation of changes(before, this.durableData())) this.enqueue(mutation);
      this.flush();
    }
  }
  automaticPreset(id: string) { if (this.sharedDefaults && !this.sharedDefaults.customPresets.some(p => p.id === id)) this.transientPresets.add(id); }
  transientPreset(id: string) { this.transientPresets.add(id); }
  private durableData() {
    if (!this.sharedDefaults) return this.data;
    const data = structuredClone(this.data);
    data.configuration = structuredClone(this.sharedDefaults.configuration);
    data.customPresets = data.customPresets.filter(p => !this.transientPresets.has(p.id));
    for (const profile of data.profiles) {
      const saved = this.sharedDefaults.profiles.find(p => p.id === profile.id);
      if (saved) { profile.defaultPresetId = saved.defaultPresetId; profile.adaptive = saved.adaptive; profile.preview = saved.preview; }
      if (this.transientPresets.has(profile.defaultPresetId)) profile.defaultPresetId = emptySnapshot().configuration.presetId;
      const transient = (fp: string) => this.transientPresets.has(JSON.parse(fp)[0]);
      profile.contexts = profile.contexts.filter(c => !transient(c.fingerprint));
      profile.results = profile.results.filter(r => !transient(r.context));
    }
    if (!data.profiles.some(p => p.id === data.configuration.profileId)) { data.configuration.profileId = null; data.configuration.remember = false; }
    if (!presets.some(p => p.id === data.configuration.presetId) && !data.customPresets.some(p => p.id === data.configuration.presetId)) data.configuration.presetId = emptySnapshot().configuration.presetId;
    return data;
  }
  private repository: Repository | undefined;
  private recover: (() => Promise<void>) | undefined;
  allowRecovery(recover: () => Promise<void>) { this.recover = recover; }
  private generation = '';
  private operations: Operation[] = [];
  private saving: Promise<void> = Promise.resolve();
  private writes = 0;
  get savingPending() { return this.writes > 0; }
  private roundGenerations = new WeakMap<Practice, string>();
  private recorded = new WeakSet<Practice>();
  private activeRounds = new Map<Practice, string | undefined>();
  private roundIds = new WeakMap<Practice, string>();
  private roundResults = new WeakMap<Practice, Result>();
  private checkpointAnswers = 0;
  private dirty = false;
  private revision = 0;
  private pending: ReturnType<typeof setTimeout> | undefined;
  useRepository(repository: Repository, state: SavedState) {
    this.repository = repository; this.data = state.data; this.generation = state.generation;
    this.durable = true; this.writeAllowed = true; this.message = ''; this.statusChanged();
  }
  endRound(round: Practice) { this.activeRounds.delete(round); }
  beginRound(round: Practice, profileId?: string) { this.roundGenerations.set(round, this.generation); this.activeRounds.set(round, profileId); }
  private enqueue(mutation: Mutation, generation = this.generation) {
    if (this.repository && this.durable) this.operations.push({ id: crypto.randomUUID(), generation, mutation: structuredClone(mutation) });
    this.dirty = true; this.revision++;
  }
  private saveFailed() {
    this.durable = false;
    this.message = 'Progress couldn’t be saved on this device. You can keep playing. Your progress is still in memory.';
    this.statusChanged();
  }
  /** Refresh between rounds, preserving this tab's setup and any unsaved work. */
  async refresh() {
    await this.flush();
    if (!this.repository || !this.durable || this.operations.length || this.activeRounds.size) return;
    try {
      const revision = this.revision;
      const state = await this.repository.read();
      if (this.operations.length || revision !== this.revision) return;
      const configuration = state.generation === this.generation ? this.data.configuration : state.data.configuration;
      const transient = this.data.customPresets.filter(p => this.transientPresets.has(p.id));
      this.data = state.data; this.generation = state.generation;
      this.data.configuration = configuration;
      if (!this.data.profiles.some(p => p.id === configuration.profileId)) configuration.profileId = null;
      for (const p of transient) if (!this.data.customPresets.some(v => v.id === p.id)) this.data.customPresets.push(p);
      if (!presets.some(p => p.id === configuration.presetId) && !this.data.customPresets.some(p => p.id === configuration.presetId)) configuration.presetId = emptySnapshot().configuration.presetId;
    } catch { this.saveFailed(); }
  }
  async close() { await this.flush(); this.activeRounds.clear(); this.repository?.close(); }

  /** The browser attaches a transactional repository via connectNotesStore; the adapter supports legacy migration/tests. */
  constructor(storage?: StorageAdapter) {
    this.storage = storage;
    try { if (!storage) throw new Error(); this.saved = storage.getItem(STORAGE_KEY); if (this.saved !== null) { this.data = parseBackup(this.saved); this.dirty = JSON.stringify(this.data) !== this.saved; } }
    catch { this.durable = false; this.message = 'Saved data could not be read. Using memory only; you can export a backup. Existing saved data has been preserved.'; }
  }
  onStatusChange(listener: () => void) { this.statusListeners.add(listener); listener(); return () => { this.statusListeners.delete(listener); }; }
  get canDeleteSavedData() { return Boolean(this.recover) || this.writeAllowed && Boolean(this.repository || this.storage); }
  private statusChanged() { this.statusListeners.forEach(listener => listener()); }
  /** Preserve usable memory when durable storage cannot be opened. */
  memoryOnly(message: string) {
    this.writeAllowed = false; this.durable = false; this.message = message;
    if (this.pending) clearTimeout(this.pending); this.pending = undefined;
    this.statusChanged();
  }
  private requireCurrent() {
    if (!this.writeAllowed || !this.storage) throw new Error('This tab cannot save.');
    // This check detects external/older writers; the browser lock provides mutual exclusion.
    if (this.storage.getItem(STORAGE_KEY) !== this.saved) {
      this.memoryOnly('Saved data changed elsewhere. This tab is using memory only. Export your work before reloading saved data.');
      throw new Error('Saved data changed elsewhere. Export your work before reloading.');
    }
  }
  private write(raw: string) { this.requireCurrent(); this.storage!.setItem(STORAGE_KEY, raw); this.saved = raw; }
  update(change: (data: Snapshot) => void, deferred = false) {
    const before = this.repository ? structuredClone(this.durableData()) : undefined;
    const previous = this.data;
    const next = structuredClone(this.data);
    const configurationWrites = new Set<keyof Snapshot['configuration']>();
    next.configuration = new Proxy(next.configuration, {
      set(target, key, value) { configurationWrites.add(key as keyof Snapshot['configuration']); return Reflect.set(target, key, value); },
    });
    change(next); this.data = validateSnapshot(next);
    for (const [round, profileId] of this.activeRounds) {
      const result = this.roundResults.get(round);
      const index = result ? previous.profiles.find(p => p.id === profileId)?.results.indexOf(result) ?? -1 : -1;
      const replacement = index < 0 ? undefined : this.data.profiles.find(p => p.id === profileId)?.results[index];
      if (replacement) this.roundResults.set(round, replacement);
    }
    while (new TextEncoder().encode(JSON.stringify(this.data)).length > MAX_BYTES) {
      const oldest = this.data.profiles.filter(p => p.contexts.length).sort((a,b) => a.contexts[0]!.updated - b.contexts[0]!.updated)[0];
      if (oldest) oldest.contexts.shift();
      else {
        const history = this.data.profiles.filter(p => p.results.length).sort((a,b) => a.results[0]!.at - b.results[0]!.at)[0];
        if (!history) throw new Error('Data exceeds the backup size limit.');
        history.results.shift();
      }
    }
    if (before) {
      const mutations = changes(before, this.durableData());
      // An explicit selection still matters when another tab changed the stored default to a different value.
      if (!this.sharedDefaults && configurationWrites.size) {
        let config = mutations.find(m => m.kind === 'configuration');
        if (!config) { config = { kind: 'configuration', patch: {} }; mutations.push(config); }
        Object.assign(config.patch, Object.fromEntries([...configurationWrites].map(key => [key, this.data.configuration[key]])));
      }
      for (const mutation of mutations) this.enqueue(mutation);
    }
    this.dirty = true;
    if (deferred) { if (!this.pending) this.pending = setTimeout(() => { void this.flush(); },400); this.pending.unref?.(); } else void this.flush();
  }
  flush() {
    for (const [round, profileId] of this.activeRounds) if (round.attempts) this.captureResult(profileId, round, false);
    if (this.pending) clearTimeout(this.pending); this.pending = undefined;
    this.checkpointAnswers = 0;
    if (!this.durable) return this.saving;
    if (this.repository) {
      const batch = this.operations.splice(0);
      if (!batch.length) return this.saving;
      this.writes++; this.statusChanged();
      this.saving = this.saving.then(async () => {
        if (!this.durable) { this.operations.unshift(...batch); this.writes--; this.statusChanged(); return; }
        try {
          const { ignored } = await this.repository!.commit(batch);
          if (ignored) { this.message = 'Saved profiles changed in another tab. This round won’t restore deleted or replaced progress.'; this.statusChanged(); }
        } catch { this.operations.unshift(...batch); this.saveFailed(); }
        finally { this.writes--; this.statusChanged(); }
      });
      return this.saving;
    }
    if (!this.dirty) return this.saving;
    try { this.write(JSON.stringify(validateSnapshot(this.durableData()))); this.dirty = false; }
    catch { if (this.writeAllowed) { this.durable = false; this.message = 'Storage is unavailable or full. Progress is kept in memory; export a backup before closing.'; this.statusChanged(); } }
  }
  replace(candidate: Snapshot): void | Promise<void> {
    const next = validateSnapshot(candidate);
    if (this.repository && this.durable) return this.replaceStored(next);

    // Keep both the previous memory snapshot and the durable snapshot on a failed import.
    if (this.durable) {
      try { this.write(JSON.stringify(next)); }
      catch { throw new Error('Import was not committed: saved data changed or storage write failed. Existing data is unchanged.'); }
    }
    if (this.pending) clearTimeout(this.pending); this.pending = undefined; this.data = next;
    if (this.sharedDefaults) this.sharedDefaults = structuredClone(next); this.transientPresets.clear();
    this.message = this.durable ? 'Backup imported.' : 'Backup replaced in memory only. Export before closing.';
    this.statusChanged();
  }
  private async replaceStored(next: Snapshot) {
    // Serialize behind saves already dispatched, but do not discard pending memory unless replacement commits.
    await this.saving;
    const state = await this.repository!.replace(next);
    try { this.storage?.removeItem(STORAGE_KEY); } catch { /* The transactional replacement is already committed. */ }
    if (this.pending) clearTimeout(this.pending); this.pending = undefined;
    this.operations = []; this.data = state.data; this.generation = state.generation;
    if (this.sharedDefaults) this.sharedDefaults = structuredClone(next);
    this.transientPresets.clear(); this.durable = true; this.message = 'Changes saved.'; this.statusChanged();
  }
  clear(): void | Promise<void> {
    if (!this.repository && this.recover) return this.recover();
    if (this.repository && this.writeAllowed) return this.replaceStored(emptySnapshot());
    if (this.pending) clearTimeout(this.pending); this.pending = undefined;
    this.data = emptySnapshot();
    if (this.sharedDefaults) this.sharedDefaults = emptySnapshot(); this.transientPresets.clear();
    if (!this.writeAllowed) { this.message = 'This tab’s in-memory data was deleted. Saved data is unchanged; reload to use it.'; this.statusChanged(); return; }
    try { this.requireCurrent(); this.storage!.removeItem(STORAGE_KEY); this.saved = null; this.durable = true; this.message = 'All tuNotes data in this storage context was deleted.'; }
    catch { this.durable = false; this.message = 'In-memory data was deleted. Saved data could not be deleted; reload to review it or clear site data in your browser.'; }
    this.statusChanged();
  }
  export() {
    const data = validateSnapshot(this.data);
    let raw = JSON.stringify(data);
    while (new TextEncoder().encode(raw).length > MAX_BYTES) {
      const oldest = data.profiles.filter(p => p.contexts.length).sort((a,b) => a.contexts[0]!.updated - b.contexts[0]!.updated)[0];
      if (oldest) oldest.contexts.shift();
      else {
        const history = data.profiles.filter(p => p.results.length).sort((a,b) => a.results[0]!.at - b.results[0]!.at)[0];
        if (!history) throw new Error('Data exceeds the backup size limit.');
        history.results.shift();
      }
      raw = JSON.stringify(data);
    }
    return raw;
  }
  profile() { return this.data.configuration.remember ? this.data.profiles.find(p => p.id === this.data.configuration.profileId) : undefined; }
  benchmark(preset: Preset, adaptive = false) { return Math.max(10,...(this.profile()?.results.filter(r => r.context === fingerprint(preset,adaptive) && r.attempts >= 20 && !r.interrupted).slice(-5).map(r => r.first20) ?? [])); }
  challengeBenchmark(preset: Preset, adaptive: boolean, rules: ChallengeRules) {
    return this.challengeBenchmarkFor(this.profile()?.id,preset,adaptive,rules);
  }
  challengeBenchmarkFor(profileId: string | undefined, preset: Preset, adaptive: boolean, rules: ChallengeRules) {
    if (rules.goal === 'target') return rules.target;
    return Math.max(10,...(this.data.profiles.find(p => p.id === profileId)?.results.filter(r => r.context === fingerprint(preset,adaptive,'challenge') && r.challenge?.end === 'completed' && !r.interrupted && r.attempts > 0 && JSON.stringify(r.challenge.rules) === JSON.stringify(rules)).slice(-5).map(r => r.correct) ?? []));
  }
  observe(profileId: string | undefined, preset: Preset, observation: Observation, adaptive = false, learning?: Learning, round?: Practice) {
    if (!profileId || round && this.roundGenerations.has(round) && this.roundGenerations.get(round) !== this.generation) return;
    const p = this.data.profiles.find(p => p.id === profileId); if (!p) return;
    const mutation: Extract<Mutation, { kind: 'observation' }> = {
      kind: 'observation', profileId, fingerprint: fingerprint(preset,adaptive,observation.activity),
      observation, ...(adaptive && learning ? { learning: { ...learning } } : {}), at: Date.now(),
    };
    applyObservation(p, mutation);
    if (!this.transientPresets.has(preset.id)) this.enqueue(mutation, round ? this.roundGenerations.get(round) ?? this.generation : this.generation);
    // No history cloning, validation, serialization or storage on the answer path.
    this.checkpointAnswers++;
    if (this.checkpointAnswers >= 20) {
      if (this.pending) clearTimeout(this.pending);
      this.pending = setTimeout(() => { void this.flush(); }, 0);
    } else if (!this.pending) this.pending = setTimeout(() => { void this.flush(); }, 30_000);
    this.pending?.unref?.();
  }

  record(profileId: string | undefined, session: Practice) {
    this.activeRounds.delete(session);
    if (!profileId || !session.attempts && !(session instanceof Challenge)) return;
    if (this.recorded.has(session)) return;
    this.recorded.add(session);
    this.captureResult(profileId, session, true);
    void this.flush();
  }
  private captureResult(profileId: string | undefined, session: Practice, final: boolean) {
    if (this.roundGenerations.has(session) && this.roundGenerations.get(session) !== this.generation) return;
    const p = this.data.profiles.find(p => p.id === profileId); if (!p) return;
    const result: Result = { version: 1, context: fingerprint(session.preset,session.adaptive,session.activity), attempts: session.attempts, correct: session.correct, first20: session.first20Correct, interrupted: !final || session.interrupted, at: this.roundResults.get(session)?.at ?? Date.now(), activeMs: session instanceof Challenge ? Math.floor(session.activeMs) : session.activeMs, ...(session instanceof Challenge ? { challenge: { rules: session.rules, end: session.end ?? 'partial', bestStreak: session.bestStreak } } : {}), preview: session.preview };
    const previous = this.roundResults.get(session);
    if (previous && JSON.stringify(previous) === JSON.stringify(result)) return;
    const index = previous ? p.results.indexOf(previous) : -1;
    if (index < 0) p.results.push(result); else p.results[index] = result;
    p.results = p.results.slice(-100); this.roundResults.set(session, result);
    let roundId = this.roundIds.get(session);
    if (!roundId) { roundId = crypto.randomUUID(); this.roundIds.set(session, roundId); }
    if (!this.transientPresets.has(session.preset.id)) this.enqueue({ kind: 'result', profileId: p.id, roundId, result }, this.roundGenerations.get(session) ?? this.generation);
  }
}

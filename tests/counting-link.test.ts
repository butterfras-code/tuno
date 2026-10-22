import { score } from './score-test-support.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { countingPreferenceOptions, defaultCountingPreferences as defaults } from '../src/music/counting/preferences.ts';
import { encodeCountingPreferences as encode, decodeCountingPreferences as decode, readCountingLink, countingPreferencesUrl, maximumCountingPayloadLength } from '../src/music/counting/link.ts';
import { createPreferenceSession } from '../src/apps/rhythm-walk/counting-session.ts';
import { Activity, defaultPreferences, readPreferences, presets } from '../src/apps/rhythm-walk/activity.ts';
import { enterToken, evaluateAnswer } from '../src/music/counting/answer.ts';
const linked = { ...defaults, longNotes: false, dotted: true, includeRests: false, showDurationLine: false, linePlacement: 'above' as const, internalAppearance: 'lowered' as const, restAppearance: 'slashes' as const, vocabulary: 'syllables' as const, offbeat: '+' as const };

test('all nine dimensions round trip through the canonical versioned contract', () => {
  for (let bits = 0; bits < 16; bits++) for (const linePlacement of countingPreferenceOptions.linePlacement) for (const internalAppearance of countingPreferenceOptions.internalAppearance) for (const restAppearance of countingPreferenceOptions.restAppearance) for (const vocabulary of countingPreferenceOptions.vocabulary) for (const offbeat of countingPreferenceOptions.offbeat) {
    const prefs = { ...defaults, longNotes: Boolean(bits & 1), dotted: Boolean(bits & 2), includeRests: Boolean(bits & 4), showDurationLine: Boolean(bits & 8), linePlacement, internalAppearance, restAppearance, vocabulary, offbeat };
    assert.deepEqual(decode(encode(prefs)), prefs);
  }
});
test('encoding is deterministic regardless of property order', () => {
  const reversed = Object.fromEntries(Object.entries(linked).reverse()) as typeof linked;
  assert.equal(encode(linked), encode(reversed));
  assert.match(encode(linked), /counting=1&counting.longNotes=false&counting.dotted=true/);
  assert.ok(encode(linked).length < maximumCountingPayloadLength);
});
test('malformed, oversized, unsupported and invalid fields reject the whole link', () => {
  const changed = (key: string, value: string | null) => {
    const params = new URLSearchParams(encode(linked));
    if (value === null) params.delete(key); else params.set(key, value);
    return params.toString();
  };
  const bad = [encode(linked).replace('counting=1', 'counting.version=1'), '', 'counting=invalid', 'counting=1', 'counting.longNotes=true', changed('counting', '2'), changed('counting', '01'), changed('counting.longNotes', 'yes'), changed('counting.dotted', null), changed('counting.extra', 'true'), changed('counting.vocabulary', 'a'.repeat(maximumCountingPayloadLength + 1)), encode(linked) + '&counting=1', encode(linked) + '&counting.dotted=true'];
  for (const key of Object.keys(countingPreferenceOptions)) bad.push(changed(`counting.${key}`, 'invalid'));
  for (const value of bad) {
    assert.throws(() => decode(value));
    if (!value) continue;
    const result = readCountingLink(`?${value}`);
    assert.equal(result.counting, undefined); assert.match(result.notice, /could not be loaded/);
  }
  assert.deepEqual(readCountingLink('?unrelated=yes'), { notice: '' });
});
test('URL overrides saved counting before initial exercise, preserving unrelated preferences', () => {
  const saved = { ...defaultPreferences(), bpm: 123, mode: 'both', playStyle: 'hold' };
  const session = createPreferenceSession(JSON.stringify(saved), `?${encode(linked)}`);
  assert.deepEqual(session.preferences, { ...saved, counting: linked });
  const activity = new Activity(session.preferences, score(presets.find(p => p.id === 'half')!.score.measures));
  assert.deepEqual(activity.countingPlan.preferences, linked);
  assert.equal(activity.countingPlan.counts.length, 4);
  assert.ok(Object.isFrozen(activity.countingPlan.preferences));
  assert.deepEqual(createPreferenceSession(JSON.stringify(saved), '?counting=broken').preferences, saved);
});
test('linked edits and unrelated saves remain isolated until successful explicit adoption', () => {
  const session = createPreferenceSession(null, `?${encode(linked)}`);
  session.preferences.counting = { ...linked, dotted: false };
  session.preferences.bpm = 110; session.preferences.mode = 'tap';
  let saved = session.serialize();
  assert.deepEqual(readPreferences(saved).counting, defaults);
  assert.equal(readPreferences(saved).bpm, 110); assert.equal(readPreferences(saved).mode, 'tap');
  assert.throws(() => session.saveAsDefaults(() => { throw new Error('storage unavailable'); }));
  assert.equal(session.isLinked(), true); assert.deepEqual(readPreferences(session.serialize()).counting, defaults);
  session.saveAsDefaults(raw => { saved = raw; });
  assert.equal(session.isLinked(), false); assert.deepEqual(readPreferences(saved).counting, session.preferences.counting);
  session.preferences.counting = linked;
  assert.deepEqual(readPreferences(session.serialize()).counting, linked);
  assert.deepEqual(createPreferenceSession(saved, '').preferences.counting, { ...linked, dotted: false });
});
test('ordinary sessions save edits; linked pending edits preserve exercise, answers and evaluation until replacement', () => {
  const normal = createPreferenceSession(null, ''); normal.preferences.counting = linked;
  assert.deepEqual(readPreferences(normal.serialize()).counting, linked);
  const session = createPreferenceSession(null, `?${encode(linked)}`);
  const measures = presets.find(p => p.id === 'half')!.score.measures;
  const a = new Activity(session.preferences, score(measures)), plan = a.countingPlan, exercise = a.exercise;
  a.countingAnswer = enterToken(plan, a.countingAnswer, plan.counts[0]!.id, '1');
  a.countingResult = evaluateAnswer(plan, a.countingAnswer);
  const answer = a.countingAnswer, result = a.countingResult;
  session.preferences.counting = defaults;
  session.serialize(); session.saveAsDefaults(() => {});
  assert.equal(a.exercise, exercise); assert.equal(a.countingPlan, plan); assert.equal(a.countingAnswer, answer); assert.equal(a.countingResult, result);
  assert.deepEqual(evaluateAnswer(plan, answer), result);
  a.replace(score(measures)); assert.deepEqual(a.countingPlan.preferences, defaults); assert.equal(a.countingResult, null);
});
test('share URL replaces duplicates, strips fixture access, retains unrelated parameters and view deterministically', () => {
  const url = new URL(countingPreferencesUrl('https://tuno.cc/prototypes/count-writing/?z=1&counting=old&fixture=half&testing=1&counting=other&counting.dotted=old&counting.unknown=old&a=2#settings', linked));
  assert.equal(url.pathname, '/prototypes/count-writing/'); assert.equal(url.hash, '#settings');
  assert.equal(url.searchParams.get('z'), '1'); assert.equal(url.searchParams.get('a'), '2');
  assert.equal(url.searchParams.has('fixture'), false); assert.equal(url.searchParams.has('testing'), false);
  assert.deepEqual(url.searchParams.getAll('counting'), ['1']);
  assert.deepEqual(decode(url.search), linked);
  assert.equal(countingPreferencesUrl(url.href, linked), url.href);
  assert.equal(new URL(countingPreferencesUrl('https://tuno.cc/developer/', linked)).pathname, '/prototypes/rhythm-walk/');
});

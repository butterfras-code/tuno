import test from 'node:test';
import assert from 'node:assert/strict';
import { score, note } from './score-test-support.ts';
import { buildCountingPlan } from '../src/music/counting/plan.ts';
import { defaultCountingPreferences } from '../src/music/counting/preferences.ts';
import { evaluateAnswer, initializeAnswer, enterToken, toggleUnit, type CountingEvaluation } from '../src/music/counting/answer.ts';
import { countingScore, countingProblems } from '../src/apps/rhythm-walk/counting-feedback.ts';
const plan = buildCountingPlan(score([{ meter: [4,4], notes: [note('half', { kind: 'rest' }), note('half', {tieNext:true})] }, { meter: [4,4], notes: [note('half'), note('half')] }]), defaultCountingPreferences);
test('partial credit counts every applicable token and unit once, including cross-bar ties', () => {
  let answer = initializeAnswer(plan);
  const initial = countingScore(evaluateAnswer(plan, answer));
  const expectedTotal = plan.counts.length + plan.units.filter(u => u.restApplicable).length + plan.units.filter(u => u.durationApplicable).length;
  assert.equal(initial.total, expectedTotal);
  const first = plan.counts[0]!;
  answer = enterToken(plan, answer, first.id, first.expectedToken);
  answer = toggleUnit(plan, answer, first.id, 'restMarked');
  const partial = countingScore(evaluateAnswer(plan, answer));
  assert.equal(partial.correct, initial.correct + 2);
  assert.equal(partial.total, initial.total);
  const tied = plan.units.find(u => u.symbolIds.length === 2)!;
  assert.equal(evaluateAnswer(plan, answer).duration.items.filter(i => i.id === tied.id).length, 1);
});
test('edits mark only their aspect pending and leave the confirmed evaluation untouched', () => {
  const checked = initializeAnswer(plan), result = evaluateAnswer(plan, checked), before = countingScore(result);
  const id = plan.counts[0]!.id;
  const edited = enterToken(plan, checked, id, '1');
  const problems = countingProblems(plan, result, checked, edited);
  assert.equal(problems.find(p => p.dimension === 'tokens' && p.item.id === id)?.state, 'edited');
  assert.equal(problems.find(p => p.dimension === 'rests' && p.item.countIds.includes(id))?.state, 'missing');
  assert.deepEqual(countingScore(result), before);
  assert.equal(countingScore(evaluateAnswer(plan, edited)).correct, before.correct + 1);
});
test('corrected answers resolve all independent errors on reassessment', () => {
  let answer = initializeAnswer(plan);
  for (const c of plan.counts) answer = enterToken(plan, answer, c.id, c.expectedToken);
  for (const u of plan.units) {
    if (u.restApplicable && u.expectedRest) answer = toggleUnit(plan, answer, u.counts[0]!.id, 'restMarked');
    if (u.durationApplicable) answer = toggleUnit(plan, answer, u.counts[0]!.id, 'durationIndicated');
  }
  const result = evaluateAnswer(plan, answer);
  assert.equal(countingScore(result).percent, 100);
  assert.equal(countingScore(result).bones, 5);
  assert.deepEqual(countingProblems(plan, result, answer, answer), []);
});
test('counting reuses rhythm thresholds on unrounded percentages; zero applicable points are unrated', () => {
  for (const [correct, bones] of [[0,1],[39,1],[40,2],[59,2],[60,3],[74,3],[75,4],[89,4],[90,5],[100,5]]) {
    const result = { tokens: { verdict: 'incorrect', items: Array.from({length:100}, (_,i) => ({id:`count:0:${i}/1`,verdict:i<correct!?'correct':'incorrect',countIds:[],symbolIds:[],labels:[]})) }, rests:{verdict:'not-applicable',items:[]},duration:{verdict:'not-applicable',items:[]} } as CountingEvaluation;
    assert.equal(countingScore(result).bones,bones);
  }
  const omitted = buildCountingPlan(score([{meter:[4,4],notes:[note('whole',{kind:'rest'})]}]), {...defaultCountingPreferences,includeRests:false});
  assert.deepEqual(countingScore(evaluateAnswer(omitted,initializeAnswer(omitted))),{correct:0,total:0,percent:null,bones:null});
});

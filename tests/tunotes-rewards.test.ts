import test from 'node:test';
import assert from 'node:assert/strict';
import { NotesProgress } from '../src/apps/tunotes/engine/progress.ts';
function learner(goal=10) {
  const progress = new NotesProgress(goal);
  let correct=0, attempts=0, streak=0;
  return {progress, answer(right=true) { attempts++; if(right) {correct++;streak++;} else streak=0; return progress.update(correct,streak,attempts); }, get correct(){return correct;}, get attempts(){return attempts;}, get streak(){return streak;} };
}
test('treats continue beyond the first goal with a growing recent running-streak peak', () => {
  const f=learner(), treats:number[]=[];
  for(let i=1;i<=61;i++) if(f.answer().treat)treats.push(i);
  assert.deepEqual(treats,[10,13,17,22,28,35,44,55]);
  assert.equal(f.progress.interval,13);assert.equal(f.progress.remaining,7);
  assert.equal(f.progress.treats,8);assert.equal(f.progress.pose,'happy');
});
test('recent mistakes ease the interval; peak and mistake influence expire after 20 answers', () => {
  const f=learner();for(let i=0;i<60;i++)f.answer();assert.equal(f.progress.interval,12);
  for(let i=1;i<=5;i++){assert.equal(f.answer(false).treat,false);assert.equal(f.progress.interval,12-Math.ceil(i/4));}
  assert.equal(f.progress.interval,10);
  for(let i=0;i<15;i++)assert.equal(f.answer(false).treat,false);
  assert.equal(f.progress.interval,3);assert.equal(f.progress.remaining,1);assert.equal(f.progress.treats,8);
  assert.equal(f.answer().treat,true); // Existing correct progress was never erased.
  for(let i=1;i<20;i++)f.answer();assert.equal(f.progress.interval,4);
});
test('misses never earn treats, duplicates never earn twice, and retry starts a fresh schedule', () => {
  const f=learner();for(let i=0;i<10;i++)assert.equal(f.answer(false).treat,false);
  assert.equal(f.progress.remaining,10);for(let i=0;i<10;i++)f.answer();assert.equal(f.progress.treats,1);
  assert.equal(f.progress.update(f.correct,f.streak,f.attempts).treat,false);
  assert.equal(f.progress.treats,1);assert.equal(learner().progress.remaining,10);
  for(let i=0;i<100;i++){const before: number=f.progress.treats;assert.equal(f.answer(false).treat,false);assert.equal(f.progress.treats,before);}
  assert.equal(f.progress.interval,3);assert.equal(f.progress.remaining,3);
});
test('small Target goals get their first treat at their actual target, with at least three correct between later treats', () => {
  for(const goal of [1,2,5,10]) {const f=learner(goal);for(let i=1;i<=goal;i++)assert.equal(f.answer().treat,i===goal);assert.equal(f.progress.remaining,3);assert.equal(f.answer().treat,false);assert.equal(f.answer().treat,false);assert.equal(f.answer().treat,true);}
  for(const invalid of [0,-1,NaN,Infinity,1.5])assert.throws(()=>new NotesProgress(invalid));
});

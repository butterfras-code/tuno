import test from 'node:test';
import assert from 'node:assert/strict';
import { celebrationMessage } from '../src/apps/tunotes/ui/answer-feedback.ts';

test('rewards and new notes replace ordinary positive feedback without dropping simultaneous events', () => {
  const treat = { treat: true, text: 'A treat for Uno! Keep exploring.' };
  const streak = { treat: false, text: '20 in a row! Keep going.' };
  const ordinary = { treat: false, text: '' };
  const expansion = 'New Note! Uno added a lower B!';
  assert.equal(celebrationMessage(treat, '', 'Great!'), 'A treat for Uno!');
  assert.equal(celebrationMessage(treat, expansion, 'Great!'), `A treat for Uno!\n${expansion}`);
  assert.equal(celebrationMessage(streak, expansion, 'Great!'), expansion);
  assert.equal(celebrationMessage(streak, '', 'Great!'), streak.text);
  assert.equal(celebrationMessage(ordinary, '', 'Great!'), 'Great!');
});

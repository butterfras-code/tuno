import { el } from '../../../shared/ui/components.ts';
import { Challenge, describeRules } from '../engine/challenge.ts';
import { clefForPitch } from '../domain/presets.ts';
import { renderStaff } from './staff.ts';

function button(label: string, action: () => void, primary = false) {
  const node = el('button', `control${primary ? ' control--primary' : ''}`, label);
  node.type = 'button'; node.addEventListener('click', action); return node;
}
/** One persistent note area for the entire round, including its scoreboard. */
export function challengeScene(actions: { ready: () => void; resume: () => void; retry: () => void; edit: () => void }) {
  const node = el('section','challenge-scene'); node.hidden = true; node.setAttribute('aria-label','Challenge note area');
  const backdrop = el('div','challenge-backdrop'); backdrop.setAttribute('aria-hidden','true');
  const notation = el('div','challenge-notation');
  notation.tabIndex = -1;
  const hud = el('div','challenge-hud');
  const status = el('p'); status.id = 'challenge-status'; status.setAttribute('role','timer');
  const stats = el('p'); stats.id = 'challenge-stats'; hud.append(status,stats);
  const interlude = el('div','challenge-interlude');
  const announcement = el('p','challenge-announcement'); announcement.setAttribute('role','status'); announcement.setAttribute('aria-live','polite'); announcement.setAttribute('aria-atomic','true');
  const cue = el('h2','challenge-cue'); cue.tabIndex = -1;
  const instruction = el('p','muted');
  const ready = button('Ready',actions.ready,true), resume = button('Resume',actions.resume,true);
  interlude.append(cue,instruction,ready,resume);
  const dogSlot = el('div','challenge-dog');
  const treat = el('p','treat-progress'); treat.id = 'challenge-treat-progress';
  dogSlot.append(treat);
  const board = el('section','challenge-scoreboard'); board.id = 'challenge-result'; board.hidden = true;
  const title = el('h2','scoreboard-title','Challenge complete'); title.tabIndex = -1;
  const value = el('p','scoreboard-value');
  const number = el('strong'), unit = el('span'); value.append(number,unit);
  const metrics = el('dl','scoreboard-metrics');
  const metric = (label: string, id: string) => {
    const group = el('div'), term = el('dt','',label), amount = el('dd'); amount.id = id;
    group.append(term,amount); metrics.append(group); return amount;
  };
  const correct = metric('Correct','challenge-correct'), accuracy = metric('Accuracy','challenge-accuracy'), streak = metric('Best streak','challenge-streak');
  const message = el('p','scoreboard-message');
  const controls = el('div','control-row'); controls.append(button('Play again',actions.retry,true),button('Change setup',actions.edit));
  const details = el('details','round-details');
  const detailList = el('dl'); details.append(el('summary','','Round details'),detailList);
  board.append(title,value,metrics,message,controls,details);
  node.append(backdrop,hud,notation,interlude,dogSlot,board,announcement);
  let round = -1, lastPhase = '';
  const phase = (s: Challenge) => s.state === 'finished' ? 'finished' : s.state === 'paused' ? 'paused' : s.phase;
  return {
    node, notation, dogSlot, treat,
    update(s: Challenge, remaining: number, showKeySignature = false) {
      const state = phase(s);
      if (round !== s.session) {
        round = s.session; lastPhase = ''; details.open = false;
        const background = renderStaff(s.pitch,clefForPitch(s.preset,s.pitch),s.preset.key,s.preset.keyless,showKeySignature);
        background.querySelectorAll('.notehead,.note-accidental,.ledger').forEach(n=>n.remove());
        background.removeAttribute('aria-label'); backdrop.replaceChildren(background);
      }
      node.dataset.phase = state;
      board.hidden = state !== 'finished'; interlude.hidden = state === 'playing' || state === 'finished';
      hud.hidden = state === 'finished'; notation.hidden = state !== 'playing';
      backdrop.hidden = state === 'playing';
      ready.hidden = state !== 'ready'; resume.hidden = state !== 'paused';
      treat.hidden = state !== 'playing';
      status.textContent = state === 'ready' ? 'Ready' : state === 'countdown' ? 'Get ready' : state === 'paused' ? 'Paused' : `${(s.remainingMs / 1000).toFixed(1)} s remaining`;
      stats.textContent = state === 'playing' ? `${s.correct}${s.rules.goal === 'target' ? ` / ${s.rules.target}` : ''} correct · ${s.streak} in a row` : '';
      cue.textContent = state === 'countdown' ? String(s.countdown) : state === 'paused' ? 'Paused' : 'Ready?';
      instruction.textContent = state === 'ready' ? describeRules(s.rules) : state === 'paused' ? 'Take your time. This round will be unranked.' : '';
      const speech = state === 'countdown' ? `Starting in ${s.countdown}` : state !== lastPhase ? state === 'playing' ? 'Go!' : state === 'paused' ? 'Paused' : state === 'ready' ? 'Ready when you are.' : '' : announcement.textContent;
      if (announcement.textContent !== speech) announcement.textContent = speech;
      if (state !== lastPhase && state === 'playing') notation.focus({preventScroll:true});
      lastPhase = state;
      treat.textContent = `${remaining} more for a treat`;
    },
    finish(s: Challenge, name?: string) {
      this.update(s,0);
      title.textContent = s.end === 'timeout' ? 'Time’s up!' : s.end === 'partial' ? 'Round finished' : 'Challenge complete';
      const timed = s.rules.goal === 'timed';
      number.textContent = timed ? s.score.toFixed(2) : (Math.floor(s.activeMs)/1000).toFixed(2);
      unit.textContent = timed ? 'points' : 'seconds';
      correct.textContent = String(s.correct); accuracy.textContent = s.accuracy === null ? '—' : `${Math.round(s.accuracy*100)}%`; streak.textContent = String(s.bestStreak);
      message.textContent = s.end === 'timeout' ? `Nice practice — try another round. ${s.correct} of ${s.rules.goal === 'target' ? s.rules.target : 0} notes read.` : s.end === 'partial' ? 'You ended this round early. Every note is practice.' : s.interrupted ? 'Nice practice! This round included a pause.' : !s.attempts ? 'Ready whenever you are. Try a note next time.' : !s.qualified ? 'Nice run! Improve your accuracy to make finals.' : 'Nicely read! Ready for another round?';
      detailList.replaceChildren();
      const row = (label: string, content: string) => { detailList.append(el('dt','',label),el('dd','',content)); };
      if (name) row('Player',name);
      row('Preset',s.preset.name); row('Rules',describeRules(s.rules));
      row('Attempts',String(s.attempts)); row('Active time',`${(Math.floor(s.activeMs)/1000).toFixed(2)} seconds`);
      row('Result',s.qualified ? 'Qualified' : `Unranked${s.interrupted ? ' · Interrupted' : s.end !== 'completed' ? ' · Incomplete' : !s.attempts ? ' · No attempts' : ' · Below the accuracy goal'}`);
      title.focus({preventScroll:true});
    },
    focus() { cue.focus({preventScroll:true}); },
  };
}

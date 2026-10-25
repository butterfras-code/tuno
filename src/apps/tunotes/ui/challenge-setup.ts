import { el } from '../../../shared/ui/components.ts';
import { segments } from './range-editor.ts';
import { validateRules } from '../engine/challenge.ts';
export function challengeSetup(title = 'Solo Challenge', inline = false) {
  const node = inline ? el('section','challenge-settings visual-content-section practice-mode-section') : el('fieldset','challenge-settings'); node.hidden = true;
  node.append(el(inline ? 'h3' : 'legend','',title));
  if (inline) node.setAttribute('aria-label',title);
  let goal: 'timed' | 'target' = 'timed';
  const timed = el('div','control-row challenge-main-fields'), target = el('div','control-row challenge-main-fields'); target.hidden = true;
  const mode = segments<'timed' | 'target'>(inline ? title : 'Challenge goal',[['timed','Timed'],['target',inline ? 'Goal' : 'Target']], value => {
    goal = value; mode.update([goal]); if (!inline) { timed.hidden = goal !== 'timed'; target.hidden = goal !== 'target'; }
  }); mode.update([goal]);
  if (inline) {
    mode.node.className = 'practice-mode-choices';
    const refreshMarks = () => mode.buttons.forEach(control => {
      const mark = el('span','range-content-mark',control.getAttribute('aria-pressed') === 'true' ? '✓' : '');
      mark.setAttribute('aria-hidden','true');
      control.replaceChildren(el('span','',control.getAttribute('aria-label')!),mark);
    });
    mode.buttons.forEach(control => {
      control.classList.add('range-content-button');
      control.addEventListener('click',refreshMarks);
    });
    refreshMarks();
    const future = el('div','practice-mode-auto');
    const correct = el('button','control range-content-button','Correct Only');
    correct.type = 'button'; correct.disabled = true; correct.title = 'Coming soon';
    future.append(correct,el('span','muted challenge-coming-soon','Coming soon'));
    mode.node.append(future);
  }
  const numeric = (parent: HTMLElement, label: string, value: number, min: number, max: number) => {
    const wrapper = el('label','setting',label); const input = el('input'); input.type = 'number'; input.value = String(value); input.min = String(min); input.max = String(max); input.step = '1'; input.required = true;
    wrapper.append(input); parent.append(wrapper); return input;
  };
  const seconds = numeric(timed,'Duration (seconds)',60,15,300);
  const scoringLabel = el('label','setting','Scoring'); const scoring = el('select');
  for (const [value,text] of [['adjusted','Correct Notes × Accuracy'],['correct','Correct Notes']]) { const option = el('option','',text); option.value = value!; scoring.append(option); }
  scoringLabel.append(scoring);
  const count = numeric(target,inline ? 'Correct notes' : 'Correct-note target',10,1,100), floor = numeric(target,'Qualifying accuracy (%)',80,50,100);
  if (inline) {
    [seconds,count].forEach((input,index) => {
      const choice = mode.buttons[index]!;
      const card = el('div','challenge-mode-card');
      const label = input.parentElement!;
      input.setAttribute('aria-label',index === 0 ? 'Duration (seconds)' : 'Correct notes');
      label.firstChild!.textContent = index === 0 ? 'Seconds' : 'Notes';
      choice.before(card); card.append(choice,label);
      input.addEventListener('input',() => choice.click());
    });
  }
  const advanced = el('details','challenge-advanced');
  const advancedSummary = el('summary','','Scoring and round details');
  const timedAdvanced = el('div','challenge-advanced-fields'), targetAdvanced = el('div','challenge-advanced-fields'); targetAdvanced.hidden = true;
  timedAdvanced.append(scoringLabel); targetAdvanced.append(floor.parentElement!);
  advanced.append(advancedSummary,timedAdvanced,targetAdvanced,
    el('p','muted','Three-second count-in. Feedback counts toward time. Paused or unfinished rounds are unranked.'));
  const ruleSummary = el('p','muted challenge-rule-summary');
  const updateGoal = () => {
    timedAdvanced.hidden = goal !== 'timed'; targetAdvanced.hidden = goal !== 'target';
    ruleSummary.textContent = goal === 'timed' ? 'Score as many correct notes as you can before time runs out.' : 'Reach your correct-note goal within 120 seconds.';
  };
  mode.buttons.forEach(control => control.addEventListener('click',updateGoal)); updateGoal();
  const error = el('p','feedback'); error.hidden = true; error.setAttribute('role','alert');
  node.append(mode.node);
  if (!inline) node.append(timed,target);
  node.append(ruleSummary,advanced,error);
  let changed = () => {};
  node.addEventListener('input',() => changed()); node.addEventListener('change',() => changed());
  mode.buttons.forEach(control => control.addEventListener('click',() => changed()));
  return { node, onChange: (fn: () => void) => { changed = fn; },
    summary: () => goal === 'timed' ? `Timed · ${seconds.value || '—'} seconds` : `${inline ? 'Goal' : 'Target'} · ${count.value || '—'} correct · 120 seconds`,
    read(onInvalid?: () => void) {
    try {
      const rules = validateRules(goal === 'timed' ? { goal, seconds: seconds.valueAsNumber, scoring: scoring.value } : { goal, target: count.valueAsNumber, timeout: 120, accuracyFloor: floor.valueAsNumber });
      error.textContent = ''; error.hidden = true; return rules;
    } catch (e) { onInvalid?.(); error.hidden = false; error.textContent = (e as Error).message; const invalid = (goal === 'timed' ? [seconds] : [count,floor]).find(i => !i.validity.valid); if (invalid === floor) advanced.open = true; invalid?.focus(); return undefined; }
  } };
}

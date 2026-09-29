import { el } from '../../../shared/ui/components.ts';
import { segments } from './range-editor.ts';
import { validateRules } from '../engine/challenge.ts';
export function challengeSetup(title = 'Solo Challenge') {
  const node = el('fieldset','challenge-settings'); node.hidden = true;
  node.append(el('legend','',title));
  let goal: 'timed' | 'target' = 'timed';
  const timed = el('div','control-row challenge-main-fields'), target = el('div','control-row challenge-main-fields'); target.hidden = true;
  const mode = segments<'timed' | 'target'>('Challenge goal',[['timed','Timed'],['target','Target']], value => {
    goal = value; mode.update([goal]); timed.hidden = goal !== 'timed'; target.hidden = goal !== 'target';
  }); mode.update([goal]);
  const numeric = (parent: HTMLElement, label: string, value: number, min: number, max: number) => {
    const wrapper = el('label','setting',label); const input = el('input'); input.type = 'number'; input.value = String(value); input.min = String(min); input.max = String(max); input.step = '1'; input.required = true;
    wrapper.append(input); parent.append(wrapper); return input;
  };
  const seconds = numeric(timed,'Duration (seconds)',60,15,300);
  const scoringLabel = el('label','setting','Scoring'); const scoring = el('select');
  for (const [value,text] of [['adjusted','Correct Notes × Accuracy'],['correct','Correct Notes']]) { const option = el('option','',text); option.value = value!; scoring.append(option); }
  scoringLabel.append(scoring);
  const count = numeric(target,'Correct-note target',10,1,100), timeout = numeric(target,'Timeout (seconds)',120,15,600), floor = numeric(target,'Qualifying accuracy (%)',80,50,100);
  const advanced = el('details','challenge-advanced');
  const advancedSummary = el('summary','','Scoring and round details');
  const timedAdvanced = el('div','challenge-advanced-fields'), targetAdvanced = el('div','challenge-advanced-fields'); targetAdvanced.hidden = true;
  timedAdvanced.append(scoringLabel); targetAdvanced.append(floor.parentElement!);
  advanced.append(advancedSummary,timedAdvanced,targetAdvanced,
    el('p','muted','Three-second count-in. Feedback counts toward time. Paused or unfinished rounds are unranked.'));
  const ruleSummary = el('p','muted challenge-rule-summary');
  const updateGoal = () => {
    timedAdvanced.hidden = goal !== 'timed'; targetAdvanced.hidden = goal !== 'target';
    ruleSummary.textContent = goal === 'timed' ? 'Score as many correct notes as you can before time runs out.' : 'Reach your correct-note goal before the timeout.';
  };
  mode.buttons.forEach(control => control.addEventListener('click',updateGoal)); updateGoal();
  const error = el('p','feedback'); error.hidden = true; error.setAttribute('role','alert');
  node.append(mode.node,timed,target,ruleSummary,advanced,error);
  return { node, read() {
    try {
      const rules = validateRules(goal === 'timed' ? { goal, seconds: seconds.valueAsNumber, scoring: scoring.value } : { goal, target: count.valueAsNumber, timeout: timeout.valueAsNumber, accuracyFloor: floor.valueAsNumber });
      error.textContent = ''; error.hidden = true; return rules;
    } catch (e) { error.hidden = false; error.textContent = (e as Error).message; const invalid = (goal === 'timed' ? [seconds] : [count,timeout,floor]).find(i => !i.validity.valid); if (invalid === floor) advanced.open = true; invalid?.focus(); return undefined; }
  } };
}

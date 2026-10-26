import { el } from '../../../shared/ui/components.ts';
import { segments } from './range-editor.ts';
import { validateRules } from '../engine/challenge.ts';
export function challengeSetup(title = 'Solo Challenge', inline = false) {
  const node = inline ? el('section','challenge-settings visual-content-section practice-mode-section mode-pill-selector') : el('fieldset','challenge-settings'); node.hidden = true;
  node.append(el(inline ? 'h3' : 'legend','',title));
  if (inline) node.setAttribute('aria-label',title);
  let goal: 'timed' | 'target' = 'timed';
  const timed = el('div','control-row challenge-main-fields'), target = el('div','control-row challenge-main-fields'); target.hidden = true;
  const mode = segments<'timed' | 'target'>(inline ? title : 'Challenge goal',[['timed','Timed'],['target',inline ? 'Goal' : 'Target']], value => {
    goal = value; mode.update([goal]); if (!inline) { timed.hidden = goal !== 'timed'; target.hidden = goal !== 'target'; }
  }); mode.update([goal]);
  if (inline) {
    mode.node.className = 'practice-mode-choices';
    mode.buttons.forEach(control => {
      control.classList.add('range-content-button');
    });
    const future = el('div','practice-mode-auto');
    const correct = el('button','control range-content-button','Correct Only');
    correct.type = 'button'; correct.disabled = true; correct.title = 'Coming soon';
    future.append(correct);
    mode.node.append(future);
  }
  const numeric = (parent: HTMLElement, label: string, value: number, min: number, max: number) => {
    const wrapper = el('label','setting',label); const input = el('input'); input.type = 'number'; input.value = String(value); input.min = String(min); input.max = String(max); input.step = '1'; input.required = true;
    wrapper.append(input); parent.append(wrapper); return input;
  };
  const seconds = numeric(timed,'Duration (seconds)',60,15,300);
  const count = numeric(target,inline ? 'Correct notes' : 'Correct-note target',10,1,100);
  if (inline) {
    [seconds,count].forEach((input,index) => {
      const choice = mode.buttons[index]!;
      const card = el('div','challenge-mode-card');
      const label = input.parentElement!;
      input.setAttribute('aria-label',index === 0 ? 'Duration (seconds)' : 'Correct notes');
      label.replaceChildren(input,el('span','',index === 0 ? 'sec' : 'notes'));
      choice.before(card); card.append(choice,label);
      input.addEventListener('input',() => choice.click());
    });
  }
  const error = el('p','feedback'); error.hidden = true; error.setAttribute('role','alert');
  node.append(mode.node);
  if (!inline) node.append(timed,target);
  node.append(error);
  let changed = () => {};
  node.addEventListener('input',() => changed()); node.addEventListener('change',() => changed());
  mode.buttons.forEach(control => control.addEventListener('click',() => changed()));
  return { node, onChange: (fn: () => void) => { changed = fn; },
    summary: () => goal === 'timed' ? `Timed · ${seconds.value || '—'} seconds` : `${inline ? 'Goal' : 'Target'} · ${count.value || '—'} correct · 120 seconds`,
    read(onInvalid?: () => void) {
    try {
      const rules = validateRules(goal === 'timed' ? { goal, seconds: seconds.valueAsNumber, scoring: 'adjusted' } : { goal, target: count.valueAsNumber, timeout: 120, accuracyFloor: 80 });
      error.textContent = ''; error.hidden = true; return rules;
    } catch (e) { onInvalid?.(); error.hidden = false; error.textContent = (e as Error).message; const invalid = (goal === 'timed' ? [seconds] : [count]).find(i => !i.validity.valid); invalid?.focus(); return undefined; }
  } };
}

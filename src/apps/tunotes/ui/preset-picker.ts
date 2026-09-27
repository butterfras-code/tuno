import { pitchLabel } from '../domain/notation.ts';
import { el } from '../../../shared/ui/components.ts';
import { clefs, instruments, presets } from '../domain/presets.ts';
import type { PresetSource } from '../domain/presets.ts';

export const titleCase = (text: string) => text[0]!.toUpperCase() + text.slice(1);
export function control(text: string, action: () => void) {
  const node = el('button','control',text); node.type = 'button'; node.addEventListener('click',action); return node;
}
export function presetPicker(customs: () => readonly PresetSource[], select: (id: string) => void) {
  const node = el('div','preset-picker');
  const label = el('span','setting-label','Preset'); label.id = 'preset-label';
  const picker = control('',() => { step = 0; render(); dialog.showModal(); position(); });
  picker.id = 'preset'; picker.setAttribute('aria-haspopup','dialog'); picker.setAttribute('aria-labelledby','preset-label preset');
  const dialog = el('dialog','preset-dialog'); dialog.setAttribute('aria-labelledby','preset-step-title');
  const header = el('div','picker-header');
  const heading = el('h3'); heading.id = 'preset-step-title'; heading.tabIndex = -1;
  const close = control('Close',() => dialog.close());
  const trail = el('p','muted picker-trail');
  const choices = el('div','picker-choices');
  let step = 0, category: 'clef' | 'instrument' = 'clef', item = '';
  const back = control('← Back',() => { step--; render(); });
  header.append(back,heading,close); dialog.append(header,trail,choices);
  const choose = (id: string) => { dialog.close(); select(id); };
  const render = () => {
    choices.replaceChildren(); back.hidden = step === 0;
    heading.textContent = ['Choose a preset', category === 'clef' ? 'Choose a clef' : 'Choose an instrument', 'Choose a level'][step]!;
    trail.textContent = step === 0 ? 'Start with a clef or an instrument.' : `${titleCase(category)}${step === 2 ? ` › ${category === 'clef' ? titleCase(item) : instruments.find(i => i.id === item)!.name}` : ''} · Step ${step + 1} of 3`;
    if (step === 0) {
      const categories = el('div','picker-categories');
      for (const value of ['clef','instrument'] as const) categories.append(control(titleCase(value),() => { category = value; step = 1; render(); }));
      choices.append(categories,control('＋ Create custom',() => choose('custom')));
      if (customs().length) {
        choices.append(el('h4','','Saved custom presets'));
        for (const p of customs()) choices.append(control(p.name,() => choose(p.id)));
      }
    } else if (step === 1) {
      for (const option of category === 'clef' ? clefs.map(c => ({id:c,name:titleCase(c)})) : instruments) choices.append(control(option.name,() => { item = option.id; step = 2; render(); }));
    } else {
      for (const p of presets.filter(p => category === 'clef' ? !p.instrument && p.clef === item : p.instrument === item)) {
        const choice = control(p.name.split(' — ')[1] ?? p.name,() => choose(p.id));
        choice.dataset.presetId = p.id;
        choice.append(el('small','muted',`${pitchLabel(p.pool[0]!)} – ${pitchLabel(p.pool.at(-1)!)}`)); choices.append(choice);
      }
    }
    if (dialog.open) { position(); heading.focus(); }
  };
  const position = () => {
    const rect = picker.getBoundingClientRect();
    const scale = dialog.getBoundingClientRect().width / dialog.offsetWidth || 1;
    dialog.style.width = `${Math.min(420,(innerWidth-16)/scale)}px`;
    dialog.style.maxHeight = `${Math.min(520,(innerHeight-16)/scale)}px`;
    const width = dialog.getBoundingClientRect().width;
    dialog.style.left = `${Math.max(8,Math.min(rect.left,innerWidth-width-8))/scale}px`;
    dialog.style.top = `${Math.max(8,Math.min(rect.bottom+6,innerHeight-dialog.getBoundingClientRect().height-8))/scale}px`;
  };
  dialog.addEventListener('click',event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dialog.close(); } });
  node.append(label,picker,dialog);
  return {node,picker,set: (id: string, name: string) => { picker.value = id; picker.textContent = `${name} ▾`; }};
}

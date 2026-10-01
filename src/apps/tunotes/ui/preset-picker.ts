import { pitchLabel } from '../domain/notation.ts';
import { el } from '../../../shared/ui/components.ts';
import { onUnmount } from '../../../shared/ui/unmount.ts';
import { clefs, instruments, presets } from '../domain/presets.ts';
import type { PresetSource } from '../domain/presets.ts';

export const titleCase = (text: string) => text[0]!.toUpperCase() + text.slice(1);
export function control(text: string, action: () => void) {
  const node = el('button','control',text); node.type = 'button'; node.addEventListener('click',action); return node;
}
type PickerPreview = { begin: () => () => void; select: (id: string) => void; range: () => HTMLElement; notation: { get: () => boolean; preview: (value: boolean) => void; apply: (value: boolean) => void } };
export function presetPicker(customs: () => readonly PresetSource[], select: (id: string) => void, idPrefix = '', allowCreateCustom = true, labelText = 'Preset', preview?: PickerPreview) {
  const node = el('div','preset-picker');
  const label = el('span','setting-label',labelText); label.id = `${idPrefix}preset-label`;
  const nameText = el('span','preset-name'); nameText.id = `${idPrefix}preset-name`; nameText.hidden = true;
  let rollback: (() => void) | undefined, pendingId = '';
  const picker = control('',() => {
    signature.checked = preview?.notation.get() ?? false;
    pendingId = picker.value; rollback = separateName ? preview?.begin() : undefined;
    dialog.classList.toggle('preset-dialog--preview',Boolean(rollback));
    footer.hidden = !rollback; rangePreview.hidden = true;
    close.textContent = rollback ? '×' : 'Close';
    close.setAttribute('aria-label',rollback ? 'Cancel preset selection' : 'Close');
    step = 0; render(); dialog.showModal(); position(); heading.focus();
    window.addEventListener('resize',position);
  });
  picker.id = `${idPrefix}preset`; picker.setAttribute('aria-haspopup','dialog'); picker.setAttribute('aria-labelledby',`${idPrefix}preset-label ${idPrefix}preset`);
  const dialog = el('dialog','preset-dialog'); dialog.setAttribute('aria-labelledby',`${idPrefix}preset-step-title`);
  const header = el('div','picker-header');
  const heading = el('h3'); heading.id = `${idPrefix}preset-step-title`; heading.tabIndex = -1;
  const dismiss = () => { const restore = rollback; rollback = undefined; restore?.(); dialog.close(); };
  const close = control('Close',dismiss);
  const trail = el('p','muted picker-trail');
  const choices = el('div','picker-choices');
  const rangePreview = el('div','picker-range-preview'); rangePreview.hidden = true;
  const use = control('Use preset',() => { preview?.notation.apply(signature.checked); rollback = undefined; dialog.close(); }); use.classList.add('control--primary');
  const cancel = control('Cancel',dismiss);
  const footer = el('div','picker-footer'); footer.hidden = true; footer.append(cancel,use);
  const notation = el('label','picker-notation');
  const signature = el('input'); signature.type = 'checkbox';
  signature.addEventListener('change',() => { preview?.notation.preview(signature.checked); position(); });
  notation.append(signature,el('span','','Show key signature'));
  notation.hidden = !preview;
  let step = 0, category: 'clef' | 'instrument' = 'clef', item = '';
  const back = control('← Back',() => { step--; render(); });
  header.append(back,heading,close); dialog.append(rangePreview,header,trail,choices,notation,footer);
  const markSelection = () => {
    choices.querySelectorAll<HTMLButtonElement>('[data-preset-id]').forEach(choice => choice.setAttribute('aria-pressed',String(choice.dataset.presetId === pendingId)));
  };
  const choose = (id: string) => {
    if (!rollback || id === 'custom') { dismiss(); select(id); return; }
    pendingId = id; preview!.select(id); markSelection(); position();
  };
  const render = () => {
    choices.replaceChildren(); back.hidden = step === 0;
    heading.textContent = ['Choose a preset', category === 'clef' ? 'Choose a clef' : 'Choose an instrument', 'Choose a level'][step]!;
    trail.textContent = step === 0 ? 'Start with a clef or an instrument.' : `${titleCase(category)}${step === 2 ? ` › ${category === 'clef' ? titleCase(item) : instruments.find(i => i.id === item)!.name}` : ''} · Step ${step + 1} of 3`;
    if (step === 0) {
      const categories = el('div','picker-categories');
      for (const value of ['clef','instrument'] as const) categories.append(control(titleCase(value),() => { category = value; step = 1; render(); }));
      choices.append(categories);
      if (allowCreateCustom) choices.append(control('＋ Create custom',() => choose('custom')));
      if (customs().length) {
        choices.append(el('h4','','Saved custom presets'));
        for (const p of customs()) { const choice = control(p.name,() => choose(p.id)); choice.dataset.presetId = p.id; choices.append(choice); }
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
    if (rollback) markSelection();
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
    if (rollback) {
      const range = preview!.range().getBoundingClientRect();
      const rightSpace = innerWidth - range.right - 24;
      const belowSpace = innerHeight - range.bottom - 20;
      const aboveSpace = range.top - 20;
      const rangeFits = range.top >= 8 && range.bottom <= innerHeight-8;
      rangePreview.hidden = true; rangePreview.replaceChildren();
      if (rangeFits && rightSpace >= 300) {
        dialog.style.width = `${Math.min(420,rightSpace)/scale}px`;
        dialog.style.left = `${(range.right+12)/scale}px`;
        dialog.style.top = `${Math.max(8,Math.min(range.top,innerHeight-dialog.getBoundingClientRect().height-8))/scale}px`;
      } else if (rangeFits && Math.max(belowSpace,aboveSpace) >= 240) {
        const below = belowSpace >= aboveSpace;
        dialog.style.maxHeight = `${Math.min(520,below ? belowSpace : aboveSpace)/scale}px`;
        dialog.style.top = `${(below ? range.bottom+12 : range.top-dialog.getBoundingClientRect().height-12)/scale}px`;
      } else {
        // On short screens keep a live preview inside the chooser itself.
        rangePreview.hidden = false; rangePreview.append(preview!.range().cloneNode(true));
        dialog.style.top = `${8/scale}px`;
      }
    }
  };
  dialog.addEventListener('cancel',event => { event.preventDefault(); dismiss(); });
  dialog.addEventListener('close',() => {
    window.removeEventListener('resize',position); rangePreview.replaceChildren(); rangePreview.hidden = true;
    const restore = rollback; rollback = undefined; restore?.();
  });
  onUnmount(node,() => window.removeEventListener('resize',position));
  dialog.addEventListener('click',event => { if (event.target === dialog) { const r = dialog.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dismiss(); } });
  let separateName = false;
  const renderSelection = () => {
    nameText.hidden = !separateName;
    node.classList.toggle('preset-picker--separate',separateName);
    picker.textContent = separateName ? 'Choose preset…' : `${nameText.textContent} ▾`;
    if (separateName) {
      picker.removeAttribute('aria-labelledby');
      picker.setAttribute('aria-describedby',nameText.id);
    } else {
      picker.setAttribute('aria-labelledby',`${label.id} ${picker.id}`);
      picker.removeAttribute('aria-describedby');
    }
  };
  node.append(label,nameText,picker,dialog);
  return {node,picker,set: (id: string, name: string) => { picker.value = id; nameText.textContent = name; renderSelection(); },
    separateName: (value: boolean) => { separateName = value; renderSelection(); }};
}

import { el } from '../../../shared/ui/components.ts';
import { keyName, keySignature, pitchAt } from '../domain/notation.ts';
import type { Clef } from '../domain/notation.ts';
import { modifiersFor } from '../domain/presets.ts';
import type { Modifier, PresetSource } from '../domain/presets.ts';
import { control } from './preset-picker.ts';
import { renderStaff } from './staff.ts';

// Match the keys supported by the existing custom editor and answer layout.
const keys = [
  ['C','a'],['G','e'],['D','b'],['A','f#'],['E','c#'],['B','g#'],['F#','d#'],
  ['F','d'],['Bb','g'],['Eb','c'],['Ab','f'],['Db','bb'],['Gb','eb'],
] as const;
const keyLabel = (value: string) => value[0]!+value.slice(1).replaceAll('#','♯').replaceAll('b','♭');
const label = (major: string, minor: string) => `${keyLabel(major)}/${keyLabel(minor)}`;

export function keySignatureControl(changed: () => void, inferredClef: () => Clef) {
  let enabled = false, selected = 'C';
  let additions: Exclude<Modifier,'key'>[] = [];
  const node = el('section','visual-content-section key-signature-section');
  const options = el('div','visual-range-content'); options.setAttribute('role','group'); options.setAttribute('aria-label','Key signature');
  const picker = el('dialog','key-picker-dialog'); picker.setAttribute('aria-label','Choose a key');
  const pickerHeader = el('div','picker-header');
  const close = control('×',() => picker.close()); close.setAttribute('aria-label','Close key selection');
  pickerHeader.append(el('h3','','Choose a key'),close);
  const choices = el('div','key-picker-choices'); picker.append(pickerHeader,choices);
  const noKey = control('',() => { enabled = false; update(); changed(); });
  const key = control('',() => {
    const clef = inferredClef(); choices.replaceChildren();
    for (const [name,minor] of keys) {
      const text = label(name,minor), signature = keySignature(name);
      const choice = control('',() => { selected = name; enabled = true; update(); changed(); picker.close(); });
      choice.classList.add('key-picker-choice'); choice.dataset.key = name;
      choice.setAttribute('aria-label',text); choice.setAttribute('aria-pressed',String(enabled && name === selected));
      const staff = renderStaff(pitchAt(4,clef),clef,signature,false,true);
      staff.classList.replace('staff','key-signature-staff'); staff.dataset.clef = clef;
      staff.setAttribute('aria-label',`${text}, ${clef} clef`);
      staff.querySelectorAll('.notehead, .ledger, .note-accidental').forEach(n => n.remove());
      const width = Math.max(190,140+Math.abs(signature.fifths)*19);
      staff.setAttribute('viewBox',`16 20 ${width-16} 160`);
      staff.querySelectorAll('line').forEach(line => line.setAttribute('x2',String(width-8)));
      choice.append(staff,el('span','',text)); choices.append(choice);
    }
    picker.showModal();
    (choices.querySelector('[aria-pressed="true"]') ?? choices.querySelector('button'))?.scrollIntoView({block:'nearest'});
    (choices.querySelector<HTMLButtonElement>('[aria-pressed="true"]') ?? choices.querySelector('button'))?.focus();
  });
  const marks = [el('span','range-content-mark'),el('span','range-content-mark')];
  const selectedLabel = el('small','key-signature-selected');
  for (const [i,button] of [noKey,key].entries()) {
    button.classList.add('range-content-button'); button.setAttribute('aria-label',i === 0 ? 'No Key' : 'Key');
    marks[i]!.setAttribute('aria-hidden','true'); button.append(el('span','',i === 0 ? 'No Key' : 'Key'));
    if (i === 1) button.append(selectedLabel);
    button.append(marks[i]!); options.append(button);
  }
  key.setAttribute('aria-haspopup','dialog'); key.setAttribute('aria-expanded','false');
  picker.addEventListener('close',() => { key.setAttribute('aria-expanded','false'); if (key.isConnected) key.focus(); });
  picker.addEventListener('click',event => {
    if (event.target !== picker) return;
    const r = picker.getBoundingClientRect();
    if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) picker.close();
  });
  key.addEventListener('click',() => key.setAttribute('aria-expanded','true'));
  const accidentalOptions = el('div','visual-range-content accidental-options');
  accidentalOptions.setAttribute('role','group'); accidentalOptions.setAttribute('aria-label','Additional spellings');
  const accidentalButtons = ([['sharp','♯','Sharp'],['flat','♭','Flat'],['natural','♮','Natural']] as const).map(([value,symbol,text]) => {
    const button = control('',() => {
      additions = additions.includes(value) ? additions.filter(m => m !== value) : [...additions,value];
      update(); changed();
    });
    button.classList.add('range-content-button'); button.setAttribute('aria-label',text); button.title = text;
    const glyph = el('span','accidental-option-symbol',symbol); glyph.setAttribute('aria-hidden','true');
    const mark = el('span','range-content-mark'); mark.setAttribute('aria-hidden','true');
    button.append(glyph,el('span','accidental-option-label',text),mark); accidentalOptions.append(button);
    return {value,button,mark};
  });
  function update() {
    [noKey,key].forEach((button,i) => {
      const active = i === 0 ? !enabled : enabled;
      button.setAttribute('aria-pressed',String(active)); marks[i]!.textContent = active ? '✓' : '+';
    });
    const [major,minor] = keys.find(([name]) => name === selected) ?? [selected,selected === 'C#' ? 'a#' : 'ab'];
    selectedLabel.textContent = label(major,minor);
    selectedLabel.hidden = !enabled;
    accidentalButtons.forEach(({value,button,mark}) => {
      const active = additions.includes(value);
      button.setAttribute('aria-pressed',String(active)); mark.textContent = active ? '✓' : '+';
    });
  }
  node.append(el('h4','','Key & Accidentals'),options,accidentalOptions,picker); update();
  return {node,get enabled() { return enabled; },get signature() { return keySignature(selected); },
    get modifiers(): readonly Modifier[] { return [...(enabled ? ['key' as const] : []),...additions]; },
    close() { picker.close(); },
    load(source: PresetSource) {
      selected = keyName(source.key ?? keySignature('C'));
      enabled = source.editorVersion === 2 && modifiersFor(source).includes('key');
      additions = modifiersFor(source).filter((m): m is Exclude<Modifier,'key'> => m !== 'key');
      update();
    },
  };
}

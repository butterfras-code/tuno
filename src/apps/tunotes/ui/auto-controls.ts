import { durationIcon } from './staff.ts';
import { el } from '../../../shared/ui/components.ts';
import { autoValues, minAutoBpm, maxAutoBpm, quarterBeats, type AutoSettings } from '../engine/auto-every.ts';

export function autoControls(selectMode: () => void, change: (s: Partial<AutoSettings>) => void) {
  const button = el('button','control range-content-button','Auto Every');
  button.type = 'button'; button.setAttribute('aria-label','Auto Every');
  button.onclick = selectMode;
  const fields = el('div','auto-fields');
  const duration = el('select'); duration.setAttribute('aria-label','Note duration');
  const picker = el('span','auto-duration');
  const selectedValue = el('span'); selectedValue.setAttribute('aria-hidden','true');
  picker.append(selectedValue,duration);
  autoValues.forEach((v,i) => {
    const beats = quarterBeats(v);
    const option = el('option','', `${beats} ${beats === 1 ? 'beat' : 'beats'} · ${v.dots ? 'dotted ' : ''}${v.type} note`);
    option.value = String(i); duration.append(option);
  });
  duration.onchange = () => {
    const {type,dots} = autoValues[duration.selectedIndex]!;
    change({value:{type,dots}});
  };
  const bpm = el('input'); bpm.type = 'number'; bpm.required = true; bpm.min = String(minAutoBpm); bpm.max = String(maxAutoBpm); bpm.setAttribute('aria-label','Tempo in BPM');
  bpm.onchange = () => { if (bpm.value && bpm.validity.valid) change({bpm:bpm.valueAsNumber}); };
  const tempo = el('label','auto-tempo'); tempo.append(bpm,el('span','auto-unit','BPM'));
  fields.append(picker,tempo);
  const toggles = el('div','auto-toggles');
  const toggle = (label: string, key: 'lookahead' | 'sound') => {
    const wrapper = el('label','auto-toggle'); const input = el('input'); input.type = 'checkbox';
    input.onchange = () => change({[key]:input.checked});
    wrapper.append(input,el('span','',label)); toggles.append(wrapper); return input;
  };
  const preview = toggle('Show next note','lookahead'), sound = toggle('Metronome','sound');
  const prefs = el('div','auto-prefs');
  prefs.append(fields,toggles);
  return {node:button,prefs,bpm,update(active: boolean,s: AutoSettings) {
    button.setAttribute('aria-pressed',String(active));
    prefs.classList.toggle('auto-selected',active);
    prefs.hidden = !active;
    duration.selectedIndex = autoValues.findIndex(v => v.type === s.value.type && v.dots === s.value.dots);
    const beats = quarterBeats(s.value);
    selectedValue.replaceChildren(`${beats} ${beats === 1 ? 'beat' : 'beats'}`,durationIcon(s.value),el('span','auto-caret','▾'));
    bpm.value = String(s.bpm); sound.checked = s.sound; preview.checked = s.lookahead;
  }};
}

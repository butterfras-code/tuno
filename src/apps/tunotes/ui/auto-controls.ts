import { durationIcon } from './staff.ts';
import { el } from '../../../shared/ui/components.ts';
import { autoValues, minAutoBpm, maxAutoBpm, quarterBeats, type AutoSettings } from '../engine/auto-every.ts';

export function autoControls(selectMode: () => void, change: (s: Partial<AutoSettings>) => void) {
  const node = el('div','practice-mode-auto');
  const button = el('button','control range-content-button','Auto Every');
  button.type = 'button'; button.setAttribute('aria-label','Auto Every');
  button.onclick = selectMode;
  const fields = el('span','auto-fields');
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
  const tempo = el('label'); tempo.append('at ',bpm,' BPM');
  fields.append(picker,tempo); node.append(button,fields);
  const prefs = el('div','auto-prefs');
  const toggle = (label: string, key: 'lookahead' | 'sound') => {
    const wrapper = el('label'); const input = el('input'); input.type = 'checkbox';
    input.onchange = () => change({[key]:input.checked});
    wrapper.append(input,document.createTextNode(label)); prefs.append(wrapper); return input;
  };
  const preview = toggle('Show next note','lookahead'), sound = toggle('Metronome','sound');
  return {node,prefs,bpm,update(active: boolean,s: AutoSettings) {
    node.classList.toggle('auto-selected',active);
    button.textContent = active ? 'Every' : 'Auto Every'; button.setAttribute('aria-pressed',String(active));
    fields.hidden = prefs.hidden = !active;
    duration.selectedIndex = autoValues.findIndex(v => v.type === s.value.type && v.dots === s.value.dots);
    const beats = quarterBeats(s.value);
    selectedValue.replaceChildren(`${beats} ${beats === 1 ? 'beat' : 'beats'}`,durationIcon(s.value),'▾');
    bpm.value = String(s.bpm); sound.checked = s.sound; preview.checked = s.lookahead;
  }};
}

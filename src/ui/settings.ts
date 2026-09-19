import { LIMITS, TRANSPOSITIONS } from '../practice/state.ts';
import type { PracticeStore } from '../practice/state.ts';
import { button, el, field, numberInput, row, select } from './components.ts';

export function createSettings(store: PracticeStore) {
  const dialog = el('dialog', 'settings-dialog');
  dialog.setAttribute('aria-labelledby', 'settings-heading');
  const title = el('h2', '', 'Practice settings');
  title.id = 'settings-heading';
  const form = el('form');
  const calibration = numberInput(LIMITS.a4.min, LIMITS.a4.max, store.get().a4, 'any');
  calibration.id = 'calibration';
  const transposition = select(TRANSPOSITIONS);
  transposition.id = 'transposition';
  const showUno = el('input');
  showUno.type = 'checkbox';
  const display = field('Show Uno', showUno);
  display.classList.add('checkbox-field');
  const save = button('Save settings', undefined, true);
  save.type = 'submit';
  const cancel = button('Cancel', () => dialog.close());
  form.append(field('A4 reference (Hz)', calibration), field('Written pitch', transposition),
    el('p', 'small muted', 'Transposition changes the displayed note. Reference-tone keys stay in concert pitch.'),
    display, el('p', 'small muted', 'Settings last for this session. Reduced motion follows your device preference.'), row(cancel, save));
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    store.dispatch({ type: 'settings', value: {
      a4: Number(calibration.value), transposition: Number(transposition.value), showUno: showUno.checked,
    } });
    dialog.close();
  });
  dialog.append(title, form);
  return {
    node: dialog,
    open() {
      const state = store.get();
      calibration.value = String(state.a4);
      transposition.value = String(state.transposition);
      showUno.checked = state.showUno;
      dialog.showModal();
    },
  };
}

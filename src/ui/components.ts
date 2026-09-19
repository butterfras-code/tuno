import unoAsset from '../assets/uno-happy.svg';
import { noteName } from '../music/pitch.ts';
import { pitchReading } from '../practice/state.ts';
import type { PracticeState } from '../practice/state.ts';

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}
export function button(label: string, onClick?: () => void, primary = false): HTMLButtonElement {
  const node = el('button', primary ? 'control control--primary' : 'control', label);
  node.type = 'button';
  if (onClick) node.addEventListener('click', onClick);
  return node;
}
export function unavailableButton(label: string, descriptionId: string): HTMLButtonElement {
  const node = button(label);
  node.disabled = true;
  node.setAttribute('aria-describedby', descriptionId);
  return node;
}
export function row(...children: HTMLElement[]): HTMLDivElement {
  const node = el('div', 'control-row');
  node.append(...children);
  return node;
}
export function field(label: string, control: HTMLInputElement | HTMLSelectElement): HTMLLabelElement {
  const node = el('label', 'field');
  // Keep options/output text out of the control's accessible name.
  control.setAttribute('aria-label', label);
  node.append(el('span', 'field-label', label), control);
  return node;
}
export function select(options: readonly { value: string | number; label: string }[], onChange?: (value: string) => void): HTMLSelectElement {
  const node = el('select', 'control');
  for (const item of options) node.add(new Option(item.label, String(item.value)));
  if (onChange) node.addEventListener('change', () => onChange(node.value));
  return node;
}
export function numberInput(min: number, max: number, value: number, step = '1'): HTMLInputElement {
  const node = el('input', 'control');
  Object.assign(node, { type: 'number', min: String(min), max: String(max), step, value: String(value), required: true });
  return node;
}
export function uno(className = ''): HTMLImageElement {
  const image = el('img', `uno ${className}`);
  Object.assign(image, { src: unoAsset, alt: '', width: 300, height: 300 });
  return image;
}
export function view(id: string, heading: string): HTMLElement {
  const node = el('section', 'practice-view');
  node.id = `view-${id}`;
  node.setAttribute('aria-label', heading);
  return node;
}
export function heading(title: string, subtitle: string): HTMLDivElement {
  const node = el('div', 'view-heading');
  node.append(el('h2', '', title), el('p', 'muted', subtitle));
  return node;
}
export function pitchText(state: PracticeState) {
  const reading = pitchReading(state);
  if (!reading) return { note: '—', detail: 'No pitch selected', direction: 'Ready when you are.', summary: 'No sample' };
  const cents = Math.abs(reading.cents) < 0.05 ? 0 : reading.cents;
  const signed = `${cents > 0 ? '+' : cents < 0 ? '−' : ''}${Math.abs(cents).toFixed(1)}`;
  const direction = cents === 0 ? 'In tune' : `${Math.abs(cents).toFixed(1)} cents ${cents > 0 ? 'sharp' : 'flat'}`;
  return {
    note: noteName(reading.writtenNote),
    detail: `${state.manualHz!.toFixed(1)} Hz · ${signed} cents`,
    direction,
    summary: `Concert ${noteName(reading.concertNote)} · Written ${noteName(reading.writtenNote)} · ${direction}`,
  };
}

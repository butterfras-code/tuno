import boneAsset from '../assets/volume-bone.svg';
import unoAsset from '../assets/uno-happy.svg';
import { noteName } from '../music/pitch.ts';
import { pitchReading, displayedHz } from '../practice/state.ts';
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
    detail: `${displayedHz(state)!.toFixed(1)} Hz · ${signed} cents`,
    direction,
    summary: `Concert ${noteName(reading.concertNote)} · Written ${noteName(reading.writtenNote)} · ${direction}`,
  };
}

/** Keep descriptive accessible names while using the shorter mobile captions. */
export function responsiveLabel(node: HTMLElement, desktop: string, mobile: string) {
  if (node.dataset.desktopLabel === desktop && node.dataset.mobileLabel === mobile) return;
  node.dataset.desktopLabel = desktop;
  node.dataset.mobileLabel = mobile;
  if (node instanceof HTMLButtonElement) node.setAttribute('aria-label', desktop);
  node.replaceChildren(el('span', 'desktop-label', desktop), el('span', 'mobile-label', mobile));
}

/** Compact volume button opens the existing range control without losing keyboard access. */
export function volumePopover(label: string, input: HTMLInputElement, options: { heading?: string; formatValue?: (value: string) => string } = {}) {
  const formatValue = options.formatValue ?? ((value: string) => `${value}%`);
  // Base64 avoids embedded SVG quotes invalidating a CSS url() token.
  const thumb = boneAsset.includes(';base64,') ? boneAsset : `data:image/svg+xml;base64,${btoa(decodeURIComponent(boneAsset.slice(boneAsset.indexOf(',') + 1)))}`;
  input.style.setProperty('--volume-thumb', `url("${thumb}")`);
  const wrapper = el('div', 'volume-popover mobile-only');
  const popup = el('div', 'volume-popup');
  popup.id = `${label.toLowerCase().replaceAll(' ', '-')}-popup`;
  popup.setAttribute('popover', 'auto');
  const value = el('output', '', formatValue(input.value || '0'));
  const title = el('div', 'volume-popup-heading');
  title.append(el('span', '', options.heading ?? 'Volume'), value);
  input.setAttribute('aria-label', label);
  popup.append(title, input, el('p', 'small muted', 'Drag the bone or use arrow keys'));
  const updateValue = () => {
    value.textContent = formatValue(input.value);
    const percent = (Number(input.value) - Number(input.min || 0)) / (Number(input.max || 100) - Number(input.min || 0)) * 100;
    input.style.setProperty('--volume-percent', `${percent}%`);
  };
  input.addEventListener('input', updateValue);
  const trigger = button('Volume');
  trigger.setAttribute('popovertarget', popup.id);
  popup.addEventListener('toggle', event => {
    if (event.newState !== 'open') return;
    updateValue();
    const box = trigger.getBoundingClientRect();
    popup.style.left = `${Math.max(8, Math.min(box.left, innerWidth - popup.offsetWidth - 8))}px`;
    popup.style.top = `${box.bottom + popup.offsetHeight + 8 < innerHeight ? box.bottom + 6 : Math.max(8, box.top - popup.offsetHeight - 6)}px`;
    input.focus();
  });
  wrapper.append(trigger, popup);
  return { node: wrapper, trigger };
}

/** Shared, anchored selector. Native popover dismissal preserves keyboard focus. */
let popupId = 0;
export function selectorPopover(label: string, options: readonly { value: string | number; label: string }[], onChange: (value: string) => void) {
  const trigger = button(label);
  trigger.setAttribute('aria-label', label);
  trigger.setAttribute('aria-haspopup', 'menu');
  const popup = el('div', 'selector-popup');
  popup.id = `selector-${++popupId}`;
  popup.setAttribute('popover', 'auto');
  popup.setAttribute('role', 'menu');
  popup.setAttribute('aria-label', label);
  trigger.setAttribute('popovertarget', popup.id);
  const choices = options.map(option => {
    const choice = button(option.label, () => { onChange(String(option.value)); popup.hidePopover(); trigger.focus(); });
    choice.setAttribute('role', 'menuitemradio');
    popup.append(choice);
    return choice;
  });
  popup.addEventListener('toggle', event => {
    trigger.setAttribute('aria-expanded', String(event.newState === 'open'));
    if (event.newState !== 'open') return;
    const box = trigger.getBoundingClientRect();
    popup.style.width = `${Math.max(120, box.width)}px`;
    popup.style.left = `${Math.max(8, Math.min(box.left, innerWidth - popup.offsetWidth - 8))}px`;
    popup.style.top = `${box.bottom + popup.offsetHeight + 8 < innerHeight ? box.bottom + 6 : Math.max(8, box.top - popup.offsetHeight - 6)}px`;
    (choices.find(choice => choice.getAttribute('aria-checked') === 'true') || choices[0])?.focus();
  });
  popup.addEventListener('keydown', event => {
    const index = choices.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === 'ArrowDown' ? (index + 1) % choices.length : event.key === 'ArrowUp' ? (index - 1 + choices.length) % choices.length : event.key === 'Home' ? 0 : event.key === 'End' ? choices.length - 1 : -1;
    if (next >= 0) { event.preventDefault(); choices[next]!.focus(); }
  });
  return { trigger, popup, update(value: string | number, text?: string) {
    trigger.textContent = `${text ?? options.find(option => String(option.value) === String(value))?.label ?? value} ▾`;
    choices.forEach((choice, index) => choice.setAttribute('aria-checked', String(String(options[index]!.value) === String(value))));
  } };
}

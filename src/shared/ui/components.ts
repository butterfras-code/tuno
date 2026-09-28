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

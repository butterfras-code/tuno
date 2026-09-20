export const CLICK_SOUNDS = [
  { value: 'click', label: 'Click' },
  { value: 'wood', label: 'Wood' },
  { value: 'beep', label: 'Beep' },
  { value: 'drum', label: 'Drum' },
] as const;

export type ClickSound = typeof CLICK_SOUNDS[number]['value'];

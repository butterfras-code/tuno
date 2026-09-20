export const TONE_SOUNDS = [
  { value: 'sine', label: 'Sine' },
  { value: 'triangle', label: 'Triangle' },
  { value: 'rich', label: 'Rich' },
  { value: 'sweet', label: 'Sweet' },
  { value: 'clear', label: 'Clear' },
] as const;

export type ToneSound = typeof TONE_SOUNDS[number]['value'];

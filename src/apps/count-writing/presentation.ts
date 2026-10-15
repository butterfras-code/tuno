/** Display preferences are independent of musical timing and answer evaluation. */
export const linePlacementOptions = [
  { value: 'below', label: 'Below counts' },
  { value: 'above', label: 'Above counts' },
  { value: 'beside', label: 'Beside counts' },
] as const;
export const sustainAppearanceOptions = [
  { value: 'raised', label: 'Raised and smaller' },
  { value: 'lowered', label: 'Lowered and smaller' },
  { value: 'unchanged', label: 'Unchanged' },
] as const;
export type LinePlacement = typeof linePlacementOptions[number]['value'];
export type SustainAppearance = typeof sustainAppearanceOptions[number]['value'];
export interface CountPresentation {
  linePlacement: LinePlacement;
  sustainAppearance: SustainAppearance;
}
export const defaultPresentation: CountPresentation = { linePlacement: 'below', sustainAppearance: 'raised' };

export function withLinePlacement(current: CountPresentation, linePlacement: LinePlacement): CountPresentation {
  return {
    ...current,
    linePlacement,
    sustainAppearance: linePlacement === 'beside' && current.linePlacement !== 'beside' ? 'raised' : current.sustainAppearance,
  };
}

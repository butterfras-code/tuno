/** Symbolic score time: integer eighth-note ticks, independent of playback and UI. */
export interface RhythmEvent {
  readonly kind: 'note' | 'rest';
  readonly start: number;
  readonly value: 'half' | 'quarter' | 'eighth';
  readonly dotted?: boolean;
}
export interface RhythmMeasure {
  readonly id: string;
  readonly label: string;
  readonly meter: readonly [4, 4];
  readonly events: readonly RhythmEvent[];
}
export function duration(event: RhythmEvent): number {
  const ticks = { half: 4, quarter: 2, eighth: 1 }[event.value];
  return ticks * (event.dotted ? 1.5 : 1);
}
export function validateMeasure(measure: RhythmMeasure): void {
  let end = 0;
  for (const event of measure.events) {
    if (event.start !== end || !Number.isInteger(duration(event))) throw new Error('Events must fill a contiguous eighth-note timeline.');
    end += duration(event);
  }
  if (end !== 8) throw new Error('A 4/4 measure must contain eight eighth-note ticks.');
}
export const countWritingFixtures: readonly RhythmMeasure[] = [
  { id: 'half', label: 'Half • quarter • two eighths', meter: [4, 4], events: [
    { kind: 'note', start: 0, value: 'half' }, { kind: 'note', start: 4, value: 'quarter' },
    { kind: 'note', start: 6, value: 'eighth' }, { kind: 'note', start: 7, value: 'eighth' },
  ] },
  { id: 'dotted-quarter', label: 'Dotted quarter • eighth • half', meter: [4, 4], events: [
    { kind: 'note', start: 0, value: 'quarter', dotted: true }, { kind: 'note', start: 3, value: 'eighth' },
    { kind: 'note', start: 4, value: 'half' },
  ] },
  { id: 'rest', label: 'Quarter • quarter rest • two eighths • quarter', meter: [4, 4], events: [
    { kind: 'note', start: 0, value: 'quarter' }, { kind: 'rest', start: 2, value: 'quarter' },
    { kind: 'note', start: 4, value: 'eighth' }, { kind: 'note', start: 5, value: 'eighth' },
    { kind: 'note', start: 6, value: 'quarter' },
  ] },
  { id: 'dotted-half', label: 'Dotted half • quarter', meter: [4, 4], events: [
    { kind: 'note', start: 0, value: 'half', dotted: true }, { kind: 'note', start: 6, value: 'quarter' },
  ] },
];
countWritingFixtures.forEach(validateMeasure);

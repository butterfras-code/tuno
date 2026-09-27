import { chromatic, diatonic, pitchLabel } from '../domain/notation.ts';
import { clefForPitch } from '../domain/presets.ts';
import type { WrittenPitch } from '../domain/notation.ts';
import type { Preset } from '../domain/presets.ts';
export const beginnerPreview = (preset: Preset) => !!preset.instrument && preset.id.endsWith('-starter') || /^((treble|bass|alto|tenor)-(lines|spaces|lines-and-spaces))$/.test(preset.id);
export function previewGroups(preset: Preset) {
  const sorted = [...preset.pool].sort((a,b) => chromatic(a)-chromatic(b) || diatonic(a)-diatonic(b) || pitchLabel(a).localeCompare(pitchLabel(b),'en'));
  const groups: WrittenPitch[][] = [];
  for (const pitch of sorted) {
    const last = groups.at(-1);
    if (!last || last.length === 4 || clefForPitch(preset,last[0]!) !== clefForPitch(preset,pitch)) groups.push([pitch]);
    else last.push(pitch);
  }
  return groups;
}

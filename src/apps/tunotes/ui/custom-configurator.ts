import { el } from '../../../shared/ui/components.ts';
import { clefs, clefForPitch, modifiersFor, normalizePreset } from '../domain/presets.ts';
import type { Content, Modifier, PresetSource } from '../domain/presets.ts';
import { chromatic, diatonic, keyName, keySignature, ledgerPositions, pitchLabel, spelling, staffPosition } from '../domain/notation.ts';
import type { Clef } from '../domain/notation.ts';
import { rangeEditor, segments } from './range-editor.ts';
import { titleCase } from './preset-picker.ts';

export function customConfigurator(changed: () => void) {
  const node = el('fieldset','custom-configurator'); node.append(el('legend','','tuNotes Your Way!'));
  let content: Content = 'lines-and-spaces', modifiers: Modifier[] = ['key'], available: Clef[] = ['treble'];
  let firstClefChange: number | undefined, explicitClefs = false;
  const range = el('div','range-grid');
  const update = () => { modifierSegments.update(modifiers); availableSegments.update(available); contentSegments.update([content]); changed(); };
  const setClef = (index: number, clef: Clef) => {
    const other = endpoints[1-index]!;
    if (endpoints[0].clef === endpoints[1].clef && (firstClefChange === undefined || firstClefChange === index)) {
      endpoints.forEach(e => e.setClef(clef)); firstClefChange = index;
    } else {
      if (clef !== other.clef && !available.includes(clef) && !window.confirm(`Selecting a different clef allows it to appear in the exercise. Use ${other.clef} and ${clef} clefs?`)) return;
      endpoints[index]!.setClef(clef);
    }
    if (!explicitClefs) available = clefs.filter(c => endpoints.some(e => e.clef === c));
    else if (!available.includes(clef)) available = clefs.filter(c => c === clef || available.includes(c));
    update();
  };
  const syncLimits = () => {
    endpoints[0].setLimits(0,diatonic(endpoints[1].pitch));
    endpoints[1].setLimits(diatonic(endpoints[0].pitch),62);
  };
  const rangeChanged = (index: number) => {
    const low = endpoints[0].pitch, high = endpoints[1].pitch;
    if (diatonic(low) > diatonic(high) || chromatic(low) > chromatic(high)) {
      const boundary = endpoints[1-index]!.pitch;
      endpoints[index]!.set(pitchLabel(boundary),endpoints[index]!.clef);
      notice.textContent = `${index === 0 ? 'Lowest' : 'Highest'} note stopped at ${pitchLabel(boundary)} to keep the range in order.`;
    } else notice.textContent = '';
    syncLimits(); changed();
  };
  const endpoints = [rangeEditor('Lowest note','E4',() => rangeChanged(0),c => setClef(0,c)),rangeEditor('Highest note','F5',() => rangeChanged(1),c => setClef(1,c))] as const;
  syncLimits();
  range.append(...endpoints.map(e => e.node));
  const contentSegments = segments<Content>('Staff content',[['lines','Lines'],['spaces','Spaces'],['lines-and-spaces','Both']],value => { content = value; update(); });
  const modifierSegments = segments<Modifier>('Modifiers',[['key','Key'],['flat','♭ Flat'],['natural','♮ Natural'],['sharp','♯ Sharp']],value => { modifiers = modifiers.includes(value) ? modifiers.filter(m => m !== value) : [...modifiers,value]; update(); },true);
  const key = el('select','inline-key'); key.setAttribute('aria-label','Major key');
  for (const value of ['C','F','Bb','Eb','Ab','Db','Gb','G','D','A','E','B','F#']) {
    const option = el('option','',`${spelling(keySignature(value).tonic)} major`); option.value = value; key.append(option);
  }
  const keyGroup = el('div','key-modifier'); modifierSegments.buttons[0]!.replaceWith(keyGroup); keyGroup.append(modifierSegments.buttons[0]!,key);
  key.addEventListener('change',() => { if (!modifiers.includes('key')) modifiers.push('key'); update(); });
  const availableSegments = segments<Clef>('Available clefs',clefs.map(c => [c,titleCase(c)] as const),value => {
    if (available.includes(value) && available.length === 1) { notice.textContent = 'Keep at least one clef enabled.'; return; }
    available = clefs.filter(c => c === value ? !available.includes(c) : available.includes(c)); explicitClefs = true; notice.textContent = ''; update();
  },true);
  const notice = el('p','muted configurator-notice'); notice.setAttribute('role','status');
  const ledger = el('p','muted ledger-description');
  node.append(el('p','muted clef-help','Click the clef to change.'),range,el('p','muted range-help','Tap the staff or drag the note. Arrow keys move one position; Page Up/Down move an octave.'),contentSegments.node,el('h4','','Modifiers · select multiple'),modifierSegments.node,el('h4','','Available clefs'),availableSegments.node,el('p','muted','Notes use the enabled clef that needs the fewest ledger lines. Flat, natural and sharp add spellings within the selected range.'),notice,ledger);
  const source = (id: string, name: string): PresetSource => ({id,name,editorVersion:2,clef:available[0]!,range:endpoints.map(e => pitchLabel(e.pitch).replace('♯','#').replace('♭','b')) as [string,string],content,key:keySignature(key.value),accidentals:'key-only',modifiers:[...modifiers],availableClefs:[...available],endpointClefs:endpoints.map(e => e.clef) as [Clef,Clef]});
  const load = (p: PresetSource) => {
    content = p.content; modifiers = [...modifiersFor(p)]; available = [...p.availableClefs ?? [p.clef]]; explicitClefs = p.editorVersion === 2; firstClefChange = undefined;
    let bounds = p.range;
    if (p.editorVersion !== 2) { // Preserve the old ledger-clipped extent when opening it in the graphical editor.
      const pool = [...normalizePreset(p,{legacySpellings:true}).pool].sort((a,b) => diatonic(a)-diatonic(b) || a.accidental-b.accidental);
      bounds = [pitchLabel(pool[0]!),pitchLabel(pool.at(-1)!)];
    }
    endpoints[0].set(bounds[0],p.endpointClefs?.[0] ?? p.clef); endpoints[1].set(bounds[1],p.endpointClefs?.[1] ?? p.clef);
    const name = keyName(p.key ?? keySignature('C'));
    if (![...key.options].some(o => o.value === name)) { const option = el('option','',`${spelling(keySignature(name).tonic)} major (saved)`); option.value = name; key.append(option); }
    key.value = name; notice.textContent = ''; syncLimits(); update();
  };
  // Initialize visual state without notifying the parent before construction completes.
  modifierSegments.update(modifiers); availableSegments.update(available); contentSegments.update([content]);
  return {node,source,load,clearDescription() { ledger.textContent = ''; },describe(p: ReturnType<typeof normalizePreset>) {
    const counts = p.pool.map(note => ledgerPositions(staffPosition(note,clefForPitch(p,note))).length);
    const count = Math.max(...counts); ledger.textContent = count ? `Range includes up to ${count} ledger ${count === 1 ? 'line' : 'lines'}.` : 'Range stays on the staff or its immediately adjacent spaces.';
  }};
}

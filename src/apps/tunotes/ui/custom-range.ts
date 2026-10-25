import { el } from '../../../shared/ui/components.ts';
import { C_MAJOR, chromatic, diatonic, pitchLabel } from '../domain/notation.ts';
import type { Clef } from '../domain/notation.ts';
import { clefs, defaultPreset, generatedPresetName, modifiersFor, normalizePreset } from '../domain/presets.ts';
import type { PresetSource } from '../domain/presets.ts';
import { control } from './preset-picker.ts';
import { rangeEditor } from './range-editor.ts';

/** Graphical range draft; remaining custom settings stay in the existing editor. */
export function customRange(apply: (source: PresetSource) => void) {
  const node = el('section','visual-custom-range'); node.setAttribute('aria-label','Range');
  let base: PresetSource = defaultPreset;
  let available: Clef[] = ['treble'];
  let lines = true, spaces = true;
  const notice = el('p','muted'); notice.setAttribute('role','status');
  const validation = el('p','muted'); validation.setAttribute('role','status');
  const changed = (index: number) => {
    const low = endpoints[0].pitch, high = endpoints[1].pitch;
    if (diatonic(low) > diatonic(high) || chromatic(low) > chromatic(high)) {
      const boundary = endpoints[1-index]!.pitch;
      endpoints[index]!.set(pitchLabel(boundary),endpoints[index]!.clef);
      notice.textContent = `Range stops at ${pitchLabel(boundary)}.`;
    } else notice.textContent = '';
    refresh();
  };
  const changeClef = (index: number, clef: Clef) => {
    endpoints[index]!.setClef(clef);
    available = clefs.filter(c => (base.availableClefs ?? [base.clef]).includes(c) || endpoints.some(e => e.clef === c));
    refresh();
  };
  const endpoints = [
    rangeEditor('Lowest note','E4',() => changed(0),c => changeClef(0,c),true),
    rangeEditor('Highest note','F5',() => changed(1),c => changeClef(1,c),true),
  ] as const;
  function source(): PresetSource {
    if (!lines && !spaces) throw new Error('Turn on Lines or Spaces to include notes.');
    const draft: PresetSource = {id:'custom-current',name:'Custom',editorVersion:2,
      content:lines && spaces ? 'lines-and-spaces' : lines ? 'lines' : 'spaces',key:base.key ?? C_MAJOR,accidentals:'key-only',
      clef:available[0]!,availableClefs:[...available],modifiers:[...modifiersFor(base)],
      endpointClefs:endpoints.map(e => e.clef) as [Clef,Clef],
      range:endpoints.map(e => pitchLabel(e.pitch).replace('♯','#').replace('♭','b')) as [string,string]};
    return {...draft,name:generatedPresetName(draft)};
  }
  function refresh() {
    contentButtons.forEach(({button,mark},i) => {
      const active = i === 0 ? lines : spaces;
      button.setAttribute('aria-pressed',String(active)); mark.textContent = active ? '✓' : '';
    });
    endpoints[0].setLimits(0,diatonic(endpoints[1].pitch));
    endpoints[1].setLimits(diatonic(endpoints[0].pitch),62);
    try { normalizePreset(source()); use.disabled = false; validation.textContent = ''; }
    catch (error) { use.disabled = true; validation.textContent = (error as Error).message; }
  }
  const use = control('Save',() => apply(source())); use.classList.add('control--primary');
  const footer = el('div','visual-range-actions'); footer.append(use);
  const pair = el('div','visual-range-pair'); pair.append(...endpoints.map(e => e.node));
  const header = el('div','visual-range-header');
  header.append(el('p','muted','Tap clefs or accidentals to change them. Drag notes or use arrows to move them.'));
  const content = el('div','visual-range-content'); content.setAttribute('role','group'); content.setAttribute('aria-label','Staff content');
  const contentButtons = (['Lines','Spaces'] as const).map((label,index) => {
    const button = control('',() => { if (index === 0) lines = !lines; else spaces = !spaces; refresh(); });
    button.classList.add('range-content-button'); button.setAttribute('aria-label',label);
    const ns = 'http://www.w3.org/2000/svg', icon = document.createElementNS(ns,'svg');
    icon.setAttribute('viewBox','0 0 48 48'); icon.setAttribute('aria-hidden','true');
    for (const y of index === 0 ? [24] : [12,36]) {
      const line = document.createElementNS(ns,'line');
      for (const [name,value] of Object.entries({x1:'2',x2:'46',y1:String(y),y2:String(y),stroke:'currentColor','stroke-width':'1.5'})) line.setAttribute(name,value);
      icon.append(line);
    }
    const note = document.createElementNS(ns,'path');
    note.setAttribute('d','M 11 24 a 13 9 0 1 0 26 0 a 13 9 0 1 0 -26 0 M 19 24 a 5 7 0 1 0 10 0 a 5 7 0 1 0 -10 0');
    note.setAttribute('fill','currentColor'); note.setAttribute('fill-rule','evenodd');
    icon.append(note);
    const mark = el('span','range-content-mark'); mark.setAttribute('aria-hidden','true');
    button.append(icon,el('span','',label),mark); content.append(button);
    return {button,mark};
  });
  const contentPanel = el('section','visual-content-section');
  contentPanel.append(el('p','muted','Select note positions to include'),content,validation);
  node.append(header,pair,notice);
  return {node,contentPanel,footer,load(p: PresetSource) {
    base = p; available = [...p.availableClefs ?? [p.clef]];
    lines = p.content !== 'spaces'; spaces = p.content !== 'lines';
    let bounds = p.range;
    if (p.editorVersion !== 2) {
      const pool = [...normalizePreset(p,{legacySpellings:true}).pool].sort((a,b) => diatonic(a)-diatonic(b) || a.accidental-b.accidental);
      bounds = [pitchLabel(pool[0]!),pitchLabel(pool.at(-1)!)];
    }
    endpoints.forEach((endpoint,i) => endpoint.set(bounds[i]!,p.endpointClefs?.[i] ?? p.clef));
    notice.textContent = ''; refresh();
  }};
}

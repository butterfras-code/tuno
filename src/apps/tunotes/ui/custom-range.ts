import { el } from '../../../shared/ui/components.ts';
import { C_MAJOR, chromatic, diatonic, pitchAt, pitchLabel, staffPosition } from '../domain/notation.ts';
import type { Clef } from '../domain/notation.ts';
import { clefs, clefForPitch, defaultPreset, generatedPresetName, normalizePreset } from '../domain/presets.ts';
import type { PresetSource } from '../domain/presets.ts';
import { control, titleCase } from './preset-picker.ts';
import { rangeEditor } from './range-editor.ts';
import { keySignatureControl } from './key-signature-control.ts';
import { renderStaff } from './staff.ts';

/** Graphical range draft; remaining custom settings stay in the existing editor. */
export function customRange(apply: (source: PresetSource) => void) {
  const node = el('section','visual-custom-range'); node.setAttribute('aria-label','Range');
  let base: PresetSource = defaultPreset;
  let available: Clef[] = ['treble'];
  let explicitClefs = false;
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
    if (!explicitClefs) available = clefs.filter(c => endpoints.some(e => e.clef === c));
    refresh();
  };
  const endpoints = [
    rangeEditor('Lowest note','E4',() => changed(0),c => changeClef(0,c),true),
    rangeEditor('Highest note','F5',() => changed(1),c => changeClef(1,c),true),
  ] as const;
  function source(): PresetSource {
    if (!lines && !spaces) throw new Error('Turn on Lines or Spaces to include notes.');
    if (!available.length) throw new Error('Select at least one clef for practice.');
    const draft: PresetSource = {id:'custom-current',name:'Custom',editorVersion:2,
      content:lines && spaces ? 'lines-and-spaces' : lines ? 'lines' : 'spaces',key:keyControl.signature,accidentals:'key-only',
      clef:available[0]!,availableClefs:[...available],modifiers:keyControl.modifiers,
      endpointClefs:endpoints.map(e => e.clef) as [Clef,Clef],
      range:endpoints.map(e => pitchLabel(e.pitch).replace('♯','#').replace('♭','b')) as [string,string]};
    return {...draft,name:generatedPresetName(draft)};
  }
  function refresh() {
    clefButtons.forEach(({clef,button,mark}) => {
      const active = available.includes(clef);
      button.setAttribute('aria-pressed',String(active)); mark.textContent = active ? '✓' : '+';
    });
    contentButtons.forEach(({button,mark},i) => {
      const active = i === 0 ? lines : spaces;
      button.setAttribute('aria-pressed',String(active)); mark.textContent = active ? '✓' : '+';
    });
    endpoints[0].setLimits(0,diatonic(endpoints[1].pitch));
    endpoints[1].setLimits(diatonic(endpoints[0].pitch),62);
    try { normalizePreset(source()); use.disabled = false; validation.textContent = ''; }
    catch (error) { use.disabled = true; validation.textContent = (error as Error).message; }
  }
  const use = control('Save',() => apply(source())); use.classList.add('control--primary');
  const footer = el('div','visual-range-actions'); footer.append(validation,use);
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
  contentPanel.append(el('p','muted','Select note positions to include'),content);
  const keyControl = keySignatureControl(refresh,() => {
    const middle = pitchAt(Math.floor((staffPosition(endpoints[0].pitch,'treble')+staffPosition(endpoints[1].pitch,'treble'))/2),'treble');
    return clefForPitch({...base,clef:endpoints[0].clef,availableClefs:[...new Set(endpoints.map(e => e.clef))]},middle);
  });
  const clefPanel = el('section','visual-content-section practice-clef-section');
  const clefOptions = el('div','visual-range-content practice-clef-options');
  clefOptions.setAttribute('role','group'); clefOptions.setAttribute('aria-label','Practice clefs');
  const clefButtons = clefs.map(clef => {
    const button = control('',() => {
      explicitClefs = true;
      available = clefs.filter(c => c === clef ? !available.includes(c) : available.includes(c));
      refresh();
    });
    button.classList.add('range-content-button','practice-clef-button'); button.setAttribute('aria-label',titleCase(clef));
    const staff = renderStaff(pitchAt(4,clef),clef,C_MAJOR); staff.classList.replace('staff','practice-clef-staff');
    staff.setAttribute('viewBox','16 20 128 160'); staff.setAttribute('aria-hidden','true');
    staff.querySelectorAll('.notehead, .ledger, .note-accidental').forEach(n => n.remove());
    staff.querySelectorAll('line').forEach(line => line.setAttribute('x2','136'));
    const mark = el('span','range-content-mark'); mark.setAttribute('aria-hidden','true');
    const label = el('span','practice-clef-label'); label.append(el('span','',titleCase(clef)),mark);
    button.append(staff,label); clefOptions.append(button);
    return {clef,button,mark};
  });
  clefPanel.append(el('h4','','Clefs'),clefOptions);
  node.append(header,pair,notice);
  return {node,contentPanel,keyPanel:keyControl.node,clefPanel,footer,closePopovers: () => keyControl.close(),load(p: PresetSource) {
    base = p; explicitClefs = p.editorVersion === 2;
    lines = p.content !== 'spaces'; spaces = p.content !== 'lines';
    keyControl.load(p);
    let bounds = p.range;
    if (p.editorVersion !== 2) {
      const pool = [...normalizePreset(p,{legacySpellings:true}).pool].sort((a,b) => diatonic(a)-diatonic(b) || a.accidental-b.accidental);
      bounds = [pitchLabel(pool[0]!),pitchLabel(pool.at(-1)!)];
    }
    endpoints.forEach((endpoint,i) => endpoint.set(bounds[i]!,p.endpointClefs?.[i] ?? p.clef));
    available = explicitClefs ? [...p.availableClefs ?? [p.clef]] : clefs.filter(c => endpoints.some(e => e.clef === c));
    notice.textContent = ''; refresh();
  }};
}

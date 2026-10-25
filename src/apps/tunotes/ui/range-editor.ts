import { el } from '../../../shared/ui/components.ts';
import { C_MAJOR, diatonic, parsePitch, pitchAt, pitchLabel, staffPosition } from '../domain/notation.ts';
import type { Accidental, Clef, WrittenPitch } from '../domain/notation.ts';
import { supportedAnswer } from '../domain/answer-layout.ts';
import { clefs } from '../domain/presets.ts';
import { renderStaff } from './staff.ts';
import { control, titleCase } from './preset-picker.ts';

export function segments<T extends string>(label: string, values: readonly (readonly [T,string])[], change: (value: T) => void, multiple = false) {
  const node = el('div','segments'); node.setAttribute('role','group'); node.setAttribute('aria-label',label);
  const buttons = values.map(([value,text]) => {
    const button = control(text,() => change(value)); button.setAttribute('aria-label',text); button.dataset.value = value; node.append(button); return button;
  });
  return { node, buttons, update(selected: readonly T[]) { buttons.forEach((b,i) => { const active = selected.includes(values[i]![0]); b.setAttribute('aria-pressed',String(active)); b.textContent = `${multiple ? active ? '✓ ' : '＋ ' : ''}${values[i]![1]}`; }); } };
}
export function rangeEditor(label: string, initial: string, changed: () => void, changeClef: (clef: Clef) => void, visual = false) {
  let pitch = parsePitch(initial), clef: Clef = 'treble';
  const node = el('div','range-endpoint');
  const heading = el('h4','',label);
  const readout = el('output'); readout.setAttribute('aria-live','polite');
  const clefSelect = el('select','control endpoint-clef'); clefSelect.setAttribute('aria-label',`${label} clef`);
  for (const value of clefs) { const option = el('option','',`${titleCase(value)} clef`); option.value = value; clefSelect.append(option); }
  clefSelect.addEventListener('change',() => { changeClef(clefSelect.value as Clef); clefSelect.value = clef; });
  const stage = el('div','range-staff-stage');
  const cycleClef = () => changeClef(clefs[(clefs.indexOf(clef)+1)%clefs.length]!);
  const clefButton = control('',cycleClef); clefButton.classList.add('range-clef');
  const staff = el('div','range-staff'); staff.tabIndex = 0; staff.setAttribute('role','slider'); staff.setAttribute('aria-label',label); staff.setAttribute('aria-orientation','vertical'); staff.setAttribute('aria-valuemin','0'); staff.setAttribute('aria-valuemax','62');
  const accidental = segments(`${label} accidental`,[['-1','♭'],['0','♮'],['1','♯']] as const,value => { pitch = {...pitch,accidental:Number(value) as Accidental}; update(); changed(); });
  accidental.buttons.forEach((b,i) => b.setAttribute('aria-label',['Flat','Natural','Sharp'][i]!));
  const accidentalCycle = control('',() => {
    const values = [-1,0,1] as const;
    const start = values.indexOf(pitch.accidental);
    for (let step = 1; step <= values.length; step++) {
      const next = {...pitch,accidental:values[(start+step)%values.length]!};
      if (supportedAnswer(next)) { pitch = next; update(); changed(); break; }
    }
  });
  accidentalCycle.classList.add('range-accidental-cycle');
  let gesture: { id: number; startY: number; startPitch: WrittenPitch; unit: number } | undefined;
  const setPosition = (position: number) => {
    const safe = Math.max(0,Math.min(62,position));
    const natural = parsePitch(`${'CDEFGAB'[safe%7]}${Math.floor(safe/7)}`);
    pitch = {...natural,accidental:supportedAnswer({...natural,accidental:pitch.accidental}) ? pitch.accidental : 0};
    update(); changed();
  };
  staff.addEventListener('keydown',event => {
    const delta = ({ArrowUp:1,ArrowDown:-1,ArrowRight:1,ArrowLeft:-1,PageUp:7,PageDown:-7} as Record<string,number>)[event.key];
    if (delta !== undefined) { event.preventDefault(); setPosition(diatonic(pitch)+delta); }
    if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); setPosition(event.key === 'Home' ? 0 : 62); }
  });
  staff.addEventListener('pointerdown',event => {
    if (event.button !== 0 || !event.isPrimary) return;
    const svg = staff.querySelector('svg')!;
    const matrix = svg.getScreenCTM(); if (!matrix) return;
    const point = new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse());
    // Extreme ledger ranges can letterbox the glyph beyond the normal touch overlay.
    if (point.x >= 24 && point.x <= 105) { event.preventDefault(); if (visual) { cycleClef(); clefButton.focus(); } else clefSelect.focus(); return; }
    staff.focus(); event.preventDefault();
    if (!(event.target as Element).closest('.notehead')) {
      try { const note = pitchAt(Math.round((140-point.y)/10),clef); setPosition(diatonic(note)); } catch { /* outside supported octaves */ }
    }
    gesture = {id:event.pointerId,startY:event.clientY,startPitch:pitch,unit:10*matrix.d}; staff.setPointerCapture(event.pointerId);
  });
  staff.addEventListener('pointermove',event => { if (gesture?.id === event.pointerId) setPosition(diatonic(gesture.startPitch)+Math.round((gesture.startY-event.clientY)/gesture.unit)); });
  const end = (event: PointerEvent) => { if (gesture?.id === event.pointerId) { gesture = undefined; if (staff.hasPointerCapture(event.pointerId)) staff.releasePointerCapture(event.pointerId); } };
  staff.addEventListener('pointerup',end); staff.addEventListener('pointercancel',end); staff.addEventListener('lostpointercapture',() => { gesture = undefined; });
  function update() {
    const svg = renderStaff(pitch,clef,C_MAJOR); svg.classList.replace('staff','endpoint-staff'); svg.setAttribute('aria-hidden','true');
    // Leave space around the selected note for tapping nearby ledger positions.
    const position = staffPosition(pitch,clef), y = 140-position*10;
    const top = visual ? Math.min(60,y-12) : Math.min(0,y-50);
    const bottom = visual ? Math.max(140,y+12) : Math.max(200,y+50);
    svg.setAttribute('viewBox',`${visual ? '24' : '0'} ${top} ${visual ? '252' : '360'} ${bottom-top}`);
    if (visual) svg.querySelectorAll('line:not(.ledger)').forEach(line => line.setAttribute('x2','272'));
    staff.replaceChildren(svg); staff.setAttribute('aria-valuenow',String(diatonic(pitch))); staff.setAttribute('aria-valuetext',`${pitchLabel(pitch)}, ${clef} clef`);
    readout.value = pitchLabel(pitch); clefSelect.value = clef; accidental.update([String(pitch.accidental) as '-1'|'0'|'1']);
    clefButton.setAttribute('aria-label',`${label} clef: ${titleCase(clef)}. Change clef`);
    clefButton.title = `${titleCase(clef)} clef — click to change`;
    const accidentalName = ['Flat','Natural','Sharp'][pitch.accidental+1]!;
    accidentalCycle.textContent = ['♭','♮','♯'][pitch.accidental+1]!;
    accidentalCycle.setAttribute('aria-label',`${label} accidental: ${accidentalName}. Change accidental`);
    accidentalCycle.title = `${accidentalName} — click to change`;
    accidental.buttons.forEach((b,i) => { b.disabled = !supportedAnswer({...pitch,accidental:(i-1) as Accidental}); });
  }
  stage.append(staff);
  const identity = el('div','endpoint-identity'); identity.append(heading,readout);
  const header = el('div','endpoint-header'); header.append(identity,clefSelect);
  if (visual) {
    heading.textContent = label === 'Lowest note' ? 'Lowest:' : 'Highest:';
    node.classList.add('visual-range-endpoint'); header.replaceChildren(identity);
    const notation = el('div','visual-range-notation'); notation.append(staff,clefButton);
    const bumps: HTMLButtonElement[] = [];
    for (const [delta,text] of [[1,'⌃'],[-1,'⌄']] as const) {
      const bump = control(text,() => setPosition(diatonic(pitch)+delta));
      bump.setAttribute('aria-label',`${label}: move ${delta > 0 ? 'up' : 'down'}`); bumps.push(bump);
    }
    stage.replaceChildren(bumps[0]!,notation,bumps[1]!);
    const row = el('div','visual-range-row'); row.append(accidentalCycle,stage);
    node.append(header,row);
  } else node.append(header,stage,accidental.node);
  update();
  return {node,setLimits(low: number, high: number) { staff.setAttribute('aria-valuemin',String(low)); staff.setAttribute('aria-valuemax',String(high)); },get pitch() { return pitch; },get clef() { return clef; },set(value: string, nextClef: Clef) { pitch = parsePitch(value.replace('♯','#').replace('♭','b')); clef = nextClef; update(); },setClef(value: Clef) { clef = value; update(); }};
}

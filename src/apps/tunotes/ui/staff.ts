import { ledgerPositions, positionDescription, staffPosition, keyAccidental, keyPositions, spelling } from '../domain/notation.ts';
import type { Clef, KeySignature, WrittenPitch } from '../domain/notation.ts';
const ns = 'http://www.w3.org/2000/svg';
export const staffY = (position: number) => 140 - position * 10;
export function staffGeometry(pitch: WrittenPitch, clef: Clef) {
  const position = staffPosition(pitch, clef);
  return { position, noteY: staffY(position), ledgers: ledgerPositions(position).map(p => ({ position: p, y: staffY(p), x1: 207, x2: 253 })) };
}
function svgNode(tag: string, attrs: Record<string, string | number>) {
  const node = document.createElementNS(ns, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  return node;
}
// Original project-owned vector clefs. No system music font or remote glyph dependency.
const treble = 'M 66 156 C 87 159 87 132 76 105 L 62 64 C 53 35 72 19 76 38 C 81 58 45 82 43 104 C 39 130 79 142 88 116 C 96 93 59 82 55 105 C 52 116 64 123 73 118 M 66 156 C 52 154 54 143 61 143';
const bass = 'M 45 83 C 43 59 76 58 77 80 C 79 99 59 115 44 121 M 45 82 C 57 85 58 70 48 70 C 40 70 39 79 45 82';
export function renderStaff(pitch: WrittenPitch, clef: Clef, key: KeySignature, keyless = false) {

  const geometry = staffGeometry(pitch, clef);
  const offset = Math.abs(key.fifths) * 19;
  const top = Math.min(0, geometry.noteY - 30), bottom = Math.max(200, geometry.noteY + 30);
  const svg = svgNode('svg', { viewBox: `0 ${top} ${360 + offset} ${bottom - top}`, role: 'img', 'aria-label': `${clef} clef, ${keyless ? 'no key signature' : `${spelling(key.tonic)} major`}, ${positionDescription(geometry.position)}`, class: 'staff' });
  for (let p = 0; p <= 8; p += 2) svg.append(svgNode('line', { x1: 24, x2: 336 + offset, y1: staffY(p), y2: staffY(p), stroke: 'currentColor', 'stroke-width': 1.5 }));
  const glyph = svgNode('g', { 'aria-hidden': 'true', fill: 'none', stroke: 'currentColor', 'stroke-width': 4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
  if (clef === 'treble' || clef === 'bass') {
    glyph.append(svgNode('path', { d: clef === 'treble' ? treble : bass, transform: clef === 'treble' ? 'translate(0 10)' : 'translate(0 0)' }));
    if (clef === 'bass') for (const y of [70, 90]) glyph.append(svgNode('circle', { cx: 88, cy: y, r: 3, fill: 'currentColor', stroke: 'none' }));
  } else {
    const center = staffY(clef === 'alto' ? 4 : 6);
    glyph.append(svgNode('path', { d: `M 44 ${center - 40} V ${center + 40} M 51 ${center - 40} V ${center + 40}` }));
    glyph.append(svgNode('path', { fill: 'currentColor', stroke: 'none', d: `M 57 ${center - 40} H 73 C 103 ${center - 40} 99 ${center - 4} 80 ${center - 4} L 65 ${center} L 80 ${center + 4} C 99 ${center + 4} 103 ${center + 40} 73 ${center + 40} H 57 V ${center + 32} H 72 C 87 ${center + 32} 87 ${center + 12} 72 ${center + 12} H 68 L 57 ${center} L 68 ${center - 12} H 72 C 87 ${center - 12} 87 ${center - 32} 72 ${center - 32} H 57 Z` }));
  }
  svg.append(glyph);
  const positions = keyPositions[clef][key.fifths > 0 ? 'sharp' : 'flat'];
  positions.slice(0, Math.abs(key.fifths)).forEach((p, i) => svg.append(accidentalGlyph(key.fifths > 0 ? 1 : -1, 117 + i * 19, staffY(p), 'key-accidental')));
  if (pitch.accidental !== keyAccidental(pitch.letter, key)) svg.append(accidentalGlyph(pitch.accidental, 192 + offset, geometry.noteY, 'note-accidental'));
  for (const ledger of geometry.ledgers) svg.append(svgNode('line', { class: 'ledger', x1: ledger.x1 + offset, x2: ledger.x2 + offset, y1: ledger.y, y2: ledger.y, stroke: 'currentColor', 'stroke-width': 2 }));
  svg.append(svgNode('path', { class: 'notehead', fill: 'currentColor', 'fill-rule': 'evenodd', d: 'M -17 0 a 17 10 0 1 0 34 0 a 17 10 0 1 0 -34 0 M -7 0 a 7 8 0 1 0 14 0 a 7 8 0 1 0 -14 0', transform: `translate(${230 + offset} ${geometry.noteY}) rotate(-15)` }));
  return svg;
}

// Original vector accidental glyphs centered on their staff position.
function accidentalGlyph(value: number, x: number, y: number, kind: string) {
  const paths = value === 1 ? 'M -4 -17 V 18 M 4 -20 V 15 M -9 -5 L 9 -10 M -9 6 L 9 1' : value === -1 ? 'M -5 -22 V 12 C 15 3 9 -11 -5 -2' : 'M -5 -19 V 9 L 5 5 V -9 L -5 -5 M 5 5 V 19';
  return svgNode('path', { class: kind, d: paths, transform: `translate(${x} ${y})`, fill: 'none', stroke: 'currentColor', 'stroke-width': 2.5 });
}

/** Instructional version of the exercise staff, with one centered pitch and its label. */
export function renderPreviewStaff(pitch: WrittenPitch, clef: Clef, key: KeySignature, keyless = false) {
  const svg = renderStaff(pitch,clef,key,keyless);
  svg.classList.replace('staff','preview-staff');
  svg.setAttribute('aria-label',`${clef} clef, ${keyless ? 'no key signature' : `${spelling(key.tonic)} major`}, note introduction`);
  const width = 460+Math.abs(key.fifths)*38;
  const y = staffGeometry(pitch,clef).noteY;
  const top = Math.min(0,y-60), bottom = Math.max(200,y+55);
  svg.setAttribute('viewBox',`0 ${top} ${width} ${bottom-top+55}`);
  svg.querySelectorAll(':scope > line:not(.ledger)').forEach(line=>line.setAttribute('x2',String(width-24)));
  const note = svgNode('g',{class:'preview-note','data-label':spelling(pitch)});
  svg.querySelectorAll('.notehead, .ledger, .note-accidental').forEach(n=>note.append(n));
  const label = svgNode('text',{x:width/2,y:bottom+12,'text-anchor':'middle',class:'preview-note-label'});
  label.textContent = spelling(pitch);
  const progress = svgNode('text',{x:width/2,y:bottom+34,'text-anchor':'middle',class:'preview-note-status'});
  note.append(label,progress); svg.append(note);
  return svg;
}

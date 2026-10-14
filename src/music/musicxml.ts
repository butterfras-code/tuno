import { DOMParser } from '@xmldom/xmldom';
import type { Element } from '@xmldom/xmldom';
import { createScore, deriveScore, noteDuration } from './score.ts';
import type { RhythmScore, ScoreMeasure, WrittenNote } from './score.ts';
import { compare, divide, fraction, multiply } from './fraction.ts';
import type { WrittenType, TimeModification } from './written.ts';
import type { CountingPlan } from './counting/plan.ts';

/** Deliberately strict application profile, not a general MusicXML importer. */
const fail = (message: string): never => { throw new Error(`MusicXML profile: ${message}`); };
const children = (el: Element): Element[] => Array.from(el.childNodes).filter(n => n.nodeType === 1) as Element[];
function shape(el: Element, names: string[], attrs: string[] = [], repeated: string[] = [], text = false) {
  if (el.namespaceURI || Array.from(el.attributes).some(a => !attrs.includes(a.name))) fail(`unsupported attributes/namespace on ${el.tagName}`);
  let rank = -1;
  const seen = new Set<string>();
  for (const child of children(el)) {
    const next = names.indexOf(child.tagName);
    if (next < rank || next < 0 || (seen.has(child.tagName) && !repeated.includes(child.tagName))) fail(`unsupported, repeated or out-of-order ${child.tagName} in ${el.tagName}`);
    rank = next; seen.add(child.tagName);
  }
  if (!text && Array.from(el.childNodes).some(n => (n.nodeType === 3 || n.nodeType === 4) && n.nodeValue?.trim())) fail(`unexpected text in ${el.tagName}`);
}
function one(el: Element, name: string): Element {
  return children(el).find(c => c.tagName === name) ?? fail(`missing ${name}`);
}
function content(el: Element): string { shape(el, [], [], [], true); return el.textContent?.trim() ?? ''; }
function integer(el: Element): number {
  const s = content(el), n = Number(s);
  if (!/^\d+$/.test(s) || !Number.isSafeInteger(n) || n < 1) fail(`invalid positive integer ${el.tagName}`);
  return n;
}
function endpoints(elements: Element[]): string[] {
  const values = elements.map(e => {
    shape(e, [], ['type']); const type = e.getAttribute('type');
    if (type !== 'start' && type !== 'stop') fail('unsupported tie endpoint');
    return type!;
  });
  if (new Set(values).size !== values.length) fail('duplicate tie endpoint');
  return values.sort();
}
export function parseMusicXML(xml: string): RhythmScore {
  if (xml.length > 1_000_000 || /<!DOCTYPE|<!ENTITY/i.test(xml)) fail('DTD/entities or oversized document unsupported');
  const doc = new DOMParser({ onError: (_level, message) => fail(message) }).parseFromString(xml, 'application/xml');
  const root = doc.documentElement ?? fail('missing root');
  if (root.tagName !== 'score-partwise' || root.getAttribute('version') !== '4.0') fail('expected score-partwise version 4.0');
  shape(root, ['identification', 'part-list', 'part'], ['version']);
  const identification = children(root).find(e => e.tagName === 'identification');
  if (identification) {
    shape(identification, ['miscellaneous']);
    const misc = one(identification, 'miscellaneous'); shape(misc, ['miscellaneous-field']);
    const field = one(misc, 'miscellaneous-field'); shape(field, [], ['name'], [], true);
    if (field.getAttribute('name') !== 'tuno:counting-v1') fail('unsupported metadata');
    // Derived exercise metadata is not imported as authored musical truth.
  }
  const list = one(root, 'part-list'); shape(list, ['score-part']);
  const definition = one(list, 'score-part'); shape(definition, ['part-name'], ['id']); content(one(definition, 'part-name'));
  const part = one(root, 'part'); shape(part, ['measure'], ['id'], ['measure']);
  if (!/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(definition.getAttribute('id') ?? '') || definition.getAttribute('id') !== part.getAttribute('id')) fail('part ID mismatch');
  let pending = false;
  const measures: ScoreMeasure[] = children(part).map((measure, mi) => {
    shape(measure, ['attributes', 'note'], ['number'], ['note']);
    if (!measure.getAttribute('number')) fail('measure number required');
    const attrs = one(measure, 'attributes'); shape(attrs, ['divisions', 'time']);
    const divisions = integer(one(attrs, 'divisions'));
    const time = one(attrs, 'time'); shape(time, ['beats', 'beat-type']);
    const numerator = integer(one(time, 'beats')), denominator = integer(one(time, 'beat-type'));
    if (denominator !== 4 && denominator !== 8) fail('unsupported denominator');
    const notes = children(measure).filter(e => e.tagName === 'note').map((note, ni): WrittenNote => {
      shape(note, ['unpitched', 'rest', 'duration', 'tie', 'voice', 'type', 'dot', 'time-modification', 'notations'], ['id'], ['tie', 'dot']);
      const kinds = children(note).filter(e => ['unpitched', 'rest'].includes(e.tagName));
      if (kinds.length !== 1) fail('expected one unpitched/rest');
      shape(kinds[0]!, []);
      const voice = children(note).find(e => e.tagName === 'voice');
      if (voice && content(voice) !== '1') fail('only voice 1 supported');
      const type = content(one(note, 'type')) as WrittenType;
      const dots = children(note).filter(e => e.tagName === 'dot'); dots.forEach(e => shape(e, []));
      const tm = children(note).find(e => e.tagName === 'time-modification');
      let timeModification: TimeModification | undefined;
      if (tm) { shape(tm, ['actual-notes', 'normal-notes']); timeModification = [integer(one(tm, 'actual-notes')), integer(one(tm, 'normal-notes'))] as TimeModification; }
      const ties = endpoints(children(note).filter(e => e.tagName === 'tie'));
      if (ties.includes('stop') !== pending) fail('unmatched tie start/stop');
      pending = ties.includes('start');
      const notations = children(note).find(e => e.tagName === 'notations');
      if (notations) {
        shape(notations, ['tied', 'other-notation'], [], ['tied']);
        const arcs = children(notations).filter(e => e.tagName === 'tied');
        if (arcs.length && JSON.stringify(endpoints(arcs)) !== JSON.stringify(ties)) fail('tied notation disagrees with sound ties');
        const marker = children(notations).find(e => e.tagName === 'other-notation');
        if (marker) {
          shape(marker, [], ['type', 'print-object'], [], true);
          if (marker.textContent !== 'tuno:subdivide' || marker.getAttribute('type') !== 'single' || marker.getAttribute('print-object') !== 'no') fail('unsupported other-notation');
          // Reserved teaching markers are stripped, then rebuilt by the counting plan.
        }
      }
      if (note.getAttribute('id') === part.getAttribute('id')) fail('note and part IDs must be distinct');
      const written: WrittenNote = { id: note.getAttribute('id') || `m${mi + 1}n${ni + 1}`, kind: kinds[0]!.tagName === 'rest' ? 'rest' : 'note', type, dots: dots.length as 0 | 1 | 2, ...(timeModification ? { timeModification } : {}), tieNext: pending };
      if (compare(noteDuration(written), divide(fraction(integer(one(note, 'duration')), divisions), fraction(4)))) fail('duration inconsistent with written notation');
      return written;
    });
    return { meter: [numerator, denominator as 4 | 8], notes };
  });
  return createScore({ measures });
}
const escapeXML = (s: string) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
function serialize(score: RhythmScore, plan?: CountingPlan): string {
  const derived = deriveScore(score);
  // LCM of quarter-duration denominators, with overflow checked by fraction arithmetic.
  let divisions = 1;
  for (const symbol of derived.symbols) {
    const d = multiply(symbol.duration, fraction(4))[1];
    const reduced = fraction(divisions, d);
    divisions = multiply(fraction(reduced[0]), fraction(d))[0];
  }
  let partId = 'P1';
  while (derived.symbols.some(s => s.source.id === partId)) partId += '_';
  const metadata = plan ? `<identification><miscellaneous><miscellaneous-field name="tuno:counting-v1">${escapeXML(JSON.stringify(plan.preferences))}</miscellaneous-field></miscellaneous></identification>` : '';
  const bars = score.measures.map((m, mi) => {
    const notes = derived.symbols.filter(s => s.measure === mi).map(s => {
      const n = s.source, ties = [...(s.tiedToPrevious ? ['stop'] : []), ...(n.tieNext ? ['start'] : [])];
      const marked = plan?.subdivisionSymbolIds.includes(n.id);
      const notation = ties.map(t => `<tied type="${t}"/>`).join('') + (marked ? '<other-notation type="single" print-object="no">tuno:subdivide</other-notation>' : '');
      const d = multiply(s.duration, fraction(4 * divisions));
      if (d[1] !== 1) fail('nonintegral export duration');
      return `<note id="${escapeXML(n.id)}">${n.kind === 'rest' ? '<rest/>' : '<unpitched/>'}<duration>${d[0]}</duration>${ties.map(t => `<tie type="${t}"/>`).join('')}<voice>1</voice><type>${n.type}</type>${'<dot/>'.repeat(n.dots)}${n.timeModification ? `<time-modification><actual-notes>${n.timeModification[0]}</actual-notes><normal-notes>${n.timeModification[1]}</normal-notes></time-modification>` : ''}${notation ? `<notations>${notation}</notations>` : ''}</note>`;
    }).join('\n');
    return `<measure number="${mi + 1}"><attributes><divisions>${divisions}</divisions><time><beats>${m.meter[0]}</beats><beat-type>${m.meter[1]}</beat-type></time></attributes>\n${notes}\n</measure>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<score-partwise version="4.0">${metadata}<part-list><score-part id="${partId}"><part-name>Rhythm</part-name></score-part></part-list><part id="${partId}">\n${bars}\n</part></score-partwise>\n`;
}
export const serializeMusicXML = (score: RhythmScore): string => serialize(score);
/** Markers can only be exported together with the plan's captured configuration. */
export const serializeCountingExercise = (plan: CountingPlan): string => serialize(plan.source, plan);

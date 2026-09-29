import { el } from '../../../shared/ui/components.ts';
import { clefs, clefForPitch, modifiersFor, normalizePreset } from '../domain/presets.ts';
import type { Content, Modifier, PresetSource } from '../domain/presets.ts';
import { chromatic, diatonic, keyName, keySignature, ledgerPositions, pitchLabel, spelling, staffPosition } from '../domain/notation.ts';
import type { Clef } from '../domain/notation.ts';
import { rangeEditor, segments } from './range-editor.ts';
import { renderStaff } from './staff.ts';
import { titleCase } from './preset-picker.ts';

export function customConfigurator(changed: () => void, idPrefix = '') {
  const node = el('section','custom-configurator');
  const tabs = el('div','configurator-tabs'); tabs.setAttribute('role','tablist'); tabs.setAttribute('aria-label','Custom range settings');
  const panels = ['Range','Notes','Clefs'].map((_name,index) => {
    const panel = el('section','configurator-panel'); panel.id = `${idPrefix}custom-panel-${index}`; panel.setAttribute('role','tabpanel'); panel.setAttribute('aria-labelledby',`${idPrefix}custom-tab-${index}`);
    return panel;
  });
  const tabButtons = ['Range','Notes','Clefs'].map((name,index) => {
    const tab = el('button','control',name); tab.type = 'button'; tab.id = `${idPrefix}custom-tab-${index}`; tab.setAttribute('role','tab'); tab.setAttribute('aria-controls',panels[index]!.id);
    tab.addEventListener('click',() => showTab(index));
    tab.addEventListener('keydown',event => {
      const next = event.key === 'ArrowRight' ? (index+1)%3 : event.key === 'ArrowLeft' ? (index+2)%3 : event.key === 'Home' ? 0 : event.key === 'End' ? 2 : undefined;
      if (next !== undefined) { event.preventDefault(); showTab(next); tabButtons[next]!.focus(); }
    });
    tabs.append(tab); return tab;
  });
  function showTab(index: number) {
    if (panels[index]!.parentElement) panels[index]!.parentElement!.scrollTop = 0;
    panels.forEach((panel,i) => { panel.hidden = i !== index; tabButtons[i]!.setAttribute('aria-selected',String(i === index)); tabButtons[i]!.tabIndex = i === index ? 0 : -1; });
  }
  showTab(0);
  const body = el('div','configurator-body'); body.append(...panels); node.append(tabs,body);
  let content: Content = 'lines-and-spaces', modifiers: Modifier[] = ['key'], available: Clef[] = ['treble'];
  let firstClefChange: number | undefined, explicitClefs = false;
  const range = el('div','range-grid');
  const update = () => {
    modifierSegments.update(modifiers); keyEnabled.update([modifiers.includes('key') ? 'on' : 'off']); key.disabled = !modifiers.includes('key');
    availableSegments.update(available); decorateClefs(); contentSegments.update([content]); refreshEndpoints(); changed();
  };
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
    syncLimits(); refreshEndpoints(); changed();
  };
  const endpoints = [rangeEditor('Lowest note','E4',() => rangeChanged(0),c => setClef(0,c)),rangeEditor('Highest note','F5',() => rangeChanged(1),c => setClef(1,c))] as const;
  syncLimits();
  range.append(...endpoints.map(e => e.node));
  const endpointSwitch = el('div','endpoint-switch'); endpointSwitch.setAttribute('role','group'); endpointSwitch.setAttribute('aria-label','Range endpoint');
  const endpointButtons = endpoints.map((_endpoint,index) => {
    const button = el('button','control endpoint-choice'); button.type = 'button'; button.setAttribute('aria-label',`Edit ${index === 0 ? 'lowest' : 'highest'} note`);
    button.addEventListener('click',() => selectEndpoint(index)); endpointSwitch.append(button); return button;
  });
  function selectEndpoint(index: number) {
    endpoints.forEach((endpoint,i) => { endpoint.node.dataset.active = String(i === index); endpointButtons[i]!.setAttribute('aria-pressed',String(i === index)); });
  }
  function refreshEndpoints() {
    endpointButtons.forEach((button,i) => { button.setAttribute('aria-description',pitchLabel(endpoints[i]!.pitch)); button.replaceChildren(el('span','',i === 0 ? 'Lowest note' : 'Highest note'),el('strong','',pitchLabel(endpoints[i]!.pitch))); });
  }
  selectEndpoint(0); refreshEndpoints();
  const contentSegments = segments<Content>('Staff content',[['lines','Lines'],['spaces','Spaces'],['lines-and-spaces','Both']],value => { content = value; update(); });
  const modifierSegments = segments<Modifier>('Additional spellings',[['flat','♭ Flat'],['natural','♮ Natural'],['sharp','♯ Sharp']],value => { modifiers = modifiers.includes(value) ? modifiers.filter(m => m !== value) : [...modifiers,value]; update(); },true);
  const key = el('select','inline-key'); key.setAttribute('aria-label','Major key');
  for (const value of ['C','F','Bb','Eb','Ab','Db','Gb','G','D','A','E','B','F#']) {
    const option = el('option','',`${spelling(keySignature(value).tonic)} major`); option.value = value; key.append(option);
  }
  const keyEnabled = segments<'on'|'off'>('Key signature',[['on','On'],['off','Off']],value => {
    modifiers = modifiers.filter(m => m !== 'key'); if (value === 'on') modifiers.unshift('key'); update();
  });
  const keyGroup = el('div','configurator-key'); keyGroup.append(keyEnabled.node,key);
  key.addEventListener('change',() => { if (!modifiers.includes('key')) modifiers.push('key'); update(); });
  const availableSegments = segments<Clef>('Available clefs',clefs.map(c => [c,titleCase(c)] as const),value => {
    if (available.includes(value) && available.length === 1) { notice.textContent = 'Keep at least one clef enabled.'; return; }
    available = clefs.filter(c => c === value ? !available.includes(c) : available.includes(c)); explicitClefs = true; notice.textContent = ''; update();
  },true);
  function decorateClefs() {
    availableSegments.buttons.forEach((button,i) => {
      const clef = clefs[i]!;
      const glyph = renderStaff(endpoints[0].pitch,clef,keySignature('C')); glyph.setAttribute('viewBox','20 10 90 170'); glyph.setAttribute('aria-hidden','true'); glyph.classList.replace('staff','clef-tile-symbol');
      glyph.querySelectorAll('.notehead, .ledger, .note-accidental').forEach(n => n.remove());
      button.replaceChildren(el('span','clef-check',available.includes(clef) ? '✓' : '+'),glyph,el('span','',titleCase(clef)));
    });
  }
  const notice = el('p','muted configurator-notice'); notice.setAttribute('role','status');
  const ledger = el('p','muted ledger-description');
  const help = el('details','range-instructions'); help.append(el('summary','','How to edit the range'),el('p','','Tap the staff or drag the note. Arrow keys move one position; Page Up/Down move an octave. Changing a clef also enables it for practice. Choose your final practice clefs in the Clefs tab.'));
  panels[0]!.append(endpointSwitch,range,help,ledger);
  const tile = (title: string, ...children: HTMLElement[]) => { const section = el('section','configurator-tile'); section.append(el('h3','',title),...children); return section; };
  panels[1]!.classList.add('configurator-notes');
  panels[1]!.append(tile('Staff content',contentSegments.node),tile('Key signature',keyGroup),tile('Additional spellings',modifierSegments.node,el('p','muted','Add spellings within your range. Select any combination.')));
  availableSegments.node.classList.add('clef-tiles');
  panels[2]!.append(el('h3','','Clefs used in practice'),el('p','muted','Choose one or more. Each note uses the enabled clef with the fewest ledger lines.'),availableSegments.node);
  body.append(notice);
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
  modifierSegments.update(modifiers); keyEnabled.update(['on']); availableSegments.update(available); decorateClefs(); contentSegments.update([content]);
  return {node,source,load, resetView() { showTab(0); selectEndpoint(0); help.open = false; }, focus() { tabButtons[0]!.focus(); },clearDescription() { ledger.textContent = ''; },describe(p: ReturnType<typeof normalizePreset>) {
    const counts = p.pool.map(note => ledgerPositions(staffPosition(note,clefForPitch(p,note))).length);
    const count = Math.max(...counts); ledger.textContent = count ? `Range includes up to ${count} ledger ${count === 1 ? 'line' : 'lines'}.` : 'Range stays on the staff or its immediately adjacent spaces.';
  }};
}

import { el } from '../../../shared/ui/components.ts';
import { control, titleCase } from './preset-picker.ts';
import { clefs, instruments, presets, stringInstruments, normalizePreset } from '../domain/presets.ts';
import type { Clef } from '../domain/notation.ts';
import { renderStaff, renderRangeStaff } from './staff.ts';
import { C_MAJOR, parsePitch, diatonic, chromatic } from '../domain/notation.ts';
import { onUnmount } from '../../../shared/ui/unmount.ts';
import type { PresetSource } from '../domain/presets.ts';
import { customRange } from './custom-range.ts';
import trumpetIcon from '../../../assets/icons/trumpet.svg';
import celloIcon from '../../../assets/icons/cello.svg';
import violinIcon from '../../../assets/icons/violin.svg';
import bassoonIcon from '../../../assets/icons/bassoon.svg';
import clarinetIcon from '../../../assets/icons/clarinet.svg';
import fluteIcon from '../../../assets/icons/flute.svg';
import hornIcon from '../../../assets/icons/french-horn.svg';
import keyboardIcon from '../../../assets/icons/keyboard.svg';
import saxophoneIcon from '../../../assets/icons/saxophone.svg';
import tromboneIcon from '../../../assets/icons/trombone.svg';
import tubaIcon from '../../../assets/icons/tuba.svg';
import xylophoneIcon from '../../../assets/icons/xylophone.svg';
import oboeIcon from '../../../assets/icons/oboe.svg';
import euphoniumIcon from '../../../assets/icons/euphonium.svg';

const instrumentIcons: Readonly<Record<string,string>> = {
  Flute: fluteIcon, Oboe: oboeIcon, Bassoon: bassoonIcon, Keyboards: keyboardIcon,
  'B♭ Clarinet': clarinetIcon, 'Alto saxophone': saxophoneIcon, 'B♭ Trumpet': trumpetIcon,
  'F Horn': hornIcon, Trombone: tromboneIcon, 'Tuba (bass clef)': tubaIcon, 'Euphonium (bass clef)': euphoniumIcon,
  Violin: violinIcon, Viola: violinIcon, Cello: celloIcon, 'Double bass': celloIcon, Xylophone: xylophoneIcon,
};
function instrumentIcon(asset: string) {
  const icon = el('span','range-picker-instrument-icon'); icon.setAttribute('aria-hidden','true');
  icon.style.maskImage = `url(${JSON.stringify(asset)})`;
  return icon;
}

export type CopyPlayers = () => readonly { id: string; name: string; preset: PresetSource }[];

/** Guided visual range and exercise chooser. */
export function rangePicker(idPrefix: string, selectPreset: (id: string, adaptive: boolean, showKeySignature: boolean) => void, custom: { current: () => PresetSource; apply: (source: PresetSource, showSignature: boolean, save: boolean) => void; saved: () => readonly PresetSource[]; showKeySignature: () => boolean }, copyPlayers?: CopyPlayers) {
  let screen: 'home' | 'Clef' | 'Instrument' | 'Custom' | 'Presets' | 'Adaptive' | 'Players' = 'home';
  let myPresets = false;
  let selectedClef: Clef = 'treble';
  let selectedInstrument: { id: string; name: string } | undefined;
  let pendingPreset: string | undefined;
  let showSignature = false;
  const dialog = el('dialog','range-picker-dialog');
  const heading = el('h3','','Select range'); heading.id = `${idPrefix}range-picker-title`; heading.tabIndex = -1;
  dialog.setAttribute('aria-labelledby',heading.id);
  const trigger = control('Select range',() => {
    pendingPreset = undefined;
    savedChoice.hidden = !custom.saved().length;
    showSignature = custom.showKeySignature();
    show('home',false);
    dialog.showModal();
    // The shared Choose Notes tab reveals this panel later in the same click.
    // Measure only after that listener has made its ancestor visible.
    requestAnimationFrame(() => { if (dialog.open) { position(); heading.focus(); } });
    window.addEventListener('resize',position);
  });
  trigger.setAttribute('aria-haspopup','dialog');
  const header = el('div','picker-header');
  const back = control('←',() => show(screen === 'Adaptive' ? 'Presets' : screen === 'Presets' ? myPresets ? 'home' : selectedInstrument ? 'Instrument' : 'Clef' : 'home')); back.setAttribute('aria-label','Back to range options'); back.hidden = true;
  const close = control('×',() => dialog.close()); close.setAttribute('aria-label','Close range selection');
  header.append(back,heading,close);
  const intro = el('p','muted range-picker-intro','Select preset options or create your own.');
  const choices = el('div','range-picker-choices');
  const home = el('div'); home.append(intro,choices);
  const clefPanel = el('div','range-picker-panel');
  const clefChoices = el('div','range-picker-choices range-picker-clefs');
  const clefIcon = (clef: Clef, withStaff = false) => {
    const icon = renderStaff(parsePitch('B4'),clef,C_MAJOR);
    icon.classList.remove('staff');
    icon.setAttribute('viewBox',withStaff ? '16 10 184 170' : '24 10 80 170'); icon.setAttribute('aria-hidden','true');
    icon.querySelectorAll('.notehead, .ledger, .note-accidental').forEach(node => node.remove());
    icon.querySelectorAll('line').forEach(line => { if (withStaff) line.setAttribute('x2','192'); else line.remove(); });
    return icon;
  };
  for (const clef of clefs) {
    const tile = control('',() => { myPresets = false; selectedClef = clef; selectedInstrument = undefined; renderPresets(); show('Presets'); });
    tile.classList.add('range-picker-choice');
    tile.append(clefIcon(clef,true),el('strong','',titleCase(clef))); clefChoices.append(tile);
  }
  clefPanel.append(clefChoices);
  const presetPanel = el('div','range-picker-panel');
  const presetChoices = el('div','range-picker-choices range-picker-presets');
  const notation = el('section','preset-notation-setting'); notation.hidden = true;
  const notationChoices = el('div','preset-notation-options'); notationChoices.setAttribute('role','group'); notationChoices.setAttribute('aria-label','Accidentals');
  const notationButtons = ([[false,'On each note'],[true,'Key Signature']] as const).map(([value,label]) => {
    const button = control('',() => { showSignature = value; updateNotation(); });
    button.setAttribute('aria-label',label);
    const mark = el('span','preset-notation-mark'); mark.setAttribute('aria-hidden','true');
    button.append(el('span','',label),mark); notationChoices.append(button);
    return {value,button,mark};
  });
  function updateNotation() {
    notationButtons.forEach(({value,button,mark}) => {
      const active = value === showSignature; button.setAttribute('aria-pressed',String(active)); mark.textContent = active ? '✓' : '';
    });
  }
  notation.append(el('h4','','Accidentals'),notationChoices);
  const emptyPresets = el('p','muted'); emptyPresets.hidden = true;
  presetPanel.append(notation,presetChoices,emptyPresets);
  const adaptivePanel = el('div','range-picker-panel');
  const pendingName = el('p','range-picker-selected-preset');
  const adaptiveDescription = el('p','muted','Uno adds notes when you’re ready and gives extra practice on notes you miss.');
  const adaptiveChoices = el('div','range-picker-choices range-picker-adaptive');
  for (const [enabled,label] of [[true,'Yes, let Uno help'],[false,'Keep this range']] as const) {
    const choice = control(label,() => {
      if (!pendingPreset) return;
      selectPreset(pendingPreset,enabled,showSignature); dialog.close();
    });
    choice.classList.add('range-picker-choice'); adaptiveChoices.append(choice);
  }
  adaptivePanel.append(pendingName,adaptiveDescription,adaptiveChoices);
  function renderPresets() {
    presetChoices.replaceChildren();
    const available = myPresets ? custom.saved().map(p => normalizePreset(p,{legacySpellings:true})) : presets.filter(preset => selectedInstrument ? preset.instrument === selectedInstrument.id : !preset.instrument && preset.clef === selectedClef);
    notation.hidden = !available.some(p => !p.keyless && p.key.fifths !== 0);
    updateNotation();
    if (!myPresets && selectedInstrument && stringIds.has(selectedInstrument.id)) available.sort((a,b) => diatonic(a.pool[0]!)-diatonic(b.pool[0]!));
    emptyPresets.hidden = available.length > 0;
    emptyPresets.textContent = available.length ? '' : myPresets ? 'No saved presets yet.' : `Range presets for ${selectedInstrument!.name} are coming soon.`;
    for (const preset of available) {
      const ordered = [...preset.pool].sort((a,b) => diatonic(a)-diatonic(b) || chromatic(a)-chromatic(b));
      const low = ordered[0]!, high = ordered.at(-1)!;
      const tile = control('',() => { pendingPreset = preset.id; pendingName.textContent = preset.name; show('Adaptive'); });
      tile.classList.add('range-picker-choice'); tile.dataset.presetId = preset.id;
      tile.append(el('strong','',myPresets ? preset.name : preset.name.split(' — ')[1] ?? preset.name),renderRangeStaff(low,high,preset.clef,preset.key,preset.keyless));
      presetChoices.append(tile);
    }
  }
  const instrumentPanel = el('div','range-picker-panel');
  const ensembles = el('div','range-picker-ensembles'); ensembles.setAttribute('role','group'); ensembles.setAttribute('aria-label','Instrument group');
  const instrumentChoices = el('div','range-picker-choices range-picker-instruments');
  const stringIds = new Set<string>(stringInstruments.map(instrument => instrument.id));
  const catalogs = { Band: [...instruments.filter(instrument => !stringIds.has(instrument.id)).map(instrument => instrument.name),'Xylophone'], Orchestra: stringInstruments.map(instrument => instrument.name) };
  let ensemble: keyof typeof catalogs = 'Band';
  const ensembleButtons = (['Band','Orchestra'] as const).map(name => {
    const button = control(name,() => { ensemble = name; renderInstruments(); });
    ensembles.append(button); return button;
  });
  function renderInstruments() {
    ensembleButtons.forEach(button => button.setAttribute('aria-pressed',String(button.textContent === ensemble)));
    instrumentChoices.replaceChildren();
    for (const name of catalogs[ensemble]) {
      const tile = control('',() => {
        myPresets = false; selectedInstrument = { id: instruments.find(instrument => instrument.name === name)?.id ?? name, name };
        renderPresets(); show('Presets');
      });
      tile.classList.add('range-picker-choice');
      const asset = instrumentIcons[name]; if (asset) tile.append(instrumentIcon(asset));
      tile.append(el('span','',name)); instrumentChoices.append(tile);
    }
  }
  renderInstruments(); instrumentPanel.append(ensembles,instrumentChoices);
  const customEditor = customRange((source,signature,save) => { custom.apply(source,signature,save); dialog.close(); });
  const customPanel = el('div','range-picker-panel'); customPanel.append(customEditor.node,customEditor.contentPanel,customEditor.keyPanel,customEditor.clefPanel,customEditor.footer);
  const playerPanel = el('div','range-picker-panel');
  function renderPlayers() {
    const players = copyPlayers?.() ?? [];
    const options = el('div','range-picker-choices range-picker-presets');
    for (const player of players) {
      const tile = control('',() => {
        custom.apply(structuredClone(player.preset),custom.showKeySignature(),false);
        dialog.close();
      });
      tile.classList.add('range-picker-choice'); tile.dataset.playerId = player.id;
      tile.setAttribute('aria-label',player.name);
      tile.append(el('strong','',player.name),el('span','muted',player.preset.name));
      options.append(tile);
    }
    playerPanel.replaceChildren(players.length ? options : el('p','muted','Add another player to copy their notes.'));
  }
  const panels = { home, Clef: clefPanel, Instrument: instrumentPanel, Custom: customPanel, Presets: presetPanel, Adaptive: adaptivePanel, Players: playerPanel };
  function show(nextScreen: keyof typeof panels, focus = true) {
    screen = nextScreen;
    dialog.dataset.screen = screen;
    for (const [name,panel] of Object.entries(panels)) panel.hidden = name !== screen;
    heading.textContent = {home:'Select range',Clef:'Choose a clef',Instrument:'Choose an instrument',Custom:'Custom range',Presets:myPresets ? 'My Presets' : `${selectedInstrument?.name ?? titleCase(selectedClef)} presets`,Adaptive:'Let Uno add new notes?',Players:'Copy from player'}[screen];
    back.setAttribute('aria-label',screen === 'Adaptive' ? 'Back to presets' : screen === 'Presets' ? myPresets ? 'Back to range options' : selectedInstrument ? 'Back to instruments' : 'Back to clefs' : 'Back to range options');
    back.hidden = screen === 'home'; dialog.scrollTop = 0;
    if (dialog.open) position();
    if (focus) heading.focus();
  }
  const paths = {
    Custom: 'M12 18h40 M12 32h40 M12 46h40 M24 12v12 M42 26v12 M28 40v12',
  };
  for (const name of ['Clef','Instrument','Custom'] as const) {
    if (name === 'Instrument') {
      const group = el('div','range-picker-instrument-entry'); group.setAttribute('role','group'); group.setAttribute('aria-label','Instrument');
      const shortcuts = el('div','range-picker-instrument-shortcuts');
      for (const [filter,asset] of [['Band',trumpetIcon],['Orchestra',violinIcon]] as const) {
        const shortcut = control('',() => { ensemble = filter; renderInstruments(); show('Instrument'); });
        shortcut.classList.add('range-picker-instrument-target'); shortcut.setAttribute('aria-label',`${filter} instruments`);
        shortcut.dataset.ensemble = filter;
        shortcut.append(instrumentIcon(asset)); shortcuts.append(shortcut);
      }
      group.append(shortcuts,el('strong','','Instrument')); choices.append(group);
      continue;
    }
    const tile = control('',() => { if (name === 'Custom') customEditor.load(custom.current(),custom.showKeySignature()); show(name); });
    tile.classList.add('range-picker-choice');
    if (name === 'Clef') {
      tile.append(clefIcon('treble',true));
    } else {
      const icon = document.createElementNS('http://www.w3.org/2000/svg','svg');
      icon.setAttribute('viewBox','0 0 64 64'); icon.setAttribute('aria-hidden','true');
      const path = document.createElementNS(icon.namespaceURI,'path');
      path.setAttribute('d',paths[name]); path.setAttribute('fill','none'); path.setAttribute('stroke','currentColor');
      path.setAttribute('stroke-width','3'); path.setAttribute('stroke-linecap','round'); path.setAttribute('stroke-linejoin','round');
      icon.append(path); tile.append(icon);
    }
    tile.append(el('strong','',name)); choices.append(tile);
  }
  const savedChoice = control('',() => { myPresets = true; renderPresets(); show('Presets'); });
  savedChoice.classList.add('range-picker-choice','my-presets-choice'); savedChoice.hidden = !custom.saved().length;
  const savedIcon = document.createElementNS('http://www.w3.org/2000/svg','svg');
  savedIcon.setAttribute('viewBox','0 0 64 64'); savedIcon.setAttribute('aria-hidden','true');
  const savedPath = document.createElementNS(savedIcon.namespaceURI,'path');
  savedPath.setAttribute('d','M16 8h32v48L32 46 16 56Z M24 20h16 M24 28h16');
  savedPath.setAttribute('fill','none'); savedPath.setAttribute('stroke','currentColor');
  savedPath.setAttribute('stroke-width','3'); savedPath.setAttribute('stroke-linejoin','round');
  savedIcon.append(savedPath); savedChoice.append(savedIcon,el('strong','','My Presets'));
  choices.append(savedChoice);
  if (copyPlayers) {
    const copyChoice = control('',() => { renderPlayers(); show('Players'); });
    copyChoice.classList.add('range-picker-choice');
    const icon = savedIcon.cloneNode(true) as SVGElement;
    icon.querySelector('path')!.setAttribute('d','M24 22h30v34H24Z M40 22V8H10v34h14');
    copyChoice.append(icon,el('strong','','Copy from player')); choices.append(copyChoice);
  }
  dialog.append(header,home,clefPanel,instrumentPanel,customPanel,presetPanel,adaptivePanel,playerPanel); show('home',false);
  function position() {
    const scale = dialog.getBoundingClientRect().width / dialog.offsetWidth || 1;
    if (window.matchMedia('(max-width: 600px)').matches) {
      dialog.style.width = `${innerWidth/scale}px`;
      dialog.style.height = `${innerHeight/scale}px`;
      dialog.style.maxHeight = `${innerHeight/scale}px`;
      dialog.style.left = '0'; dialog.style.top = '0';
      return;
    }
    dialog.style.height = '';
    const wideCustom = screen === 'Custom' && window.matchMedia('(min-width: 1000px)').matches;
    dialog.style.width = `${Math.min(wideCustom ? 960 : 640,(innerWidth-24)/scale)}px`;
    const top = 12;
    dialog.style.maxHeight = `${(innerHeight-top-12)/scale}px`;
    const rect = dialog.getBoundingClientRect();
    dialog.style.left = `${Math.max(12,(innerWidth-rect.width)/2)/scale}px`;
    dialog.style.top = `${top/scale}px`;
  }
  dialog.addEventListener('click',event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  });
  dialog.addEventListener('close',() => { customEditor.closePopovers(); window.removeEventListener('resize',position); trigger.focus(); });
  onUnmount(trigger,() => { window.removeEventListener('resize',position); dialog.close(); });
  return { trigger,dialog };
}

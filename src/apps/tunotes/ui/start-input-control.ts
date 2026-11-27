import { el } from '../../../shared/ui/components.ts';
import { MIC_TOLERANCE_CENTS, microphoneTranspositions } from '../engine/microphone.ts';
import type { InputMode, noteEntry } from './note-entry.ts';

type EntryController = ReturnType<typeof noteEntry>;

const SVG_NS = 'http://www.w3.org/2000/svg';

function svgIcon(paths: string[], size: number) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('width', String(size));
  svg.setAttribute('height', String(size));
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  for (const d of paths) {
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', d);
    svg.append(path);
  }
  return svg;
}

const HAND_PATHS = [
  'M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2',
  'M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v6',
  'M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8',
  'M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15',
];

const MIC_PATHS = [
  'M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z',
  'M19 10v2a7 7 0 0 1-14 0v-2',
  'M12 19v3',
];

function modeIcon(mode: InputMode, large = false): HTMLElement | SVGSVGElement {
  if (mode === 'names') {
    const badge = el('span', `input-abc-glyph${large ? ' input-abc-glyph--tile' : ''}`, 'ABC');
    badge.setAttribute('aria-hidden', 'true');
    return badge;
  }
  return svgIcon(mode === 'instrument' ? HAND_PATHS : MIC_PATHS, large ? 22 : 16);
}

/** Split Start action + anchored input-configuration popover (Names / Fingering / Mic). */
export function startInputControl(startButton: HTMLButtonElement, entry: EntryController) {
  const node = el('div', 'start-split');
  const labelSpan = el('span', 'start-split-label', startButton.textContent ?? 'Start Practice');
  const metaSpan = el('span', 'start-split-meta');
  metaSpan.setAttribute('aria-hidden', 'true');
  metaSpan.hidden = true;
  startButton.classList.add('start-split-main');
  startButton.replaceChildren(labelSpan, metaSpan);

  const toggle = el('button', 'control control--primary start-split-toggle');
  toggle.type = 'button';
  toggle.setAttribute('aria-haspopup', 'dialog');
  toggle.setAttribute('aria-expanded', 'false');
  const kicker = el('span', 'start-split-kicker', 'Input');
  kicker.setAttribute('aria-hidden', 'true');
  const iconRow = el('span', 'start-split-icon-row');
  iconRow.setAttribute('aria-hidden', 'true');
  const iconSlot = el('span', 'start-split-icon');
  const caret = el('span', 'start-split-caret', '▾');
  iconRow.append(iconSlot, caret);
  toggle.append(kicker, iconRow);

  const popover = el('div', 'input-config-popover');
  popover.setAttribute('popover', 'auto');
  popover.setAttribute('role', 'dialog');
  popover.setAttribute('aria-label', 'Answer with');

  const head = el('div', 'input-popover-head');
  const title = el('h3', 'input-popover-title', 'Answer with');
  const closeBtn = el('button', 'control input-popover-close', '✕');
  closeBtn.type = 'button';
  closeBtn.setAttribute('aria-label', 'Close input options');
  closeBtn.addEventListener('click', () => { if (popover.matches(':popover-open')) popover.hidePopover(); });
  head.append(title, closeBtn);

  const tiles = el('div', 'input-mode-tiles');
  tiles.setAttribute('role', 'group');
  tiles.setAttribute('aria-label', 'Answer method');
  const tileButtons = new Map<InputMode, HTMLButtonElement>();
  const micTileDot = el('span', 'input-live-dot input-tile-dot');
  micTileDot.setAttribute('aria-hidden', 'true');
  micTileDot.hidden = true;

  for (const [mode, label] of [['names', 'Names'], ['instrument', 'Fingering'], ['mic', 'Mic']] as const) {
    const tile = el('button', 'control input-mode-tile');
    tile.type = 'button';
    tile.dataset.inputTile = mode;
    const iconWrap = el('span', 'input-mode-tile-icon');
    iconWrap.append(modeIcon(mode, true));
    const textWrap = el('span', 'input-mode-tile-label', label);
    if (mode === 'mic') tile.append(micTileDot);
    tile.append(iconWrap, textWrap);
    tile.addEventListener('click', () => entry.setMethod(mode));
    tileButtons.set(mode, tile);
    tiles.append(tile);
  }

  // Names panel (real keyboard shortcuts from practice-view.ts)
  const namesPanel = el('div', 'input-popover-panel');
  const namesNote = el('p', 'input-popover-note');
  namesNote.append(
    el('strong', '', 'Default. '),
    document.createTextNode('Tap note buttons or press '),
    el('kbd', '', 'A'), document.createTextNode('–'), el('kbd', '', 'G'),
    document.createTextNode(' — hold '),
    el('kbd', '', '↑'), document.createTextNode(' + letter for ♯, '),
    el('kbd', '', '↓'), document.createTextNode(' for ♭, or '),
    el('kbd', '', '→'), document.createTextNode(' for ♮.'),
  );
  namesPanel.append(namesNote);

  // Fingering panel (populated strictly from entry.getInputState().instruments)
  const instPanel = el('div', 'input-popover-panel');
  const instGrid = el('div', 'input-inst-grid');
  const instHint = el('p', 'muted input-inst-hint', 'Choose an instrument preset in Choose Notes to unlock its chart.');
  const instButtons = new Map<string, HTMLButtonElement>();
  for (const item of entry.getInputState().instruments) {
    const choice = el('button', 'control input-inst-option');
    choice.type = 'button';
    choice.dataset.instrument = item.value;
    const nameEl = el('span', 'input-inst-name', item.label);
    const reasonEl = el('small', 'input-inst-reason');
    choice.append(nameEl, reasonEl);
    choice.addEventListener('click', () => entry.selectInstrument(item.value));
    instButtons.set(item.value, choice);
    instGrid.append(choice);
  }
  instPanel.append(instGrid, instHint);

  // Mic panel (populated strictly from microphoneTranspositions + live MicSnapshot)
  const micPanel = el('div', 'input-popover-panel input-mic-panel');
  const transField = el('label', 'input-mic-field', 'Transposition');
  const transSelect = el('select', 'control input-mic-select');
  transSelect.setAttribute('aria-label', 'Transposition');
  for (const item of microphoneTranspositions) {
    const option = el('option', '', item.label);
    option.value = String(item.offset);
    transSelect.append(option);
  }
  transSelect.addEventListener('change', () => entry.setMicTransposition(transSelect.value));
  transField.append(transSelect);

  const micBox = el('div', 'input-mic-box');
  const micTop = el('div', 'input-mic-top');
  const micBtn = el('button', 'control input-mic-toggle', 'Start mic');
  micBtn.type = 'button';
  micBtn.addEventListener('click', () => entry.toggleMic());
  const micPitch = el('p', 'input-mic-pitch', '—');
  micTop.append(micBtn, micPitch);

  const micScale = el('div', 'notes-mic-scale');
  micScale.append(el('span', '', 'Flat'), el('span', '', 'In tune'), el('span', '', 'Sharp'));
  const micMeter = el('div', 'notes-mic-meter');
  micMeter.setAttribute('role', 'meter');
  micMeter.setAttribute('aria-valuemin', '-50');
  micMeter.setAttribute('aria-valuemax', '50');
  micMeter.setAttribute('aria-label', 'Pitch deviation in cents');
  micMeter.style.setProperty('--mic-tolerance', `${MIC_TOLERANCE_CENTS}%`);
  const micMarker = el('span', 'notes-mic-marker');
  micMarker.hidden = true;
  micMeter.append(micMarker);

  const micStatus = el('p', 'muted input-mic-status');
  micStatus.setAttribute('role', 'status');
  micBox.append(micTop, micScale, micMeter, micStatus);
  micPanel.append(transField, micBox);

  popover.append(head, tiles, namesPanel, instPanel, micPanel);
  node.append(startButton, toggle, popover);

  function positionPopover() {
    const bounds = node.getBoundingClientRect();
    const width = Math.min(368, window.innerWidth - 16);
    popover.style.width = `${width}px`;
    const left = window.innerWidth <= 600
      ? Math.max(8, (window.innerWidth - width) / 2)
      : Math.max(8, Math.min(bounds.right - width, window.innerWidth - width - 8));
    popover.style.left = `${left}px`;
    const preferredTop = bounds.bottom + 8;
    const availableBelow = window.innerHeight - preferredTop - 8;
    const popHeight = popover.getBoundingClientRect().height;
    const top = availableBelow >= Math.min(popHeight, 240)
      ? preferredTop
      : Math.max(8, bounds.top - popHeight - 8);
    popover.style.top = `${top}px`;
  }

  popover.addEventListener('beforetoggle', event => {
    const open = (event as ToggleEvent).newState === 'open';
    toggle.setAttribute('aria-expanded', String(open));
    if (!open) micStatus.textContent = '';
  });

  toggle.addEventListener('click', () => {
    if (popover.matches(':popover-open')) {
      popover.hidePopover();
      return;
    }
    popover.showPopover();
    sync();
    positionPopover();
    (popover.querySelector<HTMLButtonElement>('.input-mode-tile[aria-pressed="true"]') ?? closeBtn).focus();
  });

  const onViewportChange = () => { if (popover.matches(':popover-open')) positionPopover(); };
  window.addEventListener('resize', onViewportChange);

  let renderedIconMode: InputMode | undefined;
  function sync() {
    const state = entry.getInputState();
    const isLive = state.mode === 'mic' && state.mic.live;

    if (renderedIconMode !== state.mode) {
      renderedIconMode = state.mode;
      iconSlot.replaceChildren(modeIcon(state.mode, false));
    }

    toggle.classList.toggle('is-live', isLive);
    if (state.mode === 'names') {
      metaSpan.hidden = true;
      metaSpan.replaceChildren();
      toggle.setAttribute('aria-label', 'Input method: Note Names');
    } else if (state.mode === 'instrument') {
      metaSpan.hidden = false;
      metaSpan.textContent = state.selectedInstrument.label;
      toggle.setAttribute('aria-label', `Input method: ${state.selectedInstrument.label}`);
    } else {
      metaSpan.hidden = false;
      metaSpan.replaceChildren();
      if (isLive) {
        const dot = el('span', 'input-live-dot input-live-dot--light');
        dot.setAttribute('aria-hidden', 'true');
        metaSpan.append(dot);
      }
      metaSpan.append(document.createTextNode(`Mic · ${state.mic.transpositionShort}${isLive ? ' live' : ''}`));
      toggle.setAttribute('aria-label', `Input method: Mic (${state.mic.transpositionShort}${isLive ? ', live' : ''})`);
    }

    for (const [mode, tile] of tileButtons) {
      tile.setAttribute('aria-pressed', String(state.mode === mode));
    }
    tileButtons.get('mic')!.classList.toggle('is-live', isLive);
    micTileDot.hidden = !isLive;

    namesPanel.hidden = state.mode !== 'names';
    instPanel.hidden = state.mode !== 'instrument';
    micPanel.hidden = state.mode !== 'mic';

    for (const item of state.instruments) {
      const btn = instButtons.get(item.value);
      if (!btn) continue;
      btn.disabled = item.disabled;
      btn.setAttribute('aria-pressed', String(item.selected));
      const reasonEl = btn.querySelector<HTMLElement>('.input-inst-reason')!;
      reasonEl.textContent = item.reason;
      reasonEl.hidden = !item.reason;
    }
    instHint.hidden = !state.anyInstrumentDisabled;

    if (transSelect.value !== state.mic.transpositionOffset) {
      transSelect.value = state.mic.transpositionOffset;
    }
    micBox.classList.toggle('is-live', state.mic.live);
    micBtn.textContent = state.mic.live ? 'Stop mic' : 'Start mic';
    micBtn.setAttribute('aria-pressed', String(state.mic.live));
    micPitch.textContent = state.mic.pitchText;
    micPitch.title = state.mic.pitchTitle;
    micMarker.hidden = state.mic.cents === null;
    micMarker.style.left = `${50 + (state.mic.cents ?? 0)}%`;
    micMeter.setAttribute('aria-valuenow', String(state.mic.cents ?? 0));
    micStatus.textContent = popover.matches(':popover-open') ? state.mic.statusText : '';
  }

  const unsubscribe = entry.onInputChange(sync);
  sync();

  return {
    node,
    setLabel(text: string) { labelSpan.textContent = text; },
    setDisabled(disabled: boolean) { startButton.disabled = disabled; toggle.disabled = disabled; },
    close() { if (popover.matches(':popover-open')) popover.hidePopover(); },
    sync,
    dispose() {
      unsubscribe();
      window.removeEventListener('resize', onViewportChange);
    },
  };
}

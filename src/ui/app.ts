import tapHeadAsset from '../assets/uno-tap-head.svg';
import micAsset from '../assets/mic.svg';
import playAsset from '../assets/play.svg';
import stopAsset from '../assets/stop.svg';
import { prepareOffline } from '../distribution/offline.ts';
import { createAudioController } from '../audio/controller.ts';
import { noteName } from '../music/pitch.ts';
import { LIMITS, TOOLS, TUNER_ACCURACIES } from '../practice/state.ts';
import type { PracticeStore } from '../practice/state.ts';
import { button, el, micStatusText, pitchText, responsiveLabel, selectorPopover, volumePopover } from './components.ts';
import { createSettings } from './settings.ts';
import { createTuner } from './views/tuner.ts';
import { createTone } from './views/tone.ts';
import { createMetronome } from './views/metronome.ts';
import { tempoInput } from './tempo.ts';
import { createMobileTools } from './mobile-tools.ts';
import { createInformationControls } from './information.ts';

/** Mount once. Views observe the same store and retain DOM/focus across updates. */
export function mountApp(root: HTMLElement, store: PracticeStore) {
  const audio = createAudioController(store);
  window.addEventListener('pagehide', audio.stopAll);
  document.addEventListener('visibilitychange', () => { if (document.hidden) audio.interrupt(); });
  const settings = createSettings(store);
  const information = createInformationControls();
  const header = el('header', 'app-header');
  const brand = el('div', 'brand');
  brand.append(el('h1', 'wordmark', 'tUno'), el('p', 'tagline', 'Practice with a friend.'));
  const navigation = el('nav', 'focus-navigation');
  navigation.setAttribute('aria-label', 'Practice focus');
  const links = TOOLS.map((tool) => {
    const control = button(tool.label, () => store.dispatch({ type: 'focus', value: tool.id }));
    responsiveLabel(control, tool.id === 'tone' ? 'Tone' : tool.id === 'metronome' ? 'Tempo' : 'Tune', tool.id === 'tone' ? 'Tone' : tool.id === 'metronome' ? 'Tempo' : 'Tune');
    control.setAttribute('aria-label', tool.label);
    control.setAttribute('aria-controls', `view-${tool.id}`);
    navigation.append(control);
    return control;
  });
  const tinker = button('Settings', settings.open);
  responsiveLabel(tinker, 'Tinker', 'Tinker');
  tinker.setAttribute('aria-label', 'Settings');
  tinker.classList.add('tinker-control');
  navigation.append(tinker);
  header.append(brand, navigation, information.installButton);

  const main = el('main', 'practice-surface');
  main.id = 'practice';
  main.tabIndex = -1;
  main.append(createTuner(store, audio), createTone(store, audio), createMetronome(store, audio));
  const tools = el('aside', 'tool-strip');
  tools.setAttribute('aria-label', 'Practice tools');
  const popups: HTMLElement[] = [];
  const accuracyPicker = selectorPopover('Tuner accuracy', TUNER_ACCURACIES, value => store.dispatch({ type: 'tuner-accuracy', value: value as typeof TUNER_ACCURACIES[number]['value'] }));
  popups.push(accuracyPicker.popup);
  const notePicker = selectorPopover('Note', Array.from({ length: 12 }, (_, value) => ({ value, label: noteName(60 + value).replace(/\d+$/, '') })), value => store.dispatch({ type: 'tone-note', value: (store.get().octave + 1) * 12 + Number(value) }));
  const octavePicker = selectorPopover('Octave', Array.from({ length: LIMITS.octave.max }, (_, i) => ({ value: i + 1, label: String(i + 1) })), value => store.dispatch({ type: 'octave', value: Number(value) }));
  const subdivPicker = selectorPopover('Quick subdivision', Array.from({ length: 7 }, (_, i) => ({ value: i + 1, label: String(i + 1) })), value => store.dispatch({ type: 'subdivision', value: Number(value) }));
  popups.push(notePicker.popup, octavePicker.popup, subdivPicker.popup);
  const volumeInput = el('input');
  Object.assign(volumeInput, { type: 'range', min: '0', max: '100', step: '1' });
  volumeInput.addEventListener('input', () => store.dispatch({ type: 'tone-volume', value: Number(volumeInput.value) }));
  const quickVolume = volumePopover('Quick tone volume', volumeInput);
  popups.push(quickVolume.node.querySelector('.volume-popup')!);
  const iconLabel = (control: HTMLButtonElement, label: string, asset: string) => {
    control.setAttribute('aria-label', label);
    let icon = control.querySelector('img');
    if (!icon) { icon = el('img', 'control-icon'); icon.alt = ''; control.replaceChildren(icon); }
    if (icon.getAttribute('src') !== asset) icon.src = asset;
  };
  const summaries = TOOLS.map((tool) => {
    const card = el('section', 'tool-card');
    const title = el('h2', 'eyebrow', tool.label.toUpperCase());
    const status = el('p', 'tool-status');
    const tempoStatus = el('span');
    const action = tool.id === 'tuner'
      ? button('Start listening', audio.toggleMic)
      : tool.id === 'tone'
        ? button('Play tone', audio.toggleTone)
        : button('Start metronome', audio.toggleMetronome);
    responsiveLabel(title, tool.id === 'tone' ? 'TONE' : tool.id === 'metronome' ? 'TEMPO' : 'TUNE', tool.id === 'tone' ? 'TONE' : tool.id === 'metronome' ? 'TEMPO' : 'TUNE');
    const compact = el('div', 'compact-tools');
    const compactControl = (label: string, control: HTMLElement) => {
      const column = el('div', 'compact-tool');
      column.append(el('span', 'compact-label', label), control);
      compact.append(column);
      return column;
    };
    card.append(title, compact);
    if (tool.id === 'tuner') {
      compactControl('MIC', action);
      compactControl('PITCH', status);
      compactControl('ACCURACY', accuracyPicker.trigger);
      compact.append(el('div', 'compact-tool compact-tool--empty'));
    } else if (tool.id === 'tone') {
      compactControl('PLAY', action);
      compactControl('VOLUME', quickVolume.trigger);
      compactControl('NOTE', notePicker.trigger);
      compactControl('OCTAVE', octavePicker.trigger);
    } else {
      compactControl('START', action);
      status.append(tempoInput(store, 'Quick tempo (BPM)'), tempoStatus);
      compactControl('TEMPO', status);
      const tap = button('Tap tempo', audio.tapTempo);
      tap.classList.add('tool-tap');
      iconLabel(tap, 'Tap tempo', tapHeadAsset);
      tap.querySelector('img')!.classList.add('tap-head');
      compactControl('TAP', tap);
      compactControl('SUBDIVISION', subdivPicker.trigger);
    }
    tools.append(card);
    return { title, status, action, tempoStatus };
  });
  createMobileTools(tools);
  const footer = el('footer', 'app-footer');
  const availability = el('p', '', 'Reference tones and metronome clicks may be picked up by the microphone. Use headphones to compare.');
  availability.id = 'audio-availability';
  const offline = el('p', 'teal');
  offline.id = 'offline-status';
  prepareOffline(offline);
  const error = el('p');
  error.setAttribute('role', 'status');
  const local = el('div', 'local-status');
  const privacy = el('span');
  privacy.textContent = 'No data leaves your device. Free and Ad-Free.';
  local.append(privacy, offline);
  const extra = el('details', 'footer-extra');
  extra.append(el('summary', '', 'More practice tools'), button('Stop all audio', audio.stopAll), availability);
  footer.append(local, error, information.footerNavigation);
  settings.node.append(extra);
  const explorer = main.querySelector<HTMLElement>('.sample-panel')!;
  extra.append(explorer);
  root.append(header, main, tools, footer, settings.node, ...popups, ...information.dialogs);
  store.subscribe((state) => {
    links.forEach((link, index) => link.setAttribute('aria-pressed', String(TOOLS[index]!.id === state.focus)));
    error.textContent = state.audioError;
    const listening = ['requesting', 'listening', 'no-signal', 'unreliable'].includes(state.micStatus);
    iconLabel(summaries[0]!.action, listening ? 'Stop listening' : 'Start listening', micAsset);
    summaries[0]!.action.setAttribute('aria-pressed', String(listening));
    accuracyPicker.update(state.tunerAccuracy);
    iconLabel(summaries[1]!.action, state.tonePlaying ? 'Stop tone' : 'Play tone', state.tonePlaying ? stopAsset : playAsset);
    summaries[0]!.status.textContent = state.micStatus !== 'idle' ? micStatusText(state.micStatus) : state.manualHz === null ? '—' : `Sample · ${pitchText(state).note}`;
    responsiveLabel(summaries[1]!.status, `${noteName(state.toneNote)} · ${state.sustain ? 'Sustain' : 'Selected'}`, noteName(state.toneNote));
    responsiveLabel(summaries[2]!.title, 'TEMPO', 'TEMPO');
    iconLabel(summaries[2]!.action, state.metronomePlaying ? 'Stop metronome' : 'Start metronome', state.metronomePlaying ? stopAsset : playAsset);
    responsiveLabel(summaries[2]!.tempoStatus, ` BPM · ${state.metronomePlaying ? 'Playing' : 'Stopped'}`, ' BPM');
    notePicker.update(state.toneNote % 12);
    octavePicker.update(state.octave);
    quickVolume.trigger.textContent = `${state.toneVolume}%`;
    volumeInput.value = String(state.toneVolume);
    subdivPicker.update(state.subdivision);
    if (pitchText(state).note !== '—') summaries[0]!.status.textContent = `${pitchText(state).note} · ${pitchText(state).detail.split(' · ')[1]!.replace(' cents', '¢')}`;
  });
}

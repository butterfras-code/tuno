import { createReleaseControls } from '../distribution/release.ts';
import { prepareOffline } from '../distribution/offline.ts';
import { createAudioController } from '../audio/controller.ts';
import { noteName } from '../music/pitch.ts';
import { TOOLS, TUNER_ACCURACIES } from '../practice/state.ts';
import type { PracticeStore } from '../practice/state.ts';
import { button, el, pitchText, responsiveLabel } from './components.ts';
import { createSettings } from './settings.ts';
import { createTuner } from './views/tuner.ts';
import { createTone } from './views/tone.ts';
import { createMetronome } from './views/metronome.ts';
import { tempoInput } from './tempo.ts';

/** Mount once. Views observe the same store and retain DOM/focus across updates. */
export function mountApp(root: HTMLElement, store: PracticeStore) {
  const audio = createAudioController(store);
  window.addEventListener('pagehide', audio.stopAll);
  document.addEventListener('visibilitychange', () => { if (document.hidden) audio.interrupt(); });
  const settings = createSettings(store);
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
  header.append(brand, navigation, tinker);

  const main = el('main', 'practice-surface');
  main.id = 'practice';
  main.tabIndex = -1;
  main.append(createTuner(store, settings.open, audio), createTone(store, audio), createMetronome(store, audio));
  const tools = el('aside', 'tool-strip');
  tools.setAttribute('aria-label', 'Practice tools');
  let accuracyButtons: HTMLButtonElement[] = [];
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
      const accuracy = el('div', 'accuracy-toggle');
      accuracy.setAttribute('role', 'group');
      accuracy.setAttribute('aria-label', 'Tuner accuracy');
      const icon = el('span', 'accuracy-icon', '◎');
      icon.setAttribute('aria-hidden', 'true');
      accuracyButtons = TUNER_ACCURACIES.map((option) => {
        const choice = button(option.label, () => store.dispatch({ type: 'tuner-accuracy', value: option.value }));
        choice.classList.add('accuracy-choice');
        choice.setAttribute('aria-label', `${option.value[0]!.toUpperCase()}${option.value.slice(1)} accuracy`);
        accuracy.append(choice);
        return choice;
      });
      accuracy.prepend(icon);
      compactControl('ACCURACY', accuracy);
      compact.append(el('div', 'compact-tool compact-tool--empty'));
    } else if (tool.id === 'tone') {
      compactControl('PLAY', action);
      const volume = button('60%', () => store.dispatch({ type: 'focus', value: 'tone' }));
      volume.classList.add('compact-value', 'compact-tone-volume');
      compactControl('VOLUME', volume);
      const note = button('B♭ ▾', () => store.dispatch({ type: 'focus', value: 'tone' }));
      note.classList.add('compact-value', 'compact-tone-note');
      compactControl('NOTE', note);
      const octave = button('3 ▾', () => store.dispatch({ type: 'focus', value: 'tone' }));
      octave.classList.add('compact-value', 'compact-tone-octave');
      compactControl('OCTAVE', octave);
    } else {
      compactControl('START', action);
      status.append(tempoInput(store, 'Quick tempo (BPM)'), tempoStatus);
      compactControl('TEMPO', status);
      const tap = button('Tap tempo', audio.tapTempo);
      tap.classList.add('tool-tap');
      responsiveLabel(tap, 'Tap tempo', '🐶');
      compactControl('TAP', tap);
      const subdivision = button('1 ▾', () => store.dispatch({ type: 'focus', value: 'metronome' }));
      subdivision.classList.add('compact-value', 'compact-subdivision');
      compactControl('SUBDIVISION', subdivision);
    }
    tools.append(card);
    return { title, status, action, tempoStatus };
  });
  const footer = el('footer', 'app-footer');
  const availability = el('p', '', 'Reference tones and metronome clicks may be picked up by the microphone. Use headphones to compare.');
  availability.id = 'audio-availability';
  const offline = el('p', 'teal');
  offline.id = 'offline-status';
  prepareOffline(offline);
  const licenses = el('details', 'licenses');
  licenses.append(el('summary', '', 'Font licenses'));
  // Included in both artifacts so the portable font distribution retains its notices.
  const notice = el('pre', 'license-text', FONT_LICENSES);
  licenses.append(notice);
  const error = el('p');
  error.setAttribute('role', 'status');
  const local = el('div', 'local-status');
  local.append(el('span', 'mobile-only', 'On-device audio · '), offline);
  const extra = el('details', 'footer-extra');
  extra.append(el('summary', '', 'More practice tools'), button('Stop all audio', audio.stopAll), availability, createReleaseControls(), licenses);
  footer.append(local, error, extra);
  const explorer = main.querySelector<HTMLElement>('.sample-panel')!;
  extra.append(explorer);
  root.append(header, main, tools, footer, settings.node);
  store.subscribe((state) => {
    links.forEach((link, index) => link.setAttribute('aria-pressed', String(TOOLS[index]!.id === state.focus)));
    error.textContent = state.audioError;
    const listening = ['requesting', 'listening', 'no-signal', 'unreliable'].includes(state.micStatus);
    responsiveLabel(summaries[0]!.action, listening ? 'Stop listening' : 'Start listening', listening ? 'Mic on' : 'Mic off');
    summaries[0]!.action.setAttribute('aria-pressed', String(listening));
    accuracyButtons.forEach((choice, index) => choice.setAttribute('aria-pressed', String(TUNER_ACCURACIES[index]!.value === state.tunerAccuracy)));
    responsiveLabel(summaries[1]!.action, state.tonePlaying ? 'Stop tone' : 'Play tone', state.tonePlaying ? 'Stop' : 'Play');
    summaries[0]!.status.textContent = state.micStatus !== 'idle' ? state.micStatus : state.manualHz === null ? 'Not listening' : `Sample · ${pitchText(state).note}`;
    responsiveLabel(summaries[1]!.status, `${noteName(state.toneNote)} · ${state.sustain ? 'Sustain' : 'Selected'}`, noteName(state.toneNote));
    responsiveLabel(summaries[2]!.title, 'TEMPO', 'TEMPO');
    responsiveLabel(summaries[2]!.action, state.metronomePlaying ? 'Stop metronome' : 'Start metronome', state.metronomePlaying ? 'Pause' : 'Start');
    responsiveLabel(summaries[2]!.tempoStatus, ` BPM · ${state.metronomePlaying ? 'Playing' : 'Stopped'}`, ' BPM');
    root.querySelector('.compact-tone-note')!.textContent = `${noteName(state.toneNote).replace(/\d+$/, '')} ▾`;
    root.querySelector('.compact-tone-octave')!.textContent = `${state.octave} ▾`;
    root.querySelector('.compact-tone-volume')!.textContent = `${state.toneVolume}%`;
    root.querySelector('.compact-subdivision')!.textContent = `${state.subdivision} ▾`;
    if (pitchText(state).note !== '—') summaries[0]!.status.textContent = `${pitchText(state).note} · ${pitchText(state).detail.split(' · ')[1]!.replace(' cents', '¢')}`;
  });
}

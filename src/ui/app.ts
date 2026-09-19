import { prepareOffline } from '../distribution/offline.ts';
import { createAudioController } from '../audio/controller.ts';
import { noteName } from '../music/pitch.ts';
import { meterInfo, TOOLS } from '../practice/state.ts';
import type { PracticeStore } from '../practice/state.ts';
import { button, el, pitchText, row } from './components.ts';
import { createSettings } from './settings.ts';
import { createTuner } from './views/tuner.ts';
import { createTone } from './views/tone.ts';
import { createMetronome } from './views/metronome.ts';

/** Mount once. Views observe the same store and retain DOM/focus across updates. */
export function mountApp(root: HTMLElement, store: PracticeStore) {
  const audio = createAudioController(store);
  window.addEventListener('pagehide', audio.stopAll);
  const settings = createSettings(store);
  const header = el('header', 'app-header');
  const brand = el('div', 'brand');
  brand.append(el('h1', 'wordmark', 'tUno'), el('p', 'tagline', 'Practice with a friend.'));
  const navigation = el('nav', 'focus-navigation');
  navigation.setAttribute('aria-label', 'Practice focus');
  const links = TOOLS.map((tool) => {
    const control = button(tool.label, () => store.dispatch({ type: 'focus', value: tool.id }));
    control.setAttribute('aria-controls', `view-${tool.id}`);
    navigation.append(control);
    return control;
  });
  header.append(brand, navigation, button('Settings', settings.open));

  const main = el('main', 'practice-surface');
  main.id = 'practice';
  main.tabIndex = -1;
  main.append(createTuner(store, settings.open, audio), createTone(store, audio), createMetronome(store, audio));
  const tools = el('aside', 'tool-strip');
  tools.setAttribute('aria-label', 'Practice tools');
  const summaries = TOOLS.map((tool) => {
    const card = el('section', 'tool-card');
    const title = el('h2', 'eyebrow', tool.label.toUpperCase());
    const status = el('p', 'tool-status');
    const action = tool.id === 'tuner'
      ? button('Start listening', audio.toggleMic)
      : tool.id === 'tone'
        ? button('Play tone', audio.toggleTone)
        : button('Start metronome', audio.toggleMetronome);
    card.append(title, row(status, action));
    if (tool.id === 'metronome') card.append(button('Tap tempo', audio.tapTempo));
    tools.append(card);
    return { title, status, action };
  });
  const footer = el('footer', 'app-footer');
  const availability = el('p', '', 'Reference tones may be picked up by the microphone. Use headphones to compare.');
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
  footer.append(button('Stop all audio', audio.stopAll), error, availability, offline, licenses);
  root.append(header, main, tools, footer, settings.node);
  store.subscribe((state) => {
    links.forEach((link, index) => link.setAttribute('aria-pressed', String(TOOLS[index]!.id === state.focus)));
    error.textContent = state.audioError;
    summaries[0]!.action.textContent = ['requesting', 'listening', 'no-signal', 'unreliable'].includes(state.micStatus) ? 'Stop listening' : 'Start listening';
    summaries[1]!.action.textContent = state.tonePlaying ? 'Stop tone' : 'Play tone';
    summaries[0]!.status.textContent = state.micStatus !== 'idle' ? state.micStatus : state.manualHz === null ? 'Not listening' : `Sample · ${pitchText(state).note}`;
    summaries[1]!.status.textContent = `${noteName(state.toneNote)} · ${state.sustain ? 'Sustain' : 'Selected'}`;
    summaries[2]!.title.textContent = `METRONOME · ${meterInfo(state).unit.toUpperCase()}`;
    summaries[2]!.action.textContent = state.metronomePlaying ? 'Stop metronome' : 'Start metronome';
    summaries[2]!.status.textContent = `${state.tempo} BPM · ${state.metronomePlaying ? 'Playing' : 'Stopped'}`;
  });
}

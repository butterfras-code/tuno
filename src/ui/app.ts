import { createReleaseControls } from '../distribution/release.ts';
import { prepareOffline } from '../distribution/offline.ts';
import { createAudioController } from '../audio/controller.ts';
import { noteName } from '../music/pitch.ts';
import { meterInfo, TOOLS } from '../practice/state.ts';
import type { PracticeStore } from '../practice/state.ts';
import { button, el, pitchText, responsiveLabel, row } from './components.ts';
import { createSettings } from './settings.ts';
import { createTuner } from './views/tuner.ts';
import { createTone } from './views/tone.ts';
import { createMetronome } from './views/metronome.ts';

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
    responsiveLabel(control, tool.label, tool.id === 'tone' ? 'Tones' : tool.id === 'metronome' ? 'Beat' : 'Tuner');
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
    responsiveLabel(title, tool.label.toUpperCase(), tool.id === 'tone' ? 'Tone' : tool.id === 'metronome' ? 'Beat' : 'Tuner');
    card.append(title, row(status, action));
    if (tool.id === 'metronome') {
      const tap = button('Tap tempo', audio.tapTempo);
      tap.classList.add('tool-tap');
      responsiveLabel(tap, 'Tap tempo', 'Tap');
      card.append(tap);
    }
    tools.append(card);
    return { title, status, action };
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
  const mobile = window.matchMedia('(max-width: 650px)');
  const explorer = main.querySelector<HTMLElement>('.sample-panel')!;
  const placeExtras = () => {
    extra.open = !mobile.matches;
    (mobile.matches ? extra : main.querySelector('#view-tuner')!).append(explorer);
  };
  mobile.addEventListener('change', placeExtras);
  placeExtras();
  root.append(header, main, tools, footer, settings.node);
  store.subscribe((state) => {
    links.forEach((link, index) => link.setAttribute('aria-pressed', String(TOOLS[index]!.id === state.focus)));
    error.textContent = state.audioError;
    const listening = ['requesting', 'listening', 'no-signal', 'unreliable'].includes(state.micStatus);
    responsiveLabel(summaries[0]!.action, listening ? 'Stop listening' : 'Start listening', listening ? 'Mic on' : 'Mic off');
    summaries[0]!.action.setAttribute('aria-pressed', String(listening));
    responsiveLabel(summaries[1]!.action, state.tonePlaying ? 'Stop tone' : 'Play tone', state.tonePlaying ? 'Stop' : 'Play');
    summaries[0]!.status.textContent = state.micStatus !== 'idle' ? state.micStatus : state.manualHz === null ? 'Not listening' : `Sample · ${pitchText(state).note}`;
    responsiveLabel(summaries[1]!.status, `${noteName(state.toneNote)} · ${state.sustain ? 'Sustain' : 'Selected'}`, noteName(state.toneNote));
    responsiveLabel(summaries[2]!.title, `METRONOME · ${meterInfo(state).unit.toUpperCase()}`, 'Beat');
    responsiveLabel(summaries[2]!.action, state.metronomePlaying ? 'Stop metronome' : 'Start metronome', state.metronomePlaying ? 'Pause' : 'Start');
    responsiveLabel(summaries[2]!.status, `${state.tempo} BPM · ${state.metronomePlaying ? 'Playing' : 'Stopped'}`, `${state.tempo} BPM`);
    if (pitchText(state).note !== '—') summaries[0]!.status.textContent = `${pitchText(state).note} · ${pitchText(state).detail.split(' · ')[1]!.replace(' cents', '¢')}`;
  });
}

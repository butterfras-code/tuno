import { createReferenceTone, setToneSound } from './tone.ts';
import { detectPitch } from './detector.ts';
import { createTapTempo } from '../music/rhythm.ts';
import { prepareMetronome } from './metronome.ts';
import type { MetronomeSettings, VisualPulse } from './metronome-renderer.ts';
import { toneHz, meterInfo } from '../practice/state.ts';
import type { AudioState, PracticeStore } from '../practice/state.ts';
import { PitchDisplay } from '../practice/pitch-display.ts';

// The original SVG is the raised endpoint: rotating further up merges the tail into the body.
export const TAIL_RAISED_ANGLE = 0;
const TAIL_LOWERED_ANGLE = 25;

/** Application-owned resources. Cancellation generations adapted from pitch-tracker. */
export function createAudioController(store: PracticeStore) {
  let context: AudioContext | undefined;
  let stream: MediaStream | undefined;
  let source: MediaStreamAudioSourceNode | undefined;
  let analyser: AnalyserNode | undefined;
  let oscillator: OscillatorNode | undefined;
  let gain: GainNode | undefined;
  let micGeneration = 0;
  let toneGeneration = 0;
  let tonePending = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let toneTimer: ReturnType<typeof setTimeout> | undefined;
  let metronomeGeneration = 0;
  let metronomePending = false;
  let metronome: AudioWorkletNode | undefined;
  let metronomeGain: GainNode | undefined;
  let metronomeFactory: ReturnType<typeof prepareMetronome> | undefined;
  let positionPending = false;
  let hidden = typeof document !== 'undefined' && document.hidden;
  let visualFrame = 0;
  let visualQueue: VisualPulse[] = [];
  let visualBeat: VisualPulse | undefined;
  const pulseListeners = new Set<(angle: number, playing: boolean, beatIndex: number | null, accent: number) => void>();
  const tapListeners = new Set<() => void>();
  const tap = createTapTempo();
  const pitchDisplay = new PitchDisplay();
  const buffer = new Float32Array(4096);
  const update = (value: Partial<AudioState>) => store.dispatch({ type: 'audio', value });
  function audioContext() {
    if (!context) {
      context = new AudioContext();
      context.onstatechange = () => {
        if (context?.state !== 'running' && (stream || oscillator || tonePending || metronome || metronomePending || store.get().micStatus === 'requesting')) {
          stopAll();
          update({ micStatus: 'interrupted', audioError: 'Audio interrupted. Start listening, play a tone, or start the metronome to resume.' });
        }
      };
    }
    return context;
  }
  function stopMic() {
    micGeneration++;
    clearTimeout(timer);
    source?.disconnect();
    analyser?.disconnect();
    source = undefined;
    analyser = undefined;
    stream?.getTracks().forEach((track) => { track.onended = null; track.stop(); });
    stream = undefined;
    pitchDisplay.reset();
    update({ micStatus: 'idle', liveHz: null, displayHz: null, rms: 0, quality: 0 });
  }
  function analyse() {
    if (!analyser || !context) return;
    analyser.getFloatTimeDomainData(buffer);
    const evidence = detectPitch(buffer, context.sampleRate, 0.005);
    const now = performance.now();
    update({ pitchUpdatedAt: now, liveHz: evidence.frequency, displayHz: pitchDisplay.frame(now, evidence.frequency), rms: evidence.rms, quality: evidence.quality,
      micStatus: evidence.rms < 0.005 ? 'no-signal' : evidence.frequency === null ? 'unreliable' : 'listening' });
    timer = setTimeout(analyse, 70);
  }
  async function startMic() {
    if (stream || store.get().micStatus === 'requesting') return;
    const generation = ++micGeneration;
    pitchDisplay.reset();
    update({ micStatus: 'requesting', liveHz: null, displayHz: null, audioError: '' });
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw Error('Microphone access is unavailable in this browser or launch mode.');
      const ac = audioContext();
      await ac.resume();
      if (generation !== micGeneration) return;
      const result = await navigator.mediaDevices.getUserMedia({ audio: {
        echoCancellation: false, noiseSuppression: false, autoGainControl: false,
      }, video: false });
      if (generation !== micGeneration) { result.getTracks().forEach((track) => track.stop()); return; }
      stream = result;
      source = ac.createMediaStreamSource(result);
      analyser = ac.createAnalyser();
      analyser.fftSize = buffer.length;
      source.connect(analyser); // Never connect microphone input to speakers.
      result.getAudioTracks().forEach((track) => { track.onended = () => {
        stopMic();
        update({ micStatus: 'error', audioError: 'Microphone disconnected. Reconnect it and start listening again.' });
      }; });
      analyse();
    } catch (error) {
      if (generation !== micGeneration) return;
      stopMic();
      update({ micStatus: 'error', audioError: error instanceof Error && error.name === 'NotAllowedError'
        ? 'Microphone permission denied. Allow access in your browser and try again.'
        : error instanceof Error ? error.message : 'Unable to start microphone.' });
    }
  }
  function stopTone() {
    toneGeneration++;
    tonePending = false;
    heldToneNote = undefined;
    clearTimeout(toneTimer);
    if (oscillator && gain && context) {
      const oldOsc = oscillator, oldGain = gain;
      oldGain.gain.cancelScheduledValues(context.currentTime);
      oldGain.gain.setValueAtTime(oldGain.gain.value, context.currentTime);
      oldGain.gain.linearRampToValueAtTime(0, context.currentTime + 0.02);
      oldOsc.onended = () => { oldOsc.disconnect(); oldGain.disconnect(); };
      oldOsc.stop(context.currentTime + 0.025);
    }
    oscillator = undefined;
    gain = undefined;
    update({ tonePlaying: false });
  }
  function syncTone() {
    if (!oscillator || !gain || !context) return;
    setToneSound(context, oscillator, store.get().toneSound);
    oscillator.frequency.setTargetAtTime(toneHz(store.get()), context.currentTime, 0.01);
    gain.gain.setTargetAtTime(store.get().toneVolume / 100 * 0.2, context.currentTime, 0.01);
  }
  function scheduleRelease() {
    clearTimeout(toneTimer);
    if (oscillator && !store.get().sustain && heldToneNote === undefined) toneTimer = setTimeout(stopTone, 1200);
  }
  async function playTone() {
    const generation = ++toneGeneration;
    tonePending = true;
    update({ audioError: '' });
    try {
      const ac = audioContext();
      await ac.resume();
      if (generation !== toneGeneration) return;
      if (!oscillator) {
        const voice = createReferenceTone(ac, toneHz(store.get()), store.get().toneSound);
        oscillator = voice.oscillator;
        gain = voice.gain;
      }
      syncTone();
      scheduleRelease();
      update({ tonePlaying: true });
    } catch (error) {
      if (generation !== toneGeneration) return;
      stopTone();
      update({ audioError: error instanceof Error ? error.message : 'Unable to play tone.' });
    } finally { if (generation === toneGeneration) tonePending = false; }
  }
  function stopMetronome() {
    metronomeGeneration++;
    metronomePending = false;
    if (metronome) {
      metronome.port.postMessage({ type: 'stop' });
      metronome.onprocessorerror = null;
      metronome.port.onmessage = null;
      metronome.port.close();
      metronome.disconnect();
    }
    metronomeGain?.disconnect();
    metronome = undefined;
    metronomeGain = undefined;
    positionPending = false;
    if (visualFrame) cancelAnimationFrame(visualFrame);
    visualFrame = 0;
    visualQueue = [];
    visualBeat = undefined;
    pulseListeners.forEach(listener => listener(0, false, null, 0));
    update({ metronomePlaying: false, currentBeat: null, currentPart: 0 });
  }
  function renderBeat() {
    if (!metronome || !context || hidden) return;
    // Audio events drive beat identity; rendering never schedules sound.
    const stamp = context.getOutputTimestamp?.();
    const now = stamp?.contextTime || context.currentTime;
    let current: VisualPulse | undefined;
    for (const pulse of visualQueue) {
      if (pulse.time > now) break;
      current = pulse;
      if (pulse.part === 0) visualBeat = pulse;
    }
    if (visualBeat) {
      const fraction = Math.max(0, Math.min(1, (now - visualBeat.time) / visualBeat.duration));
      // Return to the low endpoint on every beat and reach the high endpoint halfway through.
      const angle = TAIL_RAISED_ANGLE + (TAIL_LOWERED_ANGLE - TAIL_RAISED_ANGLE) * (1 + Math.cos(2 * Math.PI * fraction)) / 2;
      // A quick lift and soft return, sampled from the same audible beat as the tail.
      const elapsed = Math.max(0, now - visualBeat.time);
      const accentDuration = Math.min(0.24, visualBeat.duration * 0.7);
      const progress = Math.min(1, elapsed / accentDuration);
      const accent = visualBeat.accented ? (progress < 0.2 ? progress / 0.2 : (1 - progress) / 0.8) : 0;
      pulseListeners.forEach(listener => listener(angle, true, visualBeat!.index, accent));
    }
    if (current && (store.get().currentBeat !== current.beat || store.get().currentPart !== current.part)) update({ currentBeat: current.beat, currentPart: current.part });
    if (!positionPending) { positionPending = true; metronome.port.postMessage({ type: 'position' }); }
    visualFrame = requestAnimationFrame(renderBeat);
  }
  function metronomeSettings(): MetronomeSettings {
    const state = store.get();
    return { tempo: state.tempo, beats: meterInfo(state).beats, subdivision: state.subdivision,
      clickSound: state.clickSound, beatAccents: state.beatAccents };
  }
  async function startMetronome() {
    if (metronome || metronomePending) return;
    const generation = ++metronomeGeneration;
    metronomePending = true;
    update({ audioError: '' });
    try {
      const ac = audioContext();
      await ac.resume();
      if (generation !== metronomeGeneration) return;
      metronomeFactory ??= prepareMetronome(ac).catch(error => { metronomeFactory = undefined; throw error; });
      const create = await metronomeFactory;
      if (generation !== metronomeGeneration) return;
      if (ac.state !== 'running') throw Error('Audio interrupted. Start the metronome again to resume.');
      const node = create(metronomeSettings());
      metronome = node;
      metronomeGain = ac.createGain();
      metronomeGain.gain.value = store.get().clickVolume / 100;
      node.connect(metronomeGain);
      metronomeGain.connect(ac.destination);
      node.port.onmessage = ({ data }: MessageEvent<VisualPulse[]>) => {
        if (metronome !== node) return;
        positionPending = false;
        if (!hidden) visualQueue = data;
      };
      node.onprocessorerror = () => {
        if (metronome !== node) return;
        stopMetronome();
        update({ audioError: 'Metronome audio was interrupted. Start it again to resume.' });
      };
      update({ metronomePlaying: true });
      // Move from rest immediately, including before the first scheduled click.
      pulseListeners.forEach(listener => listener(TAIL_LOWERED_ANGLE, true, 0, 0));
      renderBeat();
    } catch (error) {
      if (generation !== metronomeGeneration) return;
      stopMetronome();
      update({ audioError: error instanceof Error ? error.message : 'Unable to start metronome.' });
    } finally { if (generation === metronomeGeneration) metronomePending = false; }
  }
  function stopAll() { stopMic(); stopTone(); stopMetronome(); }
  let heldToneNote: number | undefined;
  let sustain = store.get().sustain;
  let { toneNote, a4, toneVolume, toneSound } = store.get();
  let previous = store.get();
  const unsubscribe = store.subscribe((state) => {
    if (metronome && (state.tempo !== previous.tempo || state.meter !== previous.meter || state.subdivision !== previous.subdivision
      || state.clickSound !== previous.clickSound || state.beatAccents !== previous.beatAccents)) {
      metronome.port.postMessage({ type: 'settings', settings: metronomeSettings() });
    }
    if (metronomeGain && context && state.clickVolume !== previous.clickVolume) {
      metronomeGain.gain.setTargetAtTime(state.clickVolume / 100, context.currentTime, 0.01);
    }
    previous = state;
    if (state.toneNote !== toneNote || state.a4 !== a4 || state.toneVolume !== toneVolume || state.toneSound !== toneSound) {
      toneNote = state.toneNote; a4 = state.a4; toneVolume = state.toneVolume; toneSound = state.toneSound;
      syncTone();
    }
    if (sustain !== state.sustain) {
      sustain = state.sustain;
      if (sustain) scheduleRelease();
      else stopTone();
    }
  });
  return { visibilityChanged(isHidden: boolean) {
    hidden = isHidden;
    if (hidden) {
      const micActive = stream || store.get().micStatus === 'requesting';
      stopMic();
      // A held piano key can lose its release event on a tab switch. Sustained
      // reference tones and timed notes keep their normal playback lifecycle.
      if (!store.get().sustain && heldToneNote !== undefined) stopTone();
      if (micActive) update({ micStatus: 'interrupted',
        audioError: 'Microphone paused while tUno was hidden. Start listening to resume.' });
      if (visualFrame) cancelAnimationFrame(visualFrame);
      visualFrame = 0;
      visualQueue = [];
      visualBeat = undefined;
    } else if (metronome && !visualFrame) renderBeat();
  }, startMic, stopMic, playTone, stopTone, stopAll, startMetronome, stopMetronome,
    toggleMetronome: () => metronome || metronomePending ? stopMetronome() : void startMetronome(),
    onPulseFrame(listener: (angle: number, playing: boolean, beatIndex: number | null, accent: number) => void) {
      pulseListeners.add(listener);
      return () => pulseListeners.delete(listener);
    },
    onTap(listener: () => void) { tapListeners.add(listener); return () => tapListeners.delete(listener); },
    tapTempo: () => { tapListeners.forEach(listener => listener()); const tempo = tap(performance.now()); if (tempo !== null) store.dispatch({ type: 'tempo', value: tempo }); },
    toggleMic: () => stream || store.get().micStatus === 'requesting' ? stopMic() : void startMic(),
    pressToneKey(note: number) {
      if (store.get().sustain && store.get().toneNote === note && (oscillator || tonePending)) { stopTone(); return; }
      heldToneNote = store.get().sustain ? undefined : note;
      store.dispatch({ type: 'tone-note', value: note });
      void playTone();
    },
    releaseToneKey(note: number) {
      if (!store.get().sustain && heldToneNote === note) stopTone();
    },
    toggleTone: () => oscillator || tonePending ? stopTone() : void playTone(),
    dispose() { stopAll(); unsubscribe(); pulseListeners.clear(); tapListeners.clear(); if (context) { context.onstatechange = null; void context.close(); } },
  };
}
export type AudioController = ReturnType<typeof createAudioController>;

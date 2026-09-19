import { createReferenceTone } from './tone.ts';
import { detectPitch } from './detector.ts';
import { createTimeline, createTapTempo } from '../music/rhythm.ts';
import type { Pulse } from '../music/rhythm.ts';
import { scheduleClick } from './click.ts';
import { toneHz, meterInfo } from '../practice/state.ts';
import type { AudioState, PracticeStore } from '../practice/state.ts';
import { PitchDisplay } from '../practice/pitch-display.ts';

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
  let metronomeTimer: ReturnType<typeof setTimeout> | undefined;
  let visualFrame = 0;
  let timeline: ReturnType<typeof createTimeline> | undefined;
  type VisualPulse = Pulse & { duration: number; index: number };
  let visualQueue: VisualPulse[] = [];
  let beatIndex = -1;
  let beatDuration = 0;
  let visualBeat: VisualPulse | undefined;
  const pulseListeners = new Set<(angle: number, playing: boolean, beatIndex: number | null) => void>();
  const tapListeners = new Set<() => void>();
  const clicks = new Set<ReturnType<typeof scheduleClick>>();
  const tap = createTapTempo();
  const pitchDisplay = new PitchDisplay();
  const buffer = new Float32Array(4096);
  const update = (value: Partial<AudioState>) => store.dispatch({ type: 'audio', value });
  function audioContext() {
    if (!context) {
      context = new AudioContext();
      context.onstatechange = () => {
        if (context?.state !== 'running' && (stream || oscillator || timeline)) {
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
    oscillator.frequency.setTargetAtTime(toneHz(store.get()), context.currentTime, 0.01);
    gain.gain.setTargetAtTime(store.get().toneVolume / 100 * 0.2, context.currentTime, 0.01);
  }
  function scheduleRelease() {
    clearTimeout(toneTimer);
    if (oscillator && !store.get().sustain) toneTimer = setTimeout(stopTone, 1200);
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
        const voice = createReferenceTone(ac, toneHz(store.get()));
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
    clearTimeout(metronomeTimer);
    if (visualFrame) cancelAnimationFrame(visualFrame);
    visualFrame = 0;
    timeline = undefined;
    visualQueue = [];
    visualBeat = undefined;
    beatIndex = -1;
    pulseListeners.forEach(listener => listener(0, false, null));
    for (const click of clicks) click.stop();
    clicks.clear();
    update({ metronomePlaying: false, currentBeat: null, currentPart: 0 });
  }
  function renderBeat() {
    if (!timeline || !context) return;
    // Audio events drive beat identity; rendering never schedules sound.
    const stamp = context.getOutputTimestamp?.();
    const now = stamp?.contextTime || context.currentTime;
    let current: VisualPulse | undefined;
    while (visualQueue.length && visualQueue[0]!.time <= now) {
      current = visualQueue.shift()!;
      if (current.part === 0) visualBeat = current;
    }
    if (visualBeat) {
      const fraction = Math.max(0, Math.min(1, (now - visualBeat.time) / visualBeat.duration));
      // Return to the low endpoint on every beat and reach the high endpoint halfway through.
      const angle = 25 * Math.cos(2 * Math.PI * fraction);
      pulseListeners.forEach(listener => listener(angle, true, visualBeat!.index));
    }
    if (current) update({ currentBeat: current.beat, currentPart: current.part });
    visualFrame = requestAnimationFrame(renderBeat);
  }
  function scheduleBeats() {
    if (!timeline || !context) return;
    if (timeline.time < context.currentTime - 0.05) {
      stopMetronome();
      update({ audioError: 'Metronome timing was interrupted. Start it again to resume a steady beat.' });
      return;
    }
    while (timeline.time < context.currentTime + 0.15) {
      const state = store.get();
      const pulse = timeline.next({ tempo: state.tempo, beats: meterInfo(state).beats, subdivision: state.subdivision });
      const click = scheduleClick(context, { ...pulse, downbeat: meterInfo(state).beats > 0 && pulse.part === 0 && !!state.beatAccents[pulse.beat] }, { ...state, accent: true });
      clicks.add(click);
      click.oscillator.addEventListener('ended', () => clicks.delete(click), { once: true });
      if (pulse.part === 0) { beatIndex++; beatDuration = 60 / state.tempo; }
      visualQueue.push({ ...pulse, index: beatIndex, duration: beatDuration });
    }
    metronomeTimer = setTimeout(scheduleBeats, 25);
  }
  async function startMetronome() {
    if (timeline || metronomePending) return;
    const generation = ++metronomeGeneration;
    metronomePending = true;
    update({ audioError: '' });
    try {
      const ac = audioContext();
      await ac.resume();
      if (generation !== metronomeGeneration) return;
      timeline = createTimeline(ac.currentTime + 0.05);
      update({ metronomePlaying: true });
      scheduleBeats();
      renderBeat();
    } catch (error) {
      if (generation !== metronomeGeneration) return;
      stopMetronome();
      update({ audioError: error instanceof Error ? error.message : 'Unable to start metronome.' });
    } finally { if (generation === metronomeGeneration) metronomePending = false; }
  }
  function stopAll() { stopMic(); stopTone(); stopMetronome(); }
  let sustain = store.get().sustain;
  let { toneNote, a4, toneVolume } = store.get();
  const unsubscribe = store.subscribe((state) => {
    if (state.toneNote !== toneNote || state.a4 !== a4 || state.toneVolume !== toneVolume) {
      toneNote = state.toneNote; a4 = state.a4; toneVolume = state.toneVolume;
      syncTone();
    }
    if (sustain !== state.sustain) { sustain = state.sustain; scheduleRelease(); }
  });
  return { interrupt() {
    const active = stream || oscillator || tonePending || timeline || metronomePending || store.get().micStatus === 'requesting';
    if (active) { stopAll(); update({ micStatus: 'interrupted', audioError: 'Practice paused while tUno was hidden. Start a tool to resume.' }); }
  }, startMic, stopMic, playTone, stopTone, stopAll, startMetronome, stopMetronome,
    toggleMetronome: () => timeline || metronomePending ? stopMetronome() : void startMetronome(),
    onPulseFrame(listener: (angle: number, playing: boolean, beatIndex: number | null) => void) {
      pulseListeners.add(listener);
      return () => pulseListeners.delete(listener);
    },
    onTap(listener: () => void) { tapListeners.add(listener); return () => tapListeners.delete(listener); },
    tapTempo: () => { tapListeners.forEach(listener => listener()); const tempo = tap(performance.now()); if (tempo !== null) store.dispatch({ type: 'tempo', value: tempo }); },
    toggleMic: () => stream || store.get().micStatus === 'requesting' ? stopMic() : void startMic(),
    toggleTone: () => oscillator || tonePending ? stopTone() : void playTone(),
    dispose() { stopAll(); unsubscribe(); pulseListeners.clear(); tapListeners.clear(); if (context) { context.onstatechange = null; void context.close(); } },
  };
}
export type AudioController = ReturnType<typeof createAudioController>;

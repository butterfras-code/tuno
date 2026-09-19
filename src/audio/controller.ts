import { detectPitch } from './detector.ts';
import { toneHz } from '../practice/state.ts';
import type { AudioState, PracticeStore } from '../practice/state.ts';

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
  let timer: ReturnType<typeof setTimeout> | undefined;
  let toneTimer: ReturnType<typeof setTimeout> | undefined;
  const buffer = new Float32Array(4096);
  const update = (value: Partial<AudioState>) => store.dispatch({ type: 'audio', value });
  function audioContext() {
    if (!context) {
      context = new AudioContext();
      context.onstatechange = () => {
        if (context?.state !== 'running' && (stream || oscillator)) {
          stopAll();
          update({ micStatus: 'interrupted', audioError: 'Audio interrupted. Start listening or play a tone to resume.' });
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
    update({ micStatus: 'idle', liveHz: null, rms: 0, quality: 0 });
  }
  function analyse() {
    if (!analyser || !context) return;
    analyser.getFloatTimeDomainData(buffer);
    const evidence = detectPitch(buffer, context.sampleRate, 0.005);
    update({ liveHz: evidence.frequency, rms: evidence.rms, quality: evidence.quality,
      micStatus: evidence.rms < 0.005 ? 'no-signal' : evidence.frequency === null ? 'unreliable' : 'listening' });
    timer = setTimeout(analyse, 70);
  }
  async function startMic() {
    if (stream || store.get().micStatus === 'requesting') return;
    const generation = ++micGeneration;
    update({ micStatus: 'requesting', liveHz: null, audioError: '' });
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
    update({ audioError: '' });
    try {
      const ac = audioContext();
      await ac.resume();
      if (generation !== toneGeneration) return;
      if (!oscillator) {
        oscillator = ac.createOscillator();
        gain = ac.createGain();
        gain.gain.value = 0;
        oscillator.frequency.value = toneHz(store.get());
        oscillator.connect(gain);
        gain.connect(ac.destination);
        oscillator.start();
      }
      syncTone();
      scheduleRelease();
      update({ tonePlaying: true });
    } catch (error) {
      if (generation !== toneGeneration) return;
      stopTone();
      update({ audioError: error instanceof Error ? error.message : 'Unable to play tone.' });
    }
  }
  function stopAll() { stopMic(); stopTone(); }
  let sustain = store.get().sustain;
  const unsubscribe = store.subscribe((state) => {
    syncTone();
    if (sustain !== state.sustain) { sustain = state.sustain; scheduleRelease(); }
  });
  return { startMic, stopMic, playTone, stopTone, stopAll,
    toggleMic: () => stream || store.get().micStatus === 'requesting' ? stopMic() : void startMic(),
    toggleTone: () => oscillator ? stopTone() : void playTone(),
    dispose() { stopAll(); unsubscribe(); if (context) { context.onstatechange = null; void context.close(); } },
  };
}
export type AudioController = ReturnType<typeof createAudioController>;

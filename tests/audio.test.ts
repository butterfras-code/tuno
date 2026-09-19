import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPracticeStore } from '../src/practice/state.ts';
import { createAudioController } from '../src/audio/controller.ts';

// Browser boundary doubles exercise cancellation and ownership, not physical audio.
test('audio cancellation, coexistence, settings, disconnect and interruption', async () => {
  const parameter = () => ({ value: 0, setValueAtTime(v: number) { this.value = v; }, linearRampToValueAtTime(v: number) { this.value = v; }, setTargetAtTime(v: number) { this.value = v; }, exponentialRampToValueAtTime(v: number) { this.value = v; }, cancelScheduledValues() {} });
  const oscillators: { frequency: ReturnType<typeof parameter>; stopped: boolean }[] = [];
  let ac: FakeContext;
  class FakeContext {
    state = 'running'; currentTime = 0; sampleRate = 48000; destination = {};
    onstatechange: (() => void) | null = null;
    constructor() { ac = this; }
    async resume() { this.state = 'running'; }
    async close() {}
    createMediaStreamSource() { return { connect() {}, disconnect() {} }; }
    createAnalyser() { return { fftSize: 4096, disconnect() {}, getFloatTimeDomainData(data: Float32Array) { data.fill(0); } }; }
    createPeriodicWave() { return {}; }
    createGain() { return { gain: parameter(), connect() {}, disconnect() {} }; }
    createOscillator() {
      const osc = { frequency: parameter(), stopped: false, onended: null as (() => void) | null, type: 'sine', setPeriodicWave() { this.type = 'custom'; }, addEventListener() {}, connect() {}, disconnect() {}, start() {}, stop() { this.stopped = true; this.onended?.(); } };
      oscillators.push(osc); return osc;
    }
  }
  const originalRaf = Object.getOwnPropertyDescriptor(globalThis, 'requestAnimationFrame');
  const originalCancelRaf = Object.getOwnPropertyDescriptor(globalThis, 'cancelAnimationFrame');
  Object.defineProperty(globalThis, 'requestAnimationFrame', { configurable: true, value: () => 1 });
  Object.defineProperty(globalThis, 'cancelAnimationFrame', { configurable: true, value: () => {} });
  const originalAudio = Object.getOwnPropertyDescriptor(globalThis, 'AudioContext');
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  let resolve!: (value: unknown) => void;
  let calls = 0;
  let deny = false;
  Object.defineProperty(globalThis, 'AudioContext', { configurable: true, value: FakeContext });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { mediaDevices: { getUserMedia() {
    calls++;
    if (deny) return Promise.reject(new DOMException('Denied', 'NotAllowedError'));
    return new Promise((done) => { resolve = done; });
  } } } });
  const track = { stopped: false, onended: null as (() => void) | null, stop() { this.stopped = true; } };
  const stream = { getTracks: () => [track], getAudioTracks: () => [track] };
  const store = createPracticeStore();
  const audio = createAudioController(store);
  try {
    const pending = audio.startMic(); await Promise.resolve();
    await audio.startMic(); assert.equal(calls, 1);
    audio.stopAll(); resolve(stream); await pending;
    assert.equal(track.stopped, true); assert.equal(store.get().micStatus, 'idle');
    track.stopped = false;
    const next = audio.startMic(); await Promise.resolve(); resolve(stream); await next;
    assert.equal(store.get().micStatus, 'no-signal');
    await audio.playTone(); await audio.playTone(); assert.equal(oscillators.length, 1);
    store.dispatch({ type: 'focus', value: 'tone' });
    store.dispatch({ type: 'settings', value: { a4: 442, transposition: 2, showUno: true } });
    const hz = oscillators[0]!.frequency.value;
    store.dispatch({ type: 'settings', value: { a4: 442, transposition: 9, showUno: true } });
    assert.equal(oscillators[0]!.frequency.value, hz);
    audio.stopMic(); assert.equal(store.get().tonePlaying, true);
    ac!.state = 'suspended'; ac!.onstatechange?.();
    assert.equal(store.get().micStatus, 'interrupted'); assert.equal(oscillators[0]!.stopped, true);
    const reconnect = audio.startMic(); await Promise.resolve(); resolve(stream); await reconnect;
    track.onended?.();
    assert.equal(store.get().micStatus, 'error');
    assert.match(store.get().audioError, /disconnected/);
    deny = true; await audio.startMic(); assert.equal(store.get().micStatus, 'error');
    assert.match(store.get().audioError, /permission denied/);
    await audio.startMetronome();
    const count = oscillators.length;
    await audio.startMetronome();
    assert.equal(oscillators.length, count);
    assert.equal(store.get().metronomePlaying, true);
    audio.stopMic();
    store.dispatch({ type: 'focus', value: 'tuner' });
    assert.equal(store.get().metronomePlaying, true);
    ac!.state = 'suspended'; ac!.onstatechange?.();
    assert.equal(store.get().metronomePlaying, false);
    assert.equal(store.get().currentBeat, null);
    const pendingBeat = audio.startMetronome();
    audio.stopAll();
    await pendingBeat;
    assert.equal(store.get().metronomePlaying, false);
    assert.equal(oscillators.length, count);
    const hiddenStart = audio.startMetronome();
    audio.interrupt();
    await hiddenStart;
    assert.equal(store.get().metronomePlaying, false);
    assert.equal(store.get().micStatus, 'interrupted');
    assert.match(store.get().audioError, /hidden/);
    const hiddenTone = audio.playTone();
    audio.interrupt();
    await hiddenTone;
    assert.equal(store.get().tonePlaying, false);
    assert.equal(oscillators.length, count);
    // Same-key sustain toggles also cancel an AudioContext resume still in flight.
    audio.pressToneKey(60); audio.pressToneKey(60);
    await Promise.resolve();
    assert.equal(store.get().tonePlaying, false);
    assert.equal(oscillators.length, count);
    audio.pressToneKey(60); await Promise.resolve();
    assert.equal(store.get().tonePlaying, true);
    audio.pressToneKey(62); await Promise.resolve();
    assert.equal(store.get().tonePlaying, true);
    assert.equal(store.get().toneNote, 62);
    audio.pressToneKey(62);
    assert.equal(store.get().tonePlaying, false);
    store.dispatch({ type: 'sustain', value: false });
    audio.pressToneKey(62); await Promise.resolve();
    audio.pressToneKey(62); await Promise.resolve();
    assert.equal(store.get().tonePlaying, true, 'Sustain off retriggers the timed note');
  } finally {
    audio.dispose();
    if (originalRaf) Object.defineProperty(globalThis, 'requestAnimationFrame', originalRaf); else Reflect.deleteProperty(globalThis, 'requestAnimationFrame');
    if (originalCancelRaf) Object.defineProperty(globalThis, 'cancelAnimationFrame', originalCancelRaf); else Reflect.deleteProperty(globalThis, 'cancelAnimationFrame');
    if (originalAudio) Object.defineProperty(globalThis, 'AudioContext', originalAudio); else Reflect.deleteProperty(globalThis, 'AudioContext');
    if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator); else Reflect.deleteProperty(globalThis, 'navigator');
  }
});

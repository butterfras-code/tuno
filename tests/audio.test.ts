import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPracticeStore } from '../src/practice/state.ts';
import { createAudioController } from '../src/audio/controller.ts';

// Browser boundary doubles exercise cancellation and ownership, not physical audio.
test('audio cancellation, coexistence, settings, disconnect and interruption', async () => {
  const parameter = () => ({ value: 0, setValueAtTime(v: number) { this.value = v; }, linearRampToValueAtTime(v: number) { this.value = v; }, setTargetAtTime(v: number) { this.value = v; }, exponentialRampToValueAtTime(v: number) { this.value = v; }, cancelScheduledValues() {} });
  const oscillators: { frequency: ReturnType<typeof parameter>; stopped: boolean }[] = [];
  const worklets: FakeWorklet[] = [];
  class FakeWorklet {
    disconnected = false;
    onprocessorerror: (() => void) | null = null;
    messages: { type: string }[] = [];
    port = {
      onmessage: null as ((event: { data: unknown }) => void) | null,
      close() {},
      postMessage: (data: { type: string }) => {
        this.messages.push(data);
        if (data.type === 'position') this.port.onmessage?.({ data: [{ time: 0.05, beat: 0, part: 0, downbeat: true, accented: true, duration: 0.625, index: 0 }] });
      },
    };
    constructor() { worklets.push(this); }
    connect() {}
    disconnect() { this.disconnected = true; }
  }
  let ac: FakeContext;
  class FakeContext {
    state = 'running'; currentTime = 0; sampleRate = 48000; destination = {};
    audioWorklet = { async addModule() {} };
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
  let renderFrame: FrameRequestCallback | undefined;
  Object.defineProperty(globalThis, 'requestAnimationFrame', { configurable: true, value: (callback: FrameRequestCallback) => { renderFrame = callback; return 1; } });
  Object.defineProperty(globalThis, 'cancelAnimationFrame', { configurable: true, value: () => {} });
  const originalAudio = Object.getOwnPropertyDescriptor(globalThis, 'AudioContext');
  const originalOffline = Object.getOwnPropertyDescriptor(globalThis, 'OfflineAudioContext');
  const originalWorklet = Object.getOwnPropertyDescriptor(globalThis, 'AudioWorkletNode');
  class FakeOffline {
    destination = {};
    createGain = FakeContext.prototype.createGain;
    createOscillator = FakeContext.prototype.createOscillator;
    async startRendering() { return { getChannelData: () => new Float32Array(3000) }; }
  }
  Object.defineProperty(globalThis, 'OfflineAudioContext', { configurable: true, value: FakeOffline });
  Object.defineProperty(globalThis, 'AudioWorkletNode', { configurable: true, value: FakeWorklet });
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
    const loadModule = ac!.audioWorklet.addModule;
    ac!.audioWorklet.addModule = async () => { throw Error('Audio engine could not load'); };
    await audio.startMetronome();
    assert.equal(store.get().metronomePlaying, false);
    assert.match(store.get().audioError, /could not load/);
    ac!.audioWorklet.addModule = loadModule;
    store.dispatch({ type: 'meter', value: '4/4' });
    const startupFrames: { angle: number; playing: boolean; index: number | null; accent: number }[] = [];
    audio.onPulseFrame((angle, playing, index, accent) => startupFrames.push({ angle, playing, index, accent }));
    await audio.startMetronome();
    assert.deepEqual(startupFrames[0], { angle: 25, playing: true, index: 0, accent: 0 }, 'tail moves before the first scheduled click');
    store.dispatch({ type: 'beat-accent', value: 0 });
    ac!.currentTime = 0.098;
    renderFrame!(0);
    assert.ok(startupFrames.at(-1)!.accent > 0.99, 'face follows the scheduled audible accent even when its toggle changes afterward');
    ac!.currentTime = 0.3;
    renderFrame!(0);
    assert.equal(startupFrames.at(-1)!.accent, 0, 'face settles before the next beat');
    const count = oscillators.length;
    await audio.startMetronome();
    assert.equal(oscillators.length, count);
    assert.equal(worklets.length, 1, 'repeated start does not duplicate the worklet');
    assert.equal(store.get().metronomePlaying, true);
    audio.stopMic();
    store.dispatch({ type: 'focus', value: 'tuner' });
    assert.equal(store.get().metronomePlaying, true);
    ac!.state = 'suspended'; ac!.onstatechange?.();
    assert.equal(store.get().metronomePlaying, false);
    assert.equal(store.get().currentBeat, null);
    assert.equal(worklets[0]!.disconnected, true);
    assert.ok(worklets[0]!.messages.some(message => message.type === 'stop'));
    // Interrupting while permission is pending must cancel the eventual stream.
    deny = false;
    const interruptedStart = audio.startMic(); await Promise.resolve();
    ac!.state = 'suspended'; ac!.onstatechange?.();
    track.stopped = false;
    resolve(stream); await interruptedStart;
    assert.equal(track.stopped, true, 'late permission must release capture after interruption');
    assert.equal(store.get().micStatus, 'interrupted');
    const pendingBeat = audio.startMetronome();
    audio.stopAll();
    await pendingBeat;
    assert.equal(store.get().metronomePlaying, false);
    assert.equal(oscillators.length, count);
    const hiddenStart = audio.startMetronome();
    audio.visibilityChanged(true);
    await hiddenStart;
    assert.equal(store.get().metronomePlaying, true, 'tab hiding preserves a pending metronome start');
    assert.equal(store.get().micStatus, 'idle');
    assert.equal(store.get().audioError, '');
    const backgroundNode = worklets.at(-1)!;
    audio.visibilityChanged(false);
    assert.equal(store.get().metronomePlaying, true);
    store.dispatch({ type: 'tempo', value: 120 });
    assert.ok(backgroundNode.messages.some(message => message.type === 'settings'));
    backgroundNode.onprocessorerror?.();
    assert.equal(store.get().metronomePlaying, false);
    assert.match(store.get().audioError, /interrupted/);
    const hiddenTone = audio.playTone();
    audio.visibilityChanged(true);
    await hiddenTone;
    assert.equal(store.get().tonePlaying, true, 'tab hiding preserves a pending sustained tone');
    assert.equal(oscillators.length, count + 1);
    const backgroundTone = oscillators.at(-1)!;
    audio.visibilityChanged(true);
    assert.equal(backgroundTone.stopped, false, 'an active sustained tone continues in the background');
    assert.equal(store.get().audioError, '');
    // Stopping microphone capture must not stop the reference tone.
    const backgroundMic = audio.startMic(); await Promise.resolve();
    track.stopped = false;
    audio.visibilityChanged(true);
    resolve(stream); await backgroundMic;
    assert.equal(track.stopped, true, 'a late microphone grant is released while tone playback continues');
    assert.equal(store.get().micStatus, 'interrupted');
    assert.match(store.get().audioError, /Microphone paused/);
    assert.equal(store.get().tonePlaying, true);
    audio.stopTone();
    assert.equal(backgroundTone.stopped, true, 'explicit stop still silences a background tone');
    audio.visibilityChanged(false);
    // Same-key sustain toggles also cancel an AudioContext resume still in flight.
    audio.pressToneKey(60); audio.pressToneKey(60);
    await Promise.resolve();
    assert.equal(store.get().tonePlaying, false);
    assert.equal(oscillators.length, count + 1);
    audio.pressToneKey(60); await Promise.resolve();
    assert.equal(store.get().tonePlaying, true);
    audio.pressToneKey(62); await Promise.resolve();
    assert.equal(store.get().tonePlaying, true);
    assert.equal(store.get().toneNote, 62);
    audio.pressToneKey(62);
    assert.equal(store.get().tonePlaying, false);
    await audio.playTone();
    store.dispatch({ type: 'sustain', value: false });
    assert.equal(store.get().tonePlaying, false, 'Turning sustain off immediately stops the sounding tone');
    assert.equal(oscillators.at(-1)!.stopped, true);
    store.dispatch({ type: 'sustain', value: true });
    const voicesBeforePendingTone = oscillators.length;
    const pendingTone = audio.playTone();
    store.dispatch({ type: 'sustain', value: false });
    await pendingTone;
    assert.equal(store.get().tonePlaying, false, 'Turning sustain off cancels pending playback');
    assert.equal(oscillators.length, voicesBeforePendingTone);
    audio.pressToneKey(62); await Promise.resolve();
    assert.equal(store.get().tonePlaying, true, 'Sustain off plays while the key is held');
    audio.releaseToneKey(62);
    assert.equal(store.get().tonePlaying, false, 'Sustain off stops when the key is released');
    audio.pressToneKey(62); await Promise.resolve();
    audio.pressToneKey(64); await Promise.resolve();
    audio.releaseToneKey(62);
    assert.equal(store.get().tonePlaying, true, 'Releasing an older key does not stop the current note');
    audio.releaseToneKey(64);
    assert.equal(store.get().tonePlaying, false);
    audio.pressToneKey(65); await Promise.resolve();
    audio.visibilityChanged(true);
    assert.equal(store.get().tonePlaying, false, 'an unsustained held key is released when hidden');
    audio.visibilityChanged(false);
    audio.pressToneKey(65);
    audio.visibilityChanged(true);
    await Promise.resolve();
    assert.equal(store.get().tonePlaying, false, 'a pending held-key tone cannot get stuck after hiding');
    audio.visibilityChanged(false);
    // Timed Play-button notes retain their normal release, even when hidden.
    await audio.playTone();
    audio.visibilityChanged(true);
    assert.equal(store.get().tonePlaying, true);
    audio.stopAll();
    assert.equal(store.get().tonePlaying, false);
    audio.visibilityChanged(false);
    // Cancel during engine loading, after AudioContext.resume has completed.
    const existingContext = ac!;
    const existingWorklets = worklets.length;
    const canceledStore = createPracticeStore();
    const canceledAudio = createAudioController(canceledStore);
    let finishLoading!: () => void;
    const canceledStart = canceledAudio.startMetronome();
    ac!.audioWorklet.addModule = () => new Promise<void>(resolve => { finishLoading = resolve; });
    await Promise.resolve();
    canceledAudio.stopAll();
    finishLoading();
    await canceledStart;
    assert.equal(canceledStore.get().metronomePlaying, false);
    assert.equal(worklets.length, existingWorklets, 'late module load cannot create a canceled voice');
    canceledAudio.dispose();
    ac = existingContext;
  } finally {
    audio.dispose();
    if (originalRaf) Object.defineProperty(globalThis, 'requestAnimationFrame', originalRaf); else Reflect.deleteProperty(globalThis, 'requestAnimationFrame');
    if (originalCancelRaf) Object.defineProperty(globalThis, 'cancelAnimationFrame', originalCancelRaf); else Reflect.deleteProperty(globalThis, 'cancelAnimationFrame');
    if (originalOffline) Object.defineProperty(globalThis, 'OfflineAudioContext', originalOffline); else Reflect.deleteProperty(globalThis, 'OfflineAudioContext');
    if (originalWorklet) Object.defineProperty(globalThis, 'AudioWorkletNode', originalWorklet); else Reflect.deleteProperty(globalThis, 'AudioWorkletNode');
    if (originalAudio) Object.defineProperty(globalThis, 'AudioContext', originalAudio); else Reflect.deleteProperty(globalThis, 'AudioContext');
    if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator); else Reflect.deleteProperty(globalThis, 'navigator');
  }
});

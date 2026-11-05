import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { createMicrophoneCapture, type MicrophoneState } from '../src/shared/audio/microphone.ts';

function fixture(t: TestContext) {
  let resolve!: (stream: MediaStream) => void;
  let reject!: (error: Error) => void;
  let calls = 0, hz = 0;
  const contexts: FakeContext[] = [];
  const targets: unknown[] = [];
  class FakeContext {
    state = 'running'; sampleRate = 48000; closed = false;
    onstatechange: (() => void) | null = null;
    constructor() { contexts.push(this); }
    async resume() { this.state = 'running'; }
    async close() { this.closed = true; }
    createMediaStreamSource() { return { connect(target: unknown) { targets.push(target); }, disconnect() {} }; }
    createAnalyser() { return { fftSize: 4096, disconnect() {}, getFloatTimeDomainData(data: Float32Array) {
      for (let i = 0; i < data.length; i++) data[i] = hz ? .2 * Math.sin(2 * Math.PI * hz * i / 48000) : 0;
    } }; }
  }
  const originals = ['AudioContext', 'navigator'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
  Object.defineProperty(globalThis, 'AudioContext', { configurable: true, value: FakeContext });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { mediaDevices: { getUserMedia(constraints: MediaStreamConstraints) {
    calls++;
    assert.deepEqual(constraints, { audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }, video: false });
    return new Promise<MediaStream>((done, fail) => { resolve = done; reject = fail; });
  } } } });
  const states: MicrophoneState[] = [];
  const capture = createMicrophoneCapture(state => states.push(state));
  t.after(() => {
    capture.dispose();
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  });
  function grant(complete = resolve) {
    const track = { stopped: false, onended: null as (() => void) | null, stop() { this.stopped = true; } };
    complete({ getTracks: () => [track], getAudioTracks: () => [track] } as unknown as MediaStream);
    return track;
  }
  return { capture, contexts, targets, states, grant,
    pendingGrant: () => { const complete = resolve; return () => grant(complete); },
    state: () => states.at(-1)!, calls: () => calls,
    deny: () => reject(new DOMException('Denied', 'NotAllowedError')),
    frequency: (value: number) => { hz = value; },
  };
}

test('capture starts only on request and emits raw pitch without tuner smoothing or speaker output', async t => {
  const f = fixture(t);
  assert.equal(f.calls(), 0);
  assert.equal(f.contexts.length, 0);
  assert.equal(f.state().micStatus, 'idle');
  f.frequency(440);
  const pending = f.capture.start(); await Promise.resolve();
  await f.capture.start(); assert.equal(f.calls(), 1, 'duplicate start shares the pending request');
  const track = f.grant(); await pending;
  assert.equal(f.state().micStatus, 'listening');
  assert.ok(Math.abs(1200 * Math.log2(f.state().liveHz! / 440)) < 5, 'first frame contains unsmoothed evidence');
  assert.ok(f.state().pitchUpdatedAt > 0);
  assert.equal(f.targets.length, 1, 'only the source-to-analyser connection exists');
  f.capture.stop();
  assert.equal(track.stopped, true);
  assert.equal(track.onended, null);
  assert.equal(f.state().liveHz, null);
  assert.equal(f.state().micStatus, 'idle');
});

test('stop cancels pending permission and releases a late grant without restarting capture', async t => {
  const f = fixture(t);
  const pending = f.capture.start(); await Promise.resolve();
  f.capture.toggle();
  assert.equal(f.state().micStatus, 'idle');
  const track = f.grant(); await pending;
  assert.equal(track.stopped, true);
  assert.equal(f.targets.length, 0);
  assert.equal(f.state().micStatus, 'idle');
});

test('late permission from a cancelled start cannot replace a newer capture', async t => {
  const f = fixture(t);
  const old = f.capture.start(); await Promise.resolve();
  const grantOld = f.pendingGrant();
  f.capture.stop();
  const next = f.capture.start(); await Promise.resolve();
  const track = f.grant(); await next;
  const oldTrack = grantOld(); await old;
  assert.equal(track.stopped, false);
  assert.equal(f.state().micStatus, 'no-signal');
  assert.equal(f.targets.length, 1);
  assert.equal(oldTrack.stopped, true);
});

test('permission denial remains recoverable and disconnected tracks are released', async t => {
  const f = fixture(t);
  const denied = f.capture.start(); await Promise.resolve(); f.deny(); await denied;
  assert.equal(f.state().micStatus, 'error');
  assert.match(f.state().audioError, /permission denied/);
  const retry = f.capture.start(); await Promise.resolve();
  const track = f.grant(); await retry;
  assert.equal(f.state().micStatus, 'no-signal');
  assert.equal(f.state().audioError, '');
  track.onended!();
  assert.equal(track.stopped, true);
  assert.equal(f.state().micStatus, 'error');
  assert.match(f.state().audioError, /disconnected/);
});

test('audio interruption cancels pending permission and requires an explicit restart', async t => {
  const f = fixture(t);
  const pending = f.capture.start(); await Promise.resolve();
  f.contexts[0]!.state = 'suspended'; f.contexts[0]!.onstatechange!();
  const track = f.grant(); await pending;
  assert.equal(track.stopped, true);
  assert.equal(f.state().micStatus, 'interrupted');
  f.contexts[0]!.state = 'running'; f.contexts[0]!.onstatechange!();
  assert.equal(f.calls(), 1);
  assert.equal(f.state().micStatus, 'interrupted');
});

test('disposing cancels late permission, closes the context, and prevents future starts or callbacks', async t => {
  const f = fixture(t);
  const pending = f.capture.start(); await Promise.resolve();
  const count = f.states.length;
  f.capture.dispose();
  const track = f.grant(); await pending; await f.capture.start();
  assert.equal(track.stopped, true);
  assert.equal(f.contexts[0]!.closed, true);
  assert.equal(f.contexts[0]!.onstatechange, null);
  assert.equal(f.calls(), 1);
  assert.equal(f.states.length, count);
});

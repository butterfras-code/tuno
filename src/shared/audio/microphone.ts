import { detectPitch } from './detector.ts';

export type MicrophoneStatus = 'idle' | 'requesting' | 'listening' | 'no-signal' | 'unreliable' | 'error' | 'interrupted';
export type MicrophoneState = Readonly<{
  micStatus: MicrophoneStatus;
  pitchUpdatedAt: number;
  liveHz: number | null;
  audioError: string;
}>;

/** Capture and raw pitch evidence only; callers own answer and display policy. */
export function createMicrophoneCapture(onChange: (state: MicrophoneState) => void) {
  let context: AudioContext | undefined;
  let stream: MediaStream | undefined;
  let source: MediaStreamAudioSourceNode | undefined;
  let analyser: AnalyserNode | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let generation = 0, disposed = false;
  let state: MicrophoneState = { micStatus: 'idle', pitchUpdatedAt: -1, liveHz: null, audioError: '' };
  const buffer = new Float32Array(4096);
  function update(value: Partial<MicrophoneState>) {
    state = { ...state, ...value };
    if (!disposed) onChange(state);
  }
  function stop() {
    generation++;
    clearTimeout(timer);
    source?.disconnect(); analyser?.disconnect();
    source = undefined; analyser = undefined;
    stream?.getTracks().forEach(track => { track.onended = null; track.stop(); });
    stream = undefined;
    update({ micStatus: 'idle', liveHz: null, audioError: '' });
  }
  function analyse() {
    if (!analyser || !context) return;
    analyser.getFloatTimeDomainData(buffer);
    const evidence = detectPitch(buffer, context.sampleRate, 0.005);
    update({ pitchUpdatedAt: performance.now(), liveHz: evidence.frequency,
      micStatus: evidence.rms < 0.005 ? 'no-signal' : evidence.frequency === null ? 'unreliable' : 'listening' });
    if (analyser) timer = setTimeout(analyse, 70);
  }
  async function start() {
    if (disposed || stream || state.micStatus === 'requesting') return;
    const request = ++generation;
    update({ micStatus: 'requesting', liveHz: null, audioError: '' });
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw Error('Microphone access is unavailable in this browser or launch mode.');
      if (!context) {
        context = new AudioContext();
        context.onstatechange = () => {
          if (context?.state !== 'running' && (stream || state.micStatus === 'requesting')) {
            stop();
            update({ micStatus: 'interrupted', audioError: 'Audio interrupted. Start mic to resume.' });
          }
        };
      }
      await context.resume();
      if (request !== generation) return;
      if (context.state !== 'running') throw Error('Audio interrupted. Start mic to resume.');
      const result = await navigator.mediaDevices.getUserMedia({ audio: {
        echoCancellation: false, noiseSuppression: false, autoGainControl: false,
      }, video: false });
      if (request !== generation) { result.getTracks().forEach(track => track.stop()); return; }
      stream = result;
      source = context.createMediaStreamSource(result);
      analyser = context.createAnalyser(); analyser.fftSize = buffer.length;
      source.connect(analyser); // Never route microphone input to speakers.
      result.getAudioTracks().forEach(track => { track.onended = () => {
        stop();
        update({ micStatus: 'error', audioError: 'Microphone disconnected. Reconnect it and start listening again.' });
      }; });
      analyse();
    } catch (error) {
      if (request !== generation) return;
      stop();
      update({ micStatus: 'error', audioError: error instanceof Error && error.name === 'NotAllowedError'
        ? 'Microphone permission denied. Allow access in your browser and try again.'
        : error instanceof Error ? error.message : 'Unable to start microphone.' });
    }
  }
  onChange(state);
  return { start, stop,
    toggle: () => stream || state.micStatus === 'requesting' ? stop() : void start(),
    dispose() {
      if (disposed) return;
      disposed = true;
      stop();
      if (context) { context.onstatechange = null; void context.close(); }
    },
  };
}

// Fixture scenarios require ?testing=1 or a valid ?fixture= link.
/** Execute this expression with T3 preview_evaluate on the built prototype, after one
 * trusted Start click has unlocked audio. Uses synthetic DOM events and real audio
 * clock waiting; verifies lifecycle, never physical latency or timing accuracy. */
(async () => {
  const checks = [];
  const scenario = window.__walkScenario ?? 'keyboard';
  const assert = (value, message) => { if (!value) throw new Error(message); };
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const wait = async predicate => {
    const end = performance.now() + 12000;
    while (!predicate()) { if (performance.now() > end) throw new Error('Browser check timeout'); await sleep(10); }
  };
  const status = () => document.querySelector('.tap-response .status').textContent;
  const button = name => [...document.querySelectorAll('button')].find(b => b.textContent === name);
  const pad = document.querySelector('.tap-response .pad');
  const picker = document.querySelector('.shared-controls select[data-preset]');
  const tempo = document.querySelector('input[type=number]');
  const metro = document.querySelector('.performance-settings input[type=checkbox]');
  const review = document.querySelector('[aria-label="Attempt review"]');
  const choose = id => { picker.value = id; picker.dispatchEvent(new Event('change')); };
  const originalOscillator = AudioContext.prototype.createOscillator;
  let context, scheduled = [];
  AudioContext.prototype.createOscillator = function () {
    context = this;
    const oscillator = originalOscillator.call(this), start = oscillator.start.bind(oscillator);
    oscillator.start = time => { scheduled.push(time); start(time); };
    return oscillator;
  };
  const originalURL = URL.createObjectURL;
  let evidence;
  URL.createObjectURL = blob => { evidence = blob.text().then(JSON.parse); return originalURL(blob); };
  const preventDownload = e => { if (e.target instanceof HTMLAnchorElement && e.target.download) e.preventDefault(); };
  document.addEventListener('click', preventDownload, true);
  const raw = async () => { button('Download timing evidence').click(); return evidence; };
  const key = (action, repeat = false) => {
    const e = new KeyboardEvent(action, { code: 'Space', key: ' ', repeat, bubbles: true, cancelable: true });
    pad.dispatchEvent(e); assert(e.defaultPrevented, 'Space must prevent scrolling while active');
  };
  const begin = async () => {
    scheduled = [];
    document.querySelector('.tap-response .pad').click(); await wait(() => status().startsWith('Count-in'));
    assert(picker.disabled && tempo.disabled && metro.disabled, 'settings locked');
    assert(document.activeElement === pad, 'pad focused');
    assert(document.querySelectorAll('.passage .notation').length === 2, 'notation remains visible');
    await wait(() => context.currentTime >= scheduled[0] + .01);
    return scheduled[0] + 4 * 60 / Number(tempo.value);
  };
  const audioWait = async time => wait(() => context.currentTime >= time);
  try {
    await wait(() => !picker.disabled);
    const play = document.querySelector('[data-setting="how-to-play"]');
    play.value = 'hold'; play.dispatchEvent(new Event('change'));
    if (scenario === 'keyboard') {
    choose('quarters'); tempo.value = '180'; metro.checked = true;
    const exerciseStart = await begin();
    assert(scheduled.length === 12, 'one count-in measure and two exercise measures');
    assert(Math.abs(scheduled[1] - scheduled[0] - 1 / 3) < 1e-9, 'audio clicks scheduled at quarter tempo');
    key('keydown'); key('keydown', true); await sleep(30); key('keyup');
    for (let i = 0; i < 8; i++) {
      await audioWait(exerciseStart + i / 3); key('keydown');
      await audioWait(exerciseStart + (i + 1) / 3 - .025); key('keyup');
    }
    await wait(() => status() === 'Reviewing');
    assert(review.innerText.includes('8 matched attacks · 0 missing · 0 extra'), 'playable complete keyboard loop');
    assert(document.querySelectorAll('[data-feedback=matched]').length === 8, 'feedback linked to written notes');
    const record = await raw();
    assert(record.status === 'completed' && record.bpm === 180 && record.clock.exerciseStart > 0, 'raw snapshot and clock evidence');
    assert(record.events.some(e => e.reason === 'keyboard repeat'), 'repeat retained but ignored');
    assert(record.events.filter(e => e.region === 'count-in' && e.accepted).length === 2, 'count-in evidence separate');
    checks.push('keyboard loop, count-in, scheduled clicks, repeat suppression, linked review, raw evidence');
    const saved = review.innerText; tempo.value = '120'; metro.checked = false;
    assert(review.innerText === saved, 'settings editing preserves review');
    document.querySelector('.tap-response .pad').click(); await wait(() => status().startsWith('Count-in'));
    button('Stop').click(); await wait(() => status() === 'Interrupted');
    assert(review.innerText.includes('Stopped by learner') && !review.innerText.includes('matched attacks'), 'cancel not graded');
    checks.push('preserved result and explicit retry/cancel');
    }
    if (scenario === 'tie') {
    choose('tie'); assert(!review.innerText && status() === 'Ready', 'deliberate exercise change clears review');
    assert(document.querySelectorAll('[data-tie]').length === 1, 'tie across barline visible');
    tempo.value = '180'; metro.checked = false;
    const tieStart = await begin(); assert(scheduled.length === 4, 'count-in audible with exercise metronome off');
    for (const [start, end] of [[0, 2 / 3], [1, 5 / 3], [2, 8 / 3]]) {
      await audioWait(tieStart + start); key('keydown'); await audioWait(tieStart + end - .025); key('keyup');
    }
    await wait(() => status() === 'Reviewing');
    assert(review.innerText.includes('3 matched attacks · 0 missing · 0 extra') && review.innerText.includes('tied chain'), 'tied-chain review');
    assert(document.querySelectorAll('[data-feedback=matched]').length === 4, 'one tie result linked to both written members');
    checks.push('exercise choice, metronome toggle, tied-chain performance and review');
    }
    if (scenario === 'boundary') {
    choose('quarters'); tempo.value = '180'; const crossStart = await begin(); key('keydown'); await audioWait(crossStart + .05); key('keydown', true); key('keyup');
    await audioWait(crossStart + 7 / 3); key('keydown'); // final input deliberately stuck
    await wait(() => status() === 'Reviewing'); const cross = await raw();
    assert(cross.endedAt === cross.plan.captureEnd && review.innerText.includes('no release observed'), 'finite final capture');
    assert(review.innerText.includes('measure 1, note 1: missing attack'), 'count-in hold creates no attack');
    checks.push('held count-in boundary and bounded unreleased final input');
    }
    if (scenario === 'interruptions') {
    choose('quarters'); tempo.value = '180';
    await begin(); window.dispatchEvent(new Event('blur')); await wait(() => status() === 'Interrupted');
    assert((await raw()).reason === 'Window lost focus', 'window blur interrupted');
    await begin(); document.querySelector('.response-controls select').focus(); await wait(() => status() === 'Interrupted');
    assert((await raw()).reason === 'Performance pad lost focus', 'pad focus loss interrupted');
    await begin(); await context.suspend(); await wait(() => status() === 'Interrupted'); await context.resume();
    assert((await raw()).reason === 'Audio clock interrupted', 'audio suspension interrupted');
    await begin(); window.dispatchEvent(new Event('pagehide'));
    await wait(() => status() === 'Interrupted'); assert((await raw()).reason === 'Page left', 'pagehide interruption');
    checks.push('pad/window focus loss, audio suspension, synthetic pagehide interruption');
    // Synthetic pointers have no browser-owned capture; stub only that browser primitive.
    const originalCapture = pad.setPointerCapture; pad.setPointerCapture = () => {};
    await begin();
    const pointer = (type, id) => pad.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', button: 0, bubbles: true, cancelable: true }));
    pointer('pointerdown', 1); pointer('pointerdown', 2); pointer('pointerup', 2); pointer('pointercancel', 1);
    pad.setPointerCapture = originalCapture;
    await wait(() => status() === 'Interrupted'); const cancelled = await raw();
    assert(cancelled.reason === 'Pointer cancelled', 'active pointer cancellation interrupts');
    assert(cancelled.events.filter(e => e.accepted && e.action === 'down').length === 1, 'multiple pointers monophonic');
    checks.push('synthetic touch ownership, duplicate pointers, cancellation');
    }
    return { scenario, passed: checks, evidence: 'Synthetic browser interaction; no physical-device timing claim' };
  } finally {
    AudioContext.prototype.createOscillator = originalOscillator; URL.createObjectURL = originalURL;
    document.removeEventListener('click', preventDownload, true);
  }
})()

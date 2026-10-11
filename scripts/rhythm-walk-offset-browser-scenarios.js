/** Run with native preview_evaluate after trusted audio activation.
 * For manual calibration, start this expression without awaiting, then await
 * window.__offsetCheck in a later call (the calibration lasts about 12 seconds).
 */
window.__offsetCheck = (async () => {
  const scenario = window.__offsetScenario ?? 'automatic';
  const assert = (value, message) => { if (!value) throw new Error(message); };
  const button = name => [...document.querySelectorAll('button')].find(b => b.textContent === name);
  const panel = document.querySelector('[aria-label="Timing setup"]');
  const review = document.querySelector('[aria-label="Attempt review"]');
  const status = () => document.querySelector('[role="status"]').textContent;
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const wait = async predicate => { const until = performance.now() + 15000; while (!predicate()) { if (performance.now() > until) throw new Error('Timed out: ' + scenario); await sleep(5); } };
  const original = AudioContext.prototype.createOscillator;
  const originalURL = URL.createObjectURL;
  let context, scheduled = [], evidence;
  AudioContext.prototype.createOscillator = function () { context = this; const o = original.call(this), start = o.start.bind(o); o.start = time => { scheduled.push(time); start(time); }; return o; };
  URL.createObjectURL = blob => { evidence = blob.text().then(JSON.parse); return originalURL(blob); };
  const prevent = e => { if (e.target instanceof HTMLAnchorElement && e.target.download) e.preventDefault(); };
  document.addEventListener('click', prevent, true);
  const raw = async () => { button('Download timing evidence').click(); return evidence; };
  const key = (pad, action) => {
    if (scenario === 'manual-pointer') {
      // Synthetic IDs cannot acquire native pointer capture; hardware capture is a separate check.
      pad.setPointerCapture = () => {};
      return pad.dispatchEvent(new PointerEvent(action === 'keydown' ? 'pointerdown' : 'pointerup', { pointerId: 77, pointerType: 'touch', button: 0, bubbles: true, cancelable: true }));
    }
    return pad.dispatchEvent(new KeyboardEvent(action, { key: ' ', code: 'Space', bubbles: true, cancelable: true }));
  };
  try {
    if (scenario === 'automatic' || scenario === 'reuse') {
      if (scenario === 'automatic') button('Reset timing').click();
      const before = JSON.parse(sessionStorage.getItem('tuno.rhythm-walk.timing.v1'));
      const picker = document.querySelector('.setup select'); picker.value = 'quarters'; picker.dispatchEvent(new Event('change'));
      document.querySelector('input[type=number]').value = '80';
      button('Start count-in').click(); await wait(() => status().startsWith('Count-in'));
      const start = scheduled[0] + 3, pad = button('Performance pad');
      const delay = scenario === 'automatic' ? .25 : .32;
      for (let i = 0; i < 8; i++) {
        await wait(() => context.currentTime >= start + i * .75 + delay); key(pad, 'keydown');
        await wait(() => context.currentTime >= start + i * .75 + delay + .6); key(pad, 'keyup');
      }
      await wait(() => status() === 'Reviewing');
      const record = await raw();
      assert(review.innerText.includes('8 matched attacks · 0 missing · 0 extra'), 'corrected matching');
      assert(review.innerText.includes('Raw timing before correction'), 'raw review remains available');
      assert(record.events.find(e => e.action === 'down' && e.accepted).time > .2, 'raw timestamps retained');
      assert(Math.abs(record.timingOffset.seconds - .25) < .025, 'estimated session correction');
      assert(panel.innerText.includes('Saved for this session'), 'session status');
      if (scenario === 'reuse') assert(record.timingOffset.seconds === before.seconds, 'later performance never recenters saved correction');
      return { passed: scenario, correction: record.timingOffset };
    }
    if (scenario === 'manual' || scenario === 'manual-pointer') {
      const input = panel.querySelector('select'); input.value = scenario === 'manual-pointer' ? 'pointer' : 'keyboard';
      button('Tap-along calibration').click(); await wait(() => scheduled.length === 16);
      const pad = button('Calibration pad');
      assert(document.querySelector('.setup select').disabled, 'practice is locked during calibration');
      for (let i = 4; i < 16; i++) {
        await wait(() => context.currentTime >= scheduled[i] + .2); key(pad, 'keydown'); await sleep(30); key(pad, 'keyup');
      }
      await wait(() => pad.hidden);
      const saved = JSON.parse(sessionStorage.getItem('tuno.rhythm-walk.timing.v1'));
      assert(saved.input === input.value && saved.method === 'tap' && Math.abs(saved.seconds - .2) < .025, 'manual result saved');
      assert(!button('Start count-in').disabled, 'practice unlocked');
      return { passed: scenario, correction: saved };
    }
    if (scenario === 'cancel') {
      const before = sessionStorage.getItem('tuno.rhythm-walk.timing.v1');
      button('Tap-along calibration').click(); await wait(() => scheduled.length === 16);
      button('Cancel calibration').click();
      assert(sessionStorage.getItem('tuno.rhythm-walk.timing.v1') === before, 'cancel preserves saved correction');
      assert(button('Calibration pad').hidden && !button('Start count-in').disabled, 'cancel restores controls');
      return { passed: scenario };
    }
    throw new Error('Unknown scenario');
  } finally { AudioContext.prototype.createOscillator = original; URL.createObjectURL = originalURL; document.removeEventListener('click', prevent, true); }
})();
window.__offsetCheck

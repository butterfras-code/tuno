/** Native T3 preview_evaluate expression, after a trusted Start click unlocks audio.
 * Runs in a normal document or a same-origin 320px preview iframe. Inputs are
 * synthetic; hardware latency and native touch capture remain device checks. */
window.__rhythmActivityCheck = (async () => {
  const checks = [];
  const assert = (condition, label) => { if (!condition) throw new Error(label); };
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const wait = async condition => { const limit = performance.now() + 15000; while (!condition()) { if (performance.now() > limit) throw new Error('Timed out'); await sleep(5); } };
  const button = name => [...document.querySelectorAll('button')].find(n => n.textContent === name);
  const field = name => [...document.querySelectorAll('label')].find(n => n.querySelector('.field-label')?.textContent === name)?.querySelector('select, input');
  const choose = (name, value) => { const input = field(name); input.value = value; input.dispatchEvent(new Event('change')); };
  const mode = value => choose('Mode', value);
  const id = () => document.querySelector('.passage').dataset.exerciseId;
  const notes = () => [...document.querySelectorAll('.notation g[data-event]')];
  const notation = () => notes().map(n => [n.dataset.start, n.dataset.duration, n.dataset.kind, n.dataset.value, n.dataset.dots, n.dataset.tieNext]);
  const answer = () => [...document.querySelectorAll('.count-slot')].map(n => n.textContent);
  const feedback = () => document.querySelector('.write-response').innerText;
  const review = () => document.querySelector('[aria-label="Attempt review"]').innerText;
  const status = () => document.querySelector('.tap-response .status').textContent;
  const key = (target, type, key, code = key) => target.dispatchEvent(new KeyboardEvent(type, { key, code, bubbles: true, cancelable: true }));
  const originalOsc = AudioContext.prototype.createOscillator, originalURL = URL.createObjectURL;
  let context, scheduled = [], stopped = 0, evidence;
  AudioContext.prototype.createOscillator = function () {
    context = this; const node = originalOsc.call(this), start = node.start.bind(node), stop = node.stop.bind(node);
    node.start = time => { scheduled.push(time); start(time); }; node.stop = time => { if (time === undefined) stopped++; stop(time); }; return node;
  };
  URL.createObjectURL = blob => { evidence = blob.text().then(JSON.parse); return originalURL(blob); };
  const preventDownload = e => { if (e.target instanceof HTMLAnchorElement && e.target.download) e.preventDefault(); };
  document.addEventListener('click', preventDownload, true);
  const raw = async () => { button('Download timing evidence').click(); return evidence; };
  const begin = async () => { scheduled = []; button('Start count-in').click(); await wait(() => status().startsWith('Count-in')); return scheduled[0] + 2 / 3; };
  try {
    if (!button('Start count-in').disabled) { /* ready */ } else button('Stop / Cancel').click();
    mode('write'); choose('Exercise preset', 'six-eighths');
    const visibility = field('Show written counts during performance'); visibility.checked = false; visibility.dispatchEvent(new Event('change'));
    const identity = id(), glyphs = notes(), written = notation();
    for (let i = 0; i < 6; i++) { const slot = document.querySelectorAll('.count-slot')[i]; slot.focus(); key(slot, 'keydown', String(i + 1)); }
    button('Check').click();
    assert([...document.querySelectorAll('.dimension')].every(n => n.classList.contains('correct')), 'six written counts evaluate correctly');
    const symbols = answer(), countFeedback = feedback();
    for (const response of ['tap', 'both', 'write']) {
      mode(response);
      assert(id() === identity && JSON.stringify(notation()) === JSON.stringify(written), 'mode preserves exercise and notation');
      assert(notes().every((node, i) => node === glyphs[i]), 'one actual score implementation');
      assert(JSON.stringify(answer()) === JSON.stringify(symbols), 'mode preserves written answer');
      if (response === 'tap') assert(document.querySelector('.write-response').hidden && [...document.querySelectorAll('.answer-area')].every(n => n.hidden), 'writing feedback and overlays hidden in Tap');
    }
    assert(feedback() === countFeedback, 'return restores count evaluation');
    choose('Exercise length', '4'); assert(id() === identity, 'pending configuration preserves exercise');
    checks.push('same exercise, score nodes, pending settings, written answers and feedback across every mode');
    mode('tap'); field('Tempo (dotted-quarter BPM)').value = '180';
    field('Estimate offset automatically from a consistent performance').checked = false;
    button('Reset timing').click();
    await begin(); const stopBefore = stopped; mode('write');
    assert(status() === 'Interrupted' && (await raw()).status === 'interrupted' && stopped > stopBefore, 'switch during count-in cancels capture and scheduled audio');
    mode('tap'); const started = await begin(); await wait(() => context.currentTime >= started + .05); mode('both');
    assert((await raw()).status === 'interrupted', 'switch during recording cancels safely');
    const pad = button('Performance pad'), oldPointerCapture = pad.setPointerCapture; pad.setPointerCapture = () => {};
    const start = await begin();
    for (let i = 0; i < 6; i++) {
      await wait(() => context.currentTime >= start + i / 9 + .02);
      pad.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 73, pointerType: 'touch', button: 0, bubbles: true, cancelable: true }));
      await wait(() => context.currentTime >= start + (i + 1) / 9 - .015);
      pad.dispatchEvent(new PointerEvent('pointerup', { pointerId: 73, pointerType: 'touch', button: 0, bubbles: true, cancelable: true }));
    }
    pad.setPointerCapture = oldPointerCapture;
    await wait(() => status() === 'Reviewing');
    const completed = await raw(), performed = review();
    assert(completed.status === 'completed' && completed.exercise.id === identity, 'performance uses identical canonical exercise identity');
    assert(completed.plan.pulses.filter(p => !p.countIn).length === 2 && completed.plan.notes.length === 6, '6/8 pulses stay separate from written counts');
    assert(performed.includes('6 matched attacks · 0 missing · 0 extra'), 'synthetic touch performance evaluates');
    const timelines = [...document.querySelectorAll('.timing-timeline')];
    assert(timelines.flatMap(n => [...n.querySelectorAll('text')]).map(n => n.textContent).join() === 'Expected,Received', 'one label for each exercise timeline');
    assert(timelines.every((n, i) => [...n.querySelectorAll('.timeline-rail')].every(rail => rail.getAttribute('x1') === (i === 0 ? '104' : '0') && rail.getAttribute('x2') === '800')), 'continuous timelines after the shared labels');
    assert(timelines.length === completed.exercise.measures.length, 'each score segment has the two feedback timelines');
    assert(timelines.reduce((sum, n) => sum + n.querySelectorAll('.timeline-hit').length, 0) === 12, 'six expected and six received hits');
    timelines.forEach(n => { const score = n.closest('.passage-measure').querySelector('.notation'); assert(Math.abs(n.getBoundingClientRect().width - score.getBoundingClientRect().width) < .1 && Math.abs(n.getBoundingClientRect().left - score.getBoundingClientRect().left) < .1, 'feedback timelines exactly align with notation'); });
    const bounds = n => n.getBoundingClientRect();
    assert(bounds(pad).top >= bounds(document.querySelector('.passage-scroll')).bottom, 'pad follows notation');
    mode('both'); assert([...document.querySelectorAll('.answer-area')].every(n => bounds(n).bottom <= bounds(pad).top), 'counts above pad in Both');
    button('Calibrate').focus(); button('Calibrate').click();
    const modal = document.querySelector('.timing-dialog'); assert(modal.open, 'Calibrate opens timing modal');
    button('Tap-along calibration').click(); await sleep(100);
    button('Close timing setup').click();
    assert(!modal.open && !document.querySelector('.tap-response').classList.contains('calibrating') && !field('Exercise preset').disabled, 'closing modal cancels calibration and unlocks exercise');
    checks.push('score-aligned expected/received timelines, count/pad ordering, modal calibration cancellation');
    mode('write'); assert(feedback() === countFeedback && answer().join() === symbols.join(), 'performance preserves written response');
    mode('tap'); assert(review() === performed, 'return restores completed tapping review');
    checks.push('6/8 touch capture, count-in/recording cancellation, audio stop and independent response/result retention');
    mode('both'); await begin(); assert([...document.querySelectorAll('.answer-area')].every(n => n.hidden), 'Both hides written counts during performance by default'); button('Stop / Cancel').click();
    const show = field('Show written counts during performance'); show.checked = true; show.dispatchEvent(new Event('change'));
    await begin(); assert([...document.querySelectorAll('.answer-area')].every(n => !n.hidden && n.inert), 'Both explicitly shows read-only counts'); button('Stop / Cancel').click();
    button('Next exercise').click();
    assert(id() !== identity && document.querySelectorAll('.passage-measure').length === 4, 'Next uses pending shared configuration exactly once');
    assert(answer().every(s => s === '·') && !review() && !document.querySelectorAll('.dimension').length, 'Next clears both old responses and results');
    for (const response of ['write', 'tap', 'both']) {
      mode(response);
      assert(document.documentElement.scrollWidth <= innerWidth, 'no document overflow in ' + response);
      const score = document.querySelector('.passage-scroll');
      assert(score.scrollWidth <= score.clientWidth, 'no score scrolling in ' + response);
      if (response === 'tap' && innerWidth <= 540) assert(bounds(pad).bottom - bounds(score).top <= 480, 'four stacked measures and pad fit in mobile performance area');
    }
    checks.push('optional visible counts, one Next lifecycle, both responses cleared, all-mode layout at ' + innerWidth + 'px');
    mode('tap'); document.querySelector('.tap-response input[type=number]').value = '180';
    await begin();
    const performanceScroll = scrollY, systems = [...document.querySelectorAll('.passage-measure')].map(n => bounds(n).top);
    if (innerWidth <= 540) assert(bounds(pad).bottom <= innerHeight && bounds(document.querySelector('.passage-scroll')).top >= 0, 'all four measures and pad visible during mobile count-in');
    await sleep(1500);
    assert(scrollY === performanceScroll && systems.every((top, index) => Math.abs(top - bounds(document.querySelectorAll('.passage-measure')[index]).top) < 1), 'systems and viewport stay still through count-in into recording');
    button('Stop / Cancel').click();
    checks.push('four-measure performance keeps score/pad in view without playback jumps');
    const originalResume = AudioContext.prototype.resume;
    let resolveResume;
    AudioContext.prototype.resume = () => new Promise(resolve => { resolveResume = resolve; });
    try {
      button('Start count-in').click(); mode('write');
      const interrupted = await raw(); assert(interrupted.status === 'interrupted', 'cancel pending audio activation immediately');
      resolveResume(); await sleep(50);
      assert(status() === 'Interrupted' && !button('Start count-in').disabled, 'late audio activation cannot restart a canceled attempt');
      assert((await raw()).exercise.id === interrupted.exercise.id, 'pending cancellation preserves its exercise evidence');
      checks.push('mode switch during pending audio activation rejects the stale asynchronous start');
    } finally { AudioContext.prototype.resume = originalResume; }

    mode('tap'); choose('Exercise preset', 'quarters');
    scheduled = []; button('Start count-in').click(); await wait(() => status().startsWith('Count-in'));
    const quarterStart = scheduled[0] + 4 / 3;
    for (let i = 0; i < 8; i++) {
      await wait(() => context.currentTime >= quarterStart + i / 3 + (i === 0 ? .02 : -.021));
      key(pad, 'keydown', ' ', 'Space');
      await wait(() => context.currentTime >= quarterStart + (i + 1) / 3 - .06);
      key(pad, 'keyup', ' ', 'Space');
    }
    await wait(() => status() === 'Reviewing');
    const barlineRows = [...document.querySelectorAll('.timing-timeline')];
    const rowHits = n => [...n.querySelectorAll('.timeline-hit')].filter(hit => hit.getAttribute('y1') === '40');
    assert(barlineRows.length === 2 && barlineRows.every(n => rowHits(n).length === 4), 'slightly early barline attack stays with its matched measure');
    const earlyX = Number(rowHits(barlineRows[1])[0].getAttribute('x1'));
    assert(earlyX > 110 && earlyX < 128, '21 ms early barline attack sits just before the expected note, across no engraving gap');
    checks.push('early barline hit renders beside its expected attack with proportional timing displacement');

    return { passed: checks, width: innerWidth, evidence: 'Synthetic input with real AudioContext; no physical-device timing claim' };
  } finally {
    AudioContext.prototype.createOscillator = originalOsc; URL.createObjectURL = originalURL; document.removeEventListener('click', preventDownload, true);
  }
})();

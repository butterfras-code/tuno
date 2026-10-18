// Fixture scenarios require ?testing=1 or a valid ?fixture= link.
/** Native T3 preview_evaluate expression. Set window.__playScenario to tap,
 * hold, compound, geometry, evidence, rest-boundary, barline or lifecycle.
 * For rest-boundary, set __boundaryStyle to tap or hold.
 * Await window.__playCheck separately
 * if the preview tool's per-call deadline is shorter than the audio exercise.
 * Inputs are synthetic; pointer capture is stubbed only for invented IDs. */
window.__playCheck = (async () => {
  const scenario = window.__playScenario ?? 'tap';
  const checks = [];
  const assert = (condition, label) => { if (!condition) throw new Error(label); };
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const wait = async condition => { const limit = performance.now() + 12000; while (!condition()) { if (performance.now() > limit) throw new Error('Timeout: ' + scenario); await sleep(5); } };
  const pad = document.querySelector('.pad');
  const review = document.querySelector('[aria-label="Attempt review"]');
  const status = () => document.querySelector('.tap-response .status').textContent;
  const button = name => [...document.querySelectorAll('button')].find(n => n.textContent === name || n.getAttribute('aria-label') === name);
  const play = document.querySelector('[data-setting="how-to-play"]');
  const mode = document.querySelector('select[aria-label="Mode"]');
  const preset = document.querySelector('[data-preset]');
  const tempo = document.querySelector('.score-tempo input');
  const choose = (control, value) => { control.value = value; control.dispatchEvent(new Event('change')); };
  const id = () => document.querySelector('.passage').dataset.exerciseId;
  const answer = () => [...document.querySelectorAll('.count-slot')].map(n => n.textContent).join();
  const bounds = () => [...document.querySelectorAll('.notation,.pad')].map(n => { const r = n.getBoundingClientRect(); return [r.top + scrollY, r.left, r.width, r.height]; });
  const originalOsc = AudioContext.prototype.createOscillator, originalURL = URL.createObjectURL, originalCapture = pad.setPointerCapture;
  let context, scheduled = [], evidence, stopCalls = 0;
  AudioContext.prototype.createOscillator = function () {
    context = this; const node = originalOsc.call(this), start = node.start.bind(node), stop = node.stop.bind(node);
    node.start = time => { scheduled.push(time); start(time); }; node.stop = time => { if (time === undefined) stopCalls++; stop(time); }; return node;
  };
  URL.createObjectURL = blob => { evidence = blob.text().then(JSON.parse); return originalURL(blob); };
  const prevent = e => { if (e.target instanceof HTMLAnchorElement && e.target.download) e.preventDefault(); };
  document.addEventListener('click', prevent, true);
  const raw = async () => { button('Download timing evidence').click(); return evidence; };
  const begin = async () => {
    scheduled = []; (document.querySelector('.performance-results button') ?? pad).click(); await wait(() => status().startsWith('Count-in'));
    assert(play.disabled && tempo.disabled && preset.disabled, 'capture locks performance settings');
    const count = document.querySelectorAll('.count-in-dot').length;
    return scheduled[0] + count * 60 / Number(tempo.value);
  };
  const input = (down, pointer = false) => {
    const event = pointer ? new PointerEvent(down ? 'pointerdown' : 'pointerup', { pointerId: 71, pointerType: 'touch', button: 0, bubbles: true, cancelable: true })
      : new KeyboardEvent(down ? 'keydown' : 'keyup', { code: 'Space', key: ' ', bubbles: true, cancelable: true });
    pad.dispatchEvent(event); assert(event.defaultPrevented || pointer && !down, 'active input does not scroll');
  };
  try {
    choose(mode, 'both'); choose(tempo, '180');
    button('Reset timing').click();
    const automatic = document.querySelector('.calibration input[type=checkbox]'); automatic.checked = false;
    if (scenario === 'lifecycle') {
      choose(preset, 'six-eighths');
      const slot = document.querySelector('.count-slot'); slot.focus(); slot.dispatchEvent(new KeyboardEvent('keydown', { key: '1', bubbles: true }));
      const exercise = id(), written = answer(), glyphs = [...document.querySelectorAll('.notation')];
      const pending = JSON.stringify(JSON.parse(localStorage.getItem('tuno.rhythm-walk.preferences.v1')).generation);
      choose(play, 'hold');
      assert(id() === exercise && answer() === written && glyphs.every((n, i) => n === document.querySelectorAll('.notation')[i]), 'play setting preserves exercise, score nodes and written answer');
      assert(JSON.stringify(JSON.parse(localStorage.getItem('tuno.rhythm-walk.preferences.v1')).generation) === pending, 'play setting preserves configuration');
      assert(JSON.parse(localStorage.getItem('tuno.rhythm-walk.preferences.v1')).playStyle === 'hold', 'selection persisted');
      const start = await begin(), stoppedBefore = stopCalls;
      choose(mode, 'write'); const canceled = await raw();
      assert(canceled.status === 'interrupted' && canceled.playStyle === 'hold' && stopCalls > stoppedBefore, 'mode switch cancels count-in and retains settings evidence');
      choose(mode, 'tap'); choose(play, 'tap'); await begin();
      await wait(() => status().startsWith('Performing')); choose(mode, 'both');
      assert((await raw()).status === 'interrupted', 'mode switch cancels capture');
      assert(id() === exercise && answer() === written, 'cancellation preserves written response');
      await begin(); button('Stop').click(); assert((await raw()).playStyle === 'tap', 'retry uses current selection');
      assert(!play.disabled, 'selection unlocked after cancellation');
      checks.push('settings persistence, exercise/configuration/answer retention, mode cancellation, stopped audio, retry snapshot');
    } else if (scenario === 'rest-boundary' || scenario === 'barline') {
      choose(preset, scenario === 'rest-boundary' ? 'tie-rests' : 'quarters');
      choose(play, scenario === 'barline' ? 'hold' : window.__boundaryStyle ?? 'hold');
      const start = await begin();
      // Controlled synthetic timestamps test the rendered policy near boundaries;
      // the real audio clock still governs completion. This is not device timing.
      const stamp = relative => {
        const event = new KeyboardEvent(relative.action === 'down' ? 'keydown' : 'keyup', { code: 'Space', key: ' ', bubbles: true, cancelable: true });
        Object.defineProperty(event, 'timeStamp', { value: performance.now() + (start + relative.time - context.currentTime) * 1000 });
        pad.dispatchEvent(event);
      };
      await wait(() => context.currentTime >= start + .1);
      const intervals = scenario === 'barline' ? [[4/3-.03,5/3-.015]] : [[1/3-.03,2/3-.015],[1-.03,4/3-.015]];
      for (const [down, up] of intervals) { stamp({action:'down',time:down}); stamp({action:'up',time:up}); }
      await wait(() => status() === 'Reviewing');
      const record = await raw();
      if (scenario === 'rest-boundary') {
        assert(review.innerText.includes('2 matched attacks · 0 missing · 0 extra'), 'post-rest attacks match');
        assert(!review.innerText.includes('outside tolerance') && !review.innerText.includes('needs attention'), 'accepted post-rest attack has no contradictory rest grading');
        const rests = [...document.querySelectorAll('.notation g[data-kind=rest]')];
        assert(rests.every(n=>n.dataset.feedback==='silent'), 'rest score feedback accepts early attacks');
        assert(record.events.some(e=>e.accepted && e.action==='down' && e.time<1/3), 'raw early attack retained');
        checks.push('accepted early post-rest attacks retain raw evidence with consistent '+record.playStyle+' review');
      } else {
        const rows = [...document.querySelectorAll('.timing-timeline')];
        const bar = rows[1].querySelector('.timeline-sustain[y1="48"]');
        const hit = [...rows[1].querySelectorAll('.timeline-hit')].find(n=>n.getAttribute('y1')==='40');
        assert(!rows[0].querySelector('.timeline-sustain[y1="48"]'), 'no stray early barline sustain in preceding measure');
        assert(bar.getAttribute('x1')===hit.getAttribute('x1'), 'received attack and sustain share the same start');
        assert(Number(bar.getAttribute('x1'))<128, 'early displacement remains visible');
        checks.push('matched early barline attack joins its sustain without a preceding segment');
      }
    } else if (scenario === 'evidence') {
      choose(preset, 'tie'); choose(play, 'hold'); pad.setPointerCapture = () => {};
      const start = await begin();
      await wait(() => context.currentTime >= start + .75); input(true, true);
      await wait(() => context.currentTime >= start + 1.4); input(false, true);
      await wait(() => context.currentTime >= start + 2.01); input(true, true);
      await wait(() => status() === 'Reviewing');
      const record = await raw(), rows = [...document.querySelectorAll('.timing-timeline')];
      const extras = [...document.querySelectorAll('.timeline-sustain[data-feedback=extra]')];
      assert(extras.length === 2 && rows[1].querySelectorAll('.timeline-hit').length === 2, 'unmatched input spans two measures without a continuation attack');
      assert(record.events.filter(e => e.accepted).length === 3 && record.events.at(-1).action === 'down', 'incomplete input has no fabricated release');
      assert(document.querySelectorAll('.timeline-sustain.incomplete').length === 1, 'incomplete interval visibly dashed');
      assert(rows[1].getAttribute('aria-label').includes('Incomplete hold: no release observed'), 'incomplete evidence accessible without color');
      assert(review.innerText.includes('no release observed'), 'review and incomplete timeline agree');
      checks.push('unmatched cross-bar duration, wrapped continuation without attack, bounded incomplete evidence and accessible explanation');
    } else {
      const compound = scenario === 'compound' || scenario === 'geometry';
      choose(preset, compound ? scenario === 'geometry' ? 'six-bar-tie' : 'six-eighths' : 'quarters');
      choose(play, scenario === 'tap' ? 'tap' : 'hold');
      const identity = id(); const start = await begin();
      const countBounds = bounds();
      await wait(() => context.currentTime >= start + .01);
      assert(JSON.stringify(bounds()) === JSON.stringify(countBounds), 'score/pad geometry stationary through count-in');
      const pointer = scenario === 'hold' || compound;
      if (pointer) pad.setPointerCapture = () => {};
      const intervals = compound ? scenario === 'geometry' ? [[0,1/3],[1/3,1],[1,4/3]] : Array.from({ length: 6 }, (_, i) => [i/9, (i+1)/9]) : Array.from({ length: 8 }, (_, i) => [i/3,(i+1)/3]);
      for (const [onset, end] of intervals) {
        await wait(() => context.currentTime >= start + onset + .01); input(true, pointer);
        await wait(() => context.currentTime >= start + (scenario === 'tap' ? onset + .03 : end - .015)); input(false, pointer);
      }
      await wait(() => status() === 'Reviewing');
      const record = await raw(), interpretation = review.textContent;
      assert(record.playStyle === (scenario === 'tap' ? 'tap' : 'hold') && record.evaluationPolicy.attackTolerance === .08, 'attempt snapshots play style and evaluation policy');
      assert(review.innerText.includes(`${intervals.length} matched attacks · 0 missing · 0 extra`), 'keyboard/pointer attacks matched');
      const bars = [...document.querySelectorAll('.timeline-sustain')];
      assert(scenario === 'tap' ? bars.length === 0 && review.innerText.includes('Releases are not graded') : bars.length >= intervals.length * 2, 'Tap has markers only; Hold has expected and actual bars');
      if (compound) {
        assert(record.plan.pulseSeconds === 1/3 && record.plan.notes.length === intervals.length, 'compound performance pulse independent from written counts');
        assert(document.querySelectorAll('.count-slot').length === record.exercise.measures.length * 6, 'six written counts per bar');
      }
      if (scenario === 'geometry') {
        const rows = [...document.querySelectorAll('.timing-timeline')];
        assert(rows.length === 2 && rows[1].querySelectorAll('.timeline-hit').length === 2, 'tied continuation adds no attack at wrapped barline');
        assert(rows[0].getBoundingClientRect().top < rows[1].getBoundingClientRect().top || innerWidth > 540, 'narrow systems wrap');
        assert(rows.every(row => row.querySelectorAll('.timeline-sustain').length === 4), 'continuous tied hold split on each measure');
      }
      choose(play, scenario === 'tap' ? 'hold' : 'tap');
      assert(id() === identity && review.textContent === interpretation, 'preference edit preserves completed interpretation');
      assert((await raw()).playStyle === record.playStyle, 'download keeps original setting');
      for (const response of ['write','tap','both']) { choose(mode, response); assert(id() === identity && review.textContent === interpretation, 'mode switch preserves review'); }
      await begin(); button('Stop').click(); const retry = await raw();
      assert(retry.playStyle !== record.playStyle, 'retry uses changed play style');
      checks.push(`${scenario}: ${pointer ? 'synthetic pointer' : 'keyboard'} input, timeline durations, snapshots, completed-result retention and retry`);
    }
    assert(document.documentElement.scrollWidth <= innerWidth, 'no horizontal overflow');
    checks.push(`responsive layout ${innerWidth}px; synthetic input, no physical timing claim`);
    return { scenario, passed: checks };
  } finally {
    AudioContext.prototype.createOscillator = originalOsc; URL.createObjectURL = originalURL; pad.setPointerCapture = originalCapture; document.removeEventListener('click', prevent, true);
  }
})();
window.__playCheck

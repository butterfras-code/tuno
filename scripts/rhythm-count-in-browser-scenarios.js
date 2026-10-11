/** Run in native T3 preview after a trusted Start click unlocks audio.
 * Also run in a same-origin 320px iframe with its Start button activated. */
window.__rhythmCountInCheck = (async () => {
  const assert = (condition, label) => { if (!condition) throw new Error(label); };
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const button = name => [...document.querySelectorAll('button')].find(n => n.textContent === name);
  const choose = (name, value) => { const input = [...document.querySelectorAll('label')].find(n => n.querySelector('.field-label')?.textContent === name).querySelector('select'); input.value = value; input.dispatchEvent(new Event('change')); };
  const original = AudioContext.prototype.createOscillator;
  let context, clicks = [];
  AudioContext.prototype.createOscillator = function () { context = this; const node = original.call(this), start = node.start.bind(node); node.start = time => { clicks.push(time); start(time); }; return node; };
  const checks = [];
  try {
    if (button('Start count-in').disabled) button('Stop / Cancel').click();
    document.querySelectorAll('[data-ingredient]').forEach(input => { input.checked = ['quarter', 'eighth'].includes(input.dataset.ingredient); input.dispatchEvent(new Event('change')); });
    choose('Mode', 'tap'); choose('Exercise preset', 'generated'); choose('Exercise length', '4');
    for (const [meter, numbers] of [['2/4', '1212'], ['3/4', '123123'], ['4/4', '1234'], ['6/8', '1212']]) {
      document.querySelectorAll('[data-meter]').forEach(input => { input.checked = input.dataset.meter === meter; input.dispatchEvent(new Event('change')); }); button('Next exercise').click();
      const display = document.querySelector('.count-in-display');
      assert([...display.querySelectorAll('.count-in-dot')].map(n => n.textContent).join('') === numbers, `${meter}: correct count-in bars and numbers`);
      assert([...display.querySelectorAll('.count-in-cue')].map(n => n.textContent).join(' ') .trim() === 'Ready Go', `${meter}: final Ready and Go`);
      assert(display.getBoundingClientRect().bottom <= document.querySelector('.passage-scroll').getBoundingClientRect().top, 'count-in above first measure');
      const tempo = document.querySelector('.tap-response input[type=number]'); tempo.value = '180';
      clicks = []; button('Start count-in').click();
      const limit = performance.now() + 5000;
      while (!clicks.length) { assert(performance.now() < limit, 'audio activation'); await sleep(5); }
      const tops = [...document.querySelectorAll('.passage-measure')].map(n => n.getBoundingClientRect().top), scroll = scrollY;
      const beats = [...display.children], seen = new Set();
      while (context.currentTime < clicks[0] + numbers.length / 3 + .06) {
        const active = beats.findIndex(n => n.classList.contains('lit'));
        const elapsed = context.currentTime - clicks[0];
        const expected = elapsed >= 0 && elapsed < numbers.length / 3 ? Math.floor(elapsed * 3) : -1;
        // UI polls the audio clock every 20ms; skip transition margins.
        const phase = elapsed * 3 - Math.floor(elapsed * 3);
        if (phase > .12 && phase < .8) assert(active === expected, `${meter}: dot synced to scheduled click (${active}/${expected})`);
        if (active >= 0) seen.add(active);
        await sleep(10);
      }
      assert(seen.size === numbers.length, `${meter}: every dot pulses`);
      assert(beats.every(n => !n.classList.contains('lit')), 'lights clear when performance starts');
      assert(scrollY === scroll && tops.every((top, i) => Math.abs(top - document.querySelectorAll('.passage-measure')[i].getBoundingClientRect().top) < 1), 'count-in keeps systems and viewport stable');
      if (innerWidth <= 540) assert(display.getBoundingClientRect().top >= 0 && button('Performance pad').getBoundingClientRect().bottom <= innerHeight, 'four measures, count-in and pad fit mobile viewport');
      button('Stop / Cancel').click();
      button('Start count-in').click(); await sleep(180); button('Stop / Cancel').click();
      assert(!display.querySelector('.lit, [aria-current]'), 'cancel clears count-in');
      choose('Mode', 'write'); assert(display.hidden, 'Write Counts hides count-in');
      choose('Mode', 'both'); assert(!display.hidden, 'Both shows count-in'); choose('Mode', 'tap');
      checks.push(`${meter}: dots, Ready/Go, audio sync, cancellation, stable layout and mode visibility`);
    }
    return checks;
  } finally { AudioContext.prototype.createOscillator = original; if (button('Start count-in').disabled) button('Stop / Cancel').click(); }
})();

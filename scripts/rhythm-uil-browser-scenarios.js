// Fixture scenarios require ?testing=1 or a valid ?fixture= link.
/** Evaluate in the native T3 preview after loading the current bundle.
 * Pass an iframe's contentWindow when inspecting an inline fresh build.
 * Native click first to unlock audio. Capture is real-clock, with no synthetic taps.
 */
window.runUilBrowserScenarios = async function (w = window) {
  const d = w.document, checks = [];
  const assert = (value, label) => { if (!value) throw new Error(label); checks.push(label); };
  const sleep = ms => new Promise(resolve => w.setTimeout(resolve, ms));
  const wait = async predicate => { const end = Date.now() + 12000; while (!predicate()) { if (Date.now() > end) throw new Error('Browser wait timed out'); await sleep(20); } };
  const choose = (control, value) => { if (control.tagName === 'FIELDSET') { control.querySelector(`input[value="${value}"]`).click(); return; } control.value = value; control.dispatchEvent(new w.Event('change')); };
  const button = name => [...d.querySelectorAll('button')].find(control => control.textContent === name);
  const stored = () => JSON.parse(w.localStorage.getItem('tuno.rhythm-walk.preferences.v1'));
  const generation = () => stored().generation;
  const mode = d.querySelector('.response-controls select');
  choose(mode, 'both'); choose(d.querySelector('[data-preset]'), 'half'); choose(d.querySelector('[data-preset]'), 'whole');
  choose(d.querySelector('.score-tempo input'), '180');
  choose(d.querySelector('[data-setting="count-system"]'), 'syllables');
  choose(d.querySelector('[data-setting="how-to-play"]'), 'hold');
  const whole = d.querySelector('g[data-value="whole"]');
  assert(whole && whole.querySelector('ellipse') && !whole.querySelector('line'), 'whole head is hollow and stemless');
  assert(whole.querySelector('ellipse').getAttribute('fill') === 'var(--color-surface)', 'whole head is hollow');
  const slot = d.querySelector('.count-slot:not([hidden])'); slot.focus();
  slot.dispatchEvent(new w.KeyboardEvent('keydown', { key: '1', bubbles: true, cancelable: true }));
  assert(slot.textContent === '1', 'whole-note writing accepts beat 1');
  d.querySelector('.pad').click();
  await wait(() => ['Reviewing', 'Interrupted'].includes(d.querySelector('.tap-response .status').textContent));
  const attemptStatus = d.querySelector('.tap-response .status').textContent;
  const results = d.querySelector('.performance-results'), resultText = results.textContent;
  assert(resultText.length > 0, 'real-clock attempt exposes retained review or interruption evidence');
  const exerciseId = d.querySelector('.passage').dataset.exerciseId;
  const score = d.querySelector('.notation');
  const controlsBefore = stored();
  choose(d.querySelector('[data-setting="exercise-length"]'), '3');
  const picker = d.querySelector('[data-setting="teaching-preset"]');
  const apply = d.querySelector('[data-setting="apply-teaching-preset"]');
  assert(picker.options.length === 11, 'four Uno and six UIL levels are inspectable');
  for (const id of ['uil-3', 'uil-4', 'uil-5', 'uil-6']) {
    const before = JSON.stringify(generation()); choose(picker, id);
    assert(apply.disabled, `${id} application blocked`); apply.click();
    assert(JSON.stringify(generation()) === before, `${id} leaves pending settings intact`);
    assert(d.querySelector('.passage').dataset.exerciseId === exerciseId && slot.textContent === '1' && results.textContent === resultText, `${id} preserves both responses`);
  }
  for (const id of ['uil-1', 'uil-2']) {
    choose(picker, id); assert(!apply.disabled, `${id} note-only practice available`);
    assert(generation().teachingPreset.id === id && !generation().teachingPreset.customized, `${id} pending attribution`);
    assert(generation().measures === 3, `${id} preserves chosen passage length`);
    assert(d.querySelector('.notation') === score && d.querySelector('.passage').dataset.exerciseId === exerciseId, `${id} preserves current score identity`);
    assert(slot.textContent === '1' && results.textContent === resultText, `${id} preserves both responses`);
    const after = stored();
    assert(JSON.stringify({ ...after, generation: controlsBefore.generation }) === JSON.stringify(controlsBefore), `${id} preserves independent preferences`);
  }
  const six = d.querySelector('[data-meter="6/8"]'); six.checked = true; six.dispatchEvent(new w.Event('change'));
  assert(generation().meters.includes('6/8') && generation().teachingPreset.customized && !generation().restrictions, 'independent 6/8 override customizes and removes template hooks');
  assert(!button('New exercise').disabled, 'custom meter pool validates');
  choose(picker, 'uil-1'); apply.click();
  assert(generation().meters.join(',') === '4/4' && !generation().teachingPreset.customized, 'deliberate reapplication restores controlled fields');
  const ingredient = d.querySelector('[data-ingredient="sixteenth"]'); ingredient.checked = true; ingredient.dispatchEvent(new w.Event('change'));
  assert(generation().teachingPreset.customized && !generation().restrictions, 'ingredient override retains customized source');
  apply.click(); assert(!ingredient.checked && generation().restrictions.pairedEighths, 'reapplication resynchronizes ingredient controls');
  choose(d.querySelector('[data-setting="exercise-length"]'), '2');
  assert(!generation().teachingPreset.customized, 'length is independent of template attribution');
  for (const response of ['tap', 'write', 'both']) {
    choose(mode, response);
    assert(d.querySelector('.notation') === score && d.querySelector('.passage').dataset.exerciseId === exerciseId, `${response} uses identical current score`);
    assert(slot.textContent === '1' && results.textContent === resultText, `${response} retains both responses after preset application`);
  }
  button('New exercise').click();
  assert(d.querySelector('.passage').dataset.exerciseId !== exerciseId, 'Next replaces exercise identity');
  assert(d.querySelectorAll('.passage-measure').length === 2, 'Next uses pending passage length');
  assert([...d.querySelectorAll('.count-slot:not([hidden])')].every(s => s.textContent === '·'), 'Next clears writing');
  assert(!['Reviewing', 'Interrupted'].includes(d.querySelector('.tap-response .status').textContent), 'Next clears performance review');
  assert([...d.querySelectorAll('.notation')].every(n => n.getAttribute('aria-label').startsWith('4/4')), 'Next uses one suggested meter throughout');
  w.location.hash = '#settings'; await sleep(30);
  for (const id of ['uil-1', 'uil-6']) {
    choose(picker, id);
    const details = picker.closest('.level-configuration')?.querySelector('details') ?? d.querySelector('.shared-exercise-settings details');
    details.open = true; await sleep(30);
    assert(d.documentElement.scrollWidth <= w.innerWidth + 1, `${w.innerWidth}px ${id} source details have no page overflow`);
    const box = picker.getBoundingClientRect();
    assert(box.width > 100 && box.right <= w.innerWidth + 1, `${w.innerWidth}px teaching selector fits`);
    assert(apply.getBoundingClientRect().height >= 43, `${w.innerWidth}px Apply keeps touch size`);
    details.open = false;
  }
  return { passed: checks.length, width: w.innerWidth, attemptStatus, checks };
};

/** Fresh-document persistence/migration checks for the inline review frame. */
window.runUilPreferenceBrowserScenarios = async function (frame) {
  const key = 'tuno.rhythm-walk.preferences.v1';
  const saved = localStorage.getItem(key), checks = [];
  const assert = (value, label) => { if (!value) throw new Error(label); checks.push(label); };
  const reload = () => new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('fresh iframe load timed out')), 4000);
    frame.addEventListener('load', () => { clearTimeout(timeout); resolve(); }, { once: true });
    frame.srcdoc = frame.srcdoc;
  });
  try {
    const expected = JSON.parse(saved);
    await reload();
    let d = frame.contentDocument, w = frame.contentWindow;
    const field = d.querySelector('[data-setting="teaching-preset"]').closest('.level-configuration');
    assert(field.textContent.includes('UIL I · note-only practice · next exercise'), 'fresh load restores qualified exact attribution');
    assert(d.querySelector('[data-setting="exercise-length"] input:checked').value === String(expected.generation.measures), 'fresh load restores chosen length');
    assert(d.querySelector('[data-ingredient="whole"]').checked && d.querySelector('[data-ingredient="dotted-half"]').checked, 'fresh load restores whole/dotted-half selections');
    assert(d.querySelector('[data-setting="count-system"]').value === expected.countingSystem && d.querySelector('.response-controls select').value === expected.mode, 'fresh load restores independent mode/system');
    assert(d.querySelector('.score-tempo input').value === String(expected.bpm), 'fresh load restores tempo');
    assert([...d.querySelectorAll('.count-slot:not([hidden])')].every(slot => slot.textContent === '·'), 'fresh load does not persist writing responses');
    localStorage.setItem(key, JSON.stringify({ ...expected, generation: { ...expected.generation, teachingPreset: { id: 'uil-unknown', version: 1, customized: false }, restrictions: { pairedEighths: 'yes', noQuarterRestBeatOne: true } } }));
    await reload(); d = frame.contentDocument; w = frame.contentWindow;
    assert(d.querySelector('[data-setting="teaching-preset"]').closest('.level-configuration').textContent.includes('Custom · pending settings.'), 'malformed attribution safely migrates to free practice');
    const length = d.querySelector('[data-setting="exercise-length"] input:checked'); length.dispatchEvent(new w.Event('change'));
    const restored = JSON.parse(localStorage.getItem(key));
    assert(!restored.generation.teachingPreset && !restored.generation.restrictions, 'malformed restrictions and attribution never reach persisted active settings');
    assert(restored.bpm === expected.bpm && restored.mode === expected.mode && restored.countingSystem === expected.countingSystem, 'migration preserves independent preferences');
    assert(JSON.stringify(restored.generation.ingredients) === JSON.stringify(expected.generation.ingredients), 'migration preserves valid ingredient selections');
    return { passed: checks.length, checks };
  } finally { localStorage.setItem(key, saved); await reload(); }
};

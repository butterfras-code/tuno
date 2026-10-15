/** Run with T3 preview_evaluate on an ordinary learner URL. No fixture opt-in.
 * Covers generation configuration, reload migration and testing links with fresh
 * same-origin documents; response-mode switches never replace the live score.
 */
window.runLevelBrowserScenarios = async function (w = window, loadFresh) {
  const { document, localStorage, Event, location, innerWidth } = w;
  const checks = [], key = 'tuno.rhythm-walk.preferences.v1';
  const assert = (ok, label) => { if (!ok) throw Error(label); checks.push(label); };
  const stored = () => JSON.parse(localStorage.getItem(key));
  const choose = (control, value) => { if (control.tagName === 'FIELDSET') { control.querySelector(`input[value="${value}"]`).click(); return; } control.value = value; control.dispatchEvent(new Event('change')); };
  const level = document.querySelector('[data-setting="teaching-preset"]');
  const length = document.querySelector('[data-setting="exercise-length"]');
  const mode = document.querySelector('.response-controls select');
  const next = [...document.querySelectorAll('.setup-actions button')][0];
  assert(!document.querySelector('[data-preset]'), 'ordinary visits have no fixture selector');
  assert([...level.options].every(o => o.value !== 'generated'), 'generated practice is not a level option');
  for (const measures of [1, 2, 3, 4]) {
    choose(length, String(measures));
    const score = document.querySelector('.notation'), id = document.querySelector('.passage').dataset.exerciseId;
    const independent = stored();
    choose(level, 'uil-1');
    assert(stored().generation.measures === measures, `UIL application preserves ${measures} measures`);
    assert(JSON.stringify({ ...stored(), generation: independent.generation }) === JSON.stringify(independent), 'level preserves independent preferences');
    assert(document.querySelector('.notation') === score && document.querySelector('.passage').dataset.exerciseId === id, 'level keeps current score until replacement');
    const ingredient = document.querySelector('[data-ingredient="sixteenth"]'); ingredient.checked = true; ingredient.dispatchEvent(new Event('change'));
    assert(stored().generation.teachingPreset.id === 'uil-1' && stored().generation.teachingPreset.customized && level.selectedOptions[0].textContent.includes('customized'), 'musical customization retains visible source level');
    const pending = JSON.stringify(stored().generation);
    for (const response of ['tap', 'both', 'write']) {
      choose(mode, response);
      assert(document.querySelector('.notation') === score && JSON.stringify(stored().generation) === pending, `${response} retains score and pending configuration`);
    }
    next.click();
    assert(document.querySelectorAll('.notation').length === measures && document.querySelector('.passage').dataset.exerciseId !== id, 'New exercise generates the pending length');
  }
  choose(level, 'uil-2');
  const exact = JSON.stringify(stored().generation);
  const tempo = document.querySelector('.score-tempo input'); choose(tempo, '123');
  choose(document.querySelector('[data-setting="count-system"]'), 'syllables');
  choose(document.querySelector('[data-setting="how-to-play"]'), 'hold');
  assert(JSON.stringify(stored().generation) === exact, 'tempo, counting system and Tap + Hold do not customize or reset level');
  const expected = stored();
  const frame = document.createElement('iframe'); frame.hidden = true; document.body.append(frame);
  const fresh = async search => {
    if (loadFresh) return loadFresh(search);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error('Fresh document timed out')), 5000);
      frame.onload = () => { clearTimeout(timer); resolve(); };
      frame.src = location.pathname + search;
    });
    return frame.contentDocument;
  };
  try {
    let d = await fresh('');
    assert(d.querySelector('[data-setting="teaching-preset"]').value === 'uil-2', 'level persists across fresh load');
    assert(JSON.stringify(stored().generation) === JSON.stringify(expected.generation), 'fresh load preserves exact generation configuration');
    assert([...d.querySelectorAll('.count-slot:not([hidden])')].every(s => s.textContent === '·'), 'responses reset on reload');
    localStorage.setItem(key, JSON.stringify({ ...expected, preset: 'whole' }));
    d = await fresh('');
    assert(!d.querySelector('[data-preset]') && !d.querySelector('.exercise-summary').textContent.includes('Testing fixture'), 'saved fixture never enables testing on ordinary reload');
    assert(stored().preset === 'generated' && stored().generation.teachingPreset.id === 'uil-2', 'fixture migration preserves level configuration');
    d = await fresh('?fixture=whole');
    assert(d.querySelector('[data-preset]').value === 'whole' && d.querySelector('g[data-value="whole"]') && d.querySelector('.exercise-summary').textContent.includes('Testing fixture'), 'explicit fixture link retains ID, score and testing identification');
    d = await fresh('?testing=1');
    assert(d.querySelector('[data-preset]') && d.querySelector('.testing-fixtures').textContent.includes('Developer / testing'), 'explicit testing access exposes fixture catalogue');
    localStorage.setItem(key, JSON.stringify({ ...expected, generation: { ...expected.generation, teachingPreset: undefined, restrictions: undefined }, preset: 'whole' }));
    d = await fresh('');
    assert(d.querySelector('[data-setting="teaching-preset"]').value === '' && !stored().generation.teachingPreset, 'free-form migration stays Custom without invented level');
  } finally { frame.remove(); localStorage.setItem(key, JSON.stringify(expected)); }
  return { passed: checks.length, width: innerWidth, checks };
};

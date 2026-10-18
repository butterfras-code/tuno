/** Native T3 preview scenario. Supports an inline local bundle via w/loadFresh. */
window.runUnoBrowserScenarios = async function (w = window, loadFresh) {
  const d = w.document, checks = [], key = 'tuno.rhythm-walk.preferences.v1';
  const assert = (ok, name) => { if (!ok) throw Error(name); checks.push(name); };
  const choose = (control, value) => { if (control.tagName === 'FIELDSET') { control.querySelector(`input[value="${value}"]`).click(); return; } control.value = value; control.dispatchEvent(new w.Event('change')); };
  const stored = () => JSON.parse(w.localStorage.getItem(key));
  const picker = d.querySelector('[data-setting="teaching-preset"]');
  const mode = d.querySelector('select[aria-label="Mode"]');
  const next = d.querySelector('.setup-actions button');
  choose(mode, 'write');
  choose(d.querySelector('[data-setting="exercise-length"]'), '3');
  assert([...picker.options].slice(1, 5).map(o => o.textContent).join(',') === 'Uno1,Uno2,Uno3,Uno4', 'Uno levels precede qualified UIL levels');
  for (const [index, id] of ['uno-1', 'uno-2', 'uno-3', 'uno-4'].entries()) {
    const score = d.querySelector('.notation'), exercise = d.querySelector('.passage').dataset.exerciseId;
    const slot = d.querySelector('.count-slot:not([hidden])');
    slot.focus(); slot.dispatchEvent(new w.KeyboardEvent('keydown', { key: '1', bubbles: true, cancelable: true }));
    const answer = slot.textContent;
    const independent = stored();
    choose(picker, id);
    const settings = stored().generation;
    assert(settings.teachingPreset.id === id && !settings.teachingPreset.customized, `${id} applies exact pending identity`);
    assert(settings.measures === 3 && JSON.stringify({ ...stored(), generation: independent.generation }) === JSON.stringify(independent), `${id} preserves independent preferences`);
    assert(d.querySelector('.notation') === score && d.querySelector('.passage').dataset.exerciseId === exercise && slot.textContent === answer, `${id} preserves score and writing`);
    const details = picker.closest('.level-configuration').querySelector('details'); details.open = true;
    assert(details.textContent.includes('Uno practice configuration') && !details.textContent.includes('Official criteria'), `${id} identifies its own practice configuration`);
    assert(d.documentElement.scrollWidth <= w.innerWidth + 1 && picker.getBoundingClientRect().right <= w.innerWidth + 1, `${id} selector and details fit ${w.innerWidth}px`);
    details.open = false;
    next.click();
    assert(d.querySelector('.exercise-summary').textContent.includes(`Uno${index + 1}`) && !d.querySelector('.exercise-summary').textContent.includes('note-only'), `${id} current exercise has accurate attribution`);
    assert(d.querySelectorAll('.notation').length === 3 && d.querySelector('.passage').dataset.exerciseId !== exercise, `${id} generates chosen length`);
    for (const response of ['tap', 'both', 'write']) {
      const identity = d.querySelector('.passage').dataset.exerciseId;
      choose(mode, response);
      assert(d.querySelector('.passage').dataset.exerciseId === identity && stored().generation.teachingPreset.id === id, `${id} ${response} retains shared state`);
    }
    const toggle = d.querySelector('[data-setting="ties"]'); toggle.checked = !toggle.checked; toggle.dispatchEvent(new w.Event('change'));
    assert(picker.selectedOptions[0].textContent === `Uno${index + 1} · customized`, `${id} retains visible customized attribution`);
    choose(picker, id);
    if (loadFresh) {
      const fresh = await loadFresh();
      assert(fresh.querySelector('[data-setting="teaching-preset"]').value === id && fresh.querySelector('.exercise-summary').textContent.includes(`Uno${index + 1}`), `${id} restores after fresh load`);
    }
  }
  const before = JSON.stringify(stored().generation);
  choose(picker, 'uil-6');
  assert(d.querySelector('[data-setting="apply-teaching-preset"]').disabled && JSON.stringify(stored().generation) === before, 'Uno availability does not unblock UIL VI');
  choose(picker, 'uno-4');
  return { passed: checks.length, width: w.innerWidth, checks };
};

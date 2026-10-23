/** Run through the native preview in a normal document or a narrow same-origin frame. */
window.runCustomizeBrowserScenarios = function (w = window) {
  const d = w.document, checks = [];
  const assert = (condition, name) => { if (!condition) throw Error(name); checks.push(name); };
  const dialog = d.querySelector('#custom-exercise');
  const modalLevel = dialog.querySelector('[data-setting="teaching-preset"]');
  const headerLevel = d.querySelector('.level-configuration select');
  const choose = (control, value) => { control.value = value; control.dispatchEvent(new w.Event('change')); };
  if (!dialog.open) dialog.showModal();
  const score = d.querySelector('.notation'), identity = d.querySelector('.passage').dataset.exerciseId;
  const generation = () => JSON.parse(w.localStorage.getItem('tuno.rhythm-walk.preferences.v1')).generation;
  assert(d.querySelector('[data-setting="exercise-length"] legend').textContent === 'Measures', 'length states its unit');
  for (const level of ['uno-1', 'uno-2', 'uno-3', 'uno-4']) {
    choose(modalLevel, level);
    assert(headerLevel.value === level, `${level} synchronizes both Level selectors`);
    const settings = generation();
    assert([...dialog.querySelectorAll('[data-ingredient]')].every(i => i.checked === settings.ingredients.includes(i.dataset.ingredient)), `${level} applies ingredient toggles`);
    assert([...dialog.querySelectorAll('[data-meter]')].every(i => i.checked === settings.meters.includes(i.dataset.meter)), `${level} applies meter toggles`);
  }
  choose(headerLevel, 'uno-2');
  assert(modalLevel.value === 'uno-2', 'header Level updates Customize');
  for (const id of ['whole', 'half', 'dotted-half']) {
    const input = dialog.querySelector(`[data-ingredient="${id}"]`);
    for (const checked of [false, true]) {
      if (input.checked !== checked) input.click();
      const head = input.parentElement.querySelector('[data-hollow="true"]');
      const headStyle = w.getComputedStyle(head), toggleStyle = w.getComputedStyle(input.parentElement);
      assert(headStyle.fill === toggleStyle.backgroundColor && headStyle.fill !== headStyle.stroke, `${id} stays hollow when ${checked ? 'selected' : 'unselected'}`);
    }
  }
  assert(headerLevel.selectedOptions[0].textContent === modalLevel.selectedOptions[0].textContent, 'customized attribution stays synchronized');
  const meter = dialog.querySelector('[data-meter="4/4"]');
  assert(w.getComputedStyle(meter.parentElement, '::after').content.includes('✓'), 'multiple-choice selection has a check mark');
  const length = dialog.querySelector('[data-setting="exercise-length"] input[value="3"]');
  length.click();
  assert(dialog.querySelectorAll('[name="exercise-length"]:checked').length === 1 && generation().measures === 3, 'length selects exactly one saved value');
  assert(w.getComputedStyle(length.parentElement, '::after').content === 'none', 'single-choice selection has no multiple-choice mark');
  const rows = [...dialog.querySelectorAll('.ingredient-value-row')];
  assert(rows.map(r => r.dataset.value).join() === 'W,H,Q,E,S', 'variants share rows in descending base value');
  assert(rows.every(r => r.children[0].getBoundingClientRect().top === r.children[1].getBoundingClientRect().top), 'notes and rests align in every row');
  assert([...dialog.querySelectorAll('.segmented-option')].every(e => { const r = e.getBoundingClientRect(); return r.width >= 44 && r.height >= 44; }), 'every toggle retains a 44px touch target');
  assert(dialog.scrollWidth <= dialog.clientWidth && rows.every(r => r.scrollWidth <= r.clientWidth + 1), `no horizontal overflow at ${w.innerWidth}px`);
  assert(d.querySelector('.notation') === score && d.querySelector('.passage').dataset.exerciseId === identity, 'customization keeps the exact current score');
  const meters = [...dialog.querySelectorAll('[data-meter]')];
  const selected = meters.map(i => i.checked);
  meters.forEach(i => { if (i.checked) i.click(); });
  const issue = dialog.querySelector('.shared-exercise-settings > [role="status"]');
  assert(!issue.hidden && issue.textContent.includes('Select at least one time signature'), 'invalid settings retain their explanation');
  meters.forEach((input, index) => { if (input.checked !== selected[index]) input.click(); });
  assert(issue.hidden && !issue.textContent, 'valid settings have no instructional filler');
  choose(modalLevel, 'uno-2');
  dialog.querySelector('[data-setting="exercise-length"] input[value="2"]').click();
  return { passed: checks.length, width: w.innerWidth, checks };
};

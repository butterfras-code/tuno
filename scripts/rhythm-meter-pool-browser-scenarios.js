/** Run with native T3 preview_evaluate in the page or a same-origin 320px frame. */
window.__rhythmMeterPoolCheck = (() => {
  const assert = (condition, label) => { if (!condition) throw new Error(label); };
  const button = name => [...document.querySelectorAll('button')].find(n => n.textContent === name);
  const input = meter => document.querySelector(`[data-meter="${meter}"]`);
  const check = (control, checked) => { control.checked = checked; control.dispatchEvent(new Event('change')); };
  const choose = (name, value) => { const control = [...document.querySelectorAll('label')].find(n => n.querySelector('.field-label')?.textContent === name).querySelector('select'); control.value = value; control.dispatchEvent(new Event('change')); };
  const prefs = () => JSON.parse(localStorage.getItem('tuno.rhythm-walk.preferences.v1'));
  const id = () => document.querySelector('.passage').dataset.exerciseId;
  const originalRandom = Math.random;
  try {
    choose('Mode', 'tap'); choose('Exercise preset', 'generated'); choose('Exercise length', '4');
    const identity = id(), glyphs = [...document.querySelectorAll('.notation')].map(n => n.outerHTML);
    document.querySelectorAll('[data-meter]').forEach(control => check(control, false));
    assert(button('Next exercise').disabled, 'empty meter pool blocks Next with a useful message');
    document.querySelectorAll('[data-ingredient]').forEach(control => check(control, control.dataset.ingredient === 'half'));
    check(input('3/4'), true);
    assert(document.querySelector('[data-ingredient="quarter"]').checked, 'enabling simple meter enables quarter notes');
    check(document.querySelector('[data-ingredient="quarter"]'), false);
    check(input('6/8'), true);
    assert(document.querySelector('[data-ingredient="eighth"]').checked, 'enabling 6/8 enables eighth notes');
    check(input('2/4'), true); check(input('4/4'), true);
    assert(document.querySelector('[data-ingredient="half"]').checked, 'other selected ingredients retained');
    check(document.querySelector('[data-ingredient="dotted-quarter-rest"]'), true);
    check(document.querySelector('[data-setting="unintuitive-notation"]'), false);
    assert(!button('Next exercise').disabled, 'incompatible selected ingredients do not block any enabled meter');
    assert(id() === identity && JSON.stringify([...document.querySelectorAll('.notation')].map(n => n.outerHTML)) === JSON.stringify(glyphs), 'pending meter pool preserves current score and identity');
    const pool = prefs().generation.meters;
    assert(pool.length === 4, 'every enabled meter persisted');
    for (let i = 0; i < pool.length; i++) {
      Math.random = () => (i + .5) / pool.length;
      button('Next exercise').click();
      const bars = [...document.querySelectorAll('.notation')];
      assert(bars.length === 4 && bars.every(bar => bar.getAttribute('aria-label').startsWith(pool[i])), 'each exercise uses exactly one selected meter');
      if (pool[i] === '6/8') assert(bars.every(bar => !bar.querySelector('[data-value="H"]')), 'half notes retained in settings but skipped in 6/8');
      else assert(bars.every(bar => !bar.querySelector('[data-kind="rest"][data-dots="1"]')), 'simple-meter dotted rests skipped without notation opt-in');
      for (const mode of ['both', 'write', 'tap']) { const exercise = id(); choose('Mode', mode); assert(id() === exercise, 'response mode preserves selected-meter exercise'); }
      assert(document.documentElement.scrollWidth <= innerWidth, 'meter pool controls and score fit narrow viewport');
    }
    return { width: innerWidth, passed: ['multiple meter selection, required ingredients, incompatible selections skipped', 'pending settings preserve exercise; one selected meter per entire exercise', 'shared meter pool persisted; all response modes and no viewport overflow'] };
  } finally { Math.random = originalRandom; }
})();

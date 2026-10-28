import assert from 'node:assert/strict';

/** Exercise UIL selection through the current chooser, including pending edits. */
export async function uilScenarios(page) {
  const dialog = page.getByRole('dialog', { name: 'Choose rhythms', exact: true });
  const button = (root, name) => root.getByRole('button', { name, exact: true });
  const open = () => button(page, 'Choose rhythms').click();
  const use = () => button(dialog, 'Use preset').click();
  const generation = () => page.evaluate(() => JSON.parse(localStorage.getItem('tuno.rhythm-walk.preferences.v1')).generation);
  const music = () => page.locator('.passage').getAttribute('data-exercise-id');
  await open();
  await dialog.getByRole('tab', { name: 'Uno’s Choice', exact: true }).click();
  assert.equal(await dialog.locator('.rhythm-preset-card').count(), 5);
  await dialog.getByRole('tab', { name: 'UIL Sight Reading', exact: true }).click();
  assert.equal(await dialog.locator('.rhythm-preset-card').count(), 4);
  await dialog.getByRole('tab', { name: 'Custom', exact: true }).click();
  assert.equal(await dialog.locator('[data-setting="meter-changes"], [data-meter="2/2"]').count(), 0);
  await button(dialog, 'Cancel').click();
  let combinations = 0;
  for (const [level, label] of [[1, 'I'], [2, 'II'], [3, 'III'], [4, 'IV']]) {
    for (const scope of ['general', 'percussion']) for (const length of [1, 2, 3, 4]) {
      const before = await music();
      const slot = page.locator('.count-slot').first();
      await slot.focus(); await page.keyboard.press('1');
      await open();
      await dialog.getByRole('tab', { name: 'Custom', exact: true }).click();
      await dialog.locator(`[data-setting="exercise-length"] input[value="${length}"]`).check();
      await dialog.getByRole('tab', { name: 'UIL Sight Reading', exact: true }).click();
      await dialog.getByRole('combobox', { name: 'UIL instrument scope', exact: true }).selectOption(scope);
      await button(dialog, `UIL ${label}`).click();
      assert.equal(await music(), before, 'Draft changes retain score');
      assert.equal(await slot.textContent(), '1', 'Draft changes retain answer');
      await use();
      assert.notEqual(await music(), before, 'Applying a changed preset generates immediately');
      assert.equal(await slot.textContent(), '·', 'Applying a changed preset clears answers');
      const saved = await generation();
      assert.equal(saved.teachingPreset.id, `uil-${level}`);
      assert.equal(saved.teachingPreset.scope, scope);
      assert.equal(saved.teachingPreset.version, 4);
      assert.ok(saved.ingredients.includes('quarter-rest'));
      assert.equal(saved.ingredients.includes('eighth-rest'), level >= 3);
      assert.equal(saved.teachingPreset.customized, false, 'Length is independent of preset identity');
      await button(page, 'Next Exercise').click();
      assert.equal(await page.locator('.passage .notation').count(), length);
      const score = await music();
      await slot.focus(); await page.keyboard.press('1');
      for (const panel of ['Perform', 'Counts']) {
        await button(page, panel).click();
        assert.equal(await music(), score, 'Panel retains typed score');
        assert.equal(await slot.textContent(), '1', 'Panel retains answer');
      }
      combinations++;
    }
  }
  return { combinations };
}

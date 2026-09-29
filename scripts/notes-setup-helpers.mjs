import { presets } from '../src/apps/tunotes/domain/presets.ts';
export async function choosePreset(page,id) {
  await notesMode(page,'Practice');
  await page.locator('#preset').click();
  const dialog = page.getByRole('dialog');
  if (id === 'custom') { await dialog.getByRole('button',{name:'＋ Create custom',exact:true}).click(); return; }
  const preset = presets.find(p => p.id === id);
  if (!preset) throw new Error(`Unknown built-in preset ${id}`);
  await dialog.getByRole('button',{name:preset.instrument ? 'Instrument' : 'Clef',exact:true}).click();
  if (preset.instrument) await dialog.getByRole('button',{name:preset.name.split(' — ')[0],exact:true}).click();
  else await dialog.getByRole('button',{name:preset.clef[0].toUpperCase()+preset.clef.slice(1),exact:true}).click();
  await dialog.locator(`[data-preset-id="${id}"]`).click();
}
export async function customTab(page,name) {
  if (!await page.locator('.custom-editor:visible').count()) await page.getByRole('button',{name:'Adjust range',exact:true}).click();
  await page.getByRole('tab',{name,exact:true}).click();
}
export async function endpointTab(page,label) {
  await customTab(page,'Range');
  const selector = page.getByRole('button',{name:`Edit ${label.toLowerCase()}`,exact:true});
  if (await selector.isVisible()) await selector.click();
}
export async function setKey(page,value) {
  await customTab(page,'Options');
  await page.getByRole('group',{name:'Key signature',exact:true}).getByRole('button',{name:'On',exact:true}).click();
  await page.getByLabel('Major key',{exact:true}).selectOption(value);
}
export async function useRange(page) { await page.getByRole('button',{name:'Use range',exact:true}).click(); }
export async function saveCustom(page,name) {
  await page.getByRole('button',{name:'Save as preset…',exact:true}).click();
  await page.getByLabel('Custom preset name',{exact:true}).fill(name);
  await page.getByRole('button',{name:'Save preset',exact:true}).click();
}
export async function setEndpoint(page,label,pitch) {
  await endpointTab(page,label);
  const [,letter,accidental,octave] = /^([A-G])([b#]?)([0-8])$/.exec(pitch);
  const value = Number(octave)*7+'CDEFGAB'.indexOf(letter);
  const slider = page.getByRole('slider',{name:label,exact:true});
  await slider.focus();
  for (let attempts=0; attempts<70; attempts++) {
    const delta = value-Number(await slider.getAttribute('aria-valuenow'));
    if (!delta) break;
    await page.keyboard.press(delta >= 7 ? 'PageUp' : delta <= -7 ? 'PageDown' : delta > 0 ? 'ArrowUp' : 'ArrowDown');
  }
  if (Number(await slider.getAttribute('aria-valuenow')) !== value) throw new Error(`${label}: wanted ${value}, got ${await slider.getAttribute('aria-valuetext')}; focus=${await page.evaluate(() => document.activeElement.outerHTML)}`);
  await page.getByRole('group',{name:`${label} accidental`,exact:true}).getByRole('button',{name:accidental === '#' ? 'Sharp' : accidental === 'b' ? 'Flat' : 'Natural',exact:true}).click();
}
export async function setModifiers(page,values) {
  await customTab(page,'Options');
  await page.getByRole('group',{name:'Key signature',exact:true}).getByRole('button',{name:values.includes('key') ? 'On' : 'Off',exact:true}).click();
  for (const [id,label] of [['flat','♭ Flat'],['natural','♮ Natural'],['sharp','♯ Sharp']]) {
    const button = page.getByRole('group',{name:'Additional spellings',exact:true}).getByRole('button',{name:label,exact:true});
    if ((await button.getAttribute('aria-pressed') === 'true') !== values.includes(id)) await button.click();
  }
}
export async function notesMode(page, name) {
  await page.getByRole('navigation',{name:'tuNotes modes'}).getByRole('button',{name,exact:true}).click();
}
export async function openData(page) {
  await notesMode(page,'Options');
  if (!await page.locator('.local-data').evaluate(n => n.open)) await page.locator('.local-data summary').click();
}
export async function setToggle(page, id, selected) {
  if (id === 'remember-progress') await openData(page); else await notesMode(page,'Practice');
  if (id !== 'remember-progress') await openPracticeSettings(page);
  const control = page.locator(`#${id}`);
  if ((await control.getAttribute('aria-pressed') === 'true') !== selected) await control.click();
}
export async function setPacing(page, label) {
  await notesMode(page,'Options');
  await page.getByRole('group',{name:'Continue After',exact:true}).getByRole('button',{name:label,exact:true}).click();
  await notesMode(page,'Practice');
}

export async function openPracticeSettings(page) {
  const settings = page.locator('.practice-settings');
  if (await settings.isVisible() && !await settings.evaluate(node => node.open)) await settings.locator('summary').click();
}

import { presets } from '../src/apps/tunotes/domain/presets.ts';
export async function choosePreset(page,id) {
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
export async function setEndpoint(page,label,pitch) {
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
  for (const [id,label] of [['key','Key'],['flat','♭ Flat'],['natural','♮ Natural'],['sharp','♯ Sharp']]) {
    const button = page.getByRole('group',{name:'Modifiers',exact:true}).getByRole('button',{name:label,exact:true});
    if ((await button.getAttribute('aria-pressed') === 'true') !== values.includes(id)) await button.click();
  }
}

import { presets, stringInstruments } from '../src/apps/tunotes/domain/presets.ts';
export const rangeDialog = page => page.locator('.range-picker-dialog[open]');
export async function openRange(page) {
  if (await rangeDialog(page).isVisible()) return;
  await page.locator('.activity-setup-toolbar:visible').getByRole('button',{name:/^Choose Notes(?: — .+)?$/}).click();
}
export async function choosePreset(page,id,adaptive=false) {
  await notesMode(page,'Practice');
  await openRange(page);
  const dialog = rangeDialog(page);
  if (id === 'custom') { await dialog.getByRole('button',{name:'Custom',exact:true}).click(); return; }
  const preset = presets.find(p => p.id === id);
  if (!preset) throw new Error(`Unknown built-in preset ${id}`);
  if (preset.instrument) {
    const ensemble = stringInstruments.some(i=>i.id===preset.instrument) ? 'Orchestra' : 'Band';
    await dialog.getByRole('button',{name:`${ensemble} instruments`,exact:true}).click();
    await dialog.getByRole('button',{name:preset.name.split(' — ')[0],exact:true}).click();
  } else {
    await dialog.getByRole('button',{name:'Clef',exact:true}).click();
    await dialog.getByRole('button',{name:preset.clef[0].toUpperCase()+preset.clef.slice(1),exact:true}).click();
  }
  await dialog.locator(`[data-preset-id="${id}"]`).click();
  await dialog.getByRole('button',{name:adaptive ? 'Yes, let Uno help' : 'Keep this range',exact:true}).click();
}
export async function openCustom(page) {
  if (await rangeDialog(page).isVisible() && await rangeDialog(page).getAttribute('data-screen') === 'Custom') return;
  await openRange(page);
  await rangeDialog(page).getByRole('button',{name:'Custom',exact:true}).click();
}
export async function setKey(page,value) {
  await openCustom(page);
  await rangeDialog(page).getByRole('group',{name:'Key signature',exact:true}).getByRole('button',{name:'Key',exact:true}).click();
  await page.locator(`.key-picker-dialog[open] [data-key="${value}"]`).click();
}
export async function useRange(page) { await rangeDialog(page).getByRole('button',{name:'Accept',exact:true}).click(); }
export async function saveCustom(page,name) {
  await rangeDialog(page).getByRole('button',{name:'Save Preset',exact:true}).click();
  const dialog = page.getByRole('dialog',{name:'Save Preset',exact:true});
  await dialog.getByLabel('Preset name',{exact:true}).fill(name);
  await dialog.getByRole('button',{name:'Save Preset',exact:true}).click();
}
export async function setEndpoint(page,label,pitch) {
  await openCustom(page);
  const [,letter,accidental,octave] = /^([A-G])([b#]?)([0-8])$/.exec(pitch);
  const value = Number(octave)*7+'CDEFGAB'.indexOf(letter);
  const slider = rangeDialog(page).getByRole('slider',{name:label,exact:true});
  await slider.focus();
  for (let attempts=0; attempts<70; attempts++) {
    const delta = value-Number(await slider.getAttribute('aria-valuenow'));
    if (!delta) break;
    await page.keyboard.press(delta >= 7 ? 'PageUp' : delta <= -7 ? 'PageDown' : delta > 0 ? 'ArrowUp' : 'ArrowDown');
  }
  if (Number(await slider.getAttribute('aria-valuenow')) !== value) throw new Error(`${label}: wanted ${value}, got ${await slider.getAttribute('aria-valuetext')}`);
  const target = accidental === '#' ? 'Sharp' : accidental === 'b' ? 'Flat' : 'Natural';
  const cycle = rangeDialog(page).getByRole('button',{name:new RegExp(`^${label} accidental:`)});
  for (let i=0; i<3 && !(await cycle.getAttribute('aria-label')).includes(`: ${target}.`); i++) await cycle.click();
}
export async function setModifiers(page,values) {
  await openCustom(page);
  const dialog = rangeDialog(page);
  const key = dialog.getByRole('group',{name:'Key signature',exact:true});
  if (!values.includes('key')) await key.getByRole('button',{name:'No Key',exact:true}).click();
  else if (await key.getByRole('button',{name:'Key',exact:true}).getAttribute('aria-pressed') !== 'true') await setKey(page,'C');
  for (const [id,label] of [['flat','Flat'],['natural','Natural'],['sharp','Sharp']]) {
    const button = dialog.getByRole('group',{name:'Additional spellings',exact:true}).getByRole('button',{name:label,exact:true});
    if ((await button.getAttribute('aria-pressed') === 'true') !== values.includes(id)) await button.click();
  }
}
export async function notesMode(page, name) { await page.getByRole('navigation',{name:'tuNotes modes'}).getByRole('button',{name,exact:true}).click(); }
export async function openData(page) {
  await notesMode(page,'Options');
  if (!await page.locator('.local-data').evaluate(n => n.open)) await page.locator('.local-data summary').click();
}
export async function setToggle(page,id,selected) {
  if (id !== 'remember-progress') throw new Error(`Removed toggle: ${id}`);
  await openData(page);
  const control = page.locator(`#${id}`);
  if ((await control.getAttribute('aria-pressed') === 'true') !== selected) await control.click();
}
export async function setPacing(page, label) {
  await notesMode(page,'Practice');
  await page.getByRole('group',{name:'Practice Mode',exact:true}).getByRole('button',{name:label,exact:true}).click();
}
export async function startPractice(page) {
  await notesMode(page,'Practice');
  await page.getByRole('button',{name:'Start Practice',exact:true}).click();
  if (await page.locator('.note-preview').isVisible()) {
    const skip = page.getByRole('button',{name:'Skip',exact:true});
    await (await skip.isVisible() ? skip : page.getByRole('button',{name:'Start Practice',exact:true})).click();
  }
}
export async function readyForAnswer(page) {
  await page.waitForFunction(() => document.querySelector('.practice-play:not([hidden]) .answer')?.getAttribute('aria-disabled') === 'false');
}

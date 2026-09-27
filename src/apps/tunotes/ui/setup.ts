import { el } from '../../../shared/ui/components.ts';
import { clefs, defaultPreset, normalizePreset, presets } from '../domain/presets.ts';
import type { Preset, PresetSource, Content, Policy } from '../domain/presets.ts';
import { keyNames, keySignature, pitchLabel, spelling, keyName } from '../domain/notation.ts';
import type { Clef } from '../domain/notation.ts';
import { renderStaff } from './staff.ts';
import { MAX_BYTES, NotesStore, parseBackup } from '../persistence/store.ts';
import type { Snapshot } from '../persistence/store.ts';
export function button(text: string, action: () => void) { const b = el('button','control',text); b.type = 'button'; b.addEventListener('click',action); return b; }
function select(label: string, values: readonly (string | readonly [string,string])[], initial: string) {
  const node = el('label','setting',label); const input = el('select','control'); input.setAttribute('aria-label',label);
  for (const value of values) { const [id,name] = typeof value === 'string' ? [value,value] : value; const option = el('option','',name); option.value = id; input.append(option); }
  input.value = initial; node.append(input); return { node,input };
}
export function presetSetup(store: NotesStore) {
  const node = el('div'); const pickerLabel = el('label','','Preset '); const picker = el('select','control'); picker.id = 'preset'; pickerLabel.append(picker);
  const custom = el('fieldset'); custom.hidden = true; custom.append(el('legend','','Custom note pool'));
  const clef = select('Clef',clefs,'treble'); const low = select('Lowest written position',Array.from({length:63},(_,i) => `${'CDEFGAB'[i%7]}${Math.floor(i/7)}`),'E4');
  const high = select('Highest written position',Array.from({length:63},(_,i) => `${'CDEFGAB'[i%7]}${Math.floor(i/7)}`),'F5');
  const content = select('Content',[['lines','Lines'],['spaces','Spaces'],['lines-and-spaces','Lines + Spaces']],'lines-and-spaces');
  const key = select('Major key',keyNames.map(k => [k,spelling(keySignature(k).tonic)] as const),'C');
  key.input.querySelector<HTMLOptionElement>('option[value="Cb"]')!.disabled = true;
  const policy = select('Accidentals',[['key-only','Key notes only'],['sharps','Key notes + extra sharps'],['flats','Key notes + extra flats'],['both','Key notes + sharps and flats']],'key-only');
  const below = select('Maximum ledger lines below',['0','1','2','3','4'],'0'); const above = select('Maximum ledger lines above',['0','1','2','3','4'],'0');
  custom.append(clef.node,low.node,high.node,content.node,key.node,policy.node,below.node,above.node,el('p','muted','Zero ledger lines permits the spaces immediately outside the staff. Select staff boundaries for staff-only practice. B♯, C♭, E♯ and F♭ are excluded from the note pool.'));
  const summary = el('p'); summary.id = 'preset-summary'; summary.setAttribute('role','status');
  const preview = el('div','preset-preview');
  let current: Preset | undefined; let changed = () => {};
  const customSource = (): PresetSource => ({ id: picker.value === 'custom' ? 'custom-current' : picker.value, name: store.data.customPresets.find(p => p.id === picker.value)?.name ?? 'Custom', clef: clef.input.value as Clef, range: [low.input.value,high.input.value], content: content.input.value as Content, key: keySignature(key.input.value), accidentals: policy.input.value as Policy, ledgerBelow: Number(below.input.value), ledgerAbove: Number(above.input.value) });
  const summarize = () => {
    custom.hidden = picker.value !== 'custom' && !store.data.customPresets.some(p => p.id === picker.value);
    try {
      current = custom.hidden ? presets.find(p => p.id === picker.value)! : normalizePreset(customSource());
      if (!current) throw new Error('Choose a preset.');
      summary.textContent = `${spelling(current.key.tonic)} major · ${current.pool.length} notes · ${current.pool.map(pitchLabel).join(', ')} · Adaptive off${current.pool.length === 1 ? ' · This one-note pool repeats the same note.' : ''}${current.instrument ? ' · Teacher-reviewed starting range.' : ''}`;
      const staff = renderStaff(current.pool[0]!,current.clef,current.key); staff.classList.replace('staff','setup-staff'); preview.replaceChildren(staff);
    } catch (error) { current = undefined; summary.textContent = (error as Error).message; preview.replaceChildren(); }
    changed();
  };
  const loadCustom = () => {
    const p = store.data.customPresets.find(p => p.id === picker.value);
    if (p) { clef.input.value = p.clef; low.input.value = p.range[0]; high.input.value = p.range[1]; content.input.value = p.content; key.input.value = keyName(p.key!); policy.input.value = p.accidentals!; below.input.value = String(p.ledgerBelow); above.input.value = String(p.ledgerAbove); }
    summarize();
  };
  const refresh = () => {
    const selected = store.data.configuration.presetId; picker.replaceChildren();
    for (const [name,items] of [['Clef',presets.filter(p => !p.instrument)],['Instrument',presets.filter(p => p.instrument)],['Custom',store.data.customPresets]] as const) {
      const group = el('optgroup'); group.label = name;
      for (const p of items) { const o = el('option','',p.name); o.value = p.id; group.append(o); }
      if (name === 'Custom') { const o = el('option','','New Custom…'); o.value = 'custom'; group.append(o); }
      picker.append(group);
    }
    picker.value = selected; if (!picker.value) picker.value = defaultPreset.id; loadCustom();
  };
  picker.addEventListener('change',loadCustom); custom.addEventListener('change',summarize);
  const saveName = el('input','control'); saveName.maxLength = 80; saveName.placeholder = 'Custom preset name'; saveName.setAttribute('aria-label','Custom preset name');
  const saveMessage = el('p'); saveMessage.setAttribute('role','status');
  custom.append(saveName,button('Save Custom preset',() => {
    if (!current) return;
    if (!saveName.value.trim()) { saveMessage.textContent = 'Enter a name for this preset.'; return; }
    try {
      const p = { ...customSource(), id: `custom-${crypto.randomUUID()}`, name: saveName.value.trim() };
      store.update(data => { data.customPresets.push(p); data.configuration.presetId = p.id; }); refresh(); saveMessage.textContent = 'Custom preset saved.';
    } catch (error) { saveMessage.textContent = (error as Error).message; }
  }),saveMessage);
  node.append(pickerLabel,custom,summary,preview); refresh();
  return { node,picker,refresh, selected: () => current, onChange: (fn: () => void) => { changed = fn; }, saveConfiguration: (selfPaced: boolean) => {
    if (!current) return false;
    try { store.update(data => {
      if (!custom.hidden) {
        const source = customSource(); const index = data.customPresets.findIndex(p => p.id === source.id);
        if (index < 0) data.customPresets.push(source); else data.customPresets[index] = source;
      }
      data.configuration.presetId = current!.id; data.configuration.selfPaced = selfPaced;
    }); return true; } catch (error) { summary.textContent = (error as Error).message; return false; }
  } };
}
export function localData(store: NotesStore, reload: () => void) {
  const node = el('details','local-data'); node.append(el('summary','','Local profiles and backups'));
  node.append(el('p','','Progress is saved on this device. Clearing browser or site data may erase it. Export a backup if you want to keep it.'),el('p','muted','Guest is memory-only. Moving or renaming the downloaded HTML or changing browsers may change storage access. The HTML file does not contain your progress.'));
  const remember = el('input'); remember.type = 'checkbox'; remember.id = 'remember-progress';
  const rememberLabel = el('label','pace-option'); rememberLabel.append(remember,document.createTextNode(' Remember progress'));
  const profiles = select('Local player',[['','Guest']], ''); profiles.input.id = 'profile';
  const name = el('input','control'); name.maxLength = 40; name.setAttribute('aria-label','Profile name'); name.placeholder = 'Profile name';
  const status = el('p'); status.setAttribute('role','status'); status.id = 'storage-status';
  const history = el('p'); history.id = 'profile-history';
  const refresh = () => {
    remember.checked = store.data.configuration.remember; profiles.input.replaceChildren();
    const guest = el('option','','Guest'); guest.value = ''; profiles.input.append(guest);
    store.data.profiles.forEach((p,index) => { const o = el('option','',`${p.name} · ${index+1}`); o.value = p.id; profiles.input.append(o); });
    profiles.input.value = store.data.configuration.profileId ?? ''; profiles.input.disabled = !remember.checked;
    const p = store.profile(); history.textContent = p ? `${p.results.length} recent sessions · ${p.results.reduce((sum,r) => sum+r.correct,0)} correct notes in retained history. Last session: ${p.results.at(-1)?.correct ?? 0} correct / ${p.results.at(-1)?.attempts ?? 0} attempts.` : 'Guest: progress stays in this session only.';
    status.textContent = store.message;
  };
  remember.addEventListener('change',() => { store.update(data => { data.configuration.remember = remember.checked; }); refresh(); });
  profiles.input.addEventListener('change',() => { store.update(data => { data.configuration.profileId = profiles.input.value || null; }); refresh(); });
  const create = button('Create profile',() => {
    try { store.update(data => { const p = { id: crypto.randomUUID(), name: name.value.trim(), results: [], contexts: [] }; data.profiles.push(p); data.configuration.profileId = p.id; data.configuration.remember = true; }); name.value = ''; refresh(); }
    catch (error) { status.textContent = (error as Error).message; }
  });
  const rename = button('Rename profile',() => { try { store.update(data => { const p = data.profiles.find(p => p.id === data.configuration.profileId); if (!p) throw new Error('Select a profile first.'); p.name = name.value.trim(); }); refresh(); } catch (error) { status.textContent = (error as Error).message; } });
  const remove = button('Delete selected profile',() => {
    const id = store.data.configuration.profileId;
    if (!id || !window.confirm('Delete this local profile and all its learning and results on this device?')) return;
    store.update(data => { data.profiles = data.profiles.filter(p => p.id !== id); data.configuration.profileId = null; }); refresh();
  });
  const erase = button('Delete all tuNotes data',() => {
    if (!window.confirm('Delete all tuNotes profiles, presets, settings and progress in this storage context? Other browsers, files and tUno data are unaffected.')) return;
    store.clear(); refresh(); reload();
  });
  const backupLink = el('a','control','Save backup JSON'); backupLink.hidden = true; backupLink.download = 'tunotes-backup.json'; let url = '';
  const exportButton = button('Export backup',() => {
    if (url) URL.revokeObjectURL(url); url = URL.createObjectURL(new Blob([store.export()],{type:'application/json'})); backupLink.href = url; backupLink.hidden = false; backupLink.click();
    status.textContent = 'If the download did not start, use Save backup JSON or open the link and choose Save As. Keep the .json extension.';
  });
  const fileLabel = el('label','setting','Import backup'); const file = el('input'); file.type = 'file'; file.accept = '.json,application/json'; file.id = 'import-backup'; fileLabel.append(file);
  let candidate: Snapshot | undefined; let generation = 0;
  const preview = el('p'); preview.setAttribute('role','status'); preview.id = 'import-preview';
  const replace = button('Replace tuNotes data',() => {
    if (!candidate) return;
    try { store.replace(candidate); candidate = undefined; replace.hidden = true; preview.textContent = store.message; refresh(); reload(); }
    catch (error) { preview.textContent = (error as Error).message; }
  }); replace.hidden = true;
  file.addEventListener('change',async () => {
    const own = ++generation; candidate = undefined; replace.hidden = true; preview.textContent = '';
    try {
      const selected = file.files?.[0]; if (!selected) return;
      if (selected.size > MAX_BYTES) throw new Error('Backup exceeds 5 MiB.');
      const parsed = parseBackup(await selected.text()); if (own !== generation) return;
      candidate = parsed; preview.textContent = `${parsed.profiles.length} profiles, ${parsed.customPresets.length} custom presets, ${parsed.profiles.reduce((sum,p) => sum+p.results.length,0)} results. Replace all current tuNotes data? ${store.durable ? 'This replaces saved data on this device.' : 'Storage unavailable: replacement will be memory-only.'}`; replace.hidden = false;
    } catch (error) { if (own === generation) preview.textContent = (error as Error).message; }
  });
  node.append(rememberLabel,profiles.node,name,create,rename,history,remove,erase,exportButton,backupLink,fileLabel,preview,replace,status); refresh();
  return { node,refresh,dispose: () => { generation++; if (url) URL.revokeObjectURL(url); } };
}

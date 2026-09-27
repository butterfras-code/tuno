import { el } from '../../../shared/ui/components.ts';
import { clefForPitch, generatedPresetName, defaultPreset, normalizePreset, presets } from '../domain/presets.ts';
import type { Preset } from '../domain/presets.ts';
import { pitchLabel, spelling } from '../domain/notation.ts';
import { presetPicker } from './preset-picker.ts';
import { customConfigurator } from './custom-configurator.ts';
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
  const node = el('div');
  let current: Preset | undefined; let changed = () => {}; let selectedId = store.data.configuration.presetId;
  const pickerUI = presetPicker(() => store.data.customPresets,id => { selectedId = id; loadCustom(); });
  const picker = pickerUI.picker;
  const editor = customConfigurator(() => summarize()); const custom = editor.node;
  const summary = el('p'); summary.id = 'preset-summary'; summary.setAttribute('role','status');
  const preview = el('div','preset-preview');
  const saveName = el('input','control'); saveName.maxLength = 80; saveName.setAttribute('aria-label','Custom preset name');
  let nameOverride = false;
  const customSource = () => {
    const source = editor.source(selectedId === 'custom' ? 'custom-current' : selectedId,'Custom');
    const generated = generatedPresetName(source);
    if (!nameOverride) saveName.value = generated;
    return {...source,name:saveName.value.trim() || generated};
  };
  saveName.addEventListener('input',() => { nameOverride = !!saveName.value.trim(); summarize(); });
  const summarize = () => {
    custom.hidden = selectedId !== 'custom' && !store.data.customPresets.some(p => p.id === selectedId);
    try {
      current = custom.hidden ? presets.find(p => p.id === selectedId)! : normalizePreset(customSource());
      if (!current) throw new Error('Choose a preset.');
      summary.textContent = `${current.editorVersion === 2 && !current.modifiers!.includes('key') ? 'No key signature' : `${spelling(current.key.tonic)} major`} · ${current.pool.length} notes · ${current.pool.map(pitchLabel).join(', ')}${current.pool.length === 1 ? ' · This one-note pool repeats the same note.' : ''}${current.instrument ? ' · Teacher-reviewed starting range.' : ''}`;
      if (!custom.hidden) editor.describe(current);
      const staff = renderStaff(current.pool[0]!,clefForPitch(current,current.pool[0]!),current.key); staff.classList.replace('staff','setup-staff'); preview.replaceChildren(staff); preview.hidden = !custom.hidden;
    } catch (error) { current = undefined; editor.clearDescription(); summary.textContent = (error as Error).message; preview.replaceChildren(); }
    changed();
  };
  const loadCustom = () => {
    const p = store.data.customPresets.find(p => p.id === selectedId);
    if (p) { nameOverride = p.name !== generatedPresetName(p); saveName.value = p.name; editor.load(p); }
    else if (selectedId === 'custom') nameOverride = false;
    pickerUI.set(selectedId,p?.name ?? presets.find(p => p.id === selectedId)?.name ?? 'Custom');
    summarize();
  };
  const refresh = () => {
    selectedId = store.data.configuration.presetId;
    if (!presets.some(p => p.id === selectedId) && !store.data.customPresets.some(p => p.id === selectedId)) selectedId = defaultPreset.id;
    loadCustom();
  };
  const saveMessage = el('p'); saveMessage.setAttribute('role','status');
  const nameLabel = el('label','setting','Preset name'); nameLabel.append(saveName);
  custom.append(nameLabel,el('p','muted','Generated from your settings. Edit to rename; clear to use the generated name.'),button('Save Custom preset',() => {
    if (!current) return;
    if (!saveName.value.trim()) { saveMessage.textContent = 'Enter a name for this preset.'; return; }
    try {
      const p = { ...customSource(), id: `custom-${crypto.randomUUID()}`, name: saveName.value.trim() };
      store.update(data => { data.customPresets.push(p); data.configuration.presetId = p.id; }); refresh(); saveMessage.textContent = 'Custom preset saved.';
    } catch (error) { saveMessage.textContent = (error as Error).message; }
  }),saveMessage);
  node.append(pickerUI.node,custom,summary,preview); refresh();
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

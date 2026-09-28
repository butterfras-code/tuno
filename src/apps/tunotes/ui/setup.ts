import { el } from '../../../shared/ui/components.ts';
import { clefForPitch, modifiersFor, generatedPresetName, defaultPreset, normalizePreset, presets } from '../domain/presets.ts';
import type { Preset } from '../domain/presets.ts';
import { pitchLabel, spelling } from '../domain/notation.ts';
import { titleCase, presetPicker } from './preset-picker.ts';
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
export function presetSetup(store: NotesStore, idPrefix = '') {
  const node = el('div');
  let current: Preset | undefined; let changed = () => {}; let selectedId = store.data.configuration.presetId;
  const pickerUI = presetPicker(() => store.data.customPresets,id => { selectedId = id; loadCustom(); },idPrefix);
  const picker = pickerUI.picker;
  const editor = customConfigurator(() => summarize()); const custom = editor.node;
  const summary = el('p'); summary.id = `${idPrefix}preset-summary`; summary.setAttribute('role','status');
  const preview = el('div','preset-preview range-grid');
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
      const low = current.pool[0]!, high = current.pool.at(-1)!;
      const modifiers = modifiersFor(current);
      const additions = modifiers.filter(m => m !== 'key').map(m => ({flat:'flats',natural:'naturals',sharp:'sharps'}[m])).join(', ');
      const clefs = (current.availableClefs ?? [current.clef]).map(titleCase).join(' / ');
      summary.textContent = `${modifiers.includes('key') ? `${spelling(current.key.tonic)} Major` : 'No key signature'} · ${pitchLabel(low)}–${pitchLabel(high)} · ${current.content === 'lines-and-spaces' ? 'Lines and Spaces' : titleCase(current.content)}${additions ? ` (${additions})` : ''} · ${clefs} ${current.availableClefs && current.availableClefs.length > 1 ? 'clefs' : 'clef'}`;
      if (!custom.hidden) editor.describe(current);
      preview.replaceChildren();
      for (const [label,pitch] of [['Low note',low],['High note',high]] as const) {
        const endpoint = el('div','range-endpoint');
        const staff = renderStaff(pitch,clefForPitch(current,pitch),current.key,current.keyless);
        staff.classList.replace('staff','endpoint-staff');
        endpoint.append(el('h4','',label),el('output','',pitchLabel(pitch)),staff); preview.append(endpoint);
      }
      preview.hidden = !custom.hidden;
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
  custom.append(nameLabel,button('Save Custom preset',() => {
    if (!current) return;
    if (!saveName.value.trim()) { saveMessage.textContent = 'Enter a name for this preset.'; return; }
    try {
      const p = { ...customSource(), id: `custom-${crypto.randomUUID()}`, name: saveName.value.trim() };
      store.update(data => { data.customPresets.push(p); data.configuration.presetId = p.id; }); refresh(); saveMessage.textContent = 'Custom preset saved.';
    } catch (error) { saveMessage.textContent = (error as Error).message; }
  }),saveMessage);
  node.append(pickerUI.node,custom,preview,summary); refresh();
  return { node,picker,refresh, selectPreset: (id: string) => { selectedId = id; loadCustom(); }, selected: () => current, onChange: (fn: () => void) => { changed = fn; }, saveForRoster: () => {
    if (!current) return undefined;
    if (custom.hidden) return current;
    try {
      const source = customSource();
      if (selectedId === 'custom') source.id = `custom-${crypto.randomUUID()}`;
      store.update(data => {
        const index = data.customPresets.findIndex(p => p.id === source.id);
        if (index < 0) data.customPresets.push(source); else data.customPresets[index] = source;
      });
      selectedId = source.id; loadCustom(); return current;
    } catch (error) { summary.textContent = (error as Error).message; return undefined; }
  }, saveConfiguration: (selfPaced: boolean) => {
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
export function localData(store: NotesStore, reload: () => void, playerChanged: () => void = () => {}) {
  const node = el('details','local-data'); node.append(el('summary','','Profiles and backups'));
  node.append(el('p','muted','Profiles save progress on this device. Export a backup to keep a copy. Guest progress lasts until you close the app.'));
  let remembering = false;
  const remember = button('Remember progress', () => { store.update(data => { data.configuration.remember = !remembering; if (data.configuration.remember) { const p = data.profiles.find(p => p.id === data.configuration.profileId) ?? data.profiles[0]; if (p) { data.configuration.profileId = p.id; data.configuration.presetId = p.defaultPresetId; } } }); refresh(); }); remember.id = 'remember-progress';
  const rememberLabel = el('label','pace-option'); rememberLabel.append(remember);
  const profiles = select('Saved profile',[['','No saved profiles']], ''); profiles.input.id = 'profile';
  const selectedProfile = () => store.data.profiles.find(p => p.id === store.data.configuration.profileId) ?? store.data.profiles[0];
  const create = button('Add profile',() => {
    try {
      store.update(data => {
        const p = { id: crypto.randomUUID(), name: `Profile ${data.profiles.length+1}`, results: [], contexts: [], defaultPresetId: data.configuration.presetId };
        data.profiles.push(p); data.configuration.profileId = p.id; data.configuration.remember = true;
      });
      refresh(); saved.textContent = store.durable ? 'Changes saved.' : 'Changes kept in memory only.'; name.focus(); name.select();
    } catch (error) { status.textContent = (error as Error).message; }
  });
  const card = el('section','profile-card');
  const heading = el('h3');
  const name = el('input','control'); name.maxLength = 40; name.setAttribute('aria-label','Profile name'); name.placeholder = 'Profile name';
  const nameLabel = el('label','setting','Name'); nameLabel.append(name);
  const profilePreset = presetPicker(() => store.data.customPresets,id => {
    const p = selectedProfile(); if (!p) return;
    store.update(data => { data.profiles.find(v => v.id === p.id)!.defaultPresetId = id; if (data.configuration.remember) data.configuration.presetId = id; }); refresh();
    saved.textContent = store.durable ? 'Changes saved.' : 'Changes kept in memory only.';
  },'profile-',false,'Default preset');
  const status = el('p'); status.setAttribute('role','status'); status.id = 'storage-status';
  const saved = el('p','profile-save-status'); saved.setAttribute('role','status');
  const history = el('p'); history.id = 'profile-history';
  const previous = button('Prev',() => selectNearby(-1)); previous.setAttribute('aria-label','Previous profile');
  const next = button('Next',() => selectNearby(1)); next.setAttribute('aria-label','Next profile');
  const navigation = el('div','profile-navigation'); navigation.append(previous,next);
  const remove = button('Delete profile',() => {
    const id = selectedProfile()?.id;
    if (!id || !window.confirm('Delete this local profile and all its learning and results on this device?')) return;
    store.update(data => {
      const index = data.profiles.findIndex(p => p.id === id); data.profiles.splice(index,1);
      const selected = data.profiles[index] ?? data.profiles[index-1];
      data.configuration.profileId = selected?.id ?? null;
      if (selected && data.configuration.remember) data.configuration.presetId = selected.defaultPresetId;
    }); refresh(); saved.textContent = ''; profiles.input.focus();
  }); remove.classList.add('control--destructive'); remove.setAttribute('aria-label','Delete selected profile');
  const footer = el('div','profile-card-footer'); footer.append(navigation,remove);
  card.append(heading,nameLabel,profilePreset.node,history,footer,saved);
  const refresh = () => {
    remembering = store.data.configuration.remember; remember.setAttribute('aria-pressed',String(remembering)); profiles.input.replaceChildren();
    if (!store.data.profiles.length) { const empty = el('option','','No saved profiles'); empty.value = ''; profiles.input.append(empty); }
    store.data.profiles.forEach((p,index) => { const o = el('option','',`${p.name} · ${index+1}`); o.value = p.id; profiles.input.append(o); });
    const p = selectedProfile(); profiles.input.value = p?.id ?? ''; profiles.input.disabled = !p;
    card.hidden = !p;
    if (p) {
      const index = store.data.profiles.indexOf(p);
      heading.textContent = `Profile ${index+1} settings`; name.value = p.name;
      profilePreset.set(p.defaultPresetId,store.data.customPresets.find(v => v.id === p.defaultPresetId)?.name ?? presets.find(v => v.id === p.defaultPresetId)!.name);
      previous.disabled = index === 0; next.disabled = index === store.data.profiles.length-1;
    }
    history.textContent = p ? `${p.results.length} recent sessions · ${p.results.reduce((sum,r) => sum+r.correct,0)} correct notes in retained history. Last session: ${p.results.at(-1)?.correct ?? 0} correct / ${p.results.at(-1)?.attempts ?? 0} attempts.` : 'Guest: progress stays in this session only.';
    status.textContent = store.message; playerChanged();
  };
  profiles.input.addEventListener('change',() => { store.update(data => { data.configuration.profileId = profiles.input.value; const p = data.profiles.find(p => p.id === data.configuration.profileId); if (p && data.configuration.remember) data.configuration.presetId = p.defaultPresetId; }); refresh(); saved.textContent = ''; });
  name.addEventListener('blur',() => {
    const p = selectedProfile(); if (!p) return;
    const next = name.value.trim();
    if (!next) { name.value = p.name; status.textContent = 'Give the profile a name.'; saved.textContent = ''; return; }
    if (next === p.name) return;
    try { store.update(data => { data.profiles.find(v => v.id === p.id)!.name = next; }); refresh(); saved.textContent = store.durable ? 'Changes saved.' : 'Changes kept in memory only.'; }
    catch (error) { status.textContent = (error as Error).message; name.value = p.name; }
  });
  name.addEventListener('keydown',event => { if (event.key === 'Enter' && !event.isComposing) { event.preventDefault(); name.blur(); profiles.input.focus(); } });
  function selectNearby(delta: number) {
    const index = store.data.profiles.findIndex(p => p.id === selectedProfile()?.id);
    const target = store.data.profiles[index+delta]; if (!target) return;
    store.update(data => { data.configuration.profileId = target.id; if (data.configuration.remember) data.configuration.presetId = target.defaultPresetId; }); refresh(); saved.textContent = '';
    const control = delta < 0 ? previous : next; if (control.disabled) profiles.input.focus(); else control.focus();
  }
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
  node.append(rememberLabel,profiles.node,create,card,status,erase,exportButton,backupLink,fileLabel,preview,replace); refresh();
  return { node,refresh,dispose: () => { generation++; if (url) URL.revokeObjectURL(url); } };
}

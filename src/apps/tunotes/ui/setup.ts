import { el } from '../../../shared/ui/components.ts';
import { clefForPitch, modifiersFor, generatedPresetName, defaultPreset, normalizePreset, presets } from '../domain/presets.ts';
import type { Preset, PresetSource } from '../domain/presets.ts';
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
  const node = el('div','preset-setup');
  const overview = el('div','preset-overview');
  let current: Preset | undefined, currentSource: PresetSource | undefined;
  let selectionError = '';
  let changed = () => {}, editing = false, draft: Preset | undefined, returnFocus: HTMLElement | undefined;
  const pickerUI = presetPicker(() => store.data.customPresets,id => {
    if (id === 'custom') openEditor(defaultPreset); else selectPreset(id);
  },idPrefix,true,'Preset',{
    begin: () => {
      const source = currentSource, selected = current, error = selectionError;
      return () => { currentSource = source; current = selected; selectionError = error; renderOverview(); };
    },
    select: id => selectPreset(id),
    range: () => preview,
  });
  const picker = pickerUI.picker;
  const editor = customConfigurator(() => { if (editing) summarizeDraft(); },idPrefix);
  const frame = el('section','custom-editor'); frame.hidden = true; frame.setAttribute('aria-label','Custom range editor');
  const heading = el('h2','','Custom range');
  const summary = el('p','preset-summary'); summary.id = `${idPrefix}preset-summary`; summary.setAttribute('role','status');
  const preview = el('div','preset-preview range-grid');
  const previewScene = el('div','preset-preview-scene');
  const companion = el('div','preset-preview-companion'); companion.hidden = true;
  previewScene.append(preview,companion);
  const saveName = el('input','control'); saveName.maxLength = 80; saveName.setAttribute('aria-label','Custom preset name');
  let nameOverride = false;
  const draftSource = () => {
    const source = editor.source('custom-current','Custom');
    const generated = generatedPresetName(source);
    if (!nameOverride) saveName.value = generated;
    return {...source,name:saveName.value.trim() || generated};
  };
  saveName.addEventListener('input',() => { nameOverride = !!saveName.value.trim(); summarizeDraft(); });
  const savePanel = el('label','setting custom-save-name','Preset name'); savePanel.append(saveName); savePanel.hidden = true;
  const message = el('p','custom-save-message'); message.setAttribute('role','status');
  const saveToggle = button('Save as preset…',() => {
    savePanel.hidden = !savePanel.hidden;
    saveToggle.textContent = savePanel.hidden ? 'Save as preset…' : 'Back to editing';
    saveToggle.setAttribute('aria-expanded',String(!savePanel.hidden));
    apply.textContent = savePanel.hidden ? 'Use range' : 'Save preset';
    if (!savePanel.hidden) { saveName.focus(); saveName.select(); }
  }); saveToggle.classList.add('custom-save-toggle'); saveToggle.setAttribute('aria-expanded','false');
  const apply = button('Use range',() => {
    if (!draft) return;
    try {
      let source = draftSource();
      if (!savePanel.hidden) {
        source = {...source,id:`custom-${crypto.randomUUID()}`};
        store.update(data => { data.customPresets.push(source); data.configuration.presetId = source.id; });
      }
      currentSource = source; current = normalizePreset(source); closeEditor();
    } catch (error) { message.textContent = (error as Error).message; }
  }); apply.classList.add('control--primary');
  const cancel = button('Cancel',() => closeEditor());
  const actions = el('div','custom-editor-actions'); actions.append(saveToggle,cancel,apply);
  const footer = el('div','custom-editor-footer'); footer.append(summary,savePanel,message,actions);
  frame.append(heading,editor.node,footer);
  const adjustRange = button('Adjust range',() => { if (currentSource) openEditor(current ?? currentSource); }); adjustRange.classList.add('adjust-range');
  const selectionActions = el('div','preset-selection-actions');
  overview.append(pickerUI.node,previewScene,summary,adjustRange); node.append(overview,frame);

  function describe(preset: Preset) {
    const low = preset.pool[0]!, high = preset.pool.at(-1)!;
    const modifiers = modifiersFor(preset);
    const additions = modifiers.filter(m => m !== 'key').map(m => ({flat:'flats',natural:'naturals',sharp:'sharps'}[m])).join(', ');
    const clefs = (preset.availableClefs ?? [preset.clef]).map(titleCase).join(' / ');
    return `${modifiers.includes('key') ? `${spelling(preset.key.tonic)} Major` : 'No key signature'} · ${pitchLabel(low)}–${pitchLabel(high)} · ${preset.content === 'lines-and-spaces' ? 'Lines and Spaces' : titleCase(preset.content)}${additions ? ` (${additions})` : ''} · ${clefs} ${preset.availableClefs && preset.availableClefs.length > 1 ? 'clefs' : 'clef'}`;
  }
  function summarizeDraft() {
    message.textContent = '';
    try { draft = normalizePreset(draftSource()); summary.textContent = describe(draft); editor.describe(draft); }
    catch (error) {
      draft = undefined; editor.clearDescription();
      summary.textContent = (error as Error).message.replace('Select at least one modifier.', 'Turn on a key signature or choose an additional spelling.').replace('These settings produce an empty pool. Widen the range or change content or modifiers.', 'No notes match these settings. Widen the range or change staff content or spellings.');
    }
    apply.disabled = !draft;
  }
  function renderOverview() {
    preview.replaceChildren();
    if (currentSource) pickerUI.set(currentSource.id,currentSource.name);
    if (!current) summary.textContent = selectionError;
    if (current) {
      pickerUI.set(current.id,current.name); summary.textContent = describe(current);
      for (const [label,pitch] of [['Low note',current.pool[0]!],['High note',current.pool.at(-1)!]] as const) {
        const endpoint = el('div','range-endpoint');
        const staff = renderStaff(pitch,clefForPitch(current,pitch),current.key,current.keyless); staff.classList.replace('staff','endpoint-staff');
        endpoint.append(el('h4','',label),el('output','',pitchLabel(pitch)),staff); preview.append(endpoint);
      }
    }
    changed();
  }
  function openEditor(source: PresetSource) {
    returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : picker;
    // All changes stay in the editor until applied, including edits to saved presets.
    editing = true; overview.hidden = true; frame.hidden = false; node.classList.add('is-editing');
    footer.prepend(summary); nameOverride = false; savePanel.hidden = true; saveToggle.textContent = 'Save as preset…'; saveToggle.setAttribute('aria-expanded','false'); apply.textContent = 'Use range';
    editor.load(source); editor.resetView(); editor.focus();
  }
  function closeEditor(focus = true) {
    editing = false; frame.hidden = true; overview.hidden = false; node.classList.remove('is-editing');
    previewScene.after(summary); renderOverview();
    if (focus) (returnFocus?.isConnected && returnFocus.getClientRects().length ? returnFocus : picker).focus();
  }
  function selectPreset(id: string) {
    currentSource = store.data.customPresets.find(p => p.id === id) ?? presets.find(p => p.id === id) ?? defaultPreset;
    try { current = normalizePreset(currentSource); selectionError = ''; }
    catch (error) { current = undefined; selectionError = (error as Error).message; }
    closeEditor(false);
  }
  const refresh = () => selectPreset(store.data.configuration.presetId);
  function persistCurrent() {
    if (!currentSource || !current || editing) return false;
    if (!presets.some(p => p.id === current!.id)) {
      const source = currentSource;
      store.update(data => { const index = data.customPresets.findIndex(p => p.id === source.id); if (index < 0) data.customPresets.push(source); else data.customPresets[index] = source; });
    }
    return true;
  }
  refresh();
  return { node,picker,refresh,companion, setupPresentation: (enabled: boolean) => {
    pickerUI.separateName(enabled); companion.hidden = !enabled;
    adjustRange.textContent = enabled ? 'Customize…' : 'Adjust range';
    if (enabled) {
      selectionActions.append(picker,adjustRange); pickerUI.node.prepend(selectionActions);
    } else {
      pickerUI.node.append(picker); overview.append(adjustRange); selectionActions.remove();
    }
  }, editCurrent: () => { if (currentSource) openEditor(current ?? currentSource); }, selectPreset,
    selected: () => editing ? undefined : current, onChange: (fn: () => void) => { changed = fn; },
    saveForRoster: () => {
      if (editing || !currentSource) return undefined;
      try {
        if (currentSource.id === 'custom-current') { currentSource = {...currentSource,id:`custom-${crypto.randomUUID()}`}; current = normalizePreset(currentSource); }
        if (!persistCurrent()) return undefined;
        renderOverview(); return current;
      } catch (error) { summary.textContent = (error as Error).message; return undefined; }
    },
    saveConfiguration: (selfPaced: boolean) => {
      try {
        if (!persistCurrent()) return false;
        store.update(data => { data.configuration.presetId = current!.id; data.configuration.selfPaced = selfPaced; }); return true;
      } catch (error) { summary.textContent = (error as Error).message; return false; }
    }
  };
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

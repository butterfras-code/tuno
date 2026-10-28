import { el } from '../../../shared/ui/components.ts';
import type { NotesStore } from '../persistence/store.ts';

/** Recovery stays available in every mode, including multiplayer and Options. */
export function savingNotice(store: NotesStore) {
  const node = el('section', 'notes-saving-notice'); node.setAttribute('aria-label', 'Saving status');
  const message = el('p'); message.setAttribute('role', 'status');
  const controls = el('div', 'control-row');
  const backup = el('button', 'control', 'Export this tab’s backup'); backup.type = 'button';
  const link = el('a', 'control', 'Save this tab’s backup JSON'); link.hidden = true; link.download = 'tunotes-backup.json';
  let url = '';
  backup.addEventListener('click', () => {
    if (url) URL.revokeObjectURL(url);
    url = URL.createObjectURL(new Blob([store.export()], { type: 'application/json' }));
    link.href = url; link.hidden = false; link.click();
  });
  const reload = el('button', 'control', 'Reload saved data'); reload.type = 'button';
  reload.addEventListener('click', () => {
    if (window.confirm('Reload saved data? Changes kept only in this tab will be lost. Export this tab’s backup first if you want to keep them. Close any other tuNotes tab to resume saving.')) window.location.reload();
  });
  controls.append(backup, link, reload); node.append(message, controls);
  const stop = store.onStatusChange(() => { node.hidden = store.durable; message.textContent = store.message; });
  return { node, dispose() { stop(); if (url) URL.revokeObjectURL(url); } };
}

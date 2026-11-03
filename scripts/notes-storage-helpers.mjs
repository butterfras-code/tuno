/** Read the real transactional store; keep browser tests independent of UI timing details. */
export async function waitNotesSaved(page) {
  await page.locator('.notes-saving-notice[aria-busy="false"]').waitFor({ state: 'attached' });
}
export async function readNotesData(page, select = data => data) {
  await waitNotesSaved(page);
  const data = await page.evaluate(async () => {
    const opening = indexedDB.open('tunotes-progress', 1);
    const db = await new Promise((resolve, reject) => { opening.onsuccess = () => resolve(opening.result); opening.onerror = () => reject(opening.error); });
    try {
      const tx = db.transaction(['meta', 'profiles']);
      const get = request => new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
      const [state, rows] = await Promise.all([get(tx.objectStore('meta').get('state')), get(tx.objectStore('profiles').getAll())]);
      return { appId: 'tunotes', schemaVersion: 7, configuration: state.configuration, customPresets: state.customPresets, profiles: state.profileIds.map(id => rows.find(row => row.value.id === id).value) };
    } finally { db.close(); }
  });
  return select(data);
}

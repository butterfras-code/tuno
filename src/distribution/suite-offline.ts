import { prepareOffline } from './offline.ts';
let prepared = false;
/** Cache the launcher and tUno aliases without taking over sibling app caches. */
export function prepareSuiteOffline() {
  if (prepared || location.protocol === 'file:' || ['/tone/', '/tempo/'].includes(location.pathname)) return;
  prepared = true;
  prepareOffline(document.createElement('p'), { id: 'suite', name: 'Practice Tools' }, { worker: '/suite-sw.js', scope: '/' });
}

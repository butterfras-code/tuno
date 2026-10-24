import { prepareOffline } from './offline.ts';
let prepared = false;
/** Cache the launcher and tUno aliases without taking over sibling app caches. */
export function prepareSuiteOffline(container?: HTMLElement) {
  if (prepared || ['/tone/', '/tempo/'].includes(location.pathname)) return;
  prepared = true;
  const status = document.createElement('p');
  if (container) { status.id = 'offline-status'; container.append(status); }
  prepareOffline(status, { id: 'suite', name: 'Practice Tools' }, { worker: '/suite-sw.js', scope: '/' });
}

import './styles.css';
import { createPracticeStore } from './practice/state.ts';
import { mountApp } from './ui/app.ts';
import { keepPreferences } from './practice/preferences.ts';

import { connectToolRoutes } from './shared/ui/tuno-routes.ts';

import { readActivityLink } from './shared/sharing/activity-link.ts';
import { sharedActivityNotice } from './shared/sharing/share-control.ts';
import { applyTools, toolAdapter } from './practice/sharing.ts';

async function start() {
const link = await readActivityLink(location.href, toolAdapter);
const root = document.querySelector<HTMLElement>('#app')!;
if (link.kind === 'error') { root.append(sharedActivityNotice(link,toolAdapter)); return; }
const store = createPracticeStore();
try { keepPreferences(store, window.localStorage, link.kind !== 'loaded'); } catch { /* Some browsers block local storage. */ }
if (link.kind === 'loaded') applyTools(store,link.value);
connectToolRoutes(store);
mountApp(root, store);
if (link.kind === 'loaded') root.querySelector('main')!.prepend(sharedActivityNotice(link,toolAdapter));
}
void start();

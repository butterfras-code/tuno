import './styles.css';
import { createPracticeStore } from './practice/state.ts';
import { mountApp } from './ui/app.ts';
import { keepPreferences } from './practice/preferences.ts';

import { connectToolRoutes } from './shared/ui/tuno-routes.ts';

const store = createPracticeStore();
try { keepPreferences(store, window.localStorage); } catch { /* Some browsers block local storage. */ }
connectToolRoutes(store);
mountApp(document.querySelector<HTMLElement>('#app')!, store);

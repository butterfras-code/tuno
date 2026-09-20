import './styles.css';
import { createPracticeStore } from './practice/state.ts';
import { mountApp } from './ui/app.ts';
import { keepPreferences } from './practice/preferences.ts';

const store = createPracticeStore();
try { keepPreferences(store, window.localStorage); } catch { /* Some browsers block local storage. */ }
mountApp(document.querySelector<HTMLElement>('#app')!, store);

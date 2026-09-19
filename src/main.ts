import './styles.css';
import { createPracticeStore } from './practice/state.ts';
import { mountApp } from './ui/app.ts';

mountApp(document.querySelector<HTMLElement>('#app')!, createPracticeStore());

import { el } from './components.ts';
import { prepareSuiteOffline } from '../../distribution/suite-offline.ts';
import './app-header.css';

/** Shared presentation only; each application owns its navigation and state. */
export function createAppHeader(title: string, subtitle: string) {
  const header = el('header', 'app-header suite-header');
  const tools = el('a', 'control suite-tools', '← Tools');
  tools.href = '/';
  const brand = el('div', 'brand');
  brand.append(el('h1', 'wordmark', title), el('p', 'tagline', subtitle));
  header.append(tools, brand);
  prepareSuiteOffline();
  return header;
}

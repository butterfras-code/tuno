import { el } from './components.ts';
import { createInformationControls } from './information.ts';
import { tuno, type AppIdentity } from '../../distribution/identity.ts';
import './app-footer.css';

/** One suite footer; callers retain ownership of offline status and live errors. */
export function createAppFooter(options: { app?: AppIdentity; status?: HTMLElement; message?: HTMLElement } = {}) {
  const { footerNavigation, dialogs } = createInformationControls(options.app ?? tuno);
  const node = el('footer', 'suite-footer');
  const reassurance = el('div', 'suite-footer-status');
  reassurance.append(el('p', '', 'Free and ad-free. Your practice stays on your device.'));
  if (options.status) reassurance.append(options.status);
  node.append(reassurance, footerNavigation);
  if (options.message) node.append(options.message);
  node.append(...dialogs);
  return node;
}

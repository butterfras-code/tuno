import './information.css';
import { createReleaseControls } from '../distribution/release.ts';
import { button, el } from './components.ts';

/** Native dialogs contain focus, handle Escape, and restore focus to the opener. */
export function createInformationControls() {
  const dialogs: HTMLElement[] = [];
  const createDialog = (id: string, title: string, content: HTMLElement[], popover = false) => {
    const dialog = popover ? el('div', 'settings-dialog information-dialog install-popover') : el('dialog', 'settings-dialog information-dialog');
    if (popover) { dialog.popover = 'auto'; dialog.setAttribute('role', 'dialog'); }
    dialog.id = id;
    dialog.setAttribute('aria-labelledby', `${id}-heading`);
    const heading = el('h2', '', title);
    heading.id = `${id}-heading`;
    const close = button('Close', () => popover ? dialog.hidePopover() : (dialog as HTMLDialogElement).close());
    close.autofocus = true;
    const actions = el('div', 'information-actions');
    actions.append(close);
    dialog.append(heading, ...content, actions);
    dialogs.push(dialog);
    return (label: string, className?: string) => {
      const trigger = button(label, popover ? undefined : () => (dialog as HTMLDialogElement).showModal());
      if (popover) trigger.popoverTargetElement = dialog;
      trigger.setAttribute('aria-haspopup', 'dialog');
      trigger.setAttribute('aria-controls', id);
      if (className) trigger.classList.add(className);
      return trigger;
    };
  };
  const install = createDialog('install-information', 'Keep tUno close', [
    el('p', '', 'tUno is free and ad-free. Install it in your browser or download one HTML file to practice offline.'),
    el('p', '', location.protocol === 'file:'
      ? 'You are using the downloaded offline copy. Keep this HTML file and open it whenever you want to practice.'
      : 'Use Install tUno when offered, or look for Install app / Add to Home Screen in your browser’s menu. On iPhone or iPad, open Safari’s Share menu and choose Add to Home Screen.'),
    el('p', '', 'Wait for “Offline ready” before reopening the browser app without a connection. The downloaded HTML is a separate copy; keep the file to use it again.'),
    createReleaseControls(),
  ], true);
  const licenses = el('details', 'licenses');
  licenses.append(el('summary', '', 'Font licenses'), el('pre', 'license-text', FONT_LICENSES));
  const fontSources = el('p', '', 'Font source and license: ');
  for (const [index, [name, path]] of [['Nunito', 'nunito'], ['Nunito Sans', 'nunitosans']].entries()) {
    if (index) fontSources.append(' · ');
    const link = el('a', '', name);
    link.href = `https://github.com/google/fonts/blob/main/ofl/${path}/OFL.txt`;
    fontSources.append(link);
  }
  const about = createDialog('about-information', 'About tUno', [
    el('p', '', 'A tuner, reference tone, and metronome for practicing with a friend. Free to use, with no ads.'),
    el('p', '', 'Project source and Uno artwork licenses are still being chosen. No public redistribution license has been granted yet.'),
    el('p', '', 'Bundled fonts include their complete license notices below.'), fontSources, licenses,
  ]);
  const uno = createDialog('uno-information', 'Meet Uno', [
    el('p', '', 'Uno is the friend at the heart of tUno.'),
    el('p', 'information-placeholder', 'A personal tribute to Uno is coming soon.'),
  ]);
  const privacy = createDialog('privacy-information', 'Your privacy', [
    el('p', '', 'Your microphone helps tUno hear a note. That sound stays on your device. tUno does not record it or send it to a server.'),
    el('p', '', 'Your practice settings are saved in this browser when storage is available. Clear this site’s data in your browser to remove them. A downloaded file may keep settings separately, depending on your browser.'),
    el('p', '', 'There are no ads or tracking analytics in tUno. Opening the website or getting an update uses the internet. Once it says “Offline ready,” you can practice without a connection.'),
  ]);
  const support = createDialog('support-information', 'Support tUno', [
    el('p', '', 'tUno is free and ad-free.'),
    el('p', 'information-placeholder', 'A Ko-fi support link is coming soon.'),
  ]);
  const footerNavigation = el('nav', 'information-navigation');
  footerNavigation.setAttribute('aria-label', 'About and support');
  footerNavigation.append(about('About'), uno('Uno'), support('Support'), privacy('Privacy'));
  return { installButton: install('Install', 'install-control'), footerNavigation, dialogs };
}

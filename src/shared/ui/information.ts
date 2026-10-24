import { createFeedbackLink } from './feedback.ts';
import './app-footer.css';
import projectLicense from '../../../LICENSE.txt';
import { createInstallControl } from '../../distribution/release.ts';
import { button, el } from './components.ts';

import type { AppIdentity } from '../../distribution/identity.ts';
import { tuno } from '../../distribution/identity.ts';
import nunitoLicense from '../../assets/fonts/nunito-OFL.txt';
import sansLicense from '../../assets/fonts/nunito-sans-OFL.txt';

/** Native dialogs contain focus, handle Escape, and restore focus to the opener. */
export function createInformationControls(app: AppIdentity = tuno) {
  const dialogs: HTMLElement[] = [];
  const createDialog = (id: string, title: string, content: HTMLElement[]) => {
    const dialog = el('dialog', 'information-dialog');
    dialog.id = id;
    dialog.setAttribute('aria-labelledby', `${id}-heading`);
    const heading = el('h2', '', title);
    heading.id = `${id}-heading`;
    heading.tabIndex = -1;
    heading.autofocus = true;
    const close = button('Close', () => dialog.close());
    const actions = el('div', 'information-actions');
    actions.append(close);
    dialog.append(heading, ...content, actions);
    dialogs.push(dialog);
    return (label: string) => {
      const trigger = button(label, () => dialog.showModal());
      trigger.setAttribute('aria-haspopup', 'dialog');
      trigger.setAttribute('aria-controls', id);
      return trigger;
    };
  };
  const licenses = el('details', 'licenses');
  licenses.append(el('summary', '', 'Font licenses'), el('pre', 'license-text', [nunitoLicense, sansLicense].join('\n\n')));
  const fontSources = el('p', '', 'Font source and license: ');
  for (const [index, [name, path]] of [['Nunito', 'nunito'], ['Nunito Sans', 'nunitosans']].entries()) {
    if (index) fontSources.append(' · ');
    const link = el('a', '', name);
    link.href = `https://github.com/google/fonts/blob/main/ofl/${path}/OFL.txt`;
    fontSources.append(link);
  }
  const projectTerms = el('details', 'licenses');
  projectTerms.append(el('summary', '', 'GNU GPLv3 license'), el('pre', 'license-text', projectLicense));
  const source = el('a', '', 'Source code for this version');
  source.href = document.querySelector<HTMLMetaElement>(`meta[name="${app.id}-source"]`)?.content
    ?? 'https://github.com/butterfras-code/tuno';
  const sourceParagraph = el('p');
  sourceParagraph.append(source);
  const about = createDialog('about-information', `About ${app.name}`, [
    el('p', '', 'Uno’s Practice Tools: tuning, reference tones, tempo, note reading, and rhythm practice with a friend. Free to use, with no ads.'),
    el('p', '', 'Copyright © 2026 Justin Butterfras. tUno’s code and original artwork are licensed under the GNU General Public License, version 3 (GPLv3). You can share and change them under that license. There is no warranty.'),
    sourceParagraph, projectTerms,
    el('p', '', 'Bundled fonts include their complete license notices below.'), fontSources, licenses,
  ]);
  const supportLink = () => {
    const link = el('a', 'control', 'Support on Ko-fi');
    link.href = 'https://ko-fi.com/qjayapp';
    return link;
  };
  const uno = createDialog('uno-information', 'Meet Uno', [
    el('p', '', 'Uno was my first dog and my best friend. Always the goodest boy.'),
    el('p', '', 'I was sick of being sad when reminded of him, so now he can bring a little joy into our lives every day.'),
    el('p', '', 'If you find value in this project, please consider giving time or service to your local animal shelter—or, if you must, supporting this project via the link below so I can make more cute things.'),
    supportLink(),
  ]);
  const privacy = createDialog('privacy-information', 'Your privacy', [
    el('p', '', 'When you use a tool that listens, your microphone audio is processed on your device. The tools do not record it or send it to a server.'),
    el('p', '', 'Your practice settings and progress are saved in this browser when storage is available. Clear this site’s data in your browser to remove them.'),
    el('p', '', 'There are no ads or tracking analytics in Uno’s Practice Tools. Opening the website or getting an update uses the internet. Open each tool online first. Once it says “Offline ready,” you can practice without a connection.'),
  ]);
  const tips = createDialog('tips-information', 'Tech tips', [
    el('p', '', 'Open each tool online and wait for “Offline ready” before practicing without a connection. Use Install for browser-specific installation help.'),
    el('p', '', 'If the tuner cannot hear your instrument, check your microphone permission and move closer to the mic.'),
    el('p', '', 'Noise cancellation or voice isolation can filter out musical notes. Try turning these features off in your device or headset settings if the signal is weak.'),
  ]);
  const footerNavigation = el('nav', 'information-navigation');
  footerNavigation.setAttribute('aria-label', 'Information and installation');
  footerNavigation.append(createInstallControl(app), about('About'), uno('Uno'), tips('Tech tips'), privacy('Privacy'), createFeedbackLink());
  return { footerNavigation, dialogs };
}

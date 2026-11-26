import { createAppFooter } from '../shared/ui/app-footer.ts';
import './styles.css';
import tuneArtwork from '../assets/launcher/tune.svg';
import tuneFiresideArtwork from '../assets/launcher/tune-fireside.svg';
import notesArtwork from '../assets/launcher/notes.svg';
import notesFiresideArtwork from '../assets/launcher/notes-fireside.svg';
import rhythmArtwork from '../assets/launcher/rhythm.svg';
import rhythmFiresideArtwork from '../assets/launcher/rhythm-fireside.svg';
import { el } from '../shared/ui/components.ts';
import { prepareSuiteOffline } from '../distribution/suite-offline.ts';
import { createUpdateNotice } from '../distribution/updates.ts';
import { initTheme, subscribeTheme } from '../shared/theme/state.ts';
import { pickAsset, type ThemedAssetVariants } from '../shared/theme/assets.ts';

initTheme();
const main = document.querySelector('main')!;
const brand = el('header', 'launcher-brand');
brand.append(el('h1', '', 'tUno'), el('p', '', "Uno's Practice Tools"));
const cards = el('nav', 'launcher-cards'); cards.setAttribute('aria-label', 'Practice tools');
const cardImages: { image: HTMLImageElement; variants: ThemedAssetVariants }[] = [];
for (const [name, subtitle, href, variants] of [
  ['tUno', 'Tuner, Tone Generator & Metronome', '/tune/', { default: tuneArtwork, fireside: tuneFiresideArtwork }],
  ['tuNotes', 'Note Reading Practice', '/notes/', { default: notesArtwork, fireside: notesFiresideArtwork }],
  ['Uno234', 'Rhythm & Counting Practice', '/rhythm/', { default: rhythmArtwork, fireside: rhythmFiresideArtwork }],
] as const) {
  const card = el('a', 'launcher-card'); card.href = href;
  const image = el('img'); image.src = pickAsset(variants); image.alt = '';
  cardImages.push({ image, variants });
  const arrow = el('span', 'launcher-arrow', '→'); arrow.setAttribute('aria-hidden', 'true');
  card.append(image, el('h2', '', name), el('p', '', subtitle), arrow); cards.append(card);
}
subscribeTheme(theme => {
  for (const item of cardImages) item.image.src = pickAsset(item.variants, theme);
});
const status = el('div');
const footer = createAppFooter({ status });
main.append(brand, createUpdateNotice(), cards, footer);
prepareSuiteOffline(status);

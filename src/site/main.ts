import './styles.css';
import tuneArtwork from '../assets/launcher/tune.svg';
import notesArtwork from '../assets/launcher/notes.svg';
import rhythmArtwork from '../assets/launcher/rhythm.svg';
import { el } from '../shared/ui/components.ts';
import { prepareSuiteOffline } from '../distribution/suite-offline.ts';
const main = document.querySelector('main')!;
const brand = el('header', 'launcher-brand');
brand.append(el('h1', '', 'tUno'), el('p', '', "Uno's Practice Tools"));
const cards = el('nav', 'launcher-cards'); cards.setAttribute('aria-label', 'Practice tools');
for (const [name, subtitle, href, artwork] of [
  ['tUno', 'Tuner, Tone Generator & Metronome', '/tune/', tuneArtwork],
  ['tuNotes', 'Note Reading Practice', '/notes/', notesArtwork],
  ['Uno234', 'Rhythm & Counting Practice', '/rhythm/', rhythmArtwork],
]) {
  const card = el('a', 'launcher-card'); card.href = href!;
  const image = el('img'); image.src = artwork!; image.alt = '';
  const arrow = el('span', 'launcher-arrow', '→'); arrow.setAttribute('aria-hidden', 'true');
  card.append(image, el('h2', '', name), el('p', '', subtitle), arrow); cards.append(card);
}
main.append(brand, cards);
prepareSuiteOffline();

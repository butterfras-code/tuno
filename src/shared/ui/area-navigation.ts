import tuneArtwork from '../../assets/launcher/tune.svg';
import notesArtwork from '../../assets/launcher/notes.svg';
import rhythmArtwork from '../../assets/launcher/rhythm.svg';
import { el } from './components.ts';
import './area-navigation.css';

export function createAreaNavigation(current: 'tuno' | 'tunotes' | 'rhythm') {
  const navigation = el('nav', 'area-navigation');
  navigation.setAttribute('aria-label', 'Other practice areas');
  for (const area of [
    { id: 'tuno', name: 'tUno', href: '/tune/', graphic: tuneArtwork },
    { id: 'tunotes', name: 'tuNotes', href: '/notes/', graphic: notesArtwork },
    { id: 'rhythm', name: 'Uno234', href: '/rhythm/', graphic: rhythmArtwork },
  ]) {
    if (area.id === current) continue;
    const link = el('a', 'area-link');
    link.href = area.href;
    const graphic = el('img');
    Object.assign(graphic, { src: area.graphic, alt: '', width: 48, height: 48 });
    link.append(graphic, el('span', '', area.name));
    navigation.append(link);
  }
  return navigation;
}

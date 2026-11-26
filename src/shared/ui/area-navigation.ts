import tuneArtwork from '../../assets/launcher/tune.svg';
import tuneFiresideArtwork from '../../assets/launcher/tune-fireside.svg';
import notesArtwork from '../../assets/launcher/notes.svg';
import notesFiresideArtwork from '../../assets/launcher/notes-fireside.svg';
import rhythmArtwork from '../../assets/launcher/rhythm.svg';
import rhythmFiresideArtwork from '../../assets/launcher/rhythm-fireside.svg';
import { el } from './components.ts';
import { onUnmount } from './unmount.ts';
import { pickAsset, type ThemedAssetVariants } from '../theme/assets.ts';
import { subscribeTheme, type ThemeId } from '../theme/state.ts';
import './area-navigation.css';

const areaArt: Record<'tuno' | 'tunotes' | 'rhythm', ThemedAssetVariants> = {
  tuno: { default: tuneArtwork, fireside: tuneFiresideArtwork },
  tunotes: { default: notesArtwork, fireside: notesFiresideArtwork },
  rhythm: { default: rhythmArtwork, fireside: rhythmFiresideArtwork },
};

export function createAreaNavigation(current: 'tuno' | 'tunotes' | 'rhythm') {
  const navigation = el('nav', 'area-navigation');
  navigation.setAttribute('aria-label', 'Other practice areas');
  const images: { image: HTMLImageElement; variants: ThemedAssetVariants }[] = [];
  for (const area of [
    { id: 'tuno' as const, name: 'tUno', href: '/tune/' },
    { id: 'tunotes' as const, name: 'tuNotes', href: '/notes/' },
    { id: 'rhythm' as const, name: 'Uno234', href: '/rhythm/' },
  ]) {
    if (area.id === current) continue;
    const link = el('a', 'area-link');
    link.href = area.href;
    const graphic = el('img');
    const variants = areaArt[area.id];
    Object.assign(graphic, { src: pickAsset(variants), alt: '', width: 48, height: 48 });
    images.push({ image: graphic, variants });
    link.append(graphic, el('span', '', area.name));
    navigation.append(link);
  }
  const unsubscribe = subscribeTheme((theme: ThemeId) => {
    for (const item of images) item.image.src = pickAsset(item.variants, theme);
  });
  onUnmount(navigation, unsubscribe);
  return navigation;
}

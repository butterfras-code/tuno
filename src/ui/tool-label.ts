import tuningForkAsset from '../assets/icons/tuning-fork.svg';
import keyboardAsset from '../assets/icons/keyboard.svg';
import metronomeAsset from '../assets/icons/metronome.svg';
import type { Focus } from '../practice/state.ts';
import { el } from './components.ts';
import './tool-label.css';

const presentations = {
  tuner: { label: 'Tune', icon: tuningForkAsset },
  tone: { label: 'Tone', icon: keyboardAsset },
  metronome: { label: 'UnoMet', icon: metronomeAsset },
} satisfies Record<Focus, { label: string; icon: string }>;

export function toolLabel(node: HTMLElement, tool: Focus, uppercase = false) {
  const { label, icon: asset } = presentations[tool];
  const icon = el('span', 'tool-icon');
  icon.setAttribute('aria-hidden', 'true');
  icon.style.maskImage = `url(${JSON.stringify(asset)})`;
  node.classList.add('tool-label');
  node.replaceChildren(icon, el('span', '', uppercase ? label.toUpperCase() : label));
}

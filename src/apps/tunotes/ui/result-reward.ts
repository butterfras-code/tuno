import { el } from '../../../shared/ui/components.ts';
import treatAsset from '../../../assets/uno-treat.svg';
import restAsset from '../../../assets/uno-rest.svg';
import happyAsset from '../../../assets/uno-happy.svg';

/** Static results artwork stays independent of the live reward animation. */
export function resultReward() {
  const node = el('div','result-reward');
  const image = el('img','result-uno');
  const total = el('p','result-treats');
  node.append(image,total);
  return {
    node,
    update(treats: number, pose: 'treat' | 'rest' | 'happy') {
      image.src = pose === 'treat' ? treatAsset : pose === 'rest' ? restAsset : happyAsset;
      image.alt = pose === 'treat' ? 'Uno sitting with a treat' : pose === 'rest' ? 'Uno sleeping' : 'Uno sitting happily';
      total.textContent = `${treats} ${treats === 1 ? 'treat' : 'treats'} earned this session`;
    },
  };
}

import { el } from '../../../shared/ui/components.ts';
import { onUnmount } from '../../../shared/ui/unmount.ts';
import treatAsset from '../../../assets/uno-treat.svg';
import treatFiresideAsset from '../../../assets/uno-treat-fireside.svg';
import restAsset from '../../../assets/uno-rest.svg';
import restFiresideAsset from '../../../assets/uno-rest-fireside.svg';
import happyAsset from '../../../assets/uno-happy.svg';
import happyFiresideAsset from '../../../assets/uno-happy-fireside.svg';
import { pickAsset, type ThemedAssetVariants } from '../../../shared/theme/assets.ts';
import { subscribeTheme, type ThemeId } from '../../../shared/theme/state.ts';

const rewardArt: Record<'treat' | 'rest' | 'happy', ThemedAssetVariants> = {
  treat: { default: treatAsset, fireside: treatFiresideAsset },
  rest: { default: restAsset, fireside: restFiresideAsset },
  happy: { default: happyAsset, fireside: happyFiresideAsset },
};

/** Static results artwork stays independent of the live reward animation. */
export function resultReward() {
  const node = el('div','result-reward');
  const image = el('img','result-uno');
  const total = el('p','result-treats');
  node.append(image,total);
  let currentPose: 'treat' | 'rest' | 'happy' | null = null;
  const syncArtwork = (theme?: ThemeId) => {
    if (!currentPose) return;
    image.src = pickAsset(rewardArt[currentPose], theme);
  };
  onUnmount(node, subscribeTheme(syncArtwork));
  return {
    node,
    update(treats: number, pose: 'treat' | 'rest' | 'happy') {
      currentPose = pose;
      syncArtwork();
      image.alt = pose === 'treat' ? 'Uno sitting with a treat' : pose === 'rest' ? 'Uno sleeping' : 'Uno sitting happily';
      total.textContent = `${treats} ${treats === 1 ? 'treat' : 'treats'} earned this session`;
    },
  };
}

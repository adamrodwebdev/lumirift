import { FALLING_SCENES } from '@/showcase/fallingScenes';
import { MOSAIC_SCENES } from '@/showcase/mosaicScenes';
import { SAND_SCENES } from '@/showcase/sandScenes';
import { TOWER_SCENES } from '@/showcase/towerScenes';

export type { Scene } from '@/showcase/Scene';

/**
 * The scenes of the preview videos: the title screen's reel (src/showcase),
 * real games of the real engines staged through their public options, under
 * the names the recorder (scripts/crazygames-media.mjs) asks for.
 */
export const SCENES = {
  elements: SAND_SCENES.elements,
  worm: SAND_SCENES.duneWorm,
  eye: TOWER_SCENES.towerEye,
  golem: MOSAIC_SCENES.ceramicGolem,
  heart: FALLING_SCENES.riftHeart,
  flip: FALLING_SCENES.flip,
  tilt: FALLING_SCENES.tilt,
  mirror: FALLING_SCENES.mirror,
} as const;
export type SceneName = keyof typeof SCENES;

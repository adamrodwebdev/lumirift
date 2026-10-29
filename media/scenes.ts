import { FALLING_SCENES } from '@/showcase/fallingScenes';
import { FEEL_SCENES } from '@/showcase/feelScenes';
import { MOSAIC_SCENES } from '@/showcase/mosaicScenes';
import { SAND_SCENES, type FireChoice } from '@/showcase/sandScenes';
import type { Scene } from '@/showcase/Scene';
import { TOWER_SCENES } from '@/showcase/towerScenes';

export type { Scene } from '@/showcase/Scene';
export type { FireChoice } from '@/showcase/sandScenes';

/** A scene by its variant (its seed and staging), and for a challenge the answer played. */
type SceneMaker = (variant: number, choice: FireChoice | null) => Scene;

/**
 * The scenes of the preview videos and the clip factory (1.39): the title
 * screen's reel (src/showcase), real games of the real engines staged
 * through their public options, under the names the recorders
 * (scripts/crazygames-media.mjs, scripts/yandex-media.mjs,
 * scripts/clip-factory.mjs) ask for.
 */
export const SCENES = {
  elements: (variant) => SAND_SCENES.elements(variant),
  worm: () => SAND_SCENES.duneWorm(),
  eye: () => TOWER_SCENES.towerEye(),
  golem: () => MOSAIC_SCENES.ceramicGolem(),
  heart: () => FALLING_SCENES.riftHeart(),
  flip: () => FALLING_SCENES.flip(),
  tilt: () => FALLING_SCENES.tilt(),
  mirror: () => FALLING_SCENES.mirror(),
  fireOnOil: (variant) => SAND_SCENES.fireOnOil(variant),
  lightningInWater: (variant) => SAND_SCENES.lightningInWater(variant),
  fireChoice: (variant, choice) => SAND_SCENES.fireChoice(variant, choice),
  feelDrop: () => FEEL_SCENES.feelDrop(),
  feelLine: () => FEEL_SCENES.feelLine(),
  feelRift: () => FEEL_SCENES.feelRift(),
  feelCombo: () => FEEL_SCENES.feelCombo(),
} as const satisfies Record<string, SceneMaker>;
export type SceneName = keyof typeof SCENES;

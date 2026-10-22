import type { GameSession } from '@/session/GameSession';

/**
 * A staged moment of a real game, for the title screen's reel and the store
 * videos: a real engine set up through its public options to show, within
 * seconds, what no other game of the genre has, and the hand that plays it
 * (a script or the AI). Nothing is faked: the rules play the moment out.
 */
export interface Scene {
  readonly session: GameSession;
  /** Called every frame, before the session's update: the player's moves. */
  readonly drive: (deltaMs: number) => void;
  /** The scene is over: its hand lets go and its session is disposed. */
  readonly dispose: () => void;
}

/** The moments of the reel, in the order they play. */
export const SCENE_IDS = [
  'elements',
  'flip',
  'duneWorm',
  'tilt',
  'ceramicGolem',
  'mirror',
  'towerEye',
  'riftHeart',
] as const;
export type SceneId = (typeof SCENE_IDS)[number];

/** The family whose well draws a scene (each one is its own chunk of code). */
export type SceneFamily = 'sand' | 'falling' | 'tower' | 'mosaic';

export const SCENE_FAMILIES: Readonly<Record<SceneId, SceneFamily>> = {
  elements: 'sand',
  flip: 'falling',
  duneWorm: 'sand',
  tilt: 'falling',
  ceramicGolem: 'mosaic',
  mirror: 'falling',
  towerEye: 'tower',
  riftHeart: 'falling',
};

/**
 * How long each moment plays on the title screen (ms): long enough for its
 * peak to land and be seen, short enough for the loop to stay lively.
 */
export const SCENE_MS: Readonly<Record<SceneId, number>> = {
  elements: 4800,
  flip: 3000,
  duneWorm: 4000,
  tilt: 3000,
  ceramicGolem: 3200,
  mirror: 3000,
  towerEye: 3000,
  riftHeart: 3000,
};

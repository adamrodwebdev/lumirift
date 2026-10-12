/** Families of games: each one has its own engine, renderer and commands. */
export const FAMILY_IDS = ['falling', 'sand', 'placement', 'volume'] as const;
export type FamilyId = (typeof FAMILY_IDS)[number];

/** Modes of the falling family implemented so far (grows with each lot). */
export const FALLING_MODE_IDS = [
  'classic',
  'tide',
  'flip',
  'chroma',
  'mirror',
  'fusion',
  'tilt',
  'silhouette',
  'rhythm',
  'duel',
] as const;
export type FallingModeId = (typeof FALLING_MODE_IDS)[number];

/** Modes of the placement family. */
export const PLACEMENT_MODE_IDS = ['mosaic'] as const;
export type PlacementModeId = (typeof PLACEMENT_MODE_IDS)[number];

/** Modes of the sand family. */
export const SAND_MODE_IDS = ['sand'] as const;

/** Modes of the volume family: the falling engine on a well that wraps around. */
export const VOLUME_MODE_IDS = ['tower'] as const;
export type VolumeModeId = (typeof VOLUME_MODE_IDS)[number];

/** Modes played by the falling engine (`Game` + `GameMode`). */
export type EngineModeId = FallingModeId | VolumeModeId;

export const MODE_IDS = [
  ...FALLING_MODE_IDS,
  ...SAND_MODE_IDS,
  ...PLACEMENT_MODE_IDS,
  ...VOLUME_MODE_IDS,
] as const;
export type ModeId = (typeof MODE_IDS)[number];

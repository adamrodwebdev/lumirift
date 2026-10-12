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
] as const;
export type FallingModeId = (typeof FALLING_MODE_IDS)[number];

export const MODE_IDS = [...FALLING_MODE_IDS] as const;
export type ModeId = (typeof MODE_IDS)[number];

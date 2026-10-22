export const EFFECT_LEVELS = ['full', 'reduced', 'off'] as const;
export type EffectsLevel = (typeof EFFECT_LEVELS)[number];

/** What the visual effects may do, derived from the player's settings. */
export interface EffectsProfile {
  /** Multiplier of the particle counts (0: no particles). */
  readonly particles: number;
  /** Rows crack before shattering, then the stack falls with weight. */
  readonly destruction: boolean;
  /** The screen shakes on big clears. */
  readonly shake: boolean;
  /** Whole-well animations (flip, mirror, trails, waves). */
  readonly motion: boolean;
  /** Delay before the game-over dialog, to watch the stack collapse. */
  readonly gameOverDelayMs: number;
}

/** Each level's effects; only `full` lets the player's shake through. */
const PROFILES: Readonly<
  Record<EffectsLevel, Omit<EffectsProfile, 'shake'> & { readonly shakes: boolean }>
> = {
  full: { particles: 1, destruction: true, motion: true, gameOverDelayMs: 1100, shakes: true },
  // Calmer: fewer particles, nothing moves the whole well, no shake.
  reduced: {
    particles: 0.35,
    destruction: true,
    motion: false,
    gameOverDelayMs: 600,
    shakes: false,
  },
  off: { particles: 0, destruction: false, motion: false, gameOverDelayMs: 0, shakes: false },
};

export function effectsProfile(level: EffectsLevel, shake: boolean): EffectsProfile {
  const { shakes, ...profile } = PROFILES[level];
  return { ...profile, shake: shakes && shake };
}

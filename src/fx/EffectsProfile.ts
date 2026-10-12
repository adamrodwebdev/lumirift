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

export function effectsProfile(level: EffectsLevel, shake: boolean): EffectsProfile {
  switch (level) {
    case 'full':
      return { particles: 1, destruction: true, shake, motion: true, gameOverDelayMs: 1100 };
    case 'reduced':
      // Calmer: fewer particles, nothing moves the whole well, no shake.
      return {
        particles: 0.35,
        destruction: true,
        shake: false,
        motion: false,
        gameOverDelayMs: 600,
      };
    case 'off':
      return { particles: 0, destruction: false, shake: false, motion: false, gameOverDelayMs: 0 };
  }
}

import { Tone } from '@/core/Tone';

/*
 * The elements of the sand well: how each kind of grain moves and how long it
 * lasts, and when each element starts to appear. Pure data: the grid applies
 * the motion, `SandReactions` the chemistry between them.
 */

/** How a grain moves. */
export type Matter =
  /** Falls, slides down diagonally, sinks through liquids (sand, seeds, loose fire). */
  | 'powder'
  /** Falls, spreads sideways; the denser liquid goes under (water, acid, oil). */
  | 'liquid'
  /** Rises and drifts (steam). */
  | 'gas'
  /** Holds still (ice, vines, burning oil). */
  | 'solid';

export const MATTER: Readonly<Partial<Record<Tone, Matter>>> = {
  [Tone.Water]: 'liquid',
  [Tone.Acid]: 'liquid',
  [Tone.Oil]: 'liquid',
  [Tone.Steam]: 'gas',
  [Tone.Ice]: 'solid',
  [Tone.Blaze]: 'solid',
};

/** Sand colours, seeds and loose fire are powders unless listed above. */
export const matterOf = (tone: number): Matter => MATTER[tone as Tone] ?? 'powder';

/** Liquids settle by density: oil floats on water and acid. */
export const DENSITY: Readonly<Partial<Record<Tone, number>>> = {
  [Tone.Water]: 2,
  [Tone.Acid]: 2,
  [Tone.Oil]: 1,
};

/**
 * How many physics steps (16 ms) a grain lasts before it changes: water sets
 * in a colour, fire and blaze die out, oil and acid wear off, ice melts,
 * steam condenses, a seed sprouts by itself. 0: forever (sand).
 */
export const LIFE_STEPS: Readonly<Partial<Record<Tone, number>>> = {
  [Tone.Water]: 360,
  [Tone.Fire]: 220,
  [Tone.Oil]: 1500,
  [Tone.Ice]: 2400,
  [Tone.Steam]: 260,
  [Tone.Seed]: 480,
  [Tone.Acid]: 420,
  [Tone.Blaze]: 34,
};

/** The elements a piece can be made of, in the order they appear in a game. */
export const ELEMENTS = [
  Tone.Water,
  Tone.Fire,
  Tone.Oil,
  Tone.Ice,
  Tone.Lightning,
  Tone.Seed,
  Tone.Acid,
] as const;
export type ElementTone = (typeof ELEMENTS)[number];

/** Level of an endless game from which each element can be dealt. */
export const UNLOCK_LEVEL: Readonly<Record<ElementTone, number>> = {
  [Tone.Water]: 1,
  [Tone.Fire]: 1,
  [Tone.Oil]: 2,
  [Tone.Lightning]: 2,
  [Tone.Ice]: 3,
  [Tone.Seed]: 3,
  [Tone.Acid]: 4,
};

/** How often each element is dealt, relative to the others once unlocked. */
export const WEIGHT: Readonly<Record<ElementTone, number>> = {
  [Tone.Water]: 3,
  [Tone.Fire]: 2.5,
  [Tone.Oil]: 2,
  [Tone.Lightning]: 1.5,
  [Tone.Ice]: 1.5,
  [Tone.Seed]: 1.5,
  [Tone.Acid]: 1,
};

/** The elements of an endless game at this level. */
export const elementsAt = (level: number): readonly ElementTone[] =>
  ELEMENTS.filter((tone) => UNLOCK_LEVEL[tone] <= level);

export const isElement = (tone: number): tone is ElementTone =>
  (ELEMENTS as readonly number[]).includes(tone);

/** Translation key of an element's arrival notice. */
export const NOTICE_OF: Readonly<Record<ElementTone, string>> = {
  [Tone.Water]: 'elementWater',
  [Tone.Fire]: 'elementFire',
  [Tone.Oil]: 'elementOil',
  [Tone.Ice]: 'elementIce',
  [Tone.Lightning]: 'elementLightning',
  [Tone.Seed]: 'elementSeed',
  [Tone.Acid]: 'elementAcid',
};

// --- Reactions tuning ---------------------------------------------------------

/** A blaze born from oil burns this hot (life in steps); each grain of sand it catches gets less. */
export const BLAZE_HEAT = 60;
/** Share of its heat a blaze passes to the sand it catches; below `BLAZE_MIN_HEAT` it stops spreading. */
export const BLAZE_FALLOFF = 0.85;
export const BLAZE_MIN_HEAT = 8;
/** Chance per step that a blaze catches a neighbouring grain of sand. */
export const BLAZE_CATCH = 0.35;
/** Chance per step that water touching ice freezes. */
export const FREEZE_CHANCE = 0.004;
/** Chance per step that acid eats a neighbouring grain; each bite costs it this much life. */
export const ACID_BITE = 0.18;
export const ACID_BITE_COST = 60;
/** Steam high in the well falls back as rain (chance), else it vanishes. */
export const RAIN_CHANCE = 0.5;
export const RAIN_ZONE = 0.3;
/** A vine grows this many grains long (half that without water), one grain every few steps. */
export const VINE_LENGTH = 72;
export const VINE_STEP_EVERY = 2;
/** Ice melted by fire: this many grains at most turn to water at once. */
export const MELT_MAX_GRAINS = 600;

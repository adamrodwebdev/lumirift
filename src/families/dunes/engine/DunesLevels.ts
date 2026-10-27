import { Tone } from '@/core/Tone';
import type { ElementTone } from '@/families/sand/engine/Elements';
import { GUARDIAN_HEALTH } from '@/session/GuardianHealth';

/*
 * The levels of a run of Dunes (1.37): one endless run, a goal at a time
 * (the user's choice, 27/10/2026). Each goal reached opens the next level
 * and earns a swap. The goals are the campaign's kinds (regions cleared, a
 * score, a Guardian defeated), so that a generator can make more of them.
 * Pure data and pure functions.
 */

export type DunesGoal =
  /** Clear this many regions in the level. */
  | { readonly kind: 'regions'; readonly target: number }
  /** Score this many points in the level. */
  | { readonly kind: 'score'; readonly target: number }
  /** Defeat the Dune Wyrm, who comes with this much health. */
  | { readonly kind: 'wyrm'; readonly target: number };

export interface DunesLevel {
  /** 1 for D-1. */
  readonly number: number;
  readonly goal: DunesGoal;
  /** The elements dealt in this level: the earlier levels' and its own. */
  readonly elements: readonly ElementTone[];
  /** The element this level brings (its first hand deals it), or null. */
  readonly brings: ElementTone | null;
  /** How many colours of sand the hands deal (`DUNES_TONES`, in order). */
  readonly colours: number;
}

interface Authored {
  readonly goal: DunesGoal;
  readonly brings?: ElementTone;
}

const regions = (target: number): DunesGoal => ({ kind: 'regions', target });
const score = (target: number): DunesGoal => ({ kind: 'score', target });
const wyrm = (target: number): DunesGoal => ({ kind: 'wyrm', target });

/**
 * The first ten levels, in the order the elements come (Sand's order:
 * water and fire, then lightning and oil, ice, seeds, acid). The Wyrm
 * fights at D-5, weakened, then whole at D-10. Measured by the curve bot.
 */
const AUTHORED: readonly Authored[] = [
  { goal: regions(1) },
  { goal: regions(2), brings: Tone.Water },
  { goal: regions(3), brings: Tone.Fire },
  { goal: score(2500), brings: Tone.Lightning },
  { goal: wyrm(Math.round(GUARDIAN_HEALTH * 0.6)) },
  { goal: regions(4), brings: Tone.Oil },
  { goal: score(4000), brings: Tone.Ice },
  { goal: regions(5), brings: Tone.Seed },
  { goal: score(6000), brings: Tone.Acid },
  { goal: wyrm(GUARDIAN_HEALTH) },
];

/**
 * The fourth colour comes after the first Wyrm: the run's twist. Three
 * colours before it keep a newcomer's run going (the curve bot).
 */
export const FOURTH_COLOUR_LEVEL = 6;

/** After the authored levels: every fifth a Wyrm, between them regions and scores that grow. */
const WYRM_EVERY = 5;

function goalAfter(number: number): DunesGoal {
  if (number % WYRM_EVERY === 0) return wyrm(GUARDIAN_HEALTH);
  const beyond = number - AUTHORED.length;
  return number % 2 === 1
    ? regions(Math.min(8, 5 + Math.floor(beyond / 4)))
    : score(6000 + 1000 * Math.floor(beyond / 2));
}

/** The level of this number (1 for D-1), whatever its number: the run never ends on a level. */
export function dunesLevel(number: number): DunesLevel {
  const authored = AUTHORED[number - 1];
  const elements = AUTHORED.slice(0, Math.min(number, AUTHORED.length))
    .map((level) => level.brings)
    .filter((tone): tone is ElementTone => tone !== undefined);
  return {
    number,
    goal: authored?.goal ?? goalAfter(number),
    elements,
    brings: authored?.brings ?? null,
    colours: number >= FOURTH_COLOUR_LEVEL ? 4 : 3,
  };
}

/** The level of the Wyrm's first fight: the curve bot measures how many get there. */
export const FIRST_WYRM_LEVEL = AUTHORED.findIndex((level) => level.goal.kind === 'wyrm') + 1;

import { SeededRandom, type RandomSource } from '@/core/Random';
import type { AiLevel } from '@/families/falling/ai/AiLevels';
import type { ModeId } from '@/session/ModeId';
import type { Goal, GoalKind } from '../Goals';
import type { CampaignLevel, StarRule } from '../Levels';
import type { GeneratedRole, LevelKind, LevelSlot } from './ChapterPlan';

const MIN = 60_000;
const TIME_LEFT: StarRule = { kind: 'timeLeft' };

/** Draws a level for a slot (1.38): the same draws always give the same level. */
export interface LevelGenerator {
  generate(slot: LevelSlot, random: RandomSource): CampaignLevel;
}

/** What a goal recipe draws: the clock (null: untimed), the goal, how stars are won. */
interface LevelDraft {
  readonly minutes: number | null;
  readonly goal: Goal;
  readonly stars: StarRule;
}

/** The draws of one level: its slot and its random source. */
class LevelDraws {
  constructor(
    private readonly slot: LevelSlot,
    private readonly random: RandomSource,
  ) {}

  pick<T>(items: readonly T[]): T {
    return items[this.random.nextInt(items.length)]!;
  }

  /** A clock for the slot's role, in minutes. */
  minutes(): number {
    return this.pick(CLOCKS[this.slot.role]);
  }

  /**
   * A count a regular reaches at `pace` a minute for `minutes`, asked in the
   * share its role leaves, growing with the chapter, give or take a step.
   */
  target(pace: number, minutes: number): number {
    const step = STEP ** (this.random.nextInt(2 * STEPS + 1) - STEPS);
    const growth = 1 + CHAPTER_GROWTH * (this.slot.chapter - FIRST_GENERATED_CHAPTER);
    return Math.max(1, Math.round(pace * minutes * SHARE_OF_PACE[this.slot.role] * growth * step));
  }
}

/**
 * How a goal is drawn, and its kind. An opt-in recipe is drawn only where a
 * slot asks for its kind (`LevelSlot.goals`): adding one leaves every other
 * slot's levels as they were.
 */
interface GoalRecipe {
  readonly kind: GoalKind;
  readonly optIn?: boolean;
  draw(draws: LevelDraws): LevelDraft;
}

/** A share of a regular's pace each role asks: a breather leaves room, a spike almost none. */
const SHARE_OF_PACE: Readonly<Record<GeneratedRole, number>> = {
  breather: 0.4,
  test: 0.6,
  spike: 0.8,
  finale: 0.9,
};
/** The clocks each role draws from, in minutes: short calm levels, long spikes. */
const CLOCKS: Readonly<Record<GeneratedRole, readonly number[]>> = {
  breather: [2, 2.5, 3],
  test: [2.5, 3, 3.5],
  spike: [3, 3.5, 4],
  finale: [3, 3.5],
};
/**
 * Targets grow this much a chapter, from the first generated one: a regular
 * owns every upgrade by chapter 9, and the late spikes must still press them.
 */
const CHAPTER_GROWTH = 0.08;
const FIRST_GENERATED_CHAPTER = 6;
/** A target is drawn this many steps of 15 % either side of its pace. */
const STEP = 1.15;
const STEPS = 2;

/** Lines (or links, rings) at a regular's pace. */
const lines = (pace: number): GoalRecipe => ({
  kind: 'lines',
  draw: (draws) => {
    const minutes = draws.minutes();
    return {
      minutes,
      goal: { kind: 'lines', target: draws.target(pace, minutes) },
      stars: TIME_LEFT,
    };
  },
});

/** Points at a regular's pace, to the nearest 500; opt-in. */
const points = (pace: number): GoalRecipe => ({
  kind: 'score',
  optIn: true,
  draw: (draws) => {
    const minutes = draws.minutes();
    const target = Math.max(500, Math.round(draws.target(pace, minutes) / 500) * 500);
    return { minutes, goal: { kind: 'score', target }, stars: TIME_LEFT };
  },
});

/** Lines at once (three or more: the player builds for them). */
const bigClear = (targets: readonly number[]): GoalRecipe => ({
  kind: 'bigClear',
  draw: (draws) => ({
    minutes: draws.minutes() + 0.5,
    goal: { kind: 'bigClear', target: draws.pick(targets) },
    stars: TIME_LEFT,
  }),
});

/** Survive the rising tide; stars for the lines cleared on the way. */
const survive = (pace: number): GoalRecipe => ({
  kind: 'survive',
  draw: (draws) => {
    const minutes = draws.minutes() - 0.5;
    const three = draws.target(pace, minutes);
    return {
      minutes,
      goal: { kind: 'survive', target: minutes * MIN },
      stars: { kind: 'lines', two: Math.round(three * 0.6), three },
    };
  },
});

/** Fill the silhouette of the day, without a clock; stars for the speed. */
const fill: GoalRecipe = {
  kind: 'fill',
  draw: (draws) => ({
    minutes: null,
    goal: { kind: 'fill', target: draws.pick([85, 88, 90]) },
    stars: { kind: 'fast', twoMs: 2 * MIN, threeMs: 1.2 * MIN },
  }),
};

/**
 * Measured with the curve bot at the upgrades of chapter 6 (1.38): a
 * regular's lines a minute in each falling mode, before the speed tops the
 * well out; the tide's rows held back, the silhouette filled.
 */
const FALLING_RECIPES: Readonly<Partial<Record<ModeId, readonly GoalRecipe[]>>> = {
  classic: [lines(15), bigClear([3])],
  mirror: [lines(12.5)],
  flip: [lines(15), bigClear([3])],
  fusion: [lines(8)],
  chroma: [lines(15)],
  tilt: [lines(10.5)],
  rhythm: [lines(15)],
  tide: [survive(8)],
  silhouette: [fill],
};

/** A generator of one mode or many, each with its goal recipes. */
class RecipeLevels implements LevelGenerator {
  constructor(private readonly recipes: Readonly<Partial<Record<ModeId, readonly GoalRecipe[]>>>) {}

  generate(slot: LevelSlot, random: RandomSource): CampaignLevel {
    const draws = new LevelDraws(slot, random);
    const modeId = draws.pick(slot.modes ?? (Object.keys(this.recipes) as ModeId[]));
    const recipes = (this.recipes[modeId] ?? []).filter((recipe) =>
      slot.goals ? slot.goals.includes(recipe.kind) : recipe.optIn !== true,
    );
    if (recipes.length === 0) throw new Error(`${slot.id}: no goal to draw for "${modeId}"`);
    const { minutes, goal, stars } = draws.pick(recipes).draw(draws);
    return {
      id: slot.id,
      chapter: slot.chapter,
      modeId,
      timeLimitMs: minutes === null ? null : minutes * MIN,
      goal,
      stars,
    };
  }
}

/** Past the campaign's first finale, the duels are against the two strongest AIs. */
const DUEL_AIS: readonly AiLevel[] = ['hard', 'expert'];

/** A duel against a strong AI, won quickly for the stars. */
class DuelLevels implements LevelGenerator {
  generate(slot: LevelSlot, random: RandomSource): CampaignLevel {
    const draws = new LevelDraws(slot, random);
    const variant = draws.pick(DUEL_AIS);
    return {
      id: slot.id,
      chapter: slot.chapter,
      modeId: 'duel',
      variant,
      timeLimitMs: null,
      goal: { kind: 'win', target: 1 },
      stars: { kind: 'fast', twoMs: 2.5 * MIN, threeMs: 1.5 * MIN },
    };
  }
}

/** The generator of each kind of level (1.38). */
export const LEVEL_GENERATORS: Readonly<Record<LevelKind, LevelGenerator>> = {
  falling: new RecipeLevels(FALLING_RECIPES),
  // Points measured at about 8,000 a minute for a regular (1.38), for the slots that ask for them.
  sand: new RecipeLevels({ sand: [lines(6), points(8000)] }),
  mosaic: new RecipeLevels({ mosaic: [lines(10), bigClear([3, 4])] }),
  tower: new RecipeLevels({ tower: [lines(4.5)] }),
  duel: new DuelLevels(),
};

/** The level a slot draws from a seed: the same seed, the same level, on any machine. */
export function generateLevel(slot: LevelSlot, seed: number): CampaignLevel {
  return LEVEL_GENERATORS[slot.kind].generate(
    slot,
    SeededRandom.fromString(`level:${slot.id}:${seed}`),
  );
}

/** Each goal in words, for a level's idea. */
const GOAL_WORDS: Readonly<Record<GoalKind, (target: number) => string>> = {
  lines: (target) => `${target} lines`,
  score: (target) => `${target} points`,
  bigClear: (target) => `${target} lines at once`,
  survive: (target) => `hold ${target / MIN} minutes`,
  win: () => 'win',
  fill: (target) => `fill ${target} %`,
  boss: (target) => `strike ${target}`,
};

/** A generated level's idea, in words, for its beat chart and the search's report. */
export function ideaOf(level: CampaignLevel): string {
  const { goal, timeLimitMs, variant } = level;
  const clock =
    timeLimitMs === null || goal.kind === 'survive' ? '' : ` in ${timeLimitMs / MIN} min`;
  const against = variant ? ` against the ${variant} AI` : '';
  return `${level.modeId}: ${GOAL_WORDS[goal.kind](goal.target)}${clock}${against}`;
}

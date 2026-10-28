import type { BeatChart } from '../BeatCharts';
import { CURVE_SEEDS } from '../curve/CurveBands';
import type { PlayerSkill } from '../curve/CurvePlayer';
import type { CampaignLevel } from '../Levels';
import type { PackedLevel } from '../packs';
import { chartOf, type LevelSlot } from './ChapterPlan';
import { generateLevel, ideaOf } from './LevelGenerators';

/** What the curve bot found of a level on a set of games. */
export interface LevelVerdict {
  /** How it strays from its band, in words (none when it is in it). */
  readonly problems: readonly string[];
  /** Each player's wins. */
  readonly wins: Readonly<Record<PlayerSkill, number>>;
  /** Its reference player's intensity, third by third. */
  readonly intensity: readonly number[];
}

/** The bot's judge: a level, its chart and the seeds of the games to play. */
export type LevelJudge = (
  level: CampaignLevel,
  chart: BeatChart,
  seeds: readonly number[],
) => LevelVerdict;

/** A candidate the bot turned down, and why. */
export interface RejectedLevel {
  readonly seed: number;
  readonly idea: string;
  readonly problems: readonly string[];
}

/** A candidate that held its band on both sets of games. */
export interface FittingLevel extends PackedLevel {
  readonly idea: string;
  readonly selection: LevelVerdict;
  readonly validation: LevelVerdict;
  /** How far its measured intensity strays from its chart (the squares of each third's gap). */
  readonly distance: number;
}

/** A level kept for a slot, the other candidates in band, and those turned down. */
export interface KeptLevel extends FittingLevel {
  readonly alternatives: readonly FittingLevel[];
  readonly rejected: readonly RejectedLevel[];
}

/** The games a candidate is chosen on (those the curve test replays), then checked on. */
export const SELECTION_SEEDS: readonly number[] = Array.from(
  { length: CURVE_SEEDS },
  (_, k) => k + 1,
);
export const VALIDATION_SEEDS: readonly number[] = SELECTION_SEEDS.map(
  (seed) => seed + CURVE_SEEDS,
);
/** Seeds a slot may try before the search gives up on it (a twin turned down costs no game). */
export const MOST_TRIES = 60;
/** Candidates in band compared before one is kept. */
export const CANDIDATES = 3;

/** Targets this close (a quarter of the larger, one at least) read as the same goal. */
const ALIKE_SHARE = 0.25;
/** Clocks this close play as the same length. */
const ALIKE_CLOCK_MS = 30_000;

/**
 * Two levels a player takes for the same one (1.38): the same mode and kind
 * of goal, a target within a quarter, a clock within thirty seconds (a
 * tide's target is its clock). Generated levels are never alike, but for the
 * duels: each chapter's rival fight.
 */
export function alike(a: CampaignLevel, b: CampaignLevel): boolean {
  if (a.modeId !== b.modeId || a.goal.kind !== b.goal.kind) return false;
  const larger = Math.max(a.goal.target, b.goal.target);
  const sameGoal = Math.abs(a.goal.target - b.goal.target) <= Math.max(1, ALIKE_SHARE * larger);
  const clockGap = Math.abs((a.timeLimitMs ?? 0) - (b.timeLimitMs ?? 0));
  return (
    sameGoal && (a.timeLimitMs === null) === (b.timeLimitMs === null) && clockGap <= ALIKE_CLOCK_MS
  );
}

/** How far two sets of games strayed from a chart: each third's mean gap, squared. */
function distanceOf(chart: BeatChart, verdicts: readonly LevelVerdict[]): number {
  return chart.intensity.reduce((sum, meant, third) => {
    const measured =
      verdicts.reduce((total, verdict) => total + verdict.intensity[third]!, 0) / verdicts.length;
    return sum + (measured - meant) ** 2;
  }, 0);
}

/**
 * The generators' sieve (1.38): for each slot, the seeds are tried in order;
 * a level must hold its band twice, on the games the curve test replays and
 * on six others, so that it is kept for its design, not for the luck of six
 * games. Of the first three that do, the one that plays closest to its
 * chart is kept (the lower seed on a tie). A level like one kept before
 * (`alike`) is turned down unplayed.
 */
export class PackSearch {
  constructor(private readonly judge: LevelJudge) {}

  /**
   * The level kept for a slot, like none of the `taken` ones; throws with the
   * rejections when no seed gives one.
   */
  level(slot: LevelSlot, taken: readonly CampaignLevel[] = []): KeptLevel {
    const rejected: RejectedLevel[] = [];
    const fitting: FittingLevel[] = [];
    // A seed that draws a level already judged is skipped: the bot would say the same.
    const judged = new Set<string>();
    for (let seed = 1; seed <= MOST_TRIES && fitting.length < CANDIDATES; seed++) {
      const level = generateLevel(slot, seed);
      const key = JSON.stringify(level);
      if (judged.has(key)) continue;
      judged.add(key);
      const idea = ideaOf(level);
      const twin = slot.kind === 'duel' ? undefined : taken.find((other) => alike(level, other));
      if (twin) {
        rejected.push({ seed, idea, problems: [`like ${twin.id}`] });
        continue;
      }
      const chart = chartOf(slot, idea);
      const selection = this.judge(level, chart, SELECTION_SEEDS);
      if (selection.problems.length > 0) {
        rejected.push({ seed, idea, problems: selection.problems });
        continue;
      }
      const validation = this.judge(level, chart, VALIDATION_SEEDS);
      if (validation.problems.length > 0) {
        rejected.push({ seed, idea, problems: validation.problems.map((p) => `again: ${p}`) });
        continue;
      }
      const distance = distanceOf(chart, [selection, validation]);
      fitting.push({ seed, level, idea, selection, validation, distance });
    }
    const [kept, ...alternatives] = [...fitting].sort(
      (a, b) => a.distance - b.distance || a.seed - b.seed,
    );
    if (!kept) {
      const why = rejected.map((each) => `${each.idea}: ${each.problems.join('; ')}`).join('\n');
      throw new Error(`${slot.id}: no level in its band after ${MOST_TRIES} seeds\n${why}`);
    }
    return { ...kept, alternatives, rejected };
  }
}

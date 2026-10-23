import { GOAL_RULES, type LiveState } from './Goals';
import type { CampaignLevel, StarRule } from './Levels';

/** Where a level's goal stands, for the HUD. */
export interface GoalProgress {
  readonly value: number;
  readonly target: number;
}

/** How a campaign game ended: won with 1 to 3 stars, or lost (0). */
export interface CampaignOutcome {
  readonly levelId: string;
  readonly won: boolean;
  readonly stars: 0 | 1 | 2 | 3;
}

type StarRuleOf<K extends StarRule['kind']> = Extract<StarRule, { kind: K }>;
type Stars = (rule: StarRule, state: LiveState, timeLimitMs: number | null) => 1 | 2 | 3;

/** How each kind of star rule rates a won game (its words: useCampaignText). */
export const STAR_RULES: {
  readonly [K in StarRule['kind']]: (
    rule: StarRuleOf<K>,
    state: LiveState,
    timeLimitMs: number | null,
  ) => 1 | 2 | 3;
} = {
  timeLeft: (_, state, timeLimitMs) => {
    if (timeLimitMs === null) return 1;
    const left = 1 - state.durationMs / timeLimitMs;
    return left >= 0.4 ? 3 : left >= 0.15 ? 2 : 1;
  },
  lines: (rule, state) => (state.lines >= rule.three ? 3 : state.lines >= rule.two ? 2 : 1),
  fast: (rule, state) =>
    state.durationMs <= rule.threeMs ? 3 : state.durationMs <= rule.twoMs ? 2 : 1,
};

const starsBy: Stars = (rule, state, timeLimitMs) =>
  (STAR_RULES[rule.kind] as Stars)(rule, state, timeLimitMs);

/**
 * Judges one campaign game: it follows the goal while the game runs, says
 * when a goal is met (the level then ends at once), and how many stars it
 * is worth. Pure: it only reads the state it is given.
 */
export class CampaignRun {
  constructor(
    readonly level: CampaignLevel,
    /** The clock of this game, hourglass included (null: untimed). */
    readonly timeLimitMs: number | null,
  ) {}

  /** Where the goal stands, for the HUD. */
  progress(state: LiveState): GoalProgress {
    const { goal } = this.level;
    return {
      value: Math.min(goal.target, GOAL_RULES[goal.kind].progress(state, goal)),
      target: goal.target,
    };
  }

  /** Called while playing: the outcome as soon as a live goal is met, else null. */
  check(state: LiveState): CampaignOutcome | null {
    const { goal } = this.level;
    const rule = GOAL_RULES[goal.kind];
    if (!rule.live || rule.progress(state, goal) < goal.target) return null;
    return this.won(state);
  }

  /** Called when the game ends by itself. */
  end(reason: string, state: LiveState): CampaignOutcome {
    const { goal } = this.level;
    return GOAL_RULES[goal.kind].wonAtEnd(reason, state, goal)
      ? this.won(state)
      : { levelId: this.level.id, won: false, stars: 0 };
  }

  private won(state: LiveState): CampaignOutcome {
    return {
      levelId: this.level.id,
      won: true,
      stars: starsBy(this.level.stars, state, this.timeLimitMs),
    };
  }
}

/** What a campaign game shows and measures while it runs, whatever its family. */
export interface LiveState {
  readonly lines: number;
  readonly clears: number;
  readonly bestAtOnce: number;
  /** The session's result (points, or milliseconds for a survival mode). */
  readonly score: number;
  readonly durationMs: number;
  /** Damage done to the level's boss (0 without one). */
  readonly bossDamage: number;
}

export const GOAL_KINDS = [
  'lines',
  'score',
  'bigClear',
  'survive',
  'win',
  'shape',
  'boss',
] as const;
export type GoalKind = (typeof GOAL_KINDS)[number];

export interface Goal {
  readonly kind: GoalKind;
  /** Lines, points, lines at once, or milliseconds to survive (unused for win and shape). */
  readonly target: number;
}

/**
 * A kind of goal: how far along a game is, and whether it is won. Goals met
 * during play end the level at once (`live`); the others are judged when the
 * game ends, from its reason. Adding a kind means adding a rule.
 */
interface GoalRule {
  /** Met as soon as reached, while playing. */
  readonly live: boolean;
  progress(state: LiveState, goal: Goal): number;
  /** For the goals judged at the end: did the game end the right way? */
  wonAtEnd(reason: string, state: LiveState, goal: Goal): boolean;
}

const reached = (value: number, goal: Goal) => value >= goal.target;

export const GOAL_RULES: Readonly<Record<GoalKind, GoalRule>> = {
  lines: {
    live: true,
    progress: (state) => state.lines,
    wonAtEnd: (_reason, state, goal) => reached(state.lines, goal),
  },
  score: {
    live: true,
    progress: (state) => state.score,
    wonAtEnd: (_reason, state, goal) => reached(state.score, goal),
  },
  bigClear: {
    live: true,
    progress: (state) => state.bestAtOnce,
    wonAtEnd: (_reason, state, goal) => reached(state.bestAtOnce, goal),
  },
  survive: {
    live: true,
    progress: (state) => state.durationMs,
    wonAtEnd: (reason, state, goal) => reason === 'timeUp' || reached(state.durationMs, goal),
  },
  win: {
    live: false,
    progress: () => 0,
    wonAtEnd: (reason) => reason === 'victory',
  },
  shape: {
    live: false,
    progress: () => 0,
    wonAtEnd: (reason) => reason === 'shapeComplete',
  },
  boss: {
    live: true,
    progress: (state) => state.bossDamage,
    wonAtEnd: (reason, state, goal) => reason === 'victory' || reached(state.bossDamage, goal),
  },
};

import type { GameReport } from './GameReport';

/** A game shorter than this earns no experience for itself (no quick-restart farming). */
export const MIN_GAME_MS = 20_000;
export const GAME_XP = 10;
/** One point every this long, this many at most. */
export const TIME_XP_EVERY_MS = 6_000;
export const MAX_TIME_XP = 60;
export const CLEAR_XP = 3;
/** Each line beyond the first of a clear. */
export const EXTRA_LINE_XP = 2;
export const MAX_CLEAR_XP = 150;
/** The first daily challenge of the day. */
export const DAILY_XP = 25;
/** The first Guardian challenge of the day, every day of its week. */
export const GUARDIAN_XP = 30;
/** Beating the AI, by its level: a harder opponent is worth more. */
export const VICTORY_XP: Readonly<Record<string, number>> = {
  rookie: 10,
  easy: 15,
  normal: 25,
  hard: 35,
  expert: 50,
};

/** `bonus`: the experience of a game doubled by a rewarded ad; `streak`: a step of the daily streak. */
export type XpSource =
  'game' | 'time' | 'clears' | 'daily' | 'streak' | 'guardian' | 'victory' | 'objective' | 'bonus';

/** A step of the daily streak: so many days in a row of daily challenges, and what it brings. */
export interface StreakBonus {
  readonly days: number;
  readonly xp: number;
}

/**
 * The steps of the daily streak (1.35): each brings its experience once the
 * streak reaches it. A missed day ends the streak, never what it gave; a new
 * streak climbs them again.
 */
export const STREAK_BONUSES: readonly StreakBonus[] = [
  { days: 3, xp: 75 },
  { days: 7, xp: 150 },
  { days: 14, xp: 300 },
  { days: 30, xp: 600 },
];

/** What a streak of this many days brings as it reaches it (0 between the steps). */
export function streakBonus(days: number): number {
  return STREAK_BONUSES.find((step) => step.days === days)?.xp ?? 0;
}

/** The next step of a streak now this long, or null past the last. */
export function nextStreakBonus(days: number): StreakBonus | null {
  return STREAK_BONUSES.find((step) => step.days > days) ?? null;
}

export interface XpLine {
  readonly source: XpSource;
  readonly amount: number;
}

/**
 * Experience earned by a game, line by line. It rewards playing and playing
 * well in every family alike: time, clears and lines, never raw points
 * (scores differ too much from one mode to another).
 */
export function experienceFor(report: GameReport): XpLine[] {
  const lines: XpLine[] = [];
  if (report.durationMs >= MIN_GAME_MS) lines.push({ source: 'game', amount: GAME_XP });
  const time = Math.min(MAX_TIME_XP, Math.floor(report.durationMs / TIME_XP_EVERY_MS));
  if (time > 0) lines.push({ source: 'time', amount: time });
  const clears = Math.min(
    MAX_CLEAR_XP,
    report.clears * CLEAR_XP + Math.max(0, report.lines - report.clears) * EXTRA_LINE_XP,
  );
  if (clears > 0) lines.push({ source: 'clears', amount: clears });
  if (report.reason === 'victory') {
    lines.push({ source: 'victory', amount: VICTORY_XP[report.variant ?? 'normal'] ?? 25 });
  }
  return lines;
}

export interface LevelProgress {
  readonly level: number;
  /** Experience gathered in the current level. */
  readonly into: number;
  /** Experience the current level needs (0 at the top). */
  readonly needed: number;
}

export const MAX_LEVEL = 50;

/** Experience a level needs: 40 more than the one before. */
export function xpNeeded(level: number): number {
  return 100 + 40 * (level - 1);
}

/** The level reached with this much experience, and how far into it (levels 1 to 50). */
export function levelProgress(xp: number): LevelProgress {
  let level = 1;
  let left = Math.max(0, xp);
  while (level < MAX_LEVEL && left >= xpNeeded(level)) {
    left -= xpNeeded(level);
    level++;
  }
  const needed = level === MAX_LEVEL ? 0 : xpNeeded(level);
  return { level, into: needed === 0 ? 0 : left, needed };
}

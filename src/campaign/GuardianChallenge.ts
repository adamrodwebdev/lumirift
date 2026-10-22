import { dayKey } from '@/core/Day';
import { SeededRandom } from '@/core/Random';
import { BOSS_IDS, type BossId, type SessionOptions } from '@/session/GameSession';
import type { ModeId } from '@/session/ModeId';
import { guardianLevel } from './Levels';

/** The Monday the rotation starts from: the Dune Wyrm's week. */
const FIRST_WEEK = new Date(2026, 0, 5);
const WEEK_MS = 7 * 86_400_000;

/** The Monday that starts a date's week, at local midnight. */
export function weekStart(date: Date): Date {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
}

/**
 * The Guardian challenge of a week (1.23): one Guardian of the rift a week,
 * in turn, open to every player whatever their campaign, fought as in its
 * campaign level (same mode, same clock) but without upgrades, with the same
 * pieces for everybody. The score to beat is the game's points, multiplied
 * on a victory by one plus the share of the clock left: a Guardian felled
 * with 40 % of the time left scores ×1.4.
 */
export class GuardianChallenge {
  /** The week's Monday as YYYYMMDD: the seed, and the key of the week's best score. */
  readonly key: string;
  readonly boss: BossId;
  readonly modeId: ModeId;
  readonly timeLimitMs: number;
  /** When the next Guardian comes: next Monday, at midnight. */
  readonly endsAt: Date;

  constructor(date: Date) {
    const start = weekStart(date);
    this.key = dayKey(start);
    // Rounded: a change of hour between two Mondays never shifts the week.
    const weeks = Math.round((start.getTime() - FIRST_WEEK.getTime()) / WEEK_MS);
    const count = BOSS_IDS.length;
    this.boss = BOSS_IDS[((weeks % count) + count) % count]!;
    const level = guardianLevel(this.boss);
    if (!level?.timeLimitMs) throw new Error(`No timed campaign level for ${this.boss}`);
    this.modeId = level.modeId;
    this.timeLimitMs = level.timeLimitMs;
    this.endsAt = new Date(start);
    this.endsAt.setDate(start.getDate() + 7);
  }

  /** A fresh, identical game for each attempt of the week. */
  sessionOptions(): SessionOptions {
    return {
      random: SeededRandom.fromString(`guardian:${this.key}`),
      timeLimitMs: this.timeLimitMs,
      boss: this.boss,
    };
  }

  /** What a game's points are multiplied by: 1 + the share of the clock left on a victory (to the hundredth). */
  factor(victory: boolean, timeLeftMs: number): number {
    if (!victory) return 1;
    const share = Math.min(1, Math.max(0, timeLeftMs) / this.timeLimitMs);
    return Math.round((1 + share) * 100) / 100;
  }

  /** The challenge's score. */
  score(points: number, victory: boolean, timeLeftMs: number): number {
    return Math.round(points * this.factor(victory, timeLeftMs));
  }
}

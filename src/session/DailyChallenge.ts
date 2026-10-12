import { SeededRandom } from '@/core/Random';
import type { SessionOptions } from './GameSession';
import type { ModeId } from './ModeId';

export const DAILY_TIME_LIMIT_MS = 2 * 60 * 1000;

/**
 * The challenge of a given day: everybody playing on the same local date gets
 * the same mode and the same pieces, so results can be compared and shared.
 */
export class DailyChallenge {
  /** Local date as YYYYMMDD: the seed, and the key of the day's best score. */
  readonly key: string;
  readonly modeId: ModeId;

  constructor(date: Date, eligible: readonly ModeId[]) {
    if (eligible.length === 0) throw new Error('No mode is eligible for the daily challenge');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    this.key = `${date.getFullYear()}${month}${day}`;
    const pick = SeededRandom.fromString(`mode:${this.key}`).nextInt(eligible.length);
    this.modeId = eligible[pick]!;
  }

  /** A fresh, identical piece sequence for each attempt of the day. */
  sessionOptions(): SessionOptions {
    return {
      random: SeededRandom.fromString(`pieces:${this.key}`),
      timeLimitMs: DAILY_TIME_LIMIT_MS,
    };
  }
}

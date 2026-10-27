import { reactive } from 'vue';
import { readJson, type KeyValueStorage } from './KeyValueStorage';

export const SCORES_KEY = 'stackrift:records';

export interface RecordOutcome {
  readonly best: number;
  readonly isNewBest: boolean;
}

/**
 * Best results, kept on the device only. Keys are mode ids, or
 * `daily:YYYYMMDD` for the daily challenge. Higher is better for every mode
 * (points, or time survived).
 */
export class ScoreBoard {
  private readonly records: Record<string, number>;

  constructor(private readonly storage: KeyValueStorage) {
    this.records = reactive(ScoreBoard.parse(readJson(storage, SCORES_KEY)));
  }

  static dailyKey(dayKey: string): string {
    return `daily:${dayKey}`;
  }

  /** The week's Guardian challenge, by the key of its Monday. */
  static guardianKey(weekKey: string): string {
    return `guardian:${weekKey}`;
  }

  /** The week's best of the Rift Race (1.34), by the key of its Monday. */
  static raceWeekKey(weekKey: string): string {
    return `race:${weekKey}`;
  }

  best(key: string): number | null {
    return this.records[key] ?? null;
  }

  record(key: string, value: number): RecordOutcome {
    const previous = this.best(key);
    if (previous !== null && value <= previous) return { best: previous, isNewBest: false };
    this.records[key] = value;
    this.storage.set(SCORES_KEY, JSON.stringify(this.records));
    // A first game with nothing to show is not a record worth celebrating.
    return { best: value, isNewBest: value > 0 };
  }

  private static parse(value: unknown): Record<string, number> {
    if (typeof value !== 'object' || value === null) return {};
    const records: Record<string, number> = {};
    for (const [key, score] of Object.entries(value)) {
      if (typeof score === 'number' && Number.isFinite(score) && score >= 0) records[key] = score;
    }
    return records;
  }
}

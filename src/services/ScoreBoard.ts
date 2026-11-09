import { reactive } from 'vue';
import { orElse, readText } from '@/core/input';
import { COUNT, LIST_LIMITS, SAVE_LIMITS, TEXT_LIMITS } from '@/core/limits';
import type { KeyValueStorage } from './KeyValueStorage';
import { SaveSlot } from './SaveSlot';

export const SCORES_KEY = 'stackrift:records';

export interface RecordOutcome {
  readonly best: number;
  readonly isNewBest: boolean;
}

/** A record's name: a mode (`silhouette`), or a challenge and its day (`daily:20261109`). */
const RECORD_NAME = {
  maxLength: TEXT_LIMITS.recordName,
  required: true,
  pattern: /^[a-z][a-zA-Z0-9-]*(?::\d{8})?$/,
} as const;

/**
 * Best results, kept on the device only. Keys are mode ids, or
 * `daily:YYYYMMDD` for the daily challenge. Higher is better for every mode
 * (points, or time survived).
 */
export class ScoreBoard {
  private readonly slot: SaveSlot;
  private readonly records: Map<string, number>;

  constructor(storage: KeyValueStorage) {
    this.slot = new SaveSlot(storage, SCORES_KEY, SAVE_LIMITS.records);
    this.records = reactive(ScoreBoard.read(this.slot));
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
    return this.records.get(key) ?? null;
  }

  record(key: string, value: number): RecordOutcome {
    const previous = this.best(key);
    if (previous !== null && value <= previous) return { best: previous, isNewBest: false };
    this.records.set(key, value);
    this.slot.write(Object.fromEntries(this.records));
    // A first game with nothing to show is not a record worth celebrating.
    return { best: value, isNewBest: value > 0 };
  }

  /**
   * The saved records, name by name: a name that is not a mode or a
   * challenge's day, or a score that is not a count, is left out, and the
   * others stay. A book with more names than any player could write is not
   * read at all.
   */
  private static read(slot: SaveSlot): Map<string, number> {
    const records = new Map<string, number>();
    const save = slot.saved;
    const names = slot.names;
    if (!save || names.length > LIST_LIMITS.records) return records;
    for (const name of names) {
      if (orElse(() => readText(name, RECORD_NAME, 'records'), null) !== name) continue;
      const score = orElse(() => save.number(name, COUNT), null);
      if (score !== null) records.set(name, score);
    }
    return records;
  }
}

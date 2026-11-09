import { InputRecord, orElse } from '@/core/input';
import type { KeyValueStorage } from './KeyValueStorage';

/**
 * One save under its key, read back through the door (9 Nov 2026): a text no
 * longer than the save's limit, then JSON, then a record, which its owner
 * reads field by field. A stored value it cannot read (too long, not JSON, not
 * a record: a cut write, another version's, a tampered one) is kept: the game
 * plays on from its defaults, and only the player's own progress (a game, a
 * gift, a choice) is saved over it, never what the game notes by itself (a
 * visit, the day's objectives). A text over the limit is never written: the
 * game could not read it back.
 */
export class SaveSlot {
  /** What was saved, read through the door; null when nothing was, or when it could not be read. */
  readonly saved: InputRecord | null;
  /** The text the door let through at start, for the names of its fields. */
  private readonly text: string | null;
  /** The stored value could not be read: it stays until the player's progress replaces it. */
  private kept: boolean;

  constructor(
    private readonly storage: KeyValueStorage,
    private readonly key: string,
    private readonly maxLength: number,
  ) {
    const stored = storage.get(key);
    this.saved =
      stored === null ? null : orElse(() => InputRecord.parse(stored, maxLength, key), null);
    this.text = this.saved === null ? null : stored;
    this.kept = stored !== null && this.saved === null;
  }

  /**
   * The names of the saved record's own fields, in their order. A record is
   * read by the names its owner knows; a map's names are data (the records,
   * one a day), listed here from the text the door let through.
   */
  get names(): readonly string[] {
    if (this.text === null) return [];
    const value: unknown = JSON.parse(this.text);
    return typeof value === 'object' && value !== null ? Object.keys(value) : [];
  }

  /** The player's progress: saved, over a value that could not be read too. */
  write(value: unknown): void {
    this.store(value, true);
  }

  /** What the game notes by itself: saved, but never over a value that could not be read. */
  note(value: unknown): void {
    this.store(value, false);
  }

  private store(value: unknown, progress: boolean): void {
    if (this.kept && !progress) return;
    const text = JSON.stringify(value);
    if (text.length > this.maxLength) return;
    this.kept = false;
    this.storage.set(this.key, text);
  }
}

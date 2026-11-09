import { orElse, parseNumber } from '@/core/input';
import { SAVE_LIMITS } from '@/core/limits';

/**
 * How the game's saved values sit in the platform's storage (1.46.5). The game
 * reads and writes its own keys (`stackrift:records`…); a layout says which
 * keys and values the storage actually holds for them.
 */
export interface SaveLayout {
  /** The storage's key for one of the game's keys. */
  storedKey(key: string): string;
  /** What to write for one value: one key and value, or a head and its parts. */
  encode(key: string, value: string): { readonly keys: string[]; readonly values: string[] };
  /** The keys of the parts a stored value announces (none when it is whole). */
  partKeys(key: string, stored: string): string[];
  /** The game's value, from what was stored and the parts it announced. */
  decode(stored: string, parts: readonly string[]): string;
}

/** The game's keys and values as they are: every storage but Telegram's cloud. */
export class PlainSaves implements SaveLayout {
  storedKey(key: string): string {
    return key;
  }

  encode(key: string, value: string) {
    return { keys: [key], values: [value] };
  }

  partKeys(): string[] {
    return [];
  }

  decode(stored: string): string {
    return stored;
  }
}

/** Telegram's largest value (characters). */
const MAX_VALUE = 4096;

/** A head announces one part at least, and never more than the longest save takes. */
const PARTS = {
  min: 1,
  max: Math.ceil(Math.max(...Object.values(SAVE_LIMITS)) / MAX_VALUE),
  integer: true,
} as const;

/**
 * Telegram's cloud storage, where the Playgama SDK saves on Telegram: keys of
 * `A–Z a–z 0–9 _ -` only, values of 4,096 characters at most (Telegram's Mini
 * Apps documentation, CloudStorage, read 6 November 2026). A key keeps its
 * name with "_" for every other character; a longer value is cut into parts
 * stored under `<key>_1`, `<key>_2`…, announced by a head `@parts:<count>`.
 * The game saves JSON, which never starts with "@". A head whose count is not
 * a whole number of parts the game could write (9 Nov 2026) is no head: the
 * value stays as it is, one the game cannot read and keeps.
 */
export class TelegramCloudSaves implements SaveLayout {
  /** Telegram's largest value (characters). */
  static readonly MAX_VALUE = MAX_VALUE;
  private static readonly HEAD = /^@parts:(\d+)$/;

  storedKey(key: string): string {
    return key.replace(/[^A-Za-z0-9_-]/g, '_');
  }

  encode(key: string, value: string) {
    const stored = this.storedKey(key);
    if (value.length <= TelegramCloudSaves.MAX_VALUE) return { keys: [stored], values: [value] };
    const parts: string[] = [];
    for (let at = 0; at < value.length; at += TelegramCloudSaves.MAX_VALUE) {
      parts.push(value.slice(at, at + TelegramCloudSaves.MAX_VALUE));
    }
    return {
      keys: [stored, ...parts.map((_, i) => `${stored}_${i + 1}`)],
      values: [`@parts:${parts.length}`, ...parts],
    };
  }

  partKeys(key: string, stored: string): string[] {
    const count = this.partCount(stored) ?? 0;
    return Array.from({ length: count }, (_, i) => `${this.storedKey(key)}_${i + 1}`);
  }

  decode(stored: string, parts: readonly string[]): string {
    return this.partCount(stored) === null ? stored : parts.join('');
  }

  /** The parts a head announces, or null for a value stored whole (or a head out of range). */
  private partCount(stored: string): number | null {
    const digits = TelegramCloudSaves.HEAD.exec(stored)?.[1];
    return digits === undefined ? null : orElse(() => parseNumber(digits, PARTS, 'parts'), null);
  }
}

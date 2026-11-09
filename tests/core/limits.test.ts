import { describe, expect, it } from 'vitest';
import { LEVELS } from '@/campaign/Levels';
import { UPGRADE_IDS } from '@/campaign/Upgrades';
import { savedDay } from '@/core/Day';
import { InputRecord } from '@/core/input';
import { LIST_LIMITS, SAVE_LIMITS, TEXT_LIMITS } from '@/core/limits';
import { DEFAULT_KEYS, isBindable } from '@/families/falling/input/KeyBindings';
import { readLanguageTag } from '@/i18n/locales';
import { COSMETICS, cosmeticKey } from '@/progression/Cosmetics';
import { EMPTY_PROFILE } from '@/progression/Profile';
import { SEASONS } from '@/seasons/SeasonData';
import { MemoryStorage } from '@/services/KeyValueStorage';
import { SCORES_KEY, ScoreBoard } from '@/services/ScoreBoard';
import { BOSS_IDS } from '@/session/GameSession';
import { MODE_IDS } from '@/session/ModeId';

/** A language tag of exactly `length` characters: `en`, then subtags of eight letters, then the rest. */
const tagOf = (length: number) => {
  const full = Math.floor((length - 2) / 9);
  const rest = (length - 2) % 9;
  return `en${'-aaaaaaaa'.repeat(full)}${rest > 1 ? `-${'a'.repeat(rest - 1)}` : ''}`;
};
/** A record's best, read back from a book holding only it. */
const bestOf = (name: string) => {
  const storage = new MemoryStorage();
  storage.set(SCORES_KEY, JSON.stringify({ [name]: 5 }));
  return new ScoreBoard(storage).best(name);
};
const day = (text: string) => savedDay(InputRecord.from({ day: text }, 'save'), 'day');

describe('the limits of every text read at a door (TEXT_LIMITS)', () => {
  it('accepts a language tag as long as its limit, and refuses one character more', () => {
    expect(tagOf(TEXT_LIMITS.languageTag)).toHaveLength(TEXT_LIMITS.languageTag);
    expect(readLanguageTag(tagOf(TEXT_LIMITS.languageTag))).toBe(tagOf(TEXT_LIMITS.languageTag));
    expect(readLanguageTag(tagOf(TEXT_LIMITS.languageTag + 1))).toBeNull();
  });

  it('accepts a key as long as its limit, and refuses one character more', () => {
    expect(isBindable(`K${'e'.repeat(TEXT_LIMITS.keyCode - 1)}`)).toBe(true);
    expect(isBindable(`K${'e'.repeat(TEXT_LIMITS.keyCode)}`)).toBe(false);
  });

  it('accepts a record name as long as its limit, and refuses one character more', () => {
    expect(bestOf('m'.repeat(TEXT_LIMITS.recordName))).toBe(5);
    expect(bestOf('m'.repeat(TEXT_LIMITS.recordName + 1))).toBeNull();
  });

  it('accepts a day of eight digits, and refuses one digit more', () => {
    expect(day('20261109')).toBe('20261109');
    expect(day('202611090')).toBeNull();
  });
});

/** Every key bound by default, and the longest names a keyboard gives. */
const KEY_CODES = [
  ...Object.values(DEFAULT_KEYS)
    .flat()
    .filter((code) => code !== null),
  'NumpadMemorySubtract',
  'IntlBackslash',
];

describe('the limits leave room for everything the game writes', () => {
  it.each(KEY_CODES)('lets the player bind %s', (code) => {
    expect(isBindable(code)).toBe(true);
  });

  it('holds the longest record name: a challenge and its day, or the longest mode', () => {
    expect('guardian:20261109'.length).toBeLessThanOrEqual(TEXT_LIMITS.recordName);
    expect(Math.max(...MODE_IDS.map((mode) => mode.length))).toBeLessThanOrEqual(
      TEXT_LIMITS.recordName,
    );
  });

  it('holds every list a full profile, campaign and season write, many times over', () => {
    expect(COSMETICS.length * 4).toBeLessThanOrEqual(LIST_LIMITS.cosmetics);
    expect(BOSS_IDS.length * 4).toBeLessThanOrEqual(LIST_LIMITS.bosses);
    expect(Math.max(...SEASONS.map((season) => season.track.tiers)) * 3).toBeLessThanOrEqual(
      LIST_LIMITS.seasonTiers,
    );
  });

  it('keeps the fullest profile and campaign the game writes today under a tenth of their limit', () => {
    const keys = COSMETICS.map(cosmeticKey);
    const objective = { kind: 'playMode', tier: 'medium', target: 60, mode: 'silhouette', size: 3 };
    const profile = {
      ...EMPTY_PROFILE,
      xp: Number.MAX_SAFE_INTEGER,
      games: Number.MAX_SAFE_INTEGER,
      playedMs: Number.MAX_SAFE_INTEGER,
      objectives: [1, 2, 3].map(() => ({ objective, progress: 59, done: false })),
      seen: keys,
      gifted: keys,
      bosses: [...BOSS_IDS],
    };
    const campaign = {
      stars: Object.fromEntries(LEVELS.map((level) => [level.id, 3])),
      ranks: Object.fromEntries(UPGRADE_IDS.map((id) => [id, 3])),
    };
    expect(JSON.stringify(profile).length * 10).toBeLessThan(SAVE_LIMITS.profile);
    expect(JSON.stringify(campaign).length * 10).toBeLessThan(SAVE_LIMITS.campaign);
  });

  it('keeps a year of daily challenges, Guardians and races under a tenth of the records’ limit', () => {
    const names = [
      ...MODE_IDS,
      ...Array.from({ length: 366 }, (_, i) => `daily:2026${String(i).padStart(4, '0')}`),
      ...Array.from({ length: 53 }, (_, i) => `guardian:2026${String(i).padStart(4, '0')}`),
      ...Array.from({ length: 53 }, (_, i) => `race:2026${String(i).padStart(4, '0')}`),
    ];
    const year = JSON.stringify(Object.fromEntries(names.map((name) => [name, 99_999_999])));
    expect(year.length * 10).toBeLessThan(SAVE_LIMITS.records);
    expect(names.length * 10).toBeLessThan(LIST_LIMITS.records);
  });
});

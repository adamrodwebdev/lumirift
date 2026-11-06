import { describe, expect, it } from 'vitest';
import { PlainSaves, TelegramCloudSaves } from '@/platform/playgama/SaveLayout';
import { SAVED_KEYS } from '@/platform/savedKeys';

/** Telegram's CloudStorage keys: 1 to 128 characters of A–Z a–z 0–9 _ - (Mini Apps docs, 2026-11-06). */
const TELEGRAM_KEY = /^[A-Za-z0-9_-]{1,128}$/;

describe("the save's layout in Telegram's cloud", () => {
  const cloud = new TelegramCloudSaves();

  it('gives every key the game saves a name Telegram accepts', () => {
    for (const key of SAVED_KEYS) expect(cloud.storedKey(key)).toMatch(TELEGRAM_KEY);
    expect(cloud.storedKey('stackrift:records')).toBe('stackrift_records');
  });

  it('keeps a value Telegram can hold whole', () => {
    const value = 'x'.repeat(TelegramCloudSaves.MAX_VALUE);
    expect(cloud.encode('stackrift:records', value)).toEqual({
      keys: ['stackrift_records'],
      values: [value],
    });
    expect(cloud.partKeys('stackrift:records', value)).toEqual([]);
    expect(cloud.decode(value, [])).toBe(value);
  });

  it('cuts a longer value into announced parts, each one Telegram can hold, and joins them back', () => {
    const value = JSON.stringify({ daily: 'd'.repeat(10_000) });
    const { keys, values } = cloud.encode('stackrift:records', value);
    expect(keys).toEqual([
      'stackrift_records',
      'stackrift_records_1',
      'stackrift_records_2',
      'stackrift_records_3',
    ]);
    expect(values[0]).toBe('@parts:3');
    for (const key of keys) expect(key).toMatch(TELEGRAM_KEY);
    for (const part of values)
      expect(part.length).toBeLessThanOrEqual(TelegramCloudSaves.MAX_VALUE);
    const head = values[0] ?? '';
    expect(cloud.partKeys('stackrift:records', head)).toEqual(keys.slice(1));
    expect(cloud.decode(head, values.slice(1))).toBe(value);
  });
});

describe('the plain layout', () => {
  it('stores the game’s keys and values as they are', () => {
    const plain = new PlainSaves();
    expect(plain.storedKey('stackrift:records')).toBe('stackrift:records');
    expect(plain.encode('stackrift:records', 'v')).toEqual({
      keys: ['stackrift:records'],
      values: ['v'],
    });
    expect(plain.partKeys()).toEqual([]);
    expect(plain.decode('v')).toBe('v');
  });
});

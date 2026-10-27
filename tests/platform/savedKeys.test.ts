import { describe, expect, it } from 'vitest';
import { SAVED_KEYS } from '@/platform/savedKeys';

/** The source of every module, to find the storage keys it names. */
const SOURCES = import.meta.glob<string>('/src/**/*.{ts,vue}', {
  query: '?raw',
  import: 'default',
  eager: true,
});

describe('the keys a portal reads back', () => {
  it('include every key the game saves, so no progress resets on a portal', () => {
    const named = new Set<string>();
    for (const source of Object.values(SOURCES))
      for (const [key] of source.matchAll(/stackrift:[a-z-]+/g)) named.add(key);
    // The season (1.36) was saved but never read back on Playgama and Yandex.
    expect(named).toContain('stackrift:season');
    expect([...named].filter((key) => !SAVED_KEYS.includes(key))).toEqual([]);
  });
});

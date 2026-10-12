import { describe, expect, it } from 'vitest';
import { SeededRandom } from '@/core/Random';

describe('SeededRandom', () => {
  it('replays the same sequence for the same seed', () => {
    const a = new SeededRandom(42);
    const b = new SeededRandom(42);
    const seqA = Array.from({ length: 10 }, () => a.next());
    const seqB = Array.from({ length: 10 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('derives a stable seed from a string', () => {
    expect(SeededRandom.fromString('20261012').next()).toBe(
      SeededRandom.fromString('20261012').next(),
    );
    expect(SeededRandom.fromString('20261012').next()).not.toBe(
      SeededRandom.fromString('20261013').next(),
    );
  });

  it('stays within bounds', () => {
    const random = new SeededRandom(7);
    for (let i = 0; i < 1000; i++) {
      const value = random.nextInt(7);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(7);
      expect(Number.isInteger(value)).toBe(true);
    }
  });
});

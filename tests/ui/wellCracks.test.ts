import { describe, expect, it } from 'vitest';
import { splitCrack, wellCracks } from '@/ui/components/wellCracks';

const coordinates = (d: string) => (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);

describe('wellCracks', () => {
  it('draws the same cracks for the same well, inside it, the later ones waiting for more danger', () => {
    const cracks = wellCracks(300, 600);
    expect(wellCracks(300, 600)).toEqual(cracks);
    expect(cracks).toHaveLength(7);
    const from = cracks.map((crack) => crack.from);
    expect(from).toEqual([...from].sort((a, b) => a - b));
    expect(from[0]).toBe(0);
    expect(from.at(-1)).toBeLessThan(0.7);
    for (const crack of cracks) {
      expect(crack.length).toBeGreaterThan(0);
      const values = coordinates(crack.d);
      values.forEach((value, i) => {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(i % 2 === 0 ? 300 : 600);
      });
    }
  });

  it('splits a lost well from its rim to its floor', () => {
    const split = splitCrack(300, 600);
    const values = coordinates(split.d);
    expect(values[1]).toBe(0);
    expect(values.at(-1)).toBe(600);
    expect(split.length).toBeGreaterThanOrEqual(600);
  });
});

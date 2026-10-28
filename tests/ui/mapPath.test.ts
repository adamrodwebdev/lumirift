import { describe, expect, it } from 'vitest';
import { pathPoints, rowSpread } from '@/ui/hub/mapPath';

/** A level as drawn on a phone: its disc, name and stars. */
const node = { width: 68, height: 107 };

describe('The map’s path (1.38)', () => {
  it('zigzags up a tall field, the first level at the bottom', () => {
    const points = pathPoints(7, { width: 280, height: 500 }, node);
    expect(points[0]).toEqual([24, 100]);
    expect(points[6]).toEqual([30, 0]);
    expect(points.map(([x]) => x > 50)).toEqual([false, true, false, true, false, true, false]);
  });

  it('crosses a roomy wide field in a gentle wave', () => {
    const points = pathPoints(7, { width: 1000, height: 400 }, node);
    expect(points.map(([, y]) => y)).toEqual([78, 22, 78, 22, 78, 22, 78]);
    expect(points.at(-1)).toEqual([100, 78]);
  });

  it('parts the rows of a short, narrow field until a level clears the next', () => {
    // 320 × 568: neighbours a third of a level apart, the field barely higher than a level.
    const field = { width: 205, height: 143 };
    const spread = rowSpread(7, field, node);
    expect(spread).toBeCloseTo((node.height + 8) / field.height);
    const points = pathPoints(7, field, node);
    const apart = ((points[0]![1] - points[1]![1]) / 100) * field.height;
    expect(apart).toBeCloseTo(node.height + 8);
  });

  it('keeps the wave when the levels fit side by side, or when the field is too short to part', () => {
    expect(rowSpread(7, { width: 724, height: 181 }, { width: 48, height: 84 })).toBe(0.56);
    // 568 × 320: a strip a quarter of a level high; its levels stand side by side.
    expect(rowSpread(7, { width: 371, height: 27 }, { width: 84, height: 96 })).toBe(0.56);
  });
});

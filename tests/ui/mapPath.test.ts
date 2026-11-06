import { describe, expect, it } from 'vitest';
import { isWide, pathPoints, rowSpread } from '@/ui/hub/mapPath';

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

  it('crosses a tall field in two rows when its zigzag would lay a level on the one two rows below', () => {
    // As the zigzag draws a level on a phone: the Guardian's name on one line (1.46.6).
    const zigzagged = { width: 120, height: 104 };
    // 360 × 740 under the chapter's line, and 320 × 640: three levels' height is missing.
    expect(isWide(7, { width: 245, height: 255 }, zigzagged)).toBe(true);
    expect(isWide(7, { width: 205, height: 215 }, zigzagged)).toBe(true);
    expect(pathPoints(7, { width: 245, height: 255 }, zigzagged).map(([, y]) => y)).toEqual([
      78, 22, 78, 22, 78, 22, 78,
    ]);
    // In two rows the names wrap and the levels grow taller: the field stays in two rows.
    expect(isWide(7, { width: 245, height: 255 }, { width: 68, height: 121 })).toBe(true);
    // 360 × 800 under the line: two rows apart is a level's height, the zigzag stays.
    expect(isWide(7, { width: 245, height: 315 }, zigzagged)).toBe(false);
    // Before its levels are measured, a field keeps its own shape.
    expect(isWide(7, { width: 245, height: 255 }, { width: 0, height: 0 })).toBe(false);
  });

  it('keeps the wave when the levels fit side by side, or when the field is too short to part', () => {
    expect(rowSpread(7, { width: 724, height: 181 }, { width: 48, height: 84 })).toBe(0.56);
    // 568 × 320: a strip a quarter of a level high; its levels stand side by side.
    expect(rowSpread(7, { width: 371, height: 27 }, { width: 84, height: 96 })).toBe(0.56);
  });
});

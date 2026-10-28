/** A size in pixels. */
export interface Size {
  readonly width: number;
  readonly height: number;
}

/** Where a level sits, in % of the path's field. */
export type PathPoint = readonly [x: number, y: number];

/** The two rows of a wide path, apart by this share of the field's height when there is room. */
const GENTLE_SPREAD = 0.56;
/** Room kept between two levels' names and stars, in pixels. */
const CLEARANCE = 8;

/**
 * How far apart the two rows of a wide path sit, as a share of the field's
 * height: a gentle wave while neighbours fit side by side; when they would
 * touch (a short, narrow screen), the rows part until a level clears the
 * next, as far as the field allows (1.38). A field too short for that keeps
 * the wave: its levels stand side by side.
 */
export function rowSpread(count: number, field: Size, node: Size): number {
  const step = field.width / Math.max(1, count - 1);
  const needed = (node.height + CLEARANCE) / field.height;
  const sideBySide = step >= node.width + CLEARANCE;
  return sideBySide || needed > 1 ? GENTLE_SPREAD : Math.max(GENTLE_SPREAD, needed);
}

/**
 * Where a chapter's levels sit (six, or seven with a Guardian): zigzagging
 * up a tall field, across a wide one in two rows that never cover each other.
 */
export function pathPoints(count: number, field: Size, node: Size): PathPoint[] {
  const wide = field.width > field.height;
  // Half the rows' distance, in % of the field, to the hundredth.
  const half = Math.round(rowSpread(count, field, node) * 5000) / 100;
  return Array.from({ length: count }, (_, i): PathPoint => {
    const t = count > 1 ? i / (count - 1) : 0;
    return wide
      ? [t * 100, i % 2 ? 50 - half : 50 + half]
      : [i % 2 ? 77 - i : 24 + i, 100 - t * 100];
  });
}

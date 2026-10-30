import type { Cell } from '../pieces/Shapes';

/**
 * Which sides of a block touch another block of the same piece: one bit per
 * side. A piece is drawn as one crystal, without a border between its own
 * cells (1.43, CAHIER § 9 quinquies); a lone block has no link.
 */
export const LINK = { north: 1, east: 2, south: 4, west: 8 } as const;

/** Every combination of sides: the sprites of a material are drawn for each one. */
export const LINK_MASKS = 16;

/** The links of each cell of a piece, in the order of its cells. */
export function linksOf(cells: readonly Cell[]): number[] {
  const taken = new Set(cells.map(({ x, y }) => `${x},${y}`));
  const has = (x: number, y: number) => taken.has(`${x},${y}`);
  return cells.map(
    ({ x, y }) =>
      (has(x, y - 1) ? LINK.north : 0) |
      (has(x + 1, y) ? LINK.east : 0) |
      (has(x, y + 1) ? LINK.south : 0) |
      (has(x - 1, y) ? LINK.west : 0),
  );
}

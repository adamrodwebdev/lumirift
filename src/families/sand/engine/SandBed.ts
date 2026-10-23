import { GRAINS_PER_CELL, SAND_TONES, type SandGrid } from './SandGrid';

/** A prepared well: how much of its height the bed fills, and which of its patterns. */
export interface SandBed {
  /** Share of the well's height (0 to 1). */
  readonly share: number;
  /** Shifts the colours and the cuts: two beds never look alike. */
  readonly variant: number;
}

/**
 * Lays a prepared well (the home's reel, the portals' training): bands of
 * coloured sand, a cell high, each cut by another colour. The elements have
 * something to work on, and a few grains of the right colour over a cut
 * link a band from wall to wall. No chance involved: a bed never changes a
 * seeded game's draws.
 */
export function layBed(grid: SandGrid, { share, variant }: SandBed): void {
  const rows = Math.round(grid.height * share);
  for (let y = 0; y < rows; y++) {
    const band = Math.floor(y / GRAINS_PER_CELL);
    const tone = SAND_TONES[(band + variant) % SAND_TONES.length]!;
    const cut = (band * 17 + 6 + variant * 11) % (grid.width - 8);
    const other = SAND_TONES[(band + variant + 2) % SAND_TONES.length]!;
    for (let x = 0; x < grid.width; x++) {
      grid.put(x, grid.height - 1 - y, x >= cut && x < cut + 7 ? other : tone, (x * 7 + y) & 3);
    }
  }
}

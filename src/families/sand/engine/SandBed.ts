import { Tone } from '@/core/Tone';
import { GRAINS_PER_CELL, SAND_TONES, type SandGrid } from './SandGrid';

/** A prepared well: how much sand the bed lays, and which of its patterns. */
export interface SandBed {
  /**
   * Rows of sand, in cells: an amount, not a share of the well, so that what was staged or
   * tuned on a bed keeps its sand whatever the well's height (1.43: two rows fewer thinned
   * every bed laid as a share).
   */
  readonly rows: number;
  /** Shifts the colours and the cuts: two beds never look alike. */
  readonly variant: number;
  /**
   * Bands at the top of the bed made one slab of one colour (cut once
   * through), under a sheet of water: the first bolt, wherever it lands,
   * shocks the whole slab (the training's opening, 1.33). None by default.
   */
  readonly water?: number;
}

/** Steps the set water stays water (about twenty seconds): the first piece always lands before. */
export const SET_WATER_LIFE = 1200;
/** Grains of water over the bed. */
const SHEET_GRAINS = 3;
/** Width of a band's cut, in grains. */
const CUT = 7;

/**
 * Lays a prepared well (the home's reel, the portals' training, the Sand's
 * practice): bands of coloured sand, a cell high, each cut by another
 * colour. The elements have something to work on, and a few grains of the
 * right colour over a cut link a band from wall to wall. With `water`, the
 * top bands are one slab under a sheet of water. No chance involved:
 * a bed never changes a seeded game's draws.
 */
export function layBed(grid: SandGrid, { rows: cells, variant, water = 0 }: SandBed): void {
  const rows = Math.min(grid.height, Math.round(cells * GRAINS_PER_CELL));
  const bands = Math.ceil(rows / GRAINS_PER_CELL);
  const toneOf = (band: number) => SAND_TONES[(band + variant) % SAND_TONES.length]!;
  const cutOf = (band: number) => (band * 17 + 6 + variant * 11) % (grid.width - 8);
  for (let y = 0; y < rows; y++) {
    const band = Math.floor(y / GRAINS_PER_CELL);
    // The soaked bands are one slab of one colour, cut once all the way down
    // (whole, it would link the walls at once): the shock breaks both halves.
    const soaked = band >= bands - water;
    const pattern = soaked ? bands - 1 : band;
    const tone = toneOf(pattern);
    const cut = cutOf(pattern);
    const other = SAND_TONES[(pattern + variant + 2) % SAND_TONES.length]!;
    for (let x = 0; x < grid.width; x++) {
      grid.put(x, grid.height - 1 - y, x >= cut && x < cut + CUT ? other : tone, (x * 7 + y) & 3);
    }
  }
  // Water over the slab stays there: sand sinks through water, never the other way.
  for (let y = rows; y < rows + (water > 0 ? SHEET_GRAINS : 0); y++) {
    for (let x = 0; x < grid.width; x++) setWater(grid, x, grid.height - 1 - y, (x * 5 + y) & 3);
  }
}

/** A grain of the set water: it lasts until the first piece has surely landed. */
function setWater(grid: SandGrid, x: number, y: number, shade: number): void {
  grid.set(y * grid.width + x, Tone.Water, shade, SET_WATER_LIFE);
}

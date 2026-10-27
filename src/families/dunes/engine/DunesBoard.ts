import { Tone } from '@/core/Tone';
import type { Shape } from '@/families/placement/engine/Shape';
import { GRAINS_PER_CELL, SandGrid } from '@/families/sand/engine/SandGrid';

/**
 * The Dunes board (1.37): 9 cells by 12, each of 6 × 6 grains. Lumirift's
 * own size, smaller than the Sand's 10 × 20 well: placed pieces fill it fast.
 */
export const DUNES_COLUMNS = 9;
export const DUNES_ROWS = 12;

/**
 * The colours of Dunes' sand, in the order they come: three from D-1, the
 * fourth later in the run (`DunesLevel.colours`). Measured by the curve bot,
 * four colours from the start ended most runs within two minutes.
 */
export const DUNES_TONES: readonly Tone[] = [
  Tone.ChromaA,
  Tone.ChromaB,
  Tone.ChromaC,
  Tone.ChromaD,
];

/** A fresh board of grains. */
export const dunesGrid = (): SandGrid =>
  new SandGrid(DUNES_COLUMNS * GRAINS_PER_CELL, DUNES_ROWS * GRAINS_PER_CELL);

/** Where a piece goes: the cell of its top-left corner. */
export interface Spot {
  readonly x: number;
  readonly y: number;
}

/**
 * The board seen in cells, to put pieces down: a cell is free when none of
 * its grains holds anything (steam and falling rain pass, as they let the
 * Sand's falling piece pass). A snapshot of one physics step.
 */
export class CellMap {
  readonly columns: number;
  readonly rows: number;
  private readonly free: Uint8Array;
  private _freeCells = 0;

  constructor(grid: SandGrid) {
    this.columns = grid.width / GRAINS_PER_CELL;
    this.rows = grid.height / GRAINS_PER_CELL;
    this.free = new Uint8Array(this.columns * this.rows);
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.columns; x++) {
        if (!CellMap.open(grid, x, y)) continue;
        this.free[y * this.columns + x] = 1;
        this._freeCells++;
      }
    }
  }

  private static open(grid: SandGrid, cx: number, cy: number): boolean {
    const g = GRAINS_PER_CELL;
    for (let y = cy * g; y < cy * g + g; y++) {
      for (let x = cx * g; x < cx * g + g; x++) if (!grid.isOpen(x, y)) return false;
    }
    return true;
  }

  /** Cells left free: the room on the board. */
  get freeCells(): number {
    return this._freeCells;
  }

  /** The share of the board taken (0 empty, 1 full): the danger rises with it. */
  get filled(): number {
    return 1 - this._freeCells / this.free.length;
  }

  isFree(x: number, y: number): boolean {
    return (
      x >= 0 && y >= 0 && x < this.columns && y < this.rows && this.free[y * this.columns + x] === 1
    );
  }

  fits(shape: Shape, x: number, y: number): boolean {
    return shape.cells.every((cell) => this.isFree(x + cell.x, y + cell.y));
  }

  fitsAnywhere(shape: Shape): boolean {
    for (let y = 0; y <= this.rows - shape.height; y++) {
      for (let x = 0; x <= this.columns - shape.width; x++) if (this.fits(shape, x, y)) return true;
    }
    return false;
  }

  /** Every place the shape fits, row after row from the top. */
  spots(shape: Shape): Spot[] {
    const spots: Spot[] = [];
    for (let y = 0; y <= this.rows - shape.height; y++) {
      for (let x = 0; x <= this.columns - shape.width; x++) {
        if (this.fits(shape, x, y)) spots.push({ x, y });
      }
    }
    return spots;
  }
}

/** The colour most present among the grains of a cell (one grain in four is read), or null. */
export function colourOf(grid: SandGrid, cx: number, cy: number): Tone | null {
  const g = GRAINS_PER_CELL;
  const counts = new Map<Tone, number>();
  for (let y = cy * g; y < cy * g + g; y += 2) {
    for (let x = cx * g; x < cx * g + g; x += 2) {
      const tone = grid.tones[y * grid.width + x] as Tone;
      if (DUNES_TONES.includes(tone)) counts.set(tone, (counts.get(tone) ?? 0) + 1);
    }
  }
  let best: Tone | null = null;
  let most = 0;
  for (const [tone, count] of counts) {
    if (count > most) {
      best = tone;
      most = count;
    }
  }
  return best;
}

/** The colour of the sand on top of each column (its top cell's), or null where the column is empty. */
export function surfaceColours(grid: SandGrid, board: CellMap): (Tone | null)[] {
  return Array.from({ length: board.columns }, (_, x) => {
    let y = 0;
    while (y < board.rows && board.isFree(x, y)) y++;
    return y < board.rows ? colourOf(grid, x, y) : null;
  });
}

/** The longest run of neighbouring columns of this colour. */
export function runOf(colours: readonly (Tone | null)[], tone: Tone): number {
  let best = 0;
  let run = 0;
  for (const colour of colours) {
    run = colour === tone ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

/** The colour whose run along the surface is the longest: the closest to linking the walls. */
export function closestToLink(colours: readonly (Tone | null)[]): Tone | null {
  let best: Tone | null = null;
  let longest = 0;
  for (const tone of DUNES_TONES) {
    const run = runOf(colours, tone);
    if (run > longest) {
      best = tone;
      longest = run;
    }
  }
  return best;
}

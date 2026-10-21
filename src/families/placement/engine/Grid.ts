import { Tone } from '@/core/Tone';
import type { Cell, Shape } from './Shape';

export interface RemovedTile extends Cell {
  readonly tone: Tone;
}

export interface Lines {
  readonly rows: readonly number[];
  readonly columns: readonly number[];
}

/** The Mosaic's square board: no gravity, tiles stay where they are put. */
export class Grid {
  static readonly SIZE = 8;

  private readonly cells: Uint8Array;

  constructor(readonly size = Grid.SIZE) {
    this.cells = new Uint8Array(size * size);
  }

  /** Builds a grid from rows of text ('.' empty, any other character a tile). */
  static fromRows(rows: readonly string[]): Grid {
    const grid = new Grid(rows.length);
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) if (row[x] !== '.') grid.set(x, y, Tone.Garbage);
    });
    return grid;
  }

  get(x: number, y: number): Tone {
    return this.cells[y * this.size + x] as Tone;
  }

  isFree(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.size && y < this.size && this.get(x, y) === Tone.Empty;
  }

  fits(shape: Shape, x: number, y: number): boolean {
    return shape.cells.every((cell) => this.isFree(x + cell.x, y + cell.y));
  }

  /** True when the shape fits somewhere on the board. */
  fitsAnywhere(shape: Shape): boolean {
    for (let y = 0; y <= this.size - shape.height; y++) {
      for (let x = 0; x <= this.size - shape.width; x++) if (this.fits(shape, x, y)) return true;
    }
    return false;
  }

  place(shape: Shape, x: number, y: number, tone: Tone): Cell[] {
    return shape.cells.map((cell) => {
      const at = { x: x + cell.x, y: y + cell.y };
      this.set(at.x, at.y, tone);
      return at;
    });
  }

  /** Complete rows and columns. */
  fullLines(): Lines {
    const rows: number[] = [];
    const columns: number[] = [];
    for (let i = 0; i < this.size; i++) {
      let row = true;
      let column = true;
      for (let j = 0; j < this.size; j++) {
        if (this.get(j, i) === Tone.Empty) row = false;
        if (this.get(i, j) === Tone.Empty) column = false;
      }
      if (row) rows.push(i);
      if (column) columns.push(i);
    }
    return { rows, columns };
  }

  /** The rows and columns a placement would complete (the board is left untouched). */
  linesIfPlaced(shape: Shape, x: number, y: number): Lines {
    if (!this.fits(shape, x, y)) return { rows: [], columns: [] };
    const trial = this.clone();
    trial.place(shape, x, y, Tone.Garbage);
    return trial.fullLines();
  }

  /**
   * Empties the given rows and columns; a tile at a crossing is removed once.
   * A stone of the Golem only cracks (a cracked one breaks): the stones it
   * cracked are added to `cracked`.
   */
  clearLines({ rows, columns }: Lines, cracked: Cell[] = []): RemovedTile[] {
    const cells: Cell[] = [];
    for (const y of rows) for (let x = 0; x < this.size; x++) cells.push({ x, y });
    for (const x of columns) {
      for (let y = 0; y < this.size; y++) if (!rows.includes(y)) cells.push({ x, y });
    }
    return this.remove(cells, cracked);
  }

  /** Sets a stone of the Golem on a free cell; false when the cell is taken. */
  putStone(x: number, y: number): boolean {
    if (!this.isFree(x, y)) return false;
    this.set(x, y, Tone.Stone);
    return true;
  }

  stoneCount(): number {
    return this.cells.reduce(
      (count, tone) => count + (tone === Tone.Stone || tone === Tone.CrackedStone ? 1 : 0),
      0,
    );
  }

  /** Empties a square of (2 × radius + 1) cells around a cell (the bomb). */
  clearArea(cx: number, cy: number, radius = 1): RemovedTile[] {
    const cells: Cell[] = [];
    for (let y = cy - radius; y <= cy + radius; y++) {
      for (let x = cx - radius; x <= cx + radius; x++) {
        if (x >= 0 && y >= 0 && x < this.size && y < this.size) cells.push({ x, y });
      }
    }
    return this.remove(cells);
  }

  isEmpty(): boolean {
    return this.cells.every((tone) => tone === Tone.Empty);
  }

  hasEmptyCell(): boolean {
    return this.cells.some((tone) => tone === Tone.Empty);
  }

  tileCount(): number {
    return this.cells.reduce((count, tone) => count + (tone === Tone.Empty ? 0 : 1), 0);
  }

  clone(): Grid {
    const copy = new Grid(this.size);
    copy.cells.set(this.cells);
    return copy;
  }

  /** Puts back the content of another grid (undo). */
  restore(from: Grid): void {
    this.cells.set(from.cells);
  }

  toRows(): string[] {
    const rows: string[] = [];
    for (let y = 0; y < this.size; y++) {
      let row = '';
      for (let x = 0; x < this.size; x++) row += this.get(x, y) === Tone.Empty ? '.' : '#';
      rows.push(row);
    }
    return rows;
  }

  /** Removes the tiles of these cells; with `cracked`, a whole stone only cracks. */
  private remove(cells: readonly Cell[], cracked?: Cell[]): RemovedTile[] {
    const removed: RemovedTile[] = [];
    for (const { x, y } of cells) {
      const tone = this.get(x, y);
      if (tone === Tone.Empty) continue;
      if (tone === Tone.Stone && cracked) {
        this.set(x, y, Tone.CrackedStone);
        cracked.push({ x, y });
        continue;
      }
      removed.push({ x, y, tone });
      this.set(x, y, Tone.Empty);
    }
    return removed;
  }

  private set(x: number, y: number, tone: Tone): void {
    this.cells[y * this.size + x] = tone;
  }
}

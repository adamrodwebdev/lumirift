import type { Piece } from '../pieces/Piece';
import { Tone } from '../pieces/PieceType';
import type { Cell } from '../pieces/Shapes';

export interface ClearedRow {
  /** Row index before removal. */
  readonly index: number;
  /** True when every block of the row has the same tone. */
  readonly pure: boolean;
  /** The tones the row held, left to right (for the destruction effects). */
  readonly tones: Uint8Array;
}

export interface RemovedCell extends Cell {
  readonly tone: Tone;
}

/**
 * The well: a grid of tones, row 0 at the top. The first `hiddenRows` rows sit
 * above the visible area, where pieces spawn.
 */
export class Board {
  static readonly WIDTH = 10;
  static readonly VISIBLE_HEIGHT = 20;
  static readonly HIDDEN_ROWS = 2;

  readonly width: number;
  readonly height: number;
  readonly hiddenRows: number;
  /** The last column touches the first one: the well is a cylinder, without side walls. */
  readonly wraps: boolean;
  private readonly cells: Uint8Array;

  constructor(
    width = Board.WIDTH,
    visibleHeight = Board.VISIBLE_HEIGHT,
    hiddenRows = Board.HIDDEN_ROWS,
    wraps = false,
  ) {
    this.width = width;
    this.wraps = wraps;
    this.height = visibleHeight + hiddenRows;
    this.hiddenRows = hiddenRows;
    this.cells = new Uint8Array(this.width * this.height);
  }

  /** Builds a board from rows of text, bottom row last ('.' empty, '#' garbage). */
  static fromRows(rows: readonly string[], width = Board.WIDTH, visibleHeight = 20): Board {
    const board = new Board(width, visibleHeight);
    const offset = board.height - rows.length;
    rows.forEach((row, r) => {
      for (let x = 0; x < Math.min(row.length, width); x++) {
        if (row[x] !== '.') board.set(x, offset + r, Tone.Garbage);
      }
    });
    return board;
  }

  get(x: number, y: number): Tone {
    return this.cells[y * this.width + x] as Tone;
  }

  isInside(x: number, y: number): boolean {
    return (this.wraps || (x >= 0 && x < this.width)) && y >= 0 && y < this.height;
  }

  isFree(x: number, y: number): boolean {
    return this.isInside(x, y) && this.get(this.column(x), y) === Tone.Empty;
  }

  /** The column a horizontal position falls in: around the cylinder when the well wraps. */
  column(x: number): number {
    if (!this.wraps) return x;
    const column = x % this.width;
    return column < 0 ? column + this.width : column;
  }

  /**
   * True when the piece, shifted by (dx, dy), lies inside the well on empty
   * cells only. The offset avoids allocating a moved piece for each probe.
   */
  fits(piece: Piece, dx = 0, dy = 0): boolean {
    for (const cell of piece.localCells) {
      if (!this.isFree(cell.x + piece.x + dx, cell.y + piece.y + dy)) return false;
    }
    return true;
  }

  /** Writes the piece into the grid. Returns false if it lies wholly in the hidden rows. */
  lock(piece: Piece): boolean {
    let visible = false;
    for (const cell of piece.localCells) {
      const y = cell.y + piece.y;
      this.set(this.column(cell.x + piece.x), y, piece.tone);
      if (y >= this.hiddenRows) visible = true;
    }
    return visible;
  }

  /** Removes full rows, shifts everything above down, and reports what was removed. */
  clearFullRows(): ClearedRow[] {
    const cleared: ClearedRow[] = [];
    for (let y = 0; y < this.height; y++) {
      if (this.isRowFull(y))
        cleared.push({ index: y, pure: this.isRowPure(y), tones: this.rowTones(y) });
    }
    if (cleared.length === 0) return cleared;

    let write = this.height - 1;
    for (let read = this.height - 1; read >= 0; read--) {
      if (this.isRowFull(read)) continue;
      if (write !== read) this.copyRow(read, write);
      write--;
    }
    for (; write >= 0; write--) this.fillRow(write, Tone.Empty);
    return cleared;
  }

  /**
   * Pushes a garbage row in from the bottom; everything moves up one row.
   * Returns true when blocks were pushed out of the top (the player tops out).
   */
  pushGarbageRow(holeX: number): boolean {
    const overflow = !this.isRowEmpty(0);
    for (let y = 0; y < this.height - 1; y++) this.copyRow(y + 1, y);
    const bottom = this.height - 1;
    for (let x = 0; x < this.width; x++) {
      this.set(x, bottom, x === holeX ? Tone.Empty : Tone.Garbage);
    }
    return overflow;
  }

  /**
   * Turns the well upside down, then lets every block fall to the floor of its
   * column: holes disappear and the stack is rebuilt bottom-up in reverse order.
   */
  flipAndSettle(): void {
    const column: Tone[] = [];
    for (let x = 0; x < this.width; x++) {
      column.length = 0;
      // Reading top-down gives the blocks in the order they land once flipped.
      for (let y = 0; y < this.height; y++) {
        const tone = this.get(x, y);
        if (tone !== Tone.Empty) column.push(tone);
      }
      for (let y = 0; y < this.height; y++) this.set(x, y, Tone.Empty);
      let y = this.height - 1;
      for (const tone of column) this.set(x, y--, tone);
    }
  }

  /**
   * Removes the bottom `count` rows and lets everything above drop by as
   * much (a second chance when the well overflows).
   */
  dropBottomRows(count: number): void {
    const n = Math.min(count, this.height);
    this.cells.copyWithin(n * this.width, 0, (this.height - n) * this.width);
    this.cells.fill(Tone.Empty, 0, n * this.width);
  }

  /** Lets every block fall to the floor of its column, keeping their order. */
  settle(): void {
    for (let x = 0; x < this.width; x++) {
      let write = this.height - 1;
      for (let read = this.height - 1; read >= 0; read--) {
        const tone = this.get(x, read);
        if (tone === Tone.Empty) continue;
        if (write !== read) {
          this.set(x, write, tone);
          this.set(x, read, Tone.Empty);
        }
        write--;
      }
    }
  }

  /**
   * Turns the visible well a quarter turn to the left: the left wall becomes
   * the floor. Needs a square visible area; the hidden rows are emptied.
   */
  rotateLeft(): void {
    const size = this.width;
    if (this.height - this.hiddenRows !== size) throw new Error('rotateLeft needs a square well');
    const top = this.hiddenRows;
    const before = this.cells.slice();
    this.cells.fill(Tone.Empty);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        // The cell (x, y) of the turned well shows the old cell (size - 1 - y, x).
        this.set(x, top + y, before[(top + x) * size + (size - 1 - y)] as Tone);
      }
    }
  }

  /**
   * Groups of at least `minSize` blocks of the same tone touching by a side,
   * ignoring the given tones (garbage never fuses).
   */
  findGroups(minSize: number, ignored: readonly Tone[] = []): Cell[][] {
    const seen = new Uint8Array(this.cells.length);
    const groups: Cell[][] = [];
    for (let start = 0; start < this.cells.length; start++) {
      const tone = this.cells[start] as Tone;
      if (seen[start] || tone === Tone.Empty || ignored.includes(tone)) continue;
      const group: Cell[] = [];
      const stack = [start];
      seen[start] = 1;
      while (stack.length > 0) {
        const index = stack.pop()!;
        const x = index % this.width;
        const y = Math.floor(index / this.width);
        group.push({ x, y });
        for (const [nx, ny] of [
          [x - 1, y],
          [x + 1, y],
          [x, y - 1],
          [x, y + 1],
        ] as const) {
          if (!this.isInside(nx, ny)) continue;
          const next = ny * this.width + this.column(nx);
          if (!seen[next] && this.cells[next] === tone) {
            seen[next] = 1;
            stack.push(next);
          }
        }
      }
      if (group.length >= minSize) groups.push(group);
    }
    return groups;
  }

  /** Empties the given cells and returns what they held. */
  removeCells(cells: readonly Cell[]): RemovedCell[] {
    return cells.map(({ x, y }) => {
      const tone = this.get(x, y);
      this.set(x, y, Tone.Empty);
      return { x, y, tone };
    });
  }

  /** Reflects the well left to right. */
  mirror(): void {
    for (let y = 0; y < this.height; y++) {
      this.cells.subarray(y * this.width, (y + 1) * this.width).reverse();
    }
  }

  /** An independent copy, to try a move without touching the real well. */
  clone(): Board {
    const copy = new Board(this.width, this.height - this.hiddenRows, this.hiddenRows, this.wraps);
    copy.cells.set(this.cells);
    return copy;
  }

  /** Height of the stack, in rows from the floor (0 = empty board). */
  stackHeight(): number {
    for (let y = 0; y < this.height; y++) {
      if (!this.isRowEmpty(y)) return this.height - y;
    }
    return 0;
  }

  blockCount(): number {
    let count = 0;
    for (const tone of this.cells) if (tone !== Tone.Empty) count++;
    return count;
  }

  /** Text snapshot for tests and debugging, bottom row last. */
  toRows(): string[] {
    const rows: string[] = [];
    for (let y = this.hiddenRows; y < this.height; y++) {
      let row = '';
      for (let x = 0; x < this.width; x++) row += this.get(x, y) === Tone.Empty ? '.' : '#';
      rows.push(row);
    }
    return rows;
  }

  private rowTones(y: number): Uint8Array {
    return this.cells.slice(y * this.width, (y + 1) * this.width);
  }

  private set(x: number, y: number, tone: Tone): void {
    this.cells[y * this.width + x] = tone;
  }

  private isRowFull(y: number): boolean {
    for (let x = 0; x < this.width; x++) if (this.get(x, y) === Tone.Empty) return false;
    return true;
  }

  private isRowEmpty(y: number): boolean {
    for (let x = 0; x < this.width; x++) if (this.get(x, y) !== Tone.Empty) return false;
    return true;
  }

  private isRowPure(y: number): boolean {
    const first = this.get(0, y);
    for (let x = 1; x < this.width; x++) if (this.get(x, y) !== first) return false;
    return true;
  }

  private copyRow(from: number, to: number): void {
    this.cells.copyWithin(to * this.width, from * this.width, (from + 1) * this.width);
  }

  private fillRow(y: number, tone: Tone): void {
    this.cells.fill(tone, y * this.width, (y + 1) * this.width);
  }
}

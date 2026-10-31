import { WELL } from '@/core/Well';
import type { Piece } from '../pieces/Piece';
import { Tone } from '../pieces/PieceType';
import type { Cell } from '../pieces/Shapes';
import { LINK } from './Links';

/** A board drawn in text makes its pieces of the connected blocks of one letter, four at most. */
const PIECE_CELLS = 4;

export interface ClearedRow {
  /** Row index before removal. */
  readonly index: number;
  /** True when every block of the row has the same tone. */
  readonly pure: boolean;
  /** The tones the row held, left to right (for the destruction effects). */
  readonly tones: Uint8Array;
  /** Columns of the bomb gems the row held. */
  readonly bombs: readonly number[];
  /** Each block's links along the row, east and west only: the row breaks away (1.43). */
  readonly links: Uint8Array;
}

/** The colour a board drawn in text gives a piece's letter. */
const LETTER_TONES: Readonly<Record<string, Tone>> = {
  I: Tone.I,
  O: Tone.O,
  T: Tone.T,
  S: Tone.S,
  Z: Tone.Z,
  J: Tone.J,
  L: Tone.L,
};

export interface RemovedCell extends Cell {
  readonly tone: Tone;
}

/** What a view may read of a board: its size, its cells and its queries, never a change. */
export type ReadonlyBoard = Pick<
  Board,
  | 'width'
  | 'height'
  | 'hiddenRows'
  | 'wraps'
  | 'get'
  | 'links'
  | 'hasBomb'
  | 'bombCount'
  | 'isInside'
  | 'isFree'
  | 'column'
  | 'fits'
  | 'findGroups'
  | 'clone'
  | 'stackHeight'
  | 'blockCount'
>;

/**
 * The well: a grid of tones, row 0 at the top. The first `hiddenRows` rows sit
 * above the visible area, where pieces spawn.
 */
export class Board {
  /** Lumirift's well, 10 × 18 (see `WELL`). */
  static readonly WIDTH = WELL.columns;
  static readonly VISIBLE_HEIGHT = WELL.rows;
  static readonly HIDDEN_ROWS = 2;

  readonly width: number;
  readonly height: number;
  readonly hiddenRows: number;
  /** The last column touches the first one: the well is a cylinder, without side walls. */
  readonly wraps: boolean;
  private readonly cells: Uint8Array;
  /** 1 where a block carries a gem: a bomb in the Tower, a shard of the rift under the Heart. */
  private readonly bombs: Uint8Array;
  /**
   * The piece each block came from (0 for a lone block: garbage, a dropped stone): blocks
   * of one piece are drawn as one crystal (1.43). Ids move with their blocks.
   */
  private readonly pieces: Uint32Array;
  private nextPiece = 1;

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
    this.bombs = new Uint8Array(this.width * this.height);
    this.pieces = new Uint32Array(this.width * this.height);
  }

  /**
   * Builds a board from rows of text, bottom row last: '.' empty, '#' garbage,
   * '*' garbage carrying a gem, a piece's letter a block of its colour.
   */
  static fromRows(
    rows: readonly string[],
    width = Board.WIDTH,
    visibleHeight = Board.VISIBLE_HEIGHT,
    wraps = false,
  ): Board {
    const board = new Board(width, visibleHeight, Board.HIDDEN_ROWS, wraps);
    const offset = board.height - rows.length;
    rows.forEach((row, r) => {
      for (let x = 0; x < Math.min(row.length, width); x++) {
        const mark = row[x]!;
        if (mark === '.') continue;
        board.set(x, offset + r, LETTER_TONES[mark] ?? Tone.Garbage);
        if (mark === '*') board.bombs[(offset + r) * width + x] = 1;
      }
    });
    board.joinLetters();
    return board;
  }

  get(x: number, y: number): Tone {
    return this.cells[y * this.width + x] as Tone;
  }

  /**
   * The sides of the block at (x, y) that touch a block of the same piece (`LINK` bits).
   * Garbage is rift stone (1.43): it joins the stone around it, a row reads as one slab.
   */
  links(x: number, y: number): number {
    const index = y * this.width + x;
    if (this.pieces[index] === 0 && this.cells[index] !== Tone.Garbage) return 0;
    return (
      (this.joins(index, x, y - 1) ? LINK.north : 0) |
      (this.joins(index, x + 1, y) ? LINK.east : 0) |
      (this.joins(index, x, y + 1) ? LINK.south : 0) |
      (this.joins(index, x - 1, y) ? LINK.west : 0)
    );
  }

  /**
   * Whether the block at (x, y) belongs with the block at `from`: the same piece, or rift
   * stone beside rift stone. A method, not a closure: the renderer asks for every block
   * of the stack at every frame, which must allocate nothing.
   */
  private joins(from: number, x: number, y: number): boolean {
    if (!this.isInside(x, y)) return false;
    const to = y * this.width + this.column(x);
    return this.cells[from] === Tone.Garbage
      ? this.cells[to] === Tone.Garbage
      : this.pieces[to] === this.pieces[from];
  }

  /** True when the block at (x, y) carries a bomb gem. */
  hasBomb(x: number, y: number): boolean {
    return this.bombs[y * this.width + this.column(x)] === 1;
  }

  /** How many bomb gems the stack holds. */
  bombCount(): number {
    let count = 0;
    for (const bomb of this.bombs) count += bomb;
    return count;
  }

  /**
   * A bomb goes off at (x, y): every block in the sector around it is blown
   * away (`radius` columns each side, `above` rows up, `below` down), and the
   * bombs caught in it go off too. Returns the blocks removed, bombs first.
   */
  blast(
    x: number,
    y: number,
    radius: number,
    above: number,
    below: number,
  ): { cells: RemovedCell[]; bombs: number } {
    const cells: RemovedCell[] = [];
    const queue: [number, number][] = [[this.column(x), y]];
    const fired = new Set<number>([y * this.width + this.column(x)]);
    let bombs = 0;
    while (queue.length > 0) {
      const [bx, by] = queue.shift()!;
      bombs++;
      for (let dy = -above; dy <= below; dy++) {
        const ny = by + dy;
        if (ny < 0 || ny >= this.height) continue;
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = this.wraps ? this.column(bx + dx) : bx + dx;
          if (nx < 0 || nx >= this.width) continue;
          const i = ny * this.width + nx;
          const tone = this.cells[i] as Tone;
          if (tone === Tone.Empty) continue;
          if (this.bombs[i] && !fired.has(i)) {
            fired.add(i);
            queue.push([nx, ny]);
          }
          cells.push({ x: nx, y: ny, tone });
          this.cells[i] = Tone.Empty;
          this.bombs[i] = 0;
          this.pieces[i] = 0;
        }
      }
    }
    return { cells, bombs };
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
    const id = this.nextPiece++;
    piece.localCells.forEach((cell, index) => {
      const y = cell.y + piece.y;
      const x = this.column(cell.x + piece.x);
      this.set(x, y, piece.tone, id);
      if (piece.bomb === index) this.bombs[y * this.width + x] = 1;
      if (y >= this.hiddenRows) visible = true;
    });
    return visible;
  }

  /** Removes full rows, shifts everything above down, and reports what was removed. */
  clearFullRows(): ClearedRow[] {
    const cleared: ClearedRow[] = [];
    for (let y = 0; y < this.height; y++) {
      if (this.isRowFull(y)) {
        cleared.push({
          index: y,
          pure: this.isRowPure(y),
          tones: this.rowTones(y),
          bombs: this.rowBombs(y),
          links: this.rowLinks(y),
        });
      }
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
  pushGarbageRow(holeX: number, gemX: number | null = null): boolean {
    const overflow = !this.isRowEmpty(0);
    for (let y = 0; y < this.height - 1; y++) this.copyRow(y + 1, y);
    const bottom = this.height - 1;
    for (let x = 0; x < this.width; x++) {
      this.set(x, bottom, x === holeX ? Tone.Empty : Tone.Garbage);
    }
    if (gemX !== null && gemX !== holeX) this.bombs[bottom * this.width + gemX] = 1;
    return overflow;
  }

  /**
   * Turns the well upside down, then lets every block fall to the floor of its
   * column: holes disappear and the stack is rebuilt bottom-up in reverse order.
   */
  flipAndSettle(): void {
    const column: [Tone, number][] = [];
    for (let x = 0; x < this.width; x++) {
      column.length = 0;
      // Reading top-down gives the blocks in the order they land once flipped.
      for (let y = 0; y < this.height; y++) {
        const tone = this.get(x, y);
        if (tone !== Tone.Empty) column.push([tone, this.pieces[y * this.width + x]!]);
      }
      for (let y = 0; y < this.height; y++) this.set(x, y, Tone.Empty);
      let y = this.height - 1;
      for (const [tone, piece] of column) this.set(x, y--, tone, piece);
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
    this.bombs.copyWithin(n * this.width, 0, (this.height - n) * this.width);
    this.bombs.fill(0, 0, n * this.width);
    this.pieces.copyWithin(n * this.width, 0, (this.height - n) * this.width);
    this.pieces.fill(0, 0, n * this.width);
  }

  /** Lets every block fall to the floor of its column, keeping their order. */
  settle(): void {
    for (let x = 0; x < this.width; x++) {
      let write = this.height - 1;
      for (let read = this.height - 1; read >= 0; read--) {
        const tone = this.get(x, read);
        if (tone === Tone.Empty) continue;
        if (write !== read) {
          this.set(x, write, tone, this.pieces[read * this.width + x]);
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
    const pieces = this.pieces.slice();
    this.cells.fill(Tone.Empty);
    this.pieces.fill(0);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        // The cell (x, y) of the turned well shows the old cell (size - 1 - y, x).
        const from = (top + x) * size + (size - 1 - y);
        this.set(x, top + y, before[from] as Tone, pieces[from]);
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

  /**
   * Sets a block on top of column x (on the floor of an empty column), unless
   * `blocked` says the cell is taken (by the falling piece). Returns its cell.
   */
  dropOn(x: number, tone: Tone, blocked: (x: number, y: number) => boolean): Cell | null {
    const column = this.column(x);
    let y = this.height - 1;
    for (let row = 0; row < this.height; row++) {
      if (this.get(column, row) !== Tone.Empty) {
        y = row - 1;
        break;
      }
    }
    if (y < 0 || blocked(column, y)) return null;
    this.set(column, y, tone);
    return { x: column, y };
  }

  /**
   * Empties the top `count` rows of the stack, from its highest block down:
   * what a lost game's continue blows away (1.31). Returns what they held.
   */
  clearTopRows(count: number): RemovedCell[] {
    const top = this.height - this.stackHeight();
    const cells: Cell[] = [];
    for (let y = top; y < Math.min(this.height, top + count); y++) {
      for (let x = 0; x < this.width; x++) if (this.get(x, y) !== Tone.Empty) cells.push({ x, y });
    }
    return this.removeCells(cells);
  }

  /** Empties the given cells and returns what they held. */
  removeCells(cells: readonly Cell[]): RemovedCell[] {
    return cells.map(({ x, y }) => {
      const tone = this.get(x, y);
      this.set(x, y, Tone.Empty);
      return { x, y, tone };
    });
  }

  /** Reflects the well left to right, gems with their blocks. */
  mirror(): void {
    for (let y = 0; y < this.height; y++) {
      this.cells.subarray(y * this.width, (y + 1) * this.width).reverse();
      this.bombs.subarray(y * this.width, (y + 1) * this.width).reverse();
      this.pieces.subarray(y * this.width, (y + 1) * this.width).reverse();
    }
  }

  /** An independent copy, to try a move without touching the real well. */
  clone(): Board {
    const copy = new Board(this.width, this.height - this.hiddenRows, this.hiddenRows, this.wraps);
    copy.cells.set(this.cells);
    copy.bombs.set(this.bombs);
    copy.pieces.set(this.pieces);
    copy.nextPiece = this.nextPiece;
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

  private rowBombs(y: number): number[] {
    const columns: number[] = [];
    for (let x = 0; x < this.width; x++) if (this.bombs[y * this.width + x]) columns.push(x);
    return columns;
  }

  private rowLinks(y: number): Uint8Array {
    const links = new Uint8Array(this.width);
    for (let x = 0; x < this.width; x++) links[x] = this.links(x, y) & (LINK.east | LINK.west);
    return links;
  }

  private rowTones(y: number): Uint8Array {
    return this.cells.slice(y * this.width, (y + 1) * this.width);
  }

  /** Writes a block; `piece` joins it to the blocks of that piece (0: a lone block). */
  private set(x: number, y: number, tone: Tone, piece = 0): void {
    const i = y * this.width + x;
    this.cells[i] = tone;
    this.pieces[i] = tone === Tone.Empty ? 0 : piece;
    if (tone === Tone.Empty) this.bombs[i] = 0;
  }

  /**
   * Gives each run of touching blocks of one letter a piece of its own, four blocks at
   * most (a board drawn in text has no ids): the scenes' stacks are crystals too.
   */
  private joinLetters(): void {
    for (let start = 0; start < this.cells.length; start++) {
      const tone = this.cells[start] as Tone;
      if (tone === Tone.Empty || tone === Tone.Garbage || this.pieces[start] !== 0) continue;
      const id = this.nextPiece++;
      const queue = [start];
      this.pieces[start] = id;
      let size = 1;
      while (queue.length > 0 && size < PIECE_CELLS) {
        const index = queue.shift()!;
        const x = index % this.width;
        const y = Math.floor(index / this.width);
        for (const [nx, ny] of [
          [x + 1, y],
          [x, y + 1],
          [x - 1, y],
          [x, y - 1],
        ] as const) {
          if (size === PIECE_CELLS || !this.isInside(nx, ny)) continue;
          const next = ny * this.width + this.column(nx);
          if (this.cells[next] !== tone || this.pieces[next] !== 0) continue;
          this.pieces[next] = id;
          queue.push(next);
          size++;
        }
      }
    }
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
    this.bombs.copyWithin(to * this.width, from * this.width, (from + 1) * this.width);
    this.pieces.copyWithin(to * this.width, from * this.width, (from + 1) * this.width);
  }

  private fillRow(y: number, tone: Tone): void {
    this.cells.fill(tone, y * this.width, (y + 1) * this.width);
    this.bombs.fill(0, y * this.width, (y + 1) * this.width);
    this.pieces.fill(0, y * this.width, (y + 1) * this.width);
  }
}

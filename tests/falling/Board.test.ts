import { describe, expect, it } from 'vitest';
import { Board } from '@/families/falling/board/Board';
import { LINK, linksOf } from '@/families/falling/board/Links';
import { Piece } from '@/families/falling/pieces/Piece';
import { Tone } from '@/families/falling/pieces/PieceType';

const EMPTY = '..........';
/** The bottom row's index: 18 visible rows under 2 hidden ones. */
const FLOOR = Board.VISIBLE_HEIGHT + Board.HIDDEN_ROWS - 1;

describe('Board', () => {
  it('has 18 visible rows, not the standard 20, and 2 hidden rows', () => {
    const board = new Board();
    expect(board.height).toBe(20);
    expect(board.toRows()).toHaveLength(18);
  });

  it('is drawn in text: colours by letter, gems, and a cylinder for the Tower', () => {
    const board = Board.fromRows(['IO*.', '#LLJ'], 4, 4, true);
    const top = board.height - 2;
    expect([0, 1, 2, 3].map((x) => board.get(x, top))).toEqual([
      Tone.I,
      Tone.O,
      Tone.Garbage,
      Tone.Empty,
    ]);
    expect([0, 1, 2, 3].map((x) => board.get(x, top + 1))).toEqual([
      Tone.Garbage,
      Tone.L,
      Tone.L,
      Tone.J,
    ]);
    expect(board.hasBomb(2, top)).toBe(true);
    expect(board.bombCount()).toBe(1);
    expect(board.wraps).toBe(true);
  });

  it('rejects pieces outside the well or on blocks', () => {
    const board = Board.fromRows(['#.........']);
    const t = new Piece('T', Tone.T, 0, 0);
    expect(board.fits(t)).toBe(true);
    expect(board.fits(t, -1, 0)).toBe(false);
    expect(board.fits(t, 8, 0)).toBe(false);
    // Two rows of the T's box above the floor: its bottom row lands on the block.
    expect(board.fits(t, 0, FLOOR - 1)).toBe(false);
  });

  it('locks a piece and reports whether it is visible', () => {
    const board = new Board();
    expect(board.lock(new Piece('O', Tone.O, 4, FLOOR - 1))).toBe(true);
    expect(board.blockCount()).toBe(4);
    expect(board.lock(new Piece('I', Tone.I, 0, -1))).toBe(false);
  });

  it('clears full rows and drops the rows above', () => {
    const board = Board.fromRows(['#.........', '##########', '.#........', '##########']);
    const cleared = board.clearFullRows();
    expect(cleared.map((row) => row.index)).toEqual([FLOOR - 2, FLOOR]);
    expect(board.toRows().slice(-2)).toEqual(['#.........', '.#........']);
  });

  it('flags pure rows (a single tone across)', () => {
    const board = new Board();
    for (let x = 0; x < 10; x += 2) board.lock(new Piece('O', Tone.ChromaA, x, FLOOR - 1));
    const cleared = board.clearFullRows();
    expect(cleared).toHaveLength(2);
    expect(cleared.every((row) => row.pure)).toBe(true);

    const mixed = Board.fromRows(['##########']);
    mixed.lock(new Piece('I', Tone.I, 0, FLOOR - 2)); // second row: 4 I blocks…
    mixed.lock(new Piece('I', Tone.I, 4, FLOOR - 2));
    mixed.lock(new Piece('O', Tone.O, 8, FLOOR - 2)); // …then an O: mixed tones
    expect(mixed.clearFullRows().map((row) => row.pure)).toEqual([false, true]);
  });

  it('pushes garbage in from the bottom with one hole', () => {
    const board = Board.fromRows(['#.........']);
    expect(board.pushGarbageRow(3)).toBe(false);
    expect(board.toRows().slice(-2)).toEqual(['#.........', '###.######']);
  });

  it('reports an overflow when garbage pushes blocks out of the top', () => {
    const board = new Board();
    board.lock(new Piece('O', Tone.O, 0, 0));
    expect(board.pushGarbageRow(0)).toBe(true);
  });

  it('flips the well and lets every column settle, removing holes', () => {
    const board = Board.fromRows(['##........', '#.........', '.#........']);
    const before = board.blockCount();
    board.flipAndSettle();
    expect(board.blockCount()).toBe(before);
    // Columns 0 and 1 each hold two blocks (column 1 had a hole): both settle flat.
    expect(board.toRows().slice(-3)).toEqual([EMPTY, '##........', '##........']);
  });

  it('reflects the well left to right', () => {
    const board = Board.fromRows(['##........', '#....#....']);
    board.mirror();
    expect(board.toRows().slice(-2)).toEqual(['........##', '....#....#']);
  });

  it('measures the stack height', () => {
    expect(new Board().stackHeight()).toBe(0);
    expect(Board.fromRows(['#.........', EMPTY, EMPTY]).stackHeight()).toBe(3);
  });
});

describe('Board operations of the advanced modes', () => {
  it('lets blocks fall in their column, keeping their order', () => {
    const board = Board.fromRows(['#.........', '..........', '.#........', '..........']);
    board.settle();
    expect(board.toRows().slice(-2)).toEqual([EMPTY, '##........']);
    expect(board.blockCount()).toBe(2);
  });

  it('turns a square well a quarter turn left: the left wall becomes the floor', () => {
    const board = new Board(4, 4);
    const filled = Board.fromRows(['#...', '#...', '#...', '####'], 4, 4);
    filled.rotateLeft();
    expect(filled.toRows()).toEqual(['...#', '...#', '...#', '####']);
    expect(() => new Board().rotateLeft()).toThrow();
    expect(board.toRows()).toHaveLength(4);
  });

  it('finds groups of same-coloured blocks touching by a side', () => {
    const board = new Board();
    board.lock(new Piece('O', Tone.ChromaA, 0, FLOOR - 1));
    board.lock(new Piece('O', Tone.ChromaB, 2, FLOOR - 1));
    board.lock(new Piece('I', Tone.ChromaA, 4, FLOOR - 2)); // a separate line of four at x 4..7
    expect(board.findGroups(4)).toHaveLength(3);
    expect(board.findGroups(5)).toHaveLength(0);
    expect(board.findGroups(4, [Tone.ChromaB])).toHaveLength(2);
    expect(Board.fromRows(['##########']).findGroups(4, [Tone.Garbage])).toHaveLength(0);
  });

  it('removes cells and reports their tones', () => {
    const board = new Board();
    board.lock(new Piece('O', Tone.ChromaC, 0, FLOOR - 1));
    const removed = board.removeCells([
      { x: 0, y: FLOOR },
      { x: 1, y: FLOOR },
    ]);
    expect(removed.map((cell) => cell.tone)).toEqual([Tone.ChromaC, Tone.ChromaC]);
    expect(board.blockCount()).toBe(2);
  });
});

describe('Board links: each piece one crystal (1.43)', () => {
  const { north, east, south, west } = LINK;

  it('joins the blocks of a locked piece, never two pieces of one colour', () => {
    const board = new Board();
    board.lock(new Piece('O', Tone.O, 0, FLOOR - 1));
    board.lock(new Piece('O', Tone.O, 2, FLOOR - 1)); // touching, same colour, another piece
    expect(board.links(0, FLOOR - 1)).toBe(east | south);
    expect(board.links(1, FLOOR)).toBe(north | west);
    expect(board.links(2, FLOOR)).toBe(north | east);
  });

  it('keeps what is left of a piece joined once a line cuts it', () => {
    const board = Board.fromRows(['#########.', '#########.', '#########.', '#########.']);
    board.lock(new Piece('I', Tone.I, 7, FLOOR - 3).rotated(1)); // upright in the last column
    expect(board.clearFullRows()).toHaveLength(4);
    expect(board.blockCount()).toBe(0);

    // Upright on a block, the I completes one row: its three other blocks fall one row.
    const cut = Board.fromRows(['#########.', '.........#']);
    cut.lock(new Piece('I', Tone.I, 7, FLOOR - 4).rotated(1));
    expect(cut.clearFullRows()).toHaveLength(1);
    expect(cut.get(9, FLOOR - 1)).toBe(Tone.I);
    expect(cut.links(9, FLOOR - 1)).toBe(north);
    expect(cut.links(9, FLOOR - 2)).toBe(north | south);
  });

  it('makes the blocks drawn in text pieces of four at most, garbage none', () => {
    const board = Board.fromRows(['IIIIII', '##ZZ..']);
    expect(board.links(0, FLOOR - 1)).toBe(east);
    expect(board.links(3, FLOOR - 1)).toBe(west); // the fourth I closes the first piece
    expect(board.links(4, FLOOR - 1)).toBe(east); // the last two make another
    expect(board.links(0, FLOOR)).toBe(0); // garbage stands alone
    expect(board.links(2, FLOOR)).toBe(east);
  });

  it('links a lone piece cell by cell, for the falling piece and the previews', () => {
    // A T pointing up: its middle block touches the three others.
    const t = [
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
    ];
    expect(linksOf(t)).toEqual([south, east, north | east | west, west]);
  });
});

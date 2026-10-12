import { describe, expect, it } from 'vitest';
import { Board } from '@/families/falling/board/Board';
import { Piece } from '@/families/falling/pieces/Piece';
import { Tone } from '@/families/falling/pieces/PieceType';

const EMPTY = '..........';

describe('Board', () => {
  it('has 20 visible rows and 2 hidden rows', () => {
    const board = new Board();
    expect(board.height).toBe(22);
    expect(board.toRows()).toHaveLength(20);
  });

  it('rejects pieces outside the well or on blocks', () => {
    const board = Board.fromRows(['#.........']);
    const t = new Piece('T', Tone.T, 0, 0);
    expect(board.fits(t)).toBe(true);
    expect(board.fits(t, -1, 0)).toBe(false);
    expect(board.fits(t, 8, 0)).toBe(false);
    // Two rows of the T's box above the floor: its bottom row lands on the block.
    expect(board.fits(t, 0, 20)).toBe(false);
  });

  it('locks a piece and reports whether it is visible', () => {
    const board = new Board();
    expect(board.lock(new Piece('O', Tone.O, 4, 20))).toBe(true);
    expect(board.blockCount()).toBe(4);
    expect(board.lock(new Piece('I', Tone.I, 0, -1))).toBe(false);
  });

  it('clears full rows and drops the rows above', () => {
    const board = Board.fromRows(['#.........', '##########', '.#........', '##########']);
    const cleared = board.clearFullRows();
    expect(cleared.map((row) => row.index)).toEqual([19, 21]);
    expect(board.toRows().slice(-2)).toEqual(['#.........', '.#........']);
  });

  it('flags pure rows (a single tone across)', () => {
    const board = new Board();
    for (let x = 0; x < 10; x += 2) board.lock(new Piece('O', Tone.ChromaA, x, 20));
    const cleared = board.clearFullRows();
    expect(cleared).toHaveLength(2);
    expect(cleared.every((row) => row.pure)).toBe(true);

    const mixed = Board.fromRows(['##########']);
    mixed.lock(new Piece('I', Tone.I, 0, 19)); // second row: 4 I blocks…
    mixed.lock(new Piece('I', Tone.I, 4, 19));
    mixed.lock(new Piece('O', Tone.O, 8, 19)); // …then an O: mixed tones
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

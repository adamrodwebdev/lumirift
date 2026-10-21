import { describe, expect, it, vi } from 'vitest';
import { SeededRandom } from '@/core/Random';
import { Board } from '@/families/falling/board/Board';
import { Game } from '@/families/falling/game/Game';
import { ClassicMode } from '@/families/falling/modes/ClassicMode';
import { Piece } from '@/families/falling/pieces/Piece';
import { Tone } from '@/families/falling/pieces/PieceType';
import { BOMBS_AFTER, TOWER_BLAST, TowerMode } from '@/families/volume/TowerMode';
import { ConstantRandom } from '../falling/helpers';

const ring = () => new Board(20, 16, Board.HIDDEN_ROWS, true);

describe('Bombs in the stack', () => {
  it('blows away a sector around the bomb, round the cylinder, and sets off the bombs it catches', () => {
    const board = ring();
    const bottom = board.height - 1;
    // Six full rings at the bottom (O pieces two by two).
    for (const y of [bottom - 1, bottom - 3, bottom - 5]) {
      for (let x = 0; x < 20; x += 2) board.lock(new Piece('O', Tone.O, x, y));
    }
    // Two bombs on top, at columns 0 and 2 (O cell 2 is its bottom left one).
    board.lock(new Piece('O', Tone.O, 0, bottom - 7).withBomb(2));
    board.lock(new Piece('O', Tone.O, 2, bottom - 7).withBomb(2));
    expect(board.bombCount()).toBe(2);
    const blast = board.blast(
      0,
      bottom - 6,
      TOWER_BLAST.radius,
      TOWER_BLAST.above,
      TOWER_BLAST.below,
    );
    expect(blast.bombs).toBe(2);
    expect(board.bombCount()).toBe(0);
    // The first sector wraps round (18, 19, 0, 1, 2); the second reaches 3 and 4.
    const removed = new Set(blast.cells.map((cell) => cell.x));
    for (const x of [18, 19, 0, 1, 2, 3, 4]) expect(removed.has(x)).toBe(true);
    expect(removed.has(10)).toBe(false);
    // Only the bombs' rows and the ring just under them (below: 1) are touched.
    for (const cell of blast.cells) expect(cell.y).toBeLessThanOrEqual(bottom - 5);
  });

  it('keeps bombs with their rows when rows are cleared below them', () => {
    const board = ring();
    const bottom = board.height - 1;
    board.lock(new Piece('O', Tone.O, 4, bottom - 3).withBomb(0));
    expect(board.hasBomb(4, bottom - 3)).toBe(true);
    board.dropBottomRows(1);
    expect(board.hasBomb(4, bottom - 2)).toBe(true);
    expect(board.clone().bombCount()).toBe(1);
  });
});

describe('Bombs in the Tower', () => {
  it('deals bombs after a few pieces, about one in five, never two in a row', () => {
    const mode = new TowerMode();
    const random = new SeededRandom(5);
    const ranks = Array.from({ length: 400 }, (_, rank) => mode.bombFor(random, rank));
    const bombed = ranks.map((bomb, rank) => (bomb === null ? -1 : rank)).filter((r) => r >= 0);
    expect(bombed[0]).toBeGreaterThanOrEqual(BOMBS_AFTER);
    expect(bombed.length).toBeGreaterThan(40);
    expect(bombed.length).toBeLessThan(110);
    for (let k = 1; k < bombed.length; k++) expect(bombed[k]! - bombed[k - 1]!).toBeGreaterThan(1);
    for (const bomb of ranks) if (bomb !== null) expect(bomb).toBeLessThan(4);
  });

  it('never deals bombs in the other modes', () => {
    const mode = new ClassicMode();
    expect(mode.blast).toBeNull();
    expect(mode.bombFor(new SeededRandom(1), 50)).toBeNull();
  });

  it('sets a bomb off when its ring is cleared: blast event, points, and a preview that saw it coming', () => {
    const game = new Game(new TowerMode(), { random: new ConstantRandom() });
    game.start();
    const board = game.board;
    const bottom = board.height - 1;
    // The bottom ring, full but for columns 8 to 11, a bomb at column 3 (flat I pieces).
    for (const x of [0, 4, 12, 16]) {
      board.lock(new Piece('I', Tone.I, x, bottom - 1).withBomb(x === 0 ? 3 : null));
    }
    // Blocks above, over columns 2 to 5: they will fall into the bomb's sector.
    board.lock(new Piece('O', Tone.O, 2, bottom - 2));
    board.lock(new Piece('O', Tone.O, 4, bottom - 2));
    expect(board.hasBomb(3, bottom)).toBe(true);
    (game as unknown as { _active: Piece })._active = new Piece('I', Tone.I, 8, 0);
    const preview = game.blastPreview();
    expect(preview.length).toBeGreaterThan(0);
    const onBlast = vi.fn();
    game.events.on('blast', onBlast);
    game.hardDrop();
    expect(onBlast).toHaveBeenCalledOnce();
    const blast = onBlast.mock.calls[0]![0];
    expect(blast.x).toBe(3);
    expect(blast.points).toBeGreaterThan(0);
    expect(blast.cells.length).toBe(preview.length);
    expect(board.blockCount()).toBe(0);
  });

  it('keeps the bomb of a held piece', () => {
    const game = new Game(new TowerMode(), { random: new ConstantRandom() });
    game.start();
    (game as unknown as { _active: Piece })._active = new Piece('T', Tone.T, 8, 0, 0, 1);
    game.hold();
    expect(game.held?.bomb).toBe(1);
  });
});

import { describe, expect, it, vi } from 'vitest';
import { SeededRandom } from '@/core/Random';
import { Dealer } from '@/families/placement/engine/Dealer';
import { Grid } from '@/families/placement/engine/Grid';
import {
  MosaicGame,
  PERFECT_BONUS,
  POINTS_PER_CLEARED_TILE,
  type SlotId,
} from '@/families/placement/engine/MosaicGame';
import { Shape, SHAPES } from '@/families/placement/engine/Shape';
import { JOKERS, type JokerId } from '@/families/placement/jokers/Joker';
import { ConstantRandom } from '../falling/helpers';

/** A started game whose hand is replaced by the given shapes. */
function gameWith(rows: string[] | null, shapes: string[]) {
  const game = new MosaicGame({
    random: new SeededRandom(1),
    ...(rows ? { grid: Grid.fromRows(rows) } : {}),
  });
  game.start();
  const hand = (game as unknown as { hand: unknown[] }).hand;
  shapes.forEach((text, i) => (hand[i] = { id: 100 + i, shape: Shape.parse(text), tone: 1 }));
  return game;
}

const giveJoker = (game: MosaicGame, joker: JokerId) =>
  (game as unknown as { inventory: JokerId[] }).inventory.push(joker);

const EMPTY = '........';

describe('Shape', () => {
  it('parses, measures and turns', () => {
    const l = Shape.parse('#.|#.|##');
    expect([l.width, l.height, l.size]).toEqual([2, 3, 4]);
    expect(l.rotated().key).toBe(Shape.parse('###|#..').key);
    expect(l.rotated().rotated().rotated().rotated().key).toBe(l.key);
  });

  it('holds pieces from one to nine cells, all valid', () => {
    const sizes = new Set(SHAPES.map((entry) => entry.shape.size));
    expect(Math.min(...sizes)).toBe(1);
    expect(Math.max(...sizes)).toBe(9);
    for (const { shape, weight } of SHAPES) {
      expect(weight).toBeGreaterThan(0);
      expect(shape.width).toBeLessThanOrEqual(5);
      expect(shape.height).toBeLessThanOrEqual(5);
    }
  });
});

describe('Grid', () => {
  it('places pieces only on free cells inside the board', () => {
    const grid = Grid.fromRows(['#.......', ...Array<string>(7).fill(EMPTY)]);
    const square = Shape.parse('##|##');
    expect(grid.fits(square, 0, 0)).toBe(false);
    expect(grid.fits(square, 1, 0)).toBe(true);
    expect(grid.fits(square, 7, 0)).toBe(false);
  });

  it('finds full rows and columns, and clears a crossing once', () => {
    const rows = Array<string>(8).fill('#.......');
    rows[3] = '########';
    const grid = Grid.fromRows(rows);
    expect(grid.fullLines()).toEqual({ rows: [3], columns: [0] });
    const removed = grid.clearLines(grid.fullLines());
    expect(removed).toHaveLength(8 + 7);
    expect(grid.isEmpty()).toBe(true);
  });

  it('predicts the lines a placement would complete', () => {
    const grid = Grid.fromRows(['######..', ...Array<string>(7).fill(EMPTY)]);
    expect(grid.linesIfPlaced(Shape.parse('##'), 6, 0)).toEqual({ rows: [0], columns: [] });
    expect(grid.tileCount()).toBe(6);
  });

  it('clears a 3 × 3 square, clipped at the edges', () => {
    const grid = Grid.fromRows(Array<string>(8).fill('########'));
    expect(grid.clearArea(0, 0)).toHaveLength(4);
    expect(grid.clearArea(4, 4)).toHaveLength(9);
  });
});

describe('Dealer', () => {
  it('deals every shape of the library, the common ones more often', () => {
    const dealer = new Dealer(new SeededRandom(5));
    const counts = new Map<string, number>();
    for (let i = 0; i < 4000; i++) {
      const key = dealer.deal().shape.key;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    expect(counts.size).toBe(new Set(SHAPES.map((entry) => entry.shape.key)).size);
    expect(counts.get(Shape.parse('##|##').key)!).toBeGreaterThan(
      counts.get(Shape.parse('###|###|###').key)!,
    );
  });
});

describe('MosaicGame', () => {
  it('deals three pieces and places them', () => {
    const game = gameWith(null, ['##', '#', '###']);
    expect(game.pieces()).toHaveLength(3);
    expect(game.place(0, 0, 0)).toBe(true);
    expect(game.score).toBe(2);
    expect(game.place(0, 0, 0)).toBe(false); // already placed
    expect(game.place(1, 0, 0)).toBe(false); // occupied
  });

  it('deals a new hand once the three pieces are placed', () => {
    const game = gameWith(null, ['#', '#', '#']);
    const onDeal = vi.fn();
    game.events.on('deal', onDeal);
    game.place(0, 0, 0);
    game.place(1, 2, 0);
    expect(onDeal).not.toHaveBeenCalled();
    game.place(2, 4, 0);
    expect(onDeal).toHaveBeenCalledOnce();
    expect(game.pieces()).toHaveLength(3);
  });

  it('clears full lines and scores them, with a growing streak', () => {
    const game = gameWith(
      ['#######.', '#######.', ...Array<string>(6).fill(EMPTY)],
      ['#', '#', '##|##'],
    );
    const onClear = vi.fn();
    game.events.on('clear', onClear);
    game.place(0, 7, 0);
    expect(onClear).toHaveBeenLastCalledWith(
      expect.objectContaining({ lines: 1, rows: [0], streak: 1 }),
    );
    expect(game.score).toBe(1 + 8 * POINTS_PER_CLEARED_TILE);
    game.place(1, 7, 1);
    expect(game.streak).toBe(2);
    expect(game.lines).toBe(2);
  });

  it('awards a bonus when the board is left empty', () => {
    const game = gameWith(['#######.', ...Array<string>(7).fill(EMPTY)], ['#', '#', '#']);
    const onPerfect = vi.fn();
    game.events.on('perfect', onPerfect);
    game.place(0, 7, 0);
    expect(onPerfect).toHaveBeenCalledWith({ points: PERFECT_BONUS });
  });

  it('earns a joker for two lines at once', () => {
    const game = gameWith(
      ['#######.', '#######.', ...Array<string>(6).fill(EMPTY)],
      ['#|#', '#', '#'],
    );
    const onJoker = vi.fn();
    game.events.on('jokerGained', onJoker);
    game.place(0, 7, 0);
    expect(onJoker).toHaveBeenCalledOnce();
    expect(game.jokers).toHaveLength(1);
  });

  it('ends when no piece fits and no joker can help', () => {
    const full = Array<string>(8).fill('########');
    full[0] = '#.#.#.#.';
    const game = gameWith(full, ['##', '##', '##']);
    const onOver = vi.fn();
    game.events.on('over', onOver);
    game.useJoker(0); // nothing to use: just triggers nothing
    (game as unknown as { checkMoves(): void }).checkMoves();
    expect(onOver).toHaveBeenCalledWith({ reason: 'noMoves' });
  });

  it('is not over while a joker can still help', () => {
    const full = Array<string>(8).fill('########');
    full[0] = '#.#.#.#.';
    const game = gameWith(full, ['##', '##', '##']);
    giveJoker(game, 'bomb');
    (game as unknown as { checkMoves(): void }).checkMoves();
    expect(game.state).toBe('running');
  });

  it('runs out of time in a timed game', () => {
    const game = new MosaicGame({ random: new ConstantRandom(), timeLimitMs: 1000 });
    game.start();
    game.update(999);
    expect(game.timeLeftMs).toBe(1);
    game.update(1);
    expect(game.overReason).toBe('timeUp');
  });
});

describe('jokers', () => {
  const use = (game: MosaicGame, joker: JokerId, target = {}) => {
    giveJoker(game, joker);
    return game.useJoker(game.jokers.length - 1, target);
  };

  it('rotate: turns a piece of the hand', () => {
    const game = gameWith(null, ['###', '#', '#']);
    expect(use(game, 'rotate', { slot: 0 as SlotId })).toBe(true);
    expect(game.pieceAt(0)?.shape.key).toBe(Shape.parse('#|#|#').key);
    expect(use(game, 'rotate')).toBe(false); // needs a piece
  });

  it('reroll: deals three new pieces', () => {
    const game = gameWith(null, ['#', '#', '#']);
    const before = game.pieces().map(({ piece }) => piece.id);
    use(game, 'reroll');
    expect(game.pieces().map(({ piece }) => piece.id)).not.toEqual(before);
  });

  it('bomb: clears a 3 × 3 square', () => {
    const game = gameWith(Array<string>(8).fill('########'), ['#', '#', '#']);
    expect(use(game, 'bomb', { x: 3, y: 3 })).toBe(true);
    expect(game.grid.tileCount()).toBe(64 - 9);
    expect(use(game, 'bomb', { x: 9, y: 0 })).toBe(false);
  });

  it('undo: takes back the last placement, never twice', () => {
    const game = gameWith(null, ['##', '#', '#']);
    game.place(0, 0, 0);
    expect(use(game, 'undo')).toBe(true);
    expect(game.grid.isEmpty()).toBe(true);
    expect(game.score).toBe(0);
    expect(game.pieceAt(0)).not.toBeNull();
    expect(use(game, 'undo')).toBe(false);
  });

  it('undo does not give back a joker earned by the cancelled placement', () => {
    const game = gameWith(
      ['#######.', '#######.', ...Array<string>(6).fill(EMPTY)],
      ['#|#', '#', '#'],
    );
    giveJoker(game, 'undo');
    game.place(0, 7, 0); // earns a joker
    expect(game.jokers).toHaveLength(2);
    game.useJoker(0);
    expect(game.jokers).toHaveLength(0);
  });

  it('cube: adds a one-cell piece to place anywhere, once at a time', () => {
    const game = gameWith(null, ['#', '#', '#']);
    expect(use(game, 'cube')).toBe(true);
    expect(game.pieceAt('bonus')?.shape.size).toBe(1);
    expect(use(game, 'cube')).toBe(false);
    expect(game.place('bonus', 5, 5)).toBe(true);
  });

  it('every joker says whether it could unblock a game', () => {
    const game = gameWith(null, ['#', '#', '#']);
    for (const joker of Object.values(JOKERS)) expect(typeof joker.canHelp(game)).toBe('boolean');
  });
});

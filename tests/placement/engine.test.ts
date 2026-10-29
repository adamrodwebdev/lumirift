import { describe, expect, it, vi } from 'vitest';
import { SeededRandom } from '@/core/Random';
import { Tone } from '@/core/Tone';
import { Dealer, type OfferedPiece } from '@/families/placement/engine/Dealer';
import { Grid } from '@/families/placement/engine/Grid';
import { canPlaceAll } from '@/families/placement/engine/HandSolver';
import {
  linePoints,
  MAX_PER_JOKER,
  MosaicGame,
  PERFECT_BONUS,
  type SlotId,
} from '@/families/placement/engine/MosaicGame';
import { Shape, SHAPES } from '@/families/placement/engine/Shape';
import { JOKERS, type JokerId } from '@/families/placement/jokers/Joker';
import { ConstantRandom } from '../falling/helpers';

describe('MosaicGame opening', () => {
  it('deals the first hand it is given, then hands of its own', () => {
    const opening = [
      { shape: Shape.parse('#|#|#'), tone: Tone.I },
      { shape: Shape.parse('##'), tone: Tone.T },
    ];
    const game = new MosaicGame({ random: new SeededRandom(1), opening });
    const hands: (OfferedPiece | null)[][] = [];
    game.events.on('deal', ({ hand }) => hands.push([...hand]));
    game.start();
    const [first] = hands;
    expect(first?.map((piece) => piece?.shape)).toEqual([
      opening[0]!.shape,
      opening[1]!.shape,
      undefined,
    ]);
    expect(first?.map((piece) => piece?.tone)).toEqual([Tone.I, Tone.T, undefined]);
    // Dealt once: a new hand comes from the dealer.
    game.redeal();
    expect(hands[1]?.every((piece) => piece !== null)).toBe(true);
  });
});

/** A started game whose hand is replaced by the given shapes. */
function gameWith(rows: string[] | null, shapes: string[]) {
  const game = new MosaicGame({
    random: new SeededRandom(1),
    ...(rows ? { grid: Grid.fromRows(rows) } : {}),
  });
  game.start();
  // Tests give their own jokers: drop the undo every game starts with.
  (game as unknown as { inventory: JokerId[] }).inventory = [];
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
  const shapesOf = (hand: readonly { shape: Shape }[]) => hand.map((piece) => piece.shape);

  it('deals every shape of the library, the common ones more often', () => {
    const dealer = new Dealer(new SeededRandom(5));
    const counts = new Map<string, number>();
    const empty = new Grid();
    for (let i = 0; i < 1500; i++) {
      for (const piece of dealer.hand(empty, 0)) {
        counts.set(piece.shape.key, (counts.get(piece.shape.key) ?? 0) + 1);
      }
    }
    expect(counts.size).toBe(new Set(SHAPES.map((entry) => entry.shape.key)).size);
    expect(counts.get(Shape.parse('##|##').key)!).toBeGreaterThan(
      counts.get(Shape.parse('###|###|###').key)!,
    );
  });

  it('only deals hands that can be placed in full', () => {
    const random = new SeededRandom(8);
    const dealer = new Dealer(random);
    for (let k = 0; k < 40; k++) {
      // A random, half-filled board.
      const rows = Array.from({ length: 8 }, () =>
        Array.from({ length: 8 }, () => (random.next() < 0.45 ? '#' : '.')).join(''),
      );
      const grid = Grid.fromRows(rows);
      const hand = dealer.hand(grid, k);
      if (shapesOf(hand).every((shape) => !grid.fitsAnywhere(shape))) continue; // board blocked
      expect(canPlaceAll(grid, shapesOf(hand), 100_000)).toBe(true);
    }
  });

  it('still deals a playable hand on a board where almost nothing fits', () => {
    // Two isolated holes per row and per column: only single cells fit, and three never clear.
    const rows = Array.from({ length: 8 }, (_, y) =>
      Array.from({ length: 8 }, (_, x) =>
        x === (3 * y) % 8 || x === (3 * y + 4) % 8 ? '.' : '#',
      ).join(''),
    );
    const grid = Grid.fromRows(rows);
    const hand = new Dealer(new SeededRandom(3)).hand(grid, 0);
    // Only single cells fit now; whatever comes next relies on the lines they clear.
    expect(hand.some((piece) => piece.shape.size === 1)).toBe(true);
    expect(canPlaceAll(grid, shapesOf(hand), 1_000_000)).toBe(true);
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

  it('clears full lines and scores them, with a growing combo', () => {
    const game = gameWith(
      ['#######.', '#######.', ...Array<string>(6).fill(EMPTY)],
      ['#', '#', '##|##'],
    );
    const onClear = vi.fn();
    game.events.on('clear', onClear);
    game.place(0, 7, 0);
    expect(onClear).toHaveBeenLastCalledWith(
      expect.objectContaining({ lines: 1, rows: [0], streak: 1, points: 10 }),
    );
    expect(game.score).toBe(1 + linePoints(1));
    game.place(1, 7, 1);
    expect(game.streak).toBe(2);
    expect(game.lines).toBe(2);
    // A quarter more for the second clear of the combo.
    expect(onClear).toHaveBeenLastCalledWith(expect.objectContaining({ points: 13 }));
  });

  it('scores lines at once on a rising scale', () => {
    expect([1, 2, 3, 4, 5, 6, 7].map(linePoints)).toEqual([10, 30, 60, 100, 150, 210, 270]);
  });

  it('keeps the combo through two placements without a clear, not three, and says when it ends', () => {
    const game = gameWith(['#######.', ...Array<string>(7).fill(EMPTY)], ['#', '#', '#']);
    const ends: number[] = [];
    game.events.on('streakEnd', ({ streak }) => ends.push(streak));
    game.place(0, 7, 0);
    expect(game.streak).toBe(1);
    game.place(1, 0, 7);
    game.place(2, 2, 7);
    expect(game.streak).toBe(1);
    const hand = (game as unknown as { hand: unknown[] }).hand;
    hand[0] = { id: 200, shape: Shape.parse('#'), tone: 1 };
    game.place(0, 4, 7);
    expect(game.streak).toBe(0);
    // A streak that ends is told once (1.41: from ×3 it is heard falling).
    expect(ends).toEqual([1]);
  });

  it('awards a bonus when the board is left empty', () => {
    const game = gameWith(['#######.', ...Array<string>(7).fill(EMPTY)], ['#', '#', '#']);
    const onPerfect = vi.fn();
    game.events.on('perfect', onPerfect);
    game.place(0, 7, 0);
    expect(onPerfect).toHaveBeenCalledWith({ points: PERFECT_BONUS });
  });

  it('earns a joker that matches the feat', () => {
    const feat = (rows: string[], shape: string, x: number) => {
      const game = gameWith(rows, [shape, '#', '#']);
      game.place(0, x, 0);
      return [...game.jokers];
    };
    const two = ['#######.', '#######.', '#.......', ...Array<string>(5).fill(EMPTY)];
    expect(feat(two, '#|#', 7)).toEqual(['rotate']);
    const three = ['#######.', '#######.', '#######.', '#.......', ...Array<string>(4).fill(EMPTY)];
    expect(feat(three, '#|#|#', 7)).toEqual(['cube']);
    const four = [
      '#######.',
      '#######.',
      '#######.',
      '#######.',
      '#.......',
      ...Array<string>(3).fill(EMPTY),
    ];
    expect(feat(four, '#|#|#|#', 7)).toEqual(['bomb']);
    // An empty board after the clear also earns an undo.
    expect(feat(['#######.', '#######.', ...Array<string>(6).fill(EMPTY)], '#|#', 7)).toEqual([
      'rotate',
      'undo',
    ]);
  });

  it(`holds ${MAX_PER_JOKER} jokers of a kind at most, and starts with one undo`, () => {
    const fresh = new MosaicGame({ random: new SeededRandom(1) });
    expect(fresh.jokers).toEqual(['undo']);
    const game = gameWith(null, ['#', '#', '#']);
    const earn = (game as unknown as { earnJoker(id: JokerId): void }).earnJoker.bind(game);
    earn('bomb');
    earn('bomb');
    earn('bomb');
    expect(game.jokers).toEqual(['bomb', 'bomb']);
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
      ['#######.', '#######.', '#.......', ...Array<string>(5).fill(EMPTY)],
      ['#|#', '#', '#'],
    );
    giveJoker(game, 'undo');
    game.place(0, 7, 0); // earns a rotation
    expect(game.jokers).toEqual(['rotate', 'undo']);
    game.useJoker(1);
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

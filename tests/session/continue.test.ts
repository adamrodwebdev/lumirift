import { describe, expect, it, vi } from 'vitest';
import { SeededRandom } from '@/core/Random';
import { Tone } from '@/core/Tone';
import { Board } from '@/families/falling/board/Board';
import { Game } from '@/families/falling/game/Game';
import { ClassicMode } from '@/families/falling/modes/ClassicMode';
import { Grid } from '@/families/placement/engine/Grid';
import { MosaicGame } from '@/families/placement/engine/MosaicGame';
import { Shape } from '@/families/placement/engine/Shape';
import { SandGame } from '@/families/sand/engine/SandGame';
import { GRAINS_PER_CELL } from '@/families/sand/engine/SandGrid';
import { CONTINUE_FREES } from '@/session/ContinueRule';
import { ConstantRandom } from '../falling/helpers';

/** A well full to its top but for one column: the next pieces cannot enter for long. */
const fullBoard = () =>
  Board.fromRows(Array.from({ length: 20 }, (_, y) => (y < 2 ? '..........' : '#########.')));

/** Drops pieces until the game is over (or gives up after a few). */
const loseFalling = (game: Game) => {
  game.start();
  for (let n = 0; game.state === 'running' && n < 30; n++) game.hardDrop();
};

describe('The continue in the falling engine', () => {
  it('blows the top of the stack away and plays on, the blocked piece first', () => {
    const game = new Game(new ClassicMode(), { random: new ConstantRandom(), board: fullBoard() });
    loseFalling(game);
    expect(game.state).toBe('over');
    expect(game.revivable).toBe(true);
    const before = game.board.stackHeight();
    const revive = vi.fn();
    game.events.on('revive', revive);
    game.revive(CONTINUE_FREES.falling);
    expect(game.state).toBe('running');
    expect(game.overReason).toBeNull();
    expect(game.active).not.toBeNull();
    expect(game.board.stackHeight()).toBeLessThanOrEqual(before - CONTINUE_FREES.falling);
    expect(revive.mock.calls[0]![0].cells.length).toBeGreaterThan(0);
    expect(game.revivable).toBe(false);
    // Nothing falls before the player's first move.
    const y = game.active!.y;
    for (let t = 0; t < 3000; t += 16) game.update(16);
    expect(game.active!.y).toBe(y);
    expect(game.elapsedMs).toBe(0);
    game.moveLeft();
    for (let t = 0; t < 3000; t += 16) game.update(16);
    expect(game.elapsedMs).toBeGreaterThan(0);
  });

  it('cannot take back a game that ran out of time', () => {
    const game = new Game(new ClassicMode(), { random: new ConstantRandom() });
    game.start();
    game.finish('timeUp');
    expect(game.revivable).toBe(false);
    game.revive(CONTINUE_FREES.falling);
    expect(game.state).toBe('over');
  });
});

describe('The continue in the Sand', () => {
  it('blows the top of the pile away and deals the piece that had no room', () => {
    const game = new SandGame({ random: new SeededRandom(4) });
    const { grid } = game;
    // Columns of alternating colours, full to the top: no region spans, nothing can enter.
    for (let y = 0; y < grid.height; y++) {
      for (let x = 0; x < grid.width; x++) grid.put(x, y, x % 2 ? Tone.ChromaA : Tone.ChromaB, 0);
    }
    game.start();
    expect(game.state).toBe('over');
    expect(game.revivable).toBe(true);
    const revive = vi.fn();
    game.events.on('revive', revive);
    game.revive(CONTINUE_FREES.sand);
    expect(game.state).toBe('running');
    expect(grid.sandHeight()).toBe(grid.height - CONTINUE_FREES.sand * GRAINS_PER_CELL);
    expect(revive.mock.calls[0]![0].grains).toHaveLength(
      CONTINUE_FREES.sand * GRAINS_PER_CELL * grid.width,
    );
    expect(game.revivable).toBe(false);
  });
});

describe('The continue in the Mosaic', () => {
  /** A board with no room for a domino, and a hand of dominoes. */
  const stuck = () => {
    const rows = Array<string>(8).fill('#.#.#.#.');
    rows[7] = '########';
    const game = new MosaicGame({ random: new SeededRandom(1), grid: Grid.fromRows(rows) });
    (game as unknown as { inventory: string[] }).inventory = [];
    game.start();
    (game as unknown as { hand: unknown[] }).hand = [0, 1, 2].map((id) => ({
      id,
      shape: Shape.parse('#####'),
      tone: 1,
    }));
    (game as unknown as { checkMoves(): void }).checkMoves();
    return game;
  };

  it('clears its fullest rows, more while no piece in hand has room', () => {
    const game = stuck();
    expect(game.state).toBe('over');
    expect(game.revivable).toBe(true);
    const revive = vi.fn();
    game.events.on('revive', revive);
    game.revive(CONTINUE_FREES.placement);
    expect(game.state).toBe('running');
    // The full bottom row goes first; a line of five needs a whole free row: one is enough.
    expect(game.grid.isFree(0, 7)).toBe(true);
    expect(revive).toHaveBeenCalledOnce();
    expect(game.pieces().some(({ piece }) => game.grid.fitsAnywhere(piece.shape))).toBe(true);
  });
});

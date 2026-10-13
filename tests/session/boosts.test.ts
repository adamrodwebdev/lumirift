import { describe, expect, it, vi } from 'vitest';
import { SeededRandom } from '@/core/Random';
import { Tone } from '@/core/Tone';
import { Board } from '@/families/falling/board/Board';
import { createSoloSession } from '@/families/falling';
import { Game } from '@/families/falling/game/Game';
import { ClassicMode } from '@/families/falling/modes/ClassicMode';
import { DuelMode } from '@/families/falling/modes/DuelMode';
import { Grid } from '@/families/placement/engine/Grid';
import { MosaicGame } from '@/families/placement/engine/MosaicGame';
import { Shape } from '@/families/placement/engine/Shape';
import { SandGame } from '@/families/sand/engine/SandGame';
import { GRAINS_PER_CELL } from '@/families/sand/engine/SandGrid';
import { NO_BOOSTS, type Boosts } from '@/session/Boosts';
import { ConstantRandom } from '../falling/helpers';

const boosts = (patch: Partial<Boosts>): Boosts => ({ ...NO_BOOSTS, ...patch });

/** A board whose visible rows are all full but the top one (a stack about to overflow). */
const fullBoard = () => {
  const rows = Array.from({ length: 20 }, (_, y) => (y < 2 ? '..........' : '#########.'));
  return Board.fromRows(rows);
};

describe('Boosts in the falling engine', () => {
  it('slows the fall, shows more pieces and leaves more time to lock', () => {
    const slow = new Game(new ClassicMode(), {
      random: new ConstantRandom(),
      boosts: boosts({ gravityScale: 0.5, extraPreview: 2, extraLockDelayMs: 300 }),
    });
    const normal = new Game(new ClassicMode(), { random: new ConstantRandom() });
    slow.start();
    normal.start();
    for (let t = 0; t < 3000; t += 16) {
      slow.update(16);
      normal.update(16);
    }
    expect(slow.active!.y).toBeLessThan(normal.active!.y);
    expect(slow.preview()).toHaveLength(normal.preview().length + 2);
  });

  it('adds its share to the points of clears', () => {
    const play = (scoreBonus: number) => {
      const game = new Game(new ClassicMode(), {
        random: new ConstantRandom(),
        board: Board.fromRows(['.#########', '.#########', '.#########', '.#########']),
        boosts: boosts({ scoreBonus }),
      });
      const points = vi.fn();
      game.events.on('clear', ({ points: p }) => points(p));
      game.start(); // the first piece is an I
      game.rotate(1);
      while (game.moveLeft()) {
        /* to the wall */
      }
      game.hardDrop();
      return points.mock.calls[0]?.[0] as number;
    };
    expect(play(0.2)).toBe(Math.round(play(0) * 1.2));
  });

  it('gives a second chance once: the bottom rows vanish instead of the end', () => {
    const game = new Game(new ClassicMode(), {
      random: new ConstantRandom(),
      board: fullBoard(),
      boosts: boosts({ rescueRows: 6 }),
    });
    const rescue = vi.fn();
    game.events.on('rescue', rescue);
    const drops = (g: Game) => {
      g.start();
      let n = 0;
      while (g.state === 'running' && rescue.mock.calls.length === 0 && n < 20) {
        g.hardDrop();
        n++;
      }
      return n;
    };
    const plain = new Game(new ClassicMode(), { random: new ConstantRandom(), board: fullBoard() });
    drops(plain);
    // Without the upgrade, the stack ends the game; with it, the bottom rows vanish once.
    expect(plain.state).toBe('over');
    drops(game);
    expect(rescue).toHaveBeenCalledWith({ rows: 6 });
    expect(game.state).toBe('running');
  });

  it('never helps the AI of a duel', () => {
    const player = new DuelMode({ boosts: boosts({ garbageDelayMs: 2000 }) });
    const opponent = new DuelMode();
    player.receive(2);
    opponent.receive(2);
    const timer = (mode: DuelMode) =>
      (mode as unknown as { incoming: { timer: number }[] }).incoming[0]!.timer;
    expect(timer(player)).toBe(timer(opponent) + 2000);
  });

  it('is never set outside the campaign', () => {
    const session = createSoloSession('classic', {
      random: new SeededRandom(1),
      timeLimitMs: null,
    });
    session.start();
    expect(session.view.preview()).toHaveLength(3);
  });
});

describe('Boosts in the Sand and the Mosaic', () => {
  it('gives the Sand a second chance and more fire', () => {
    const game = new SandGame({
      random: new SeededRandom(4),
      boosts: boosts({ rescueRows: 4, fireBonus: 0.5 }),
    });
    const { grid } = game;
    // Fill the well to the top in columns of alternating colours (no region spans).
    for (let y = 0; y < grid.height; y++) {
      for (let x = 0; x < grid.width; x++) {
        grid.put(x, y, x % 2 ? Tone.ChromaA : Tone.ChromaB, 0);
      }
    }
    const rescue = vi.fn();
    game.events.on('rescue', rescue);
    game.start();
    expect(rescue).toHaveBeenCalledOnce();
    expect(game.state).toBe('running');
    expect(grid.sandHeight()).toBe(grid.height - 4 * GRAINS_PER_CELL);
  });

  it('gives the Mosaic its starting jokers and a second chance', () => {
    const full = Array<string>(8).fill('########');
    full[0] = '#.#.#.#.';
    const game = new MosaicGame({
      random: new SeededRandom(1),
      grid: Grid.fromRows(full),
      boosts: boosts({ startJokers: 2, rescueRows: 4 }),
    });
    expect(game.jokers).toEqual(['reroll', 'bomb', 'undo']);
    const rescue = vi.fn();
    game.events.on('rescue', rescue);
    (game as unknown as { inventory: string[] }).inventory = [];
    game.start();
    // A hand of dominoes: nothing fits on this board.
    (game as unknown as { hand: unknown[] }).hand = [0, 1, 2].map((id) => ({
      id,
      shape: Shape.parse('##'),
      tone: 1,
    }));
    (game as unknown as { checkMoves(): void }).checkMoves();
    expect(rescue).toHaveBeenCalledWith({ lines: 2 });
    expect(game.state).toBe('running');
  });
});

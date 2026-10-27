import { describe, expect, it, vi } from 'vitest';
import { SeededRandom } from '@/core/Random';
import { Tone } from '@/core/Tone';
import { Board } from '@/families/falling/board/Board';
import { Game } from '@/families/falling/game/Game';
import { ClassicMode } from '@/families/falling/modes/ClassicMode';
import { createSandSession } from '@/families/sand';
import { SandGame } from '@/families/sand/engine/SandGame';
import { GRAINS_PER_CELL } from '@/families/sand/engine/SandGrid';
import { createVolumeSession } from '@/families/volume';
import { CONTINUE_FREES } from '@/session/ContinueRule';
import { ConstantRandom } from '../falling/helpers';

/** A well full to its top but for one column: the next pieces cannot enter for long. */
const fullBoard = () =>
  Board.fromRows(Array.from({ length: 20 }, (_, y) => (y < 2 ? '..........' : '#########.')));

describe('An overflow that goes on (the Rift Race, 1.34)', () => {
  it('blows the top of the stack away in the well, never ending the game', () => {
    const game = new Game(new ClassicMode(), {
      random: new ConstantRandom(),
      board: fullBoard(),
      overflowFrees: CONTINUE_FREES.falling,
    });
    const overflow = vi.fn();
    const over = vi.fn();
    game.events.on('overflow', overflow);
    game.events.on('over', over);
    game.start();
    for (let n = 0; n < 30; n++) game.hardDrop();
    expect(over).not.toHaveBeenCalled();
    expect(game.state).toBe('running');
    expect(overflow).toHaveBeenCalled();
    expect(overflow.mock.calls[0]![0].cells.length).toBeGreaterThan(0);
    expect(game.active).not.toBeNull();
    // Play goes on at once: no wait for a first move, as after a continue.
    const y = game.active!.y;
    for (let t = 0; t < 3000; t += 16) game.update(16);
    expect(game.active === null || game.active.y !== y).toBe(true);
  });

  it('still ends a game that ran out of time', () => {
    const game = new Game(new ClassicMode(), { random: new ConstantRandom(), overflowFrees: 10 });
    game.start();
    game.finish('timeUp');
    expect(game.state).toBe('over');
  });

  it('blows the top of the pile away in the Sand and deals the piece that had no room', () => {
    const game = new SandGame({ random: new SeededRandom(4), overflowFrees: CONTINUE_FREES.sand });
    const { grid } = game;
    for (let y = 0; y < grid.height; y++) {
      for (let x = 0; x < grid.width; x++) grid.put(x, y, x % 2 ? Tone.ChromaA : Tone.ChromaB, 0);
    }
    const overflow = vi.fn();
    game.events.on('overflow', overflow);
    game.start();
    expect(game.state).toBe('running');
    expect(game.active).not.toBeNull();
    expect(overflow.mock.calls[0]![0].grains).toHaveLength(
      CONTINUE_FREES.sand * GRAINS_PER_CELL * grid.width,
    );
  });

  it('is told by the sessions, the Tower’s too, when the race asks for it', () => {
    for (const session of [
      createSandSession('sand', {
        random: new SeededRandom(1),
        timeLimitMs: null,
        overflowGoesOn: true,
      }),
      createVolumeSession('tower', {
        random: new SeededRandom(1),
        timeLimitMs: null,
        overflowGoesOn: true,
      }),
    ]) {
      const overflows = vi.fn();
      session.events.on('overflow', overflows);
      session.start();
      const drop = session as unknown as { execute(command: { type: 'hardDrop' }): boolean };
      for (let n = 0; n < 200 && overflows.mock.calls.length === 0; n++) {
        drop.execute({ type: 'hardDrop' });
        session.update(16);
      }
      expect(overflows).toHaveBeenCalled();
      expect(session.state).toBe('running');
      session.dispose();
    }
  });
});

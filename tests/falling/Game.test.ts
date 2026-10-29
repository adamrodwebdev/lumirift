import { describe, expect, it, vi } from 'vitest';
import { Board } from '@/families/falling/board/Board';
import { Game } from '@/families/falling/game/Game';
import { ClassicMode } from '@/families/falling/modes/ClassicMode';
import { FixedRandom } from '@/showcase/autoplay';
import { ConstantRandom, startedGame } from './helpers';

const row = (pattern: string, count: number): string[] => Array<string>(count).fill(pattern);

describe('Game', () => {
  it('starts with the first piece of the bag, centred, just inside the well', () => {
    const game = startedGame();
    expect(game.state).toBe('running');
    expect(game.active?.type).toBe('I');
    expect(game.active?.x).toBe(3);
    expect(game.active?.y).toBe(1);
    expect(game.preview().map((spec) => spec.type)).toEqual(['O', 'T', 'S']);
  });

  it('warns where the next piece would appear once it has no room to enter', () => {
    expect(startedGame().spawnWarning()).toBeNull();
    // The well full to its top row: the next piece, an O, could not come down.
    const full = startedGame({ rows: row('####.#####', 20) });
    expect(full.preview(1)[0]?.type).toBe('O');
    expect(full.spawnWarning()).toHaveLength(4);
  });

  it('stays ready until started', () => {
    const game = new Game(new ClassicMode(), { random: new ConstantRandom() });
    expect(game.state).toBe('ready');
    expect(game.active).toBeNull();
    game.update(5000);
    expect(game.active).toBeNull();
  });

  it('moves sideways until a wall', () => {
    const game = startedGame();
    expect([1, 2, 3].map(() => game.moveLeft())).toEqual([true, true, true]);
    expect(game.moveLeft()).toBe(false);
    expect(game.active?.x).toBe(0);
  });

  it('hard drops, scores two points per row and spawns the next piece', () => {
    const game = startedGame();
    game.hardDrop();
    expect(game.score).toBe(38);
    expect(game.board.toRows().at(-1)).toBe('...####...');
    expect(game.active?.type).toBe('O');
  });

  it('clears a line and scores it', () => {
    const game = startedGame({ rows: ['###....###'] });
    const onClear = vi.fn();
    game.events.on('clear', onClear);
    game.hardDrop();
    expect(game.lines).toBe(1);
    expect(game.score).toBe(38 + 100);
    expect(game.board.blockCount()).toBe(0);
    expect(onClear).toHaveBeenCalledWith(
      expect.objectContaining({ lines: 1, points: 100, combo: 0, cascade: false }),
    );
  });

  it('soft drop speeds the fall and scores one point per row', () => {
    const game = startedGame();
    game.setSoftDrop(true);
    game.update(50);
    expect(game.active?.y).toBe(2);
    expect(game.score).toBe(1);
  });

  it('takes the piece down a row at a time for a finger, scored as a soft drop (1.40)', () => {
    const game = startedGame();
    const y = game.active!.y;
    expect(game.softStep()).toBe(true);
    expect(game.active?.y).toBe(y + 1);
    expect(game.score).toBe(1);
    while (game.softStep()) {
      /* down to the floor */
    }
    // On the floor: no row more, and the piece waits for its lock.
    expect(game.softStep()).toBe(false);
    expect(game.active).not.toBeNull();
  });

  it('holds once per piece and swaps back after a lock', () => {
    const game = startedGame();
    expect(game.hold()).toBe(true);
    expect(game.held?.type).toBe('I');
    expect(game.active?.type).toBe('O');
    expect(game.hold()).toBe(false);
    game.hardDrop();
    expect(game.active?.type).toBe('T');
    expect(game.hold()).toBe(true);
    expect(game.active?.type).toBe('I');
    expect(game.held?.type).toBe('T');
  });

  it('waits for the lock delay after landing', () => {
    const game = startedGame();
    for (let i = 0; i < 19; i++) game.update(1000);
    expect(game.dropDistance()).toBe(0);
    game.update(499);
    expect(game.active?.type).toBe('I');
    game.update(2);
    expect(game.active?.type).toBe('O');
  });

  it('resets the lock delay when the grounded piece moves', () => {
    const game = startedGame();
    for (let i = 0; i < 19; i++) game.update(1000);
    game.update(400);
    game.moveLeft();
    game.update(400);
    expect(game.active?.type).toBe('I');
  });

  it('kicks a piece off the wall when it rotates', () => {
    const game = startedGame();
    game.rotate(1);
    while (game.moveLeft()) {
      /* push against the left wall */
    }
    expect(game.active?.x).toBe(-2);
    expect(game.rotate(1)).toBe(true);
    expect(game.active?.rotation).toBe(2);
    expect(game.active?.x).toBe(0);
  });

  it('ends with a block out when the spawn area is filled', () => {
    const game = new Game(new ClassicMode(), { random: new ConstantRandom() });
    const onOver = vi.fn();
    game.events.on('over', onOver);
    // Fill the whole well, hidden rows included (one free column, so nothing clears).
    for (let i = 0; i < game.board.height; i++) game.board.pushGarbageRow(9);
    game.start();
    expect(game.state).toBe('over');
    expect(game.overReason).toBe('blockOut');
    expect(onOver).toHaveBeenCalledWith({ reason: 'blockOut' });
  });

  it('pauses and resumes', () => {
    const game = startedGame();
    game.pause();
    game.update(5000);
    expect(game.active?.y).toBe(1);
    expect(game.moveLeft()).toBe(false);
    game.resume();
    game.update(1000);
    expect(game.active?.y).toBe(2);
  });

  it('counts the elapsed time and can be finished by a mode', () => {
    const game = startedGame();
    game.update(250);
    expect(game.elapsedMs).toBe(250);
    game.finish('timeUp');
    expect(game.state).toBe('over');
    expect(game.active).toBeNull();
    game.update(1000);
    expect(game.elapsedMs).toBe(250);
  });

  it('raises a garbage row under the stack', () => {
    const game = startedGame();
    const onGarbage = vi.fn();
    game.events.on('garbage', onGarbage);
    game.raiseGarbage(0);
    expect(game.board.toRows().at(-1)).toBe('.#########');
    expect(onGarbage).toHaveBeenCalledOnce();
  });

  it('flips the well: blocks settle and full rows clear in cascade', () => {
    const game = startedGame({ rows: ['.........#', '#########.'] });
    const onClear = vi.fn();
    const onFlip = vi.fn();
    game.events.on('clear', onClear);
    game.events.on('flip', onFlip);
    game.flipWell();
    expect(game.board.blockCount()).toBe(0);
    expect(game.lines).toBe(1);
    expect(onFlip).toHaveBeenCalledWith({ lines: 1 });
    expect(onClear).toHaveBeenCalledWith(expect.objectContaining({ cascade: true }));
  });

  it('levels up every ten lines', () => {
    const game = startedGame({ rows: [...row('.........#', 10), ...row('#########.', 10)] });
    const onLevelUp = vi.fn();
    game.events.on('levelUp', onLevelUp);
    game.flipWell();
    expect(game.lines).toBe(10);
    expect(game.level).toBe(2);
    expect(onLevelUp).toHaveBeenCalledWith({ level: 2 });
  });
});

describe('Game events and timing for the effects', () => {
  it('reports the cleared rows with their tones', () => {
    const game = startedGame({ rows: ['###....###'] });
    const onClear = vi.fn();
    game.events.on('clear', onClear);
    game.hardDrop();
    const { rows } = onClear.mock.calls[0]![0] as { rows: { index: number; tones: Uint8Array }[] };
    expect(rows).toHaveLength(1);
    expect(rows[0]!.index).toBe(21);
    expect([...rows[0]!.tones].every((tone) => tone !== 0)).toBe(true);
  });

  it('reports a hard drop with its distance, before the lock', () => {
    const game = startedGame();
    const order: string[] = [];
    game.events.on('hardDrop', ({ distance }) => order.push(`drop ${distance}`));
    game.events.on('lock', () => order.push('lock'));
    game.hardDrop();
    expect(order).toEqual(['drop 19', 'lock']);
  });

  it('reports moves and rotations, and whether a rotation was kicked', () => {
    const game = startedGame();
    const onMove = vi.fn();
    const onRotate = vi.fn();
    game.events.on('move', onMove);
    game.events.on('rotate', onRotate);
    game.moveLeft();
    game.rotate(1);
    while (game.moveLeft()) {
      /* against the wall */
    }
    game.rotate(1);
    expect(onMove).toHaveBeenCalled();
    expect(onRotate.mock.calls.map(([event]) => (event as { kicked: boolean }).kicked)).toEqual([
      false,
      true,
    ]);
  });

  it('waits for the line clear delay before the next piece', () => {
    const game = new Game(new ClassicMode(), {
      random: new ConstantRandom(),
      board: Board.fromRows(['###....###']),
      lineClearDelayMs: 280,
    });
    game.start();
    game.hardDrop();
    expect(game.active).toBeNull();
    expect(game.hold()).toBe(false);
    game.update(279);
    expect(game.active).toBeNull();
    game.update(1);
    expect(game.active?.type).toBe('O');
  });

  it('spawns at once when nothing was cleared', () => {
    const game = new Game(new ClassicMode(), {
      random: new ConstantRandom(),
      lineClearDelayMs: 280,
    });
    game.start();
    game.hardDrop();
    expect(game.active?.type).toBe('O');
  });

  describe('says how a piece locked, and when a combo ends (1.41)', () => {
    /** The feel scenes' combo board (src/showcase/feelScenes.ts): the I, then the O, each clear a line. */
    const comboWell = () => {
      const side = '###....###';
      const rows = [...row(side, 10), '####..####', '####...###'].map((pattern) =>
        pattern.replace(/#/g, 'Z'),
      );
      const game = new Game(new ClassicMode(), {
        random: new FixedRandom(),
        board: Board.fromRows(rows),
      });
      game.start();
      return game;
    };

    it('a hard drop locks as such, with its distance', () => {
      const game = comboWell();
      const locks: { cause: string; distance: number }[] = [];
      game.events.on('lock', ({ cause, distance }) => locks.push({ cause, distance }));
      const fall = game.dropDistance();
      game.hardDrop();
      expect(locks).toEqual([{ cause: 'hard', distance: fall }]);
      expect(fall).toBeGreaterThan(5);
    });

    it('a piece left to fall locks by gravity, at no distance', () => {
      const game = comboWell();
      const locks: { cause: string; distance: number }[] = [];
      game.events.on('lock', ({ cause, distance }) => locks.push({ cause, distance }));
      for (let t = 0; t < 30_000 && locks.length === 0; t += 16) game.update(16);
      expect(locks).toEqual([{ cause: 'gravity', distance: 0 }]);
    });

    it('a chain of two clears ends when a piece clears nothing', () => {
      const game = comboWell();
      const ends: number[] = [];
      const clears: number[] = [];
      game.events.on('comboEnd', ({ combo }) => ends.push(combo));
      game.events.on('clear', ({ combo }) => clears.push(combo));
      const next = () => {
        for (let t = 0; t < 2000 && !game.active; t += 16) game.update(16);
      };
      game.hardDrop();
      next();
      game.hardDrop();
      next();
      expect(clears).toEqual([0, 1]);
      expect(ends).toEqual([]);
      // The T, dropped where it appears, clears nothing: the chain ends at ×2.
      game.hardDrop();
      next();
      expect(clears).toEqual([0, 1]);
      expect(ends).toEqual([1]);
    });
  });
});

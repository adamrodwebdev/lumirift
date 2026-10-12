import { describe, expect, it, vi } from 'vitest';
import { Game } from '@/families/falling/game/Game';
import { ClassicMode } from '@/families/falling/modes/ClassicMode';
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

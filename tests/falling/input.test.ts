import { describe, expect, it, vi } from 'vitest';
import type { FallingCommand } from '@/families/falling/FallingSession';
import { FallingInput } from '@/families/falling/input/FallingInput';
import { DEFAULT_REPEAT, type RepeatTiming } from '@/families/falling/input/RepeatTiming';
import { WellGestures } from '@/families/falling/input/WellGestures';

const { das: DAS_MS, arr: ARR_MS } = DEFAULT_REPEAT;

const setup = (timing?: RepeatTiming) => {
  const commands: FallingCommand[] = [];
  const onPause = vi.fn();
  const input = new FallingInput(
    (command) => {
      commands.push(command);
      return true;
    },
    onPause,
    timing && (() => timing),
  );
  const moves = () => commands.filter((command) => command.type === 'move');
  return { input, commands, onPause, moves };
};

describe('FallingInput', () => {
  it('moves once on press, then repeats after the delay', () => {
    const { input, moves } = setup();
    input.press('left');
    expect(moves()).toHaveLength(1);
    input.update(DAS_MS - 1);
    expect(moves()).toHaveLength(1);
    input.update(1);
    expect(moves()).toHaveLength(2);
    input.update(ARR_MS * 3);
    expect(moves()).toHaveLength(5);
    expect(moves()).toEqual(Array<FallingCommand>(5).fill({ type: 'move', direction: -1 }));
  });

  it('stops repeating on release', () => {
    const { input, moves } = setup();
    input.press('right');
    input.release('right');
    input.update(1000);
    expect(moves()).toHaveLength(1);
  });

  it('follows the most recent direction, then returns to the other one', () => {
    const { input, moves } = setup();
    input.press('left');
    input.press('right');
    input.update(DAS_MS);
    expect(moves().at(-1)).toEqual({ type: 'move', direction: 1 });
    input.release('right');
    input.update(DAS_MS);
    expect(moves().at(-1)).toEqual({ type: 'move', direction: -1 });
  });

  it('holds soft drop while pressed', () => {
    const { input, commands } = setup();
    input.press('softDrop');
    input.release('softDrop');
    expect(commands).toEqual([
      { type: 'softDrop', active: true },
      { type: 'softDrop', active: false },
    ]);
  });

  it('sends one-shot actions once', () => {
    const { input, commands } = setup();
    input.press('hardDrop');
    input.press('rotateCw');
    input.press('rotateCcw');
    input.press('hold');
    input.press('ability');
    expect(commands).toEqual([
      { type: 'hardDrop' },
      { type: 'rotate', direction: 1 },
      { type: 'rotate', direction: -1 },
      { type: 'hold' },
      { type: 'ability' },
    ]);
  });

  it('asks for a pause instead of sending a command', () => {
    const { input, commands, onPause } = setup();
    input.press('pause');
    expect(onPause).toHaveBeenCalledOnce();
    expect(commands).toEqual([]);
  });

  it('releases everything at once', () => {
    const { input, moves, commands } = setup();
    input.press('left');
    input.releaseAll();
    input.update(1000);
    expect(moves()).toHaveLength(1);
    expect(commands.at(-1)).toEqual({ type: 'softDrop', active: false });
  });

  it("repeats at the player's timing", () => {
    const { input, moves } = setup({ das: 100, arr: 20 });
    input.press('right');
    input.update(99);
    expect(moves()).toHaveLength(1);
    input.update(1);
    expect(moves()).toHaveLength(2);
    input.update(60);
    expect(moves()).toHaveLength(5);
  });

  it('slides to the wall at once with an instant repeat, and stays there while held', () => {
    // A well five moves wide.
    let room = 5;
    const commands: FallingCommand[] = [];
    const input = new FallingInput(
      (command) => {
        commands.push(command);
        if (command.type !== 'move' || room === 0) return false;
        room--;
        return true;
      },
      () => {},
      () => ({ das: 120, arr: 0 }),
    );
    input.press('left');
    expect(room).toBe(4);
    input.update(119);
    expect(room).toBe(4);
    input.update(1);
    expect(room).toBe(0);
    // A rotation off the wall: the next frame takes it back.
    room = 2;
    input.update(16);
    expect(room).toBe(0);
    input.release('left');
    room = 3;
    input.update(500);
    expect(room).toBe(3);
  });
});

describe('WellGestures', () => {
  const CELL = 30;
  const setupGestures = () => {
    const commands: FallingCommand[] = [];
    const gestures = new WellGestures(
      (command) => commands.push(command),
      () => CELL,
    );
    return { gestures, commands };
  };

  it('rotates on a tap', () => {
    const { gestures, commands } = setupGestures();
    gestures.down(1, 100, 100, 0);
    gestures.up(1, 103, 102, 120);
    expect(commands).toEqual([{ type: 'rotate', direction: 1 }]);
  });

  it('moves one cell per cell dragged sideways, without rotating', () => {
    const { gestures, commands } = setupGestures();
    gestures.down(1, 100, 100, 0);
    gestures.move(1, 165, 100);
    gestures.move(1, 40, 100);
    gestures.up(1, 40, 100, 400);
    expect(commands).toEqual([
      { type: 'move', direction: 1 },
      { type: 'move', direction: 1 },
      { type: 'move', direction: -1 },
      { type: 'move', direction: -1 },
      { type: 'move', direction: -1 },
      { type: 'move', direction: -1 },
    ]);
  });

  it('hard drops on a fast flick down', () => {
    const { gestures, commands } = setupGestures();
    gestures.down(1, 100, 100, 0);
    gestures.move(1, 100, 140);
    gestures.up(1, 100, 220, 90);
    expect(commands.at(-1)).toEqual({ type: 'hardDrop' });
  });

  it('soft drops while dragging down slowly', () => {
    const { gestures, commands } = setupGestures();
    gestures.down(1, 100, 100, 0);
    gestures.move(1, 100, 150);
    expect(commands).toEqual([{ type: 'softDrop', active: true }]);
    gestures.up(1, 100, 160, 900);
    expect(commands).toEqual([
      { type: 'softDrop', active: true },
      { type: 'softDrop', active: false },
    ]);
  });

  it('ignores other pointers and releases on cancel', () => {
    const { gestures, commands } = setupGestures();
    gestures.down(1, 100, 100, 0);
    gestures.move(2, 300, 100);
    gestures.move(1, 100, 150);
    gestures.cancel();
    expect(commands).toEqual([
      { type: 'softDrop', active: true },
      { type: 'softDrop', active: false },
    ]);
  });

  it('rotates the other way on a two-finger tap', () => {
    const { gestures, commands } = setupGestures();
    gestures.down(1, 100, 100, 0);
    gestures.down(2, 180, 100, 30);
    gestures.up(1, 101, 100, 140);
    expect(commands).toEqual([]);
    gestures.up(2, 181, 101, 160);
    expect(commands).toEqual([{ type: 'rotate', direction: -1 }]);
  });

  it('does nothing when two fingers drag (the Tower turns its camera with them)', () => {
    const { gestures, commands } = setupGestures();
    gestures.down(1, 100, 100, 0);
    gestures.down(2, 180, 100, 20);
    gestures.move(1, 160, 100);
    gestures.move(2, 240, 100);
    gestures.up(1, 160, 100, 200);
    gestures.up(2, 240, 100, 210);
    expect(commands).toEqual([]);
  });

  it('ends a soft drop when a second finger comes', () => {
    const { gestures, commands } = setupGestures();
    gestures.down(1, 100, 100, 0);
    gestures.move(1, 100, 150);
    gestures.down(2, 200, 100, 300);
    expect(commands).toEqual([
      { type: 'softDrop', active: true },
      { type: 'softDrop', active: false },
    ]);
  });

  it('holds on a fast flick up, not on a slow drag up', () => {
    const { gestures, commands } = setupGestures();
    gestures.down(1, 100, 300, 0);
    gestures.up(1, 102, 200, 80);
    expect(commands).toEqual([{ type: 'hold' }]);
    gestures.down(1, 100, 300, 1000);
    gestures.up(1, 100, 200, 1900);
    expect(commands).toEqual([{ type: 'hold' }]);
  });
});

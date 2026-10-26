import { describe, expect, it, vi } from 'vitest';
import type { FallingCommand } from '@/families/falling/FallingSession';
import { FallingInput } from '@/families/falling/input/FallingInput';
import { DEFAULT_REPEAT, type RepeatTiming } from '@/families/falling/input/RepeatTiming';

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

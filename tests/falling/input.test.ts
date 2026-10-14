import { describe, expect, it, vi } from 'vitest';
import type { FallingCommand } from '@/families/falling/FallingSession';
import { ARR_MS, DAS_MS, FallingInput, KEY_BINDINGS } from '@/families/falling/input/FallingInput';
import { WellGestures } from '@/families/falling/input/WellGestures';

const setup = () => {
  const commands: FallingCommand[] = [];
  const onPause = vi.fn();
  const input = new FallingInput((command) => commands.push(command), onPause);
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

  it('binds keys by physical position, for AZERTY and QWERTY alike', () => {
    expect(KEY_BINDINGS.KeyA).toBe('left');
    expect(KEY_BINDINGS.KeyZ).toBe('rotateCcw');
    expect(KEY_BINDINGS.Space).toBe('hardDrop');
    expect(KEY_BINDINGS.KeyP).toBe('pause');
  });

  it('leaves the keys game portals reserve: Esc (full screen) and Ctrl (Ctrl+W)', () => {
    expect(KEY_BINDINGS.Escape).toBeUndefined();
    expect(KEY_BINDINGS.ControlLeft).toBeUndefined();
    expect(KEY_BINDINGS.ControlRight).toBeUndefined();
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
});

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_KEYS,
  isBindable,
  KEY_ACTIONS,
  KeyBindings,
} from '@/families/falling/input/KeyBindings';
import { keyLegendFor } from '@/ui/keyLegend';

const DEFAULT = KeyBindings.DEFAULT;

describe('KeyBindings', () => {
  it('binds keys by physical position, for AZERTY and QWERTY alike', () => {
    expect(DEFAULT.actionFor('KeyA')).toBe('left');
    expect(DEFAULT.actionFor('KeyZ')).toBe('rotateCcw');
    expect(DEFAULT.actionFor('Space')).toBe('hardDrop');
    expect(DEFAULT.actionFor('KeyP')).toBe('pause');
    expect(DEFAULT.actionFor('KeyQ')).toBe('turnLeft');
    expect(DEFAULT.codes('rotateCw')).toEqual(['ArrowUp', 'KeyX']);
  });

  it('takes both Shift keys as one', () => {
    expect(DEFAULT.actionFor('ShiftRight')).toBe('hold');
    expect(DEFAULT.with('pause', 1, 'ShiftRight').actionFor('ShiftLeft')).toBe('pause');
  });

  it('never lets a player take the keys the portals and the browser keep', () => {
    for (const code of ['Escape', 'Tab', 'ControlLeft', 'AltRight', 'MetaLeft', 'F5', 'Delete'])
      expect(isBindable(code), code).toBe(false);
    for (const code of ['KeyK', 'Digit4', 'Numpad8', 'Comma', 'Enter', 'ShiftLeft', 'ArrowUp'])
      expect(isBindable(code), code).toBe(true);
    expect(DEFAULT.with('hardDrop', 1, 'Escape')).toBe(DEFAULT);
    expect(DEFAULT.actionFor('Escape')).toBeUndefined();
    expect(DEFAULT.actionFor('ControlLeft')).toBeUndefined();
  });

  it('puts a key in a slot, and swaps it with the slot it came from', () => {
    // Space (the hard drop) on the rotation's main slot: the hard drop takes ↑.
    const swapped = DEFAULT.with('rotateCw', 0, 'Space');
    expect(swapped.codes('rotateCw')).toEqual(['Space', 'KeyX']);
    expect(swapped.codes('hardDrop')).toEqual(['ArrowUp']);
    // A new key in an empty slot: nothing else changes.
    const added = DEFAULT.with('hardDrop', 1, 'KeyK');
    expect(added.codes('hardDrop')).toEqual(['Space', 'KeyK']);
    expect(added.actionFor('KeyK')).toBe('hardDrop');
    // The spare slot of an action, taken from its main one: they swap.
    expect(DEFAULT.with('left', 1, 'ArrowLeft').codes('left')).toEqual(['KeyA', 'ArrowLeft']);
  });

  it('leaves an action without a key when its only key goes into an empty slot', () => {
    const next = DEFAULT.with('hardDrop', 1, 'KeyP');
    expect(next.codes('hardDrop')).toEqual(['Space', 'KeyP']);
    expect(next.codes('pause')).toEqual([]);
    expect(next.unbound()).toEqual(['pause']);
  });

  it('empties a slot', () => {
    const next = DEFAULT.without('left', 1);
    expect(next.codes('left')).toEqual(['ArrowLeft']);
    expect(next.actionFor('KeyA')).toBeUndefined();
    expect(next.without('left', 1)).toBe(next);
  });

  it('reads a save, keeping what is valid', () => {
    const saved = DEFAULT.with('rotateCw', 0, 'KeyK').toJSON();
    expect(KeyBindings.parse(JSON.parse(JSON.stringify(saved))).toJSON()).toEqual(saved);
    expect(KeyBindings.parse('nonsense').toJSON()).toEqual(DEFAULT_KEYS);
    const broken = KeyBindings.parse({
      left: ['Escape', 'KeyA', 'KeyB'],
      right: ['KeyA', 42],
      hold: 'KeyC',
    });
    // A reserved key and a third slot dropped; a key used twice stays with its first action.
    expect(broken.codes('left')).toEqual(['KeyA']);
    expect(broken.codes('right')).toEqual([]);
    // An action the save got wrong takes its defaults.
    expect(broken.codes('hold')).toEqual(['KeyC', 'ShiftLeft']);
  });

  it('gives an action added since the save its defaults, unless the player uses them', () => {
    const saved = Object.fromEntries(
      KEY_ACTIONS.filter((action) => action !== 'turnLeft').map((action) => [
        action,
        DEFAULT_KEYS[action],
      ]),
    );
    saved.pause = ['KeyQ', null];
    const parsed = KeyBindings.parse(saved);
    expect(parsed.codes('pause')).toEqual(['KeyQ']);
    expect(parsed.codes('turnLeft')).toEqual([]);
  });

  it('draws the legend with the player keys, but the Mosaic with its own', () => {
    const custom = DEFAULT.with('rotateCw', 0, 'KeyK').with('left', 0, 'KeyJ');
    const falling = keyLegendFor('falling', 'classic', custom);
    expect(falling.find((row) => row.action === 'controls.rotateCw')?.codes).toEqual([
      'KeyK',
      'KeyX',
    ]);
    expect(falling.find((row) => row.action === 'controls.move')?.codes).toEqual([
      'KeyJ',
      'ArrowRight',
    ]);
    const flip = keyLegendFor('falling', 'flip', custom);
    expect(flip.at(-3)?.codes).toEqual(['KeyF']);
    // The surge, before Pause, but not in the Rhythm.
    expect(flip.at(-2)?.codes).toEqual(['KeyV']);
    expect(
      keyLegendFor('falling', 'rhythm', custom).some((row) => row.action === 'surge.name'),
    ).toBe(false);
    const mosaic = keyLegendFor('placement', 'mosaic', custom);
    expect(mosaic.find((row) => row.action === 'keys.place')?.codes).toEqual(['Enter']);
  });
});

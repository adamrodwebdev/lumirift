import { describe, expect, it } from 'vitest';
import { gestureRows } from '@/ui/gestureGuide';

const marks = (...args: Parameters<typeof gestureRows>) =>
  gestureRows(...args).map(({ mark }) => mark);

describe('the gesture guide', () => {
  it('shows the falling well its gestures, a side for each turn', () => {
    expect(marks('falling', { controls: 'gestures', tapSides: true })).toEqual([
      'drag',
      'tapRight',
      'tapLeft',
      'softDrop',
      'drop',
      'hold',
      'second',
    ]);
  });

  it('turns right on every tap without the sides, and the other way with two fingers', () => {
    expect(marks('falling', { controls: 'gestures', tapSides: false })).toEqual([
      'drag',
      'tap',
      'softDrop',
      'drop',
      'hold',
      'second',
      'pair',
    ]);
  });

  it('leaves the drop and the hold to the buttons when both play', () => {
    expect(marks('falling', { controls: 'both', tapSides: true })).toEqual([
      'drag',
      'tapRight',
      'tapLeft',
      'softDrop',
      'second',
    ]);
  });

  it('keeps no piece aside in the Sand, and turns the Tower with two fingers', () => {
    expect(marks('sand', { controls: 'gestures', tapSides: true })).not.toContain('hold');
    const tower = marks('volume', { controls: 'gestures', tapSides: true });
    expect(tower).toContain('turn');
    expect(tower).not.toContain('second');
  });

  it('shows nothing for the buttons alone but the Tower’s turn, nor for the Mosaic', () => {
    expect(marks('falling', { controls: 'buttons', tapSides: true })).toEqual([]);
    expect(marks('volume', { controls: 'buttons', tapSides: true })).toEqual(['turn']);
    expect(marks('placement', { controls: 'gestures', tapSides: true })).toEqual([]);
  });

  it('shows the falling well’s gestures outside a game', () => {
    expect(marks(null, { controls: 'gestures', tapSides: true })).toEqual(
      marks('falling', { controls: 'gestures', tapSides: true }),
    );
  });
});

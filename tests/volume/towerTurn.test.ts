import { describe, expect, it } from 'vitest';
import { TowerTurn } from '@/families/volume/input/TowerTurn';

describe('TowerTurn', () => {
  /** A turn that remembers how far it went, with 40-px columns. */
  const setUp = () => {
    const turned: number[] = [];
    const turn = new TowerTurn(
      (columns) => turned.push(columns),
      () => 40,
    );
    return { turn, turned };
  };

  it('leaves one finger to the piece: no turn', () => {
    const { turn, turned } = setUp();
    turn.down(1, 100);
    expect(turn.move(1, 180)).toBe(true);
    expect(turned).toEqual([]);
  });

  it('turns with two fingers, the surface following them', () => {
    const { turn, turned } = setUp();
    turn.down(1, 100);
    turn.down(2, 200);
    // Both fingers 40 px to the right: the middle moves 20 px, then 20 more.
    turn.move(1, 140);
    turn.move(2, 240);
    expect(turned).toEqual([-0.5, -0.5]);
  });

  it('keeps turning until the last finger lifts, and ignores a stranger', () => {
    const { turn, turned } = setUp();
    turn.down(1, 100);
    turn.down(2, 200);
    turn.up(2);
    turn.move(1, 60);
    expect(turned).toEqual([1]);
    turn.up(1);
    turn.down(3, 0);
    turn.move(3, 80);
    expect(turned).toEqual([1]);
    expect(turn.move(9, 10)).toBe(false);
  });
});

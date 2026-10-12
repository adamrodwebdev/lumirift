import { describe, expect, it } from 'vitest';
import { SeededRandom } from '@/core/Random';
import { Bag } from '@/families/falling/pieces/Bag';
import { PIECE_TYPES } from '@/families/falling/pieces/PieceType';

describe('Bag', () => {
  it('deals each of the seven pieces exactly once per bag', () => {
    const bag = new Bag(new SeededRandom(1));
    for (let round = 0; round < 20; round++) {
      const dealt = Array.from({ length: 7 }, () => bag.next());
      expect([...dealt].sort()).toEqual([...PIECE_TYPES].sort());
    }
  });

  it('deals the same order for the same seed', () => {
    const a = new Bag(new SeededRandom(99));
    const b = new Bag(new SeededRandom(99));
    const seqA = Array.from({ length: 21 }, () => a.next());
    const seqB = Array.from({ length: 21 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });
});

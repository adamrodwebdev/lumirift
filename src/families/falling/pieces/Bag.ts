import type { RandomSource } from '@/core/Random';
import { PIECE_TYPES, type PieceType } from './PieceType';

/**
 * "7-bag" randomizer: every piece appears exactly once per bag of seven, in a
 * shuffled order. Avoids long droughts and floods while staying unpredictable.
 */
export class Bag {
  private readonly queue: PieceType[] = [];

  constructor(private readonly random: RandomSource) {}

  next(): PieceType {
    if (this.queue.length === 0) this.queue.push(...this.shuffledBag());
    return this.queue.shift()!;
  }

  private shuffledBag(): PieceType[] {
    const bag = [...PIECE_TYPES];
    // Fisher–Yates.
    for (let i = bag.length - 1; i > 0; i--) {
      const j = this.random.nextInt(i + 1);
      [bag[i], bag[j]] = [bag[j]!, bag[i]!];
    }
    return bag;
  }
}

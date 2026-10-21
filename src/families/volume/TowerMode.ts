import type { RandomSource } from '@/core/Random';
import { AbstractMode } from '@/families/falling/modes/AbstractMode';
import type { BlastSize, WellSize } from '@/families/falling/modes/GameMode';

/** The well rolled into a cylinder: 20 columns around, 16 rows high. */
export const TOWER_WELL: WellSize = { width: 20, height: 16, wraps: true };

/** A bomb blows away 5 columns of the tower, its ring's height and three rows above. */
export const TOWER_BLAST: BlastSize = { radius: 2, above: 3, below: 1 };
/** Bombs start after a few pieces, then come about one piece in five, never two in a row. */
export const BOMBS_AFTER = 4;
export const BOMB_CHANCE = 0.2;

/**
 * The Tower: the falling rules on a well without side walls. Column 19 touches
 * column 0, and a line is a whole ring of 20 cells. Some pieces carry a bomb
 * gem: clearing its ring sets it off, and it blows away a sector of the tower.
 */
export class TowerMode extends AbstractMode {
  readonly id = 'tower';
  override readonly well = TOWER_WELL;
  override readonly blast = TOWER_BLAST;
  private lastBomb = -BOMBS_AFTER;

  override bombFor(random: RandomSource, rank: number): number | null {
    if (rank < BOMBS_AFTER || rank - this.lastBomb < 2 || random.next() >= BOMB_CHANCE) {
      return null;
    }
    this.lastBomb = rank;
    return random.nextInt(4);
  }
}

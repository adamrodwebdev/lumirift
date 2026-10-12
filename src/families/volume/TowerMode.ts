import { AbstractMode } from '@/families/falling/modes/AbstractMode';
import type { WellSize } from '@/families/falling/modes/GameMode';

/** The well rolled into a cylinder: 20 columns around, 16 rows high. */
export const TOWER_WELL: WellSize = { width: 20, height: 16, wraps: true };

/**
 * The Tower: the falling rules on a well without side walls. Column 19 touches
 * column 0, and a line is a whole ring of 20 cells.
 */
export class TowerMode extends AbstractMode {
  readonly id = 'tower';
  override readonly well = TOWER_WELL;
}

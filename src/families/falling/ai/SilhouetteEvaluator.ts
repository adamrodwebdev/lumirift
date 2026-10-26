import { Tone } from '../pieces/PieceType';
import { Evaluator } from './Evaluator';
import type { Placement } from './PlacementSearch';

/** What a block is worth: inside the silhouette, outside it, a cell of it buried for good. */
const INSIDE = 10;
const OUTSIDE = -20;
const BURIED = -15;
/** Lower is better: the shape fills from the bottom. */
const HEIGHT = -0.1;

/**
 * Scores a placement in the Silhouette (the cells to fill as board indices):
 * blocks inside the shape, none outside, and no cell of the shape left
 * under a block, since rows never clear there. Every placement of a piece
 * starts from the same well, so the whole well is counted.
 */
export class SilhouetteEvaluator extends Evaluator {
  constructor(private readonly target: ReadonlySet<number>) {
    super();
  }

  override score(placement: Placement): number {
    const board = placement.after;
    let value = HEIGHT * placement.features.aggregateHeight;
    for (let x = 0; x < board.width; x++) {
      let roofed = false;
      for (let y = 0; y < board.height; y++) {
        const inside = this.target.has(y * board.width + x);
        if (board.get(x, y) !== Tone.Empty) {
          roofed = true;
          value += inside ? INSIDE : OUTSIDE;
        } else if (roofed && inside) {
          value += BURIED;
        }
      }
    }
    return value;
  }
}

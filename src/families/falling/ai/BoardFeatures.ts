import type { Board } from '../board/Board';
import { Tone } from '../pieces/PieceType';

/** What an AI looks at in a well, after a placement. */
export interface BoardFeatures {
  /** Sum of the column heights. */
  readonly aggregateHeight: number;
  /** Tallest column. */
  readonly maxHeight: number;
  /** Empty cells with a block somewhere above them. */
  readonly holes: number;
  /** Sum of the height differences between neighbouring columns. */
  readonly bumpiness: number;
  /** Height of each column, left to right. */
  readonly heights: readonly number[];
}

/** Measures a well (read only). */
export function measure(board: Board): BoardFeatures {
  const heights: number[] = [];
  let holes = 0;
  for (let x = 0; x < board.width; x++) {
    let height = 0;
    let roofFound = false;
    for (let y = 0; y < board.height; y++) {
      const filled = board.get(x, y) !== Tone.Empty;
      if (filled && !roofFound) {
        roofFound = true;
        height = board.height - y;
      } else if (!filled && roofFound) {
        holes++;
      }
    }
    heights.push(height);
  }
  let bumpiness = 0;
  for (let x = 1; x < heights.length; x++) bumpiness += Math.abs(heights[x]! - heights[x - 1]!);
  return {
    aggregateHeight: heights.reduce((sum, height) => sum + height, 0),
    maxHeight: Math.max(...heights),
    holes,
    bumpiness,
    heights,
  };
}

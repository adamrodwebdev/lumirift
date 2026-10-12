import type { Board } from '../board/Board';
import type { Piece } from '../pieces/Piece';
import type { Rotation } from '../pieces/PieceType';
import { measure, type BoardFeatures } from './BoardFeatures';

/** One way to place the falling piece, and what the well looks like afterwards. */
export interface Placement {
  /** Clockwise quarter turns from the spawn orientation. */
  readonly rotation: Rotation;
  /** Column of the piece's box once in place. */
  readonly x: number;
  readonly lines: number;
  readonly features: BoardFeatures;
  /** The well after the placement and its line clears (to look one piece ahead). */
  readonly after: Board;
}

/**
 * Lists every placement reachable by turning the piece at the top of the
 * well, sliding it sideways and dropping it: exactly the moves the AI will
 * then play, so every plan it picks can be carried out.
 */
export function searchPlacements(board: Board, piece: Piece): Placement[] {
  const placements: Placement[] = [];
  const seen = new Set<string>();
  let turned = piece;
  for (let rotation = 0; rotation < 4; rotation++) {
    if (rotation > 0) turned = turned.rotated(1);
    if (!board.fits(turned)) continue;
    for (let dx = -board.width; dx <= board.width; dx++) {
      if (!slides(board, turned, dx)) continue;
      const shifted = turned.moved(dx, 0);
      let drop = 0;
      while (board.fits(shifted, 0, drop + 1)) drop++;
      const landed = shifted.moved(0, drop);
      const key = landed
        .cells()
        .map((cell) => `${cell.x},${cell.y}`)
        .sort()
        .join(' ');
      // The O piece looks the same in all four orientations: count each spot once.
      if (seen.has(key)) continue;
      seen.add(key);
      const after = board.clone();
      after.lock(landed);
      const lines = after.clearFullRows().length;
      placements.push({
        rotation: rotation as Rotation,
        x: landed.x,
        lines,
        features: measure(after),
        after,
      });
    }
  }
  return placements;
}

/** True when the piece can slide `dx` columns one step at a time. */
function slides(board: Board, piece: Piece, dx: number): boolean {
  if (dx === 0) return true;
  const step = Math.sign(dx);
  for (let moved = step; Math.abs(moved) <= Math.abs(dx); moved += step) {
    if (!board.fits(piece, moved, 0)) return false;
  }
  return true;
}

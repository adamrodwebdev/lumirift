import { Tone } from '@/core/Tone';
import type { Grid } from './Grid';
import type { Shape } from './Shape';

/** Placements tried at most to prove a hand playable: past that, it counts as unproven. */
export const SOLVER_BUDGET = 4000;

/**
 * Can every shape be placed, in some order, lines clearing between two
 * placements? A depth-first search that stops at the first way through.
 * The grid is never changed.
 */
export function canPlaceAll(grid: Grid, shapes: readonly Shape[], budget = SOLVER_BUDGET): boolean {
  const left = { tries: budget };
  return search(grid, shapes, left);
}

function search(grid: Grid, shapes: readonly Shape[], left: { tries: number }): boolean {
  if (shapes.length === 0) return true;
  const tried = new Set<string>();
  for (let i = 0; i < shapes.length; i++) {
    const shape = shapes[i]!;
    // Two identical shapes lead to the same searches.
    if (tried.has(shape.key)) continue;
    tried.add(shape.key);
    const rest = shapes.filter((_, k) => k !== i);
    for (let y = 0; y <= grid.size - shape.height; y++) {
      for (let x = 0; x <= grid.size - shape.width; x++) {
        if (--left.tries < 0) return false;
        if (!grid.fits(shape, x, y)) continue;
        const next = afterPlacing(grid, shape, x, y);
        if (search(next, rest, left)) return true;
      }
    }
  }
  return false;
}

/** A copy of the grid with the shape placed and the full lines cleared. */
export function afterPlacing(grid: Grid, shape: Shape, x: number, y: number): Grid {
  const next = grid.clone();
  next.place(shape, x, y, Tone.Garbage);
  next.clearLines(next.fullLines());
  return next;
}

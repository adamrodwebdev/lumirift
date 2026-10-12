import type { Placement } from './PlacementSearch';

/**
 * Scores a placement: the well should stay low, flat and without holes, and
 * lines are welcome. Weights from the classic heuristic tuned by genetic
 * search (Yiyuan Lee, 2013); higher is better.
 */
export class Evaluator {
  constructor(
    private readonly weights = { height: -0.51, lines: 0.76, holes: -0.36, bumpiness: -0.18 },
  ) {}

  score({ lines, features }: Placement): number {
    const w = this.weights;
    return (
      w.height * features.aggregateHeight +
      w.lines * lines +
      w.holes * features.holes +
      w.bumpiness * features.bumpiness
    );
  }

  /** Placements from best to worst. */
  rank(placements: readonly Placement[]): Placement[] {
    return [...placements].sort((a, b) => this.score(b) - this.score(a));
  }
}

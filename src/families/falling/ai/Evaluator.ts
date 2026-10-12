import type { Placement } from './PlacementSearch';

export interface EvaluatorWeights {
  readonly height: number;
  readonly lines: number;
  readonly holes: number;
  readonly bumpiness: number;
}

/** The classic heuristic tuned by genetic search (Yiyuan Lee, 2013). */
export const SAFE_WEIGHTS: EvaluatorWeights = {
  height: -0.51,
  lines: 0.76,
  holes: -0.36,
  bumpiness: -0.18,
};

/**
 * Scores a placement: the well should stay low, flat and without holes, and
 * lines are welcome; higher is better.
 */
export class Evaluator {
  constructor(protected readonly weights: EvaluatorWeights = SAFE_WEIGHTS) {}

  score(placement: Placement): number {
    const { lines, features } = placement;
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

/** Below this stack height (rows), the attacker builds instead of clearing small (see AiPlayer). */
export const ATTACK_SAFE_HEIGHT = 9;

/**
 * Plays for attacks: while the well is low, it keeps a column open and saves
 * its lines for a four-line clear (the strongest attack of the duel). The
 * player switches back to the safe evaluator when its stack grows: one
 * evaluator per decision, so that every placement is scored on one scale.
 */
export class AttackEvaluator extends Evaluator {
  override score(placement: Placement): number {
    const { lines, features } = placement;
    const { heights } = features;
    const well = heights.length - 1;
    const w = this.weights;
    // The stack beside the well should be flat; the well itself stays empty.
    let bumpiness = 0;
    for (let x = 1; x < well; x++) bumpiness += Math.abs(heights[x]! - heights[x - 1]!);
    const base =
      w.height * features.aggregateHeight + w.holes * features.holes + w.bumpiness * bumpiness;
    if (lines === 4) return base + 8;
    // Small clears waste the stack that a four-line clear needs: their reward for
    // lowering the stack (a row of 9 blocks) is taken back, and more.
    return base + w.height * 9 * lines - 1.5 * lines - 0.8 * heights[well]!;
  }
}

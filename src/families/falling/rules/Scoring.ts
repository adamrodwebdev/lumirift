/** Points per number of lines cleared at once, before the level multiplier. */
const LINE_POINTS: readonly number[] = [0, 100, 300, 500, 800];
const COMBO_POINTS = 50;
const SOFT_DROP_POINTS = 1;
const HARD_DROP_POINTS = 2;
const PURE_LINE_FACTOR = 4;

export interface ClearScore {
  readonly lines: number;
  readonly pureLines: number;
  readonly level: number;
  /** Consecutive clearing locks before this one (0 for the first). */
  readonly combo: number;
}

/** Scoring rules, isolated so that modes and tests share one definition. */
export class Scoring {
  constructor(private readonly pureLinesCount: boolean = false) {}

  clear({ lines, pureLines, level, combo }: ClearScore): number {
    if (lines === 0) return 0;
    const base = (LINE_POINTS[Math.min(lines, 4)] ?? 0) * level;
    // Each pure line counts four times its share of the clear.
    const pureShare = this.pureLinesCount ? pureLines / lines : 0;
    const lineScore = Math.round(base * (1 + (PURE_LINE_FACTOR - 1) * pureShare));
    return lineScore + COMBO_POINTS * combo * level;
  }

  softDrop(rows: number): number {
    return rows * SOFT_DROP_POINTS;
  }

  hardDrop(rows: number): number {
    return rows * HARD_DROP_POINTS;
  }
}

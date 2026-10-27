import type { FamilyId } from './ModeId';

/** Mercy starts at this pressure and is full at the next one. */
export const MERCY_FROM = 0.6;
export const MERCY_FULL = 0.9;

/** How strong the mercy of each chapter of the campaign is, from chapter 1: full, fading out by chapter 4. */
export const MERCY_BY_CHAPTER: readonly number[] = [1, 2 / 3, 1 / 3, 0, 0];

/** A family's mercy: how slow its threat gets at the top of its well. */
export interface MercyRule {
  /** The threat's pace at the top, with full mercy (0.4: at 40 % of its speed). */
  readonly slowest: number;
}

/**
 * The mercy of each family: the fall and the rising rows of the falling
 * wells (the Tower's too), the fall and the Wyrm in the Sand. The Mosaic
 * has no clock on its board: its hands are proven playable instead.
 */
export const MERCY_RULES: Readonly<Record<FamilyId, MercyRule>> = {
  falling: { slowest: 0.4 },
  volume: { slowest: 0.4 },
  sand: { slowest: 0.5 },
  placement: { slowest: 1 },
  // The race is not the campaign: its worlds keep their pace.
  rift: { slowest: 1 },
};

/** The mercy strength of a campaign chapter (0 past the last listed). */
export const mercyOfChapter = (chapter: number): number => MERCY_BY_CHAPTER[chapter - 1] ?? 0;

/**
 * The mercy of a game (1.33): near the top of the well, the threat slows,
 * so that a newcomer's near miss does not turn into a loss at once. Only
 * the early campaign has it; everywhere else it is `Mercy.NONE`. Immutable.
 */
export class Mercy {
  static readonly NONE = new Mercy({ slowest: 1 }, 0);

  constructor(
    private readonly rule: MercyRule,
    /** 1 full, 0 none. */
    readonly strength: number,
  ) {}

  /** A family's mercy at a strength (none at 0). */
  static of(family: FamilyId, strength: number): Mercy {
    return strength > 0 ? new Mercy(MERCY_RULES[family], strength) : Mercy.NONE;
  }

  /** The threat's pace at this pressure: 1 at full speed, less near the top. */
  pace(pressure: number): number {
    if (this.strength <= 0) return 1;
    const t = Math.min(1, Math.max(0, (pressure - MERCY_FROM) / (MERCY_FULL - MERCY_FROM)));
    const near = t * t * (3 - 2 * t);
    return 1 - (1 - this.rule.slowest) * this.strength * near;
  }
}

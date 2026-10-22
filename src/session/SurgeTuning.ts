import type { FamilyId } from './ModeId';

/** How long a surge lasts, in real time (ms), and the pace of the game meanwhile. */
export const SURGE_MS = 8000;
export const SURGE_PACE = 1 / 3;
/** The exit factor's ceiling. */
export const MAX_SURGE_FACTOR = 3;

/** How a family fills the gauge and rewards a surge. */
export interface SurgeTuning {
  /** Clears (lines, or the Sand's regions) that fill the gauge. */
  readonly clearsToFill: number;
  /** What each clear made during a surge adds to its exit factor. */
  readonly bonusPerClear: number;
}

/** The families with a fall to slow down; a region of sand is worth three lines or so. */
export const SURGE_TUNING: Readonly<Partial<Record<FamilyId, SurgeTuning>>> = {
  falling: { clearsToFill: 12, bonusPerClear: 0.25 },
  volume: { clearsToFill: 12, bonusPerClear: 0.25 },
  sand: { clearsToFill: 4, bonusPerClear: 0.5 },
};

/** The modes whose time is not the player's to bend: the Rhythm's pulse, the Duel's fairness. */
const WITHOUT_SURGE: ReadonlySet<string> = new Set(['rhythm', 'duel']);

/**
 * The surge's tuning for a mode, or null when it has none: the one place that
 * says which modes have a surge (the game, its gauge and the controls legend).
 */
export function surgeTuningFor(family: FamilyId, modeId: string): SurgeTuning | null {
  return WITHOUT_SURGE.has(modeId) ? null : (SURGE_TUNING[family] ?? null);
}

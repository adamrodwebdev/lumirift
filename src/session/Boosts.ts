/**
 * Help a player brings into a game: the campaign upgrades, turned into
 * numbers each family reads for itself. Only campaign games carry them, so
 * records and the daily challenge stay fair. Immutable.
 */
export interface Boosts {
  /** Multiplies the falling speed (0.7: 30 % slower). Falling, Tower, Sand. */
  readonly gravityScale: number;
  /** More pieces shown in advance. Falling, Tower, Sand. */
  readonly extraPreview: number;
  /** More time before a resting piece locks. Falling, Tower, Sand. */
  readonly extraLockDelayMs: number;
  /** Share added to the points of clears (0.2: +20 %). Every family. */
  readonly scoreBonus: number;
  /** Second chance once per game: rows cleared from the bottom when the well overflows (0: none). */
  readonly rescueRows: number;
  /** Jokers the Mosaic starts with, beyond its undo. */
  readonly startJokers: number;
  /** Added to the chance that a Sand piece is fire. */
  readonly fireBonus: number;
  /** Added to the timing window of the Rhythm (each side). */
  readonly rhythmWindowMs: number;
  /** Added to the delay before received rows rise in a duel. */
  readonly garbageDelayMs: number;
}

export const NO_BOOSTS: Boosts = {
  gravityScale: 1,
  extraPreview: 0,
  extraLockDelayMs: 0,
  scoreBonus: 0,
  rescueRows: 0,
  startJokers: 0,
  fireBonus: 0,
  rhythmWindowMs: 0,
  garbageDelayMs: 0,
};

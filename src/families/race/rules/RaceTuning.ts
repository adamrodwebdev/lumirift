/**
 * The Rift Race in numbers (1.34): what the clock holds, gains and loses,
 * how the worlds turn, when a Guardian joins. Pure data, read by the race's
 * rules and logic; the research of 26/10/2026 set them (Bejeweled's time
 * gems, Tetris Blitz, Puyo Puyo Tetris's Swap).
 */

/** The clock. */
export const CLOCK = {
  /** At the start. */
  startMs: 90_000,
  /** It holds no more; the seconds above spill over as points. */
  capMs: 99_000,
  /** An overflow costs this much… */
  overflowCostMs: 10_000,
  /** …never leaving less than this. */
  overflowFloorMs: 5_000,
  /** At 0:00, the last hurrah scores the board for this long, then the run ends. */
  lastHurrahMs: 2_000,
} as const;

/** What the clock gains. */
export const GAINS = {
  /** Each line cleared (a region in the Sand). */
  lineMs: 2_000,
  /** A clear in a combo ×N gains N times this, on top of its lines. */
  comboStepMs: 1_000,
  /** This many lines at once… */
  bigClearLines: 4,
  /** …gain this much more (four lines: 8 s, plus 5 s). */
  bigClearMs: 5_000,
  /** A hit on a Guardian. */
  hitMs: 1_000,
  /** A Guardian defeated. */
  defeatMs: 15_000,
  /**
   * A world reached, the checkpoint of arcade time races: with it a
   * newcomer's run lasts about two and a half minutes, a regular's three
   * and more (checked by the bot); without it, two.
   */
  shiftMs: 10_000,
} as const;

/** The worlds' turn. */
export const SHIFTS = {
  /** A world lasts this long. */
  phaseMs: 40_000,
  /** The shift is announced this long before it: lines cleared then count double. */
  warningMs: 3_000,
  /** The Rift wipe between two worlds, the clock frozen. */
  wipeMs: 1_000,
  /** What a line cleared during the warning is worth, in lines. */
  rushFactor: 2,
} as const;

/** Points that are not the worlds' own. */
export const POINTS = {
  /** A second spilled over the cap. */
  perSpilledSecond: 50,
  /** A cell the wipe sweeps away (and the last hurrah). */
  perWipedCell: 5,
} as const;

/** The Guardians of the race. */
export const GUARDIANS = {
  /** None at the first shift, surely one at this one. */
  sureAtShift: 2,
  /** After it, a shift's chance, plus as much again for each shift without one. */
  chance: 0.25,
  /** A Guardian stays this long, then leaves; gone, it costs nothing. */
  stayMs: 25_000,
  /** It comes with this share of a Guardian's health. */
  healthShare: 1 / 3,
} as const;

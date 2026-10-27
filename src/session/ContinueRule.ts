import type { FamilyId } from './ModeId';

/**
 * The rewarded continue (1.31): once a game, a game lost to its board comes
 * back with the top half of its board blown away, so that the second life is
 * worth the ad. In rows of each family's board: of the stack in the well
 * (20 high) and in the Tower (16 rings), of cells of the pile in the Sand
 * (20 high), the fullest rows of the Mosaic (8 high, more while no piece in
 * hand has room), of cells of Dunes' sand (12 high).
 */
export const CONTINUE_FREES: Readonly<Record<FamilyId, number>> = {
  falling: 10,
  volume: 8,
  sand: 10,
  placement: 4,
  // Only the race's clock ends it: each world blows away its own top at an overflow.
  rift: 0,
  dunes: 6,
};

/** How long the end window offers the continue before Play again takes the lead (ms). */
export const CONTINUE_OFFER_MS = 5000;

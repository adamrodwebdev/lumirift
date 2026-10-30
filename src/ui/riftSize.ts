/** The next piece's box in the rift, as a share of the well's place, and its bounds (CSS px). */
const SHARE = 0.15;
const MIN = 40;
const MAX = 112;

/**
 * The width of the next piece's box in the rift above the well (1.43), from the
 * width of the well's place. From its width alone: the band's height must not
 * follow the well's height, which its own height sets (a loop).
 */
export const riftPieceSize = (wellPlaceWidth: number): number =>
  Math.round(Math.min(MAX, Math.max(MIN, wellPlaceWidth * SHARE)));

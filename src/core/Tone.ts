/**
 * Colour identifier stored in each board cell (0 = empty). The renderer maps
 * tones to theme tokens: the engine never knows actual colours.
 */
export const Tone = {
  Empty: 0,
  I: 1,
  O: 2,
  T: 3,
  S: 4,
  Z: 5,
  J: 6,
  L: 7,
  ChromaA: 8,
  ChromaB: 9,
  ChromaC: 10,
  ChromaD: 11,
  Garbage: 12,
  /** Sand: water seeps into hollows, then sets in a neighbouring colour. */
  Water: 13,
  /** Sand: fire burns away the colour it touches. */
  Fire: 14,
  /** Sand: oil floats on water; fire turns it into a blaze. */
  Oil: 15,
  /** Sand: ice holds still, freezes water, melts in fire. */
  Ice: 16,
  /** Sand: steam rises, hides what is behind it, falls back as rain. */
  Steam: 17,
  /** Sand: a seed grows into a vine of the colour it sprouts on. */
  Seed: 18,
  /** Sand: acid eats the sand it touches; water dilutes it. */
  Acid: 19,
  /** Sand: lightning strikes what lies under it. */
  Lightning: 20,
  /** Sand: burning oil, fiercer than fire, spreading as it fades. */
  Blaze: 21,
} as const;
export type Tone = (typeof Tone)[keyof typeof Tone];

export const CHROMA_TONES: readonly Tone[] = [
  Tone.ChromaA,
  Tone.ChromaB,
  Tone.ChromaC,
  Tone.ChromaD,
];

/** One of the four colours dealt independently of the shape (Chroma, Fusion). */
export const randomChromaTone = (random: { nextInt(max: number): number }): Tone =>
  CHROMA_TONES[random.nextInt(CHROMA_TONES.length)]!;

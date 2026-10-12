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

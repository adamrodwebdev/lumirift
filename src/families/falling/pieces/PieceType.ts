export const PIECE_TYPES = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'] as const;
export type PieceType = (typeof PIECE_TYPES)[number];

/** Clockwise rotation state: spawn, right, half turn, left. */
export type Rotation = 0 | 1 | 2 | 3;
export type RotationDirection = 1 | -1;

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

export const shapeTone = (type: PieceType): Tone => Tone[type];

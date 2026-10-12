import { Tone } from '@/core/Tone';

export { CHROMA_TONES, randomChromaTone, Tone } from '@/core/Tone';

export const PIECE_TYPES = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'] as const;
export type PieceType = (typeof PIECE_TYPES)[number];

/** Clockwise rotation state: spawn, right, half turn, left. */
export type Rotation = 0 | 1 | 2 | 3;
export type RotationDirection = 1 | -1;

export const shapeTone = (type: PieceType): Tone => Tone[type];

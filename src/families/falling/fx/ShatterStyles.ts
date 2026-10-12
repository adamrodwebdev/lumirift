import type { ShatterId } from '@/progression/Cosmetics';
import { CHROMA_TONES, Tone } from '../pieces/PieceType';
import { shade, type TonePalette } from '@/render/TonePalette';

const random = (min: number, max: number) => min + Math.random() * (max - min);
const pick = <T>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)]!;

/**
 * How a cleared line bursts (a shatter signature, purely cosmetic): the
 * colour of each shard, how fast it spins, how high it flies.
 */
export interface ShatterStyle {
  colour(tone: Tone, palette: TonePalette): string;
  /** Multiplies the spin of the shards. */
  readonly spin: number;
  /** Multiplies their upward speed. */
  readonly lift: number;
}

const VIVID: readonly Tone[] = [
  Tone.I,
  Tone.O,
  Tone.T,
  Tone.S,
  Tone.Z,
  Tone.J,
  Tone.L,
  ...CHROMA_TONES,
];

export const SHATTER_STYLES: Readonly<Record<ShatterId, ShatterStyle>> = {
  /** Shards of the block itself, in shades of its colour. */
  shards: {
    colour: (tone, palette) => shade(palette.color(tone), random(-0.28, 0.32)),
    spin: 1,
    lift: 1,
  },
  /** Every colour of the game, spinning fast. */
  confetti: {
    colour: (_tone, palette) => shade(palette.color(pick(VIVID)), random(0, 0.2)),
    spin: 2,
    lift: 1.25,
  },
  /** Pink petals, slow and gentle. */
  petals: {
    colour: (_tone, palette) => pick(palette.effects.petals),
    spin: 0.5,
    lift: 0.7,
  },
  /** Gold leaf. */
  gold: {
    colour: (_tone, palette) => pick(palette.effects.gold),
    spin: 1.3,
    lift: 1.1,
  },
};

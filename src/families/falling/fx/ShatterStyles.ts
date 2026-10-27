import type { ShatterId } from '@/progression/Cosmetics';
import { SEASON_SHATTERS } from '@/seasons/SeasonData';
import { CHROMA_TONES, Tone } from '../pieces/PieceType';
import { parseHex, shade, type TonePalette } from '@/render/TonePalette';

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
  /** Each shard is a piece of the block itself (its picture), not a plain colour. */
  readonly textured: boolean;
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
    textured: true,
  },
  /** Every colour of the game, spinning fast. */
  confetti: {
    colour: (_tone, palette) => shade(palette.color(pick(VIVID)), random(0, 0.2)),
    spin: 2,
    lift: 1.25,
    textured: false,
  },
  /** Pink petals, slow and gentle. */
  petals: {
    colour: (_tone, palette) => pick(palette.effects.petals),
    spin: 0.5,
    lift: 0.7,
    textured: false,
  },
  /** Gold leaf. */
  gold: {
    colour: (_tone, palette) => pick(palette.effects.gold),
    spin: 1.3,
    lift: 1.1,
    textured: false,
  },
  /** Shards of the Eye of the Tower's iris: the rift's light and the block's colour, lit up, flung high. */
  iris: {
    colour: (tone, palette) =>
      Math.random() < 0.5 ? palette.effects.rift : shade(palette.color(tone), 0.45),
    spin: 1.6,
    lift: 1.4,
    textured: false,
  },
  // The seasons' shatters (1.36), from their data: their colours, lightly shaded.
  ...(Object.fromEntries(
    SEASON_SHATTERS.map((look): [string, ShatterStyle] => [
      look.id,
      {
        colour: () => shade(parseHex(pick(look.colours)), random(-0.12, 0.12)),
        spin: look.spin,
        lift: look.lift,
        textured: false,
      },
    ]),
  ) as Record<(typeof SEASON_SHATTERS)[number]['id'], ShatterStyle>),
};

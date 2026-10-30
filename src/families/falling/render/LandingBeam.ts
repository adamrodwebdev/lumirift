import { mixRgb, type Rgb } from '@/render/TonePalette';
import type { Tone } from '../pieces/PieceType';
import type { Cell } from '../pieces/Shapes';

/**
 * The landing beam (1.43): Lumirift's landing guide, in place of a see-through
 * copy of the piece where it will land (an element Tetris v. Xio held to be
 * Tetris's expression). Under each column of the falling piece, light falls
 * from its lowest block there to where that block will rest, and a bright cap
 * marks its resting place. Each renderer places the shafts in its own space
 * (the well, the Tower's glass, the Sand's grains); this module holds what they
 * share, made once and reused: nothing is allocated per frame.
 */
export const BEAM = {
  /** The shaft's width, as a share of a column. */
  width: 0.56,
  /** The cap's length, as a share of a column. */
  cap: 0.84,
} as const;

/** The lowest block of a piece in each of its (local) columns, -1 where it has none. */
export function lowestBlocks(cells: readonly Cell[], into: Int8Array): Int8Array {
  into.fill(-1);
  for (const { x, y } of cells) into[x] = Math.max(into[x]!, y);
  return into;
}

const css = ({ r, g, b }: Rgb, alpha: number) => `rgb(${r} ${g} ${b} / ${alpha})`;

/** Where the shaft's light is faintest, as a share of its height. */
const DIMMEST = 0.7;

/** A shaft's light: from the piece to its faintest, then on to where it lands. */
interface Shaft {
  readonly fading: CanvasGradient;
  readonly landing: CanvasGradient;
}

/** The beam's light for a tone: a shaft for a unit square (0 under the piece, 1 at rest), a cap. */
export class BeamPaint {
  private readonly shafts = new Map<Tone, Shaft>();
  private readonly caps = new Map<Tone, { readonly glow: string; readonly core: string }>();

  constructor(private readonly ctx: CanvasRenderingContext2D) {}

  /**
   * Fills the shaft in the unit square of the current transform: light leaving the
   * piece, fading on the way down, brighter where it lands. Two gradients of two
   * stops each rather than one of three: the same light, on the fast path of the
   * software raster (a computer whose GPU the browser does not use).
   */
  fillShaft(tone: Tone, rgb: Rgb): void {
    const { ctx } = this;
    const shaft = this.shaft(tone, rgb);
    const left = (1 - BEAM.width) / 2;
    ctx.fillStyle = shaft.fading;
    ctx.fillRect(left, 0, BEAM.width, DIMMEST);
    ctx.fillStyle = shaft.landing;
    ctx.fillRect(left, DIMMEST, BEAM.width, 1 - DIMMEST);
  }

  private shaft(tone: Tone, rgb: Rgb): Shaft {
    let shaft = this.shafts.get(tone);
    if (!shaft) {
      const fading = this.ctx.createLinearGradient(0, 0, 0, DIMMEST);
      fading.addColorStop(0, css(rgb, 0.26));
      fading.addColorStop(1, css(rgb, 0.07));
      const landing = this.ctx.createLinearGradient(0, DIMMEST, 0, 1);
      landing.addColorStop(0, css(rgb, 0.07));
      landing.addColorStop(1, css(mixRgb(rgb, 0.5), 0.34));
      shaft = { fading, landing };
      this.shafts.set(tone, shaft);
    }
    return shaft;
  }

  /** The resting place's cap: a soft glow of the tone under a near-white line. */
  cap(tone: Tone, rgb: Rgb): { readonly glow: string; readonly core: string } {
    let cap = this.caps.get(tone);
    if (!cap) {
      cap = { glow: css(rgb, 0.4), core: css(mixRgb(rgb, 0.8), 1) };
      this.caps.set(tone, cap);
    }
    return cap;
  }
}

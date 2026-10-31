import { mixRgb, type Rgb } from '@/render/TonePalette';
import type { Tone } from '../pieces/PieceType';
import type { Cell } from '../pieces/Shapes';

/**
 * The landing beam (1.43): Lumirift's landing guide, in place of a see-through
 * copy of the piece where it will land (an element Tetris v. Xio held to be
 * Tetris's expression). Under each column of the falling piece, light falls
 * from its lowest block there to where that block will rest; at its foot, a
 * constellation (1.45): a spark where each block will rest, linked to its
 * neighbours in the piece, so the whole shape reads where it lands without a
 * copy of the piece. Each renderer places the shafts and the sparks in its own
 * space (the well, the Tower's glass, the Sand's grains); this module holds
 * what they share, made once and reused: nothing is allocated per frame.
 */
export const BEAM = {
  /** The shaft's width, as a share of a column. */
  width: 0.56,
} as const;

/** A spark's sizes, as shares of a cell's side: its core (at least 2 px), its halo, its links. */
const SPARK = { core: 0.12, halo: 0.38, link: 0.05, linkGlow: 0.16 } as const;
/** The most blocks a piece has: the constellation's sparks are kept in buffers this long. */
const MOST_BLOCKS = 8;

/** The lowest block of a piece in each of its (local) columns, -1 where it has none. */
export function lowestBlocks(cells: readonly Cell[], into: Int8Array): Int8Array {
  into.fill(-1);
  for (const { x, y } of cells) into[x] = Math.max(into[x]!, y);
  return into;
}

/**
 * The links of a piece's constellation: the index pairs of its blocks side by
 * side, written into `into` (two entries per link). Returns how many.
 */
export function constellationLinks(cells: readonly Cell[], into: Int8Array): number {
  let count = 0;
  for (let a = 0; a < cells.length; a++) {
    for (let b = a + 1; b < cells.length; b++) {
      if (Math.abs(cells[a]!.x - cells[b]!.x) + Math.abs(cells[a]!.y - cells[b]!.y) !== 1) continue;
      if ((count + 1) * 2 > into.length) return count;
      into[count * 2] = a;
      into[count * 2 + 1] = b;
      count++;
    }
  }
  return count;
}

const css = ({ r, g, b }: Rgb, alpha: number) => `rgb(${r} ${g} ${b} / ${alpha})`;

/** Where the shaft's light is faintest, as a share of its height. */
const DIMMEST = 0.7;

/** A shaft's light: from the piece to its faintest, then on to where it lands. */
interface Shaft {
  readonly fading: CanvasGradient;
  readonly landing: CanvasGradient;
}

/** A spark's light for a tone: the halo (a unit circle), the links' glow, the near-white core. */
interface Spark {
  readonly halo: CanvasGradient;
  readonly glow: string;
  readonly core: string;
}

/** The beam's light for a tone: a shaft for a unit square (0 under the piece, 1 at rest), the sparks. */
export class BeamPaint {
  private readonly shafts = new Map<Tone, Shaft>();
  private readonly sparks = new Map<Tone, Spark>();
  /** The constellation being drawn: each spark's place and cell side (px) and brightness. */
  private readonly starX = new Float32Array(MOST_BLOCKS);
  private readonly starY = new Float32Array(MOST_BLOCKS);
  private readonly starSize = new Float32Array(MOST_BLOCKS);
  private readonly starAlpha = new Float32Array(MOST_BLOCKS);
  private readonly links = new Int8Array(MOST_BLOCKS * 4);
  private starCount = 0;
  private linkCount = 0;

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

  /** Starts the constellation of a piece: its blocks side by side will be linked. */
  beginConstellation(cells: readonly Cell[]): void {
    this.starCount = 0;
    this.linkCount = constellationLinks(cells, this.links);
  }

  /**
   * The next block's spark, in the order of the piece's cells: where it will
   * rest and a cell's side, in pixels of the current transform; its brightness
   * (the back of the Tower is seen faintly through the glass).
   */
  addStar(x: number, y: number, size: number, alpha = 1): void {
    if (this.starCount >= MOST_BLOCKS) return;
    const i = this.starCount++;
    this.starX[i] = x;
    this.starY[i] = y;
    this.starSize[i] = size;
    this.starAlpha[i] = alpha;
  }

  /** Draws the constellation begun: the links first, then each spark, the tone's glow under a near-white core. */
  drawConstellation(tone: Tone, rgb: Rgb): void {
    const { ctx, starX, starY, starSize, starAlpha } = this;
    const spark = this.spark(tone, rgb);
    ctx.lineCap = 'round';
    for (let i = 0; i < this.linkCount; i++) {
      const a = this.links[i * 2]!;
      const b = this.links[i * 2 + 1]!;
      if (a >= this.starCount || b >= this.starCount) continue;
      const size = (starSize[a]! + starSize[b]!) / 2;
      ctx.globalAlpha = Math.min(starAlpha[a]!, starAlpha[b]!);
      ctx.beginPath();
      ctx.moveTo(starX[a]!, starY[a]!);
      ctx.lineTo(starX[b]!, starY[b]!);
      ctx.strokeStyle = spark.glow;
      ctx.lineWidth = Math.max(3, size * SPARK.linkGlow);
      ctx.stroke();
      ctx.strokeStyle = spark.core;
      ctx.lineWidth = Math.max(1.2, size * SPARK.link);
      ctx.stroke();
    }
    for (let i = 0; i < this.starCount; i++) {
      const x = starX[i]!;
      const y = starY[i]!;
      const size = starSize[i]!;
      ctx.globalAlpha = starAlpha[i]!;
      // The halo: the tone's gradient, made once on a unit circle, placed and scaled.
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(size * SPARK.halo, size * SPARK.halo);
      ctx.fillStyle = spark.halo;
      ctx.fillRect(-1, -1, 2, 2);
      ctx.restore();
      ctx.fillStyle = spark.core;
      ctx.beginPath();
      ctx.arc(x, y, Math.max(2, size * SPARK.core), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
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

  private spark(tone: Tone, rgb: Rgb): Spark {
    let spark = this.sparks.get(tone);
    if (!spark) {
      const halo = this.ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      halo.addColorStop(0, css(rgb, 0.75));
      halo.addColorStop(1, css(rgb, 0));
      spark = { halo, glow: css(rgb, 0.45), core: css(mixRgb(rgb, 0.85), 1) };
      this.sparks.set(tone, spark);
    }
    return spark;
  }
}

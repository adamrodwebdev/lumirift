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

/** A spark's light for a tone: the halo (a small picture, made once), the links' glow, the near-white core. */
interface Spark {
  readonly halo: HTMLCanvasElement;
  readonly glow: string;
  readonly core: string;
}

/** The halo's picture, in pixels: drawn scaled to each spark, cheaper than a gradient fill each time. */
const HALO_PX = 64;

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

  /**
   * Draws the constellation begun: the links, then each spark, the tone's glow
   * under a near-white core. Where every spark is lit alike (the well, the
   * Sand), the links are one path and the cores another: two strokes and one
   * fill, whatever the piece.
   */
  drawConstellation(tone: Tone, rgb: Rgb): void {
    const { ctx, starX, starY, starSize, starAlpha, starCount } = this;
    if (starCount === 0) return;
    const spark = this.spark(tone, rgb);
    const even = this.evenlyLit();
    ctx.lineCap = 'round';
    if (even) ctx.beginPath();
    for (let i = 0; i < this.linkCount; i++) {
      const a = this.links[i * 2]!;
      const b = this.links[i * 2 + 1]!;
      if (a >= starCount || b >= starCount) continue;
      if (!even) ctx.beginPath();
      ctx.moveTo(starX[a]!, starY[a]!);
      ctx.lineTo(starX[b]!, starY[b]!);
      if (even) continue;
      ctx.globalAlpha = Math.min(starAlpha[a]!, starAlpha[b]!);
      this.strokeLinks(spark, (starSize[a]! + starSize[b]!) / 2);
    }
    if (even) {
      ctx.globalAlpha = starAlpha[0]!;
      this.strokeLinks(spark, starSize[0]!);
    }
    for (let i = 0; i < starCount; i++) {
      const halo = starSize[i]! * SPARK.halo;
      ctx.globalAlpha = starAlpha[i]!;
      ctx.drawImage(spark.halo, starX[i]! - halo, starY[i]! - halo, halo * 2, halo * 2);
    }
    ctx.fillStyle = spark.core;
    if (even) ctx.beginPath();
    for (let i = 0; i < starCount; i++) {
      const core = Math.max(2, starSize[i]! * SPARK.core);
      if (even) {
        ctx.moveTo(starX[i]! + core, starY[i]!);
      } else {
        ctx.globalAlpha = starAlpha[i]!;
        ctx.beginPath();
      }
      ctx.arc(starX[i]!, starY[i]!, core, 0, Math.PI * 2);
      if (!even) ctx.fill();
    }
    if (even) {
      ctx.globalAlpha = starAlpha[0]!;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /** Strokes the current path as the constellation's links: the tone's glow under a near-white line. */
  private strokeLinks(spark: Spark, size: number): void {
    const { ctx } = this;
    ctx.strokeStyle = spark.glow;
    ctx.lineWidth = Math.max(3, size * SPARK.linkGlow);
    ctx.stroke();
    ctx.strokeStyle = spark.core;
    ctx.lineWidth = Math.max(1.2, size * SPARK.link);
    ctx.stroke();
  }

  /** Every spark as bright and as large as the first: one path each for the links and the cores. */
  private evenlyLit(): boolean {
    for (let i = 1; i < this.starCount; i++) {
      if (this.starAlpha[i] !== this.starAlpha[0] || this.starSize[i] !== this.starSize[0])
        return false;
    }
    return true;
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
      const halo = document.createElement('canvas');
      halo.width = HALO_PX;
      halo.height = HALO_PX;
      const paint = halo.getContext('2d');
      if (paint) {
        const middle = HALO_PX / 2;
        const glow = paint.createRadialGradient(middle, middle, 0, middle, middle, middle);
        glow.addColorStop(0, css(rgb, 0.75));
        glow.addColorStop(1, css(rgb, 0));
        paint.fillStyle = glow;
        paint.fillRect(0, 0, HALO_PX, HALO_PX);
      }
      spark = { halo, glow: css(rgb, 0.45), core: css(mixRgb(rgb, 0.85), 1) };
      this.sparks.set(tone, spark);
    }
    return spark;
  }
}

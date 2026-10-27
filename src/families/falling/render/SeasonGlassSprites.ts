import type { SeasonMaterialData } from '@/seasons/SeasonData';
import { parseHex, shade, type Rgb, type TonePalette } from '@/render/TonePalette';
import type { Tone } from '../pieces/PieceType';
import { BlockSprites } from './BlockSprites';

type Engraved = Exclude<Tone, 0>;
const css = ({ r, g, b }: Rgb, alpha = 1) => `rgb(${r} ${g} ${b} / ${alpha})`;
const mix = (a: Rgb, b: Rgb, t: number): Rgb => ({
  r: Math.round(a.r + (b.r - a.r) * t),
  g: Math.round(a.g + (b.g - a.g) * t),
  b: Math.round(a.b + (b.b - a.b) * t),
});

/**
 * A season's glass blocks (1.36), described by data: dark glass of the
 * piece's colour, a pattern lit inside it (embers, ripples or a bolt) in
 * that colour mixed with the season's gleam, the engraved motif on top.
 * Each tone draws its pattern the same way every time.
 */
export class SeasonGlassSprites extends BlockSprites {
  constructor(
    size: number,
    palette: TonePalette,
    private readonly look: SeasonMaterialData,
  ) {
    super(size, palette);
  }

  protected paint(ctx: CanvasRenderingContext2D, tone: Tone, rgb: Rgb): void {
    const s = this.size;
    const gap = Math.max(1, Math.round(s * 0.05));
    const side = s - gap * 2;
    const light = mix(rgb, parseHex(this.look.gleam), this.look.gleamShare);
    // Dark glass of the piece's colour, lit from below.
    ctx.beginPath();
    ctx.roundRect(gap, gap, side, side, s * 0.16);
    const glass = ctx.createLinearGradient(0, gap, 0, s - gap);
    glass.addColorStop(0, shade(rgb, -0.62));
    glass.addColorStop(1, shade(rgb, -0.34));
    ctx.fillStyle = glass;
    ctx.fill();
    ctx.save();
    ctx.clip();
    let seed = tone * 6271 + 92821;
    const next = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    PATTERNS[this.look.pattern]({ ctx, s, gap, side, light, next });
    ctx.restore();
    // The rim, and a gleam on the top left.
    ctx.beginPath();
    ctx.roundRect(gap, gap, side, side, s * 0.16);
    ctx.strokeStyle = css(light, 0.75);
    ctx.lineWidth = Math.max(1, s * 0.045);
    ctx.stroke();
    ctx.fillStyle = 'rgb(255 255 255 / 0.28)';
    ctx.beginPath();
    ctx.ellipse(s * 0.32, s * 0.22, s * 0.15, s * 0.05, -0.45, 0, Math.PI * 2);
    ctx.fill();
    this.engrave(ctx, tone as Engraved, parseHex('#140f2c'), s / 2, s * 0.18, css(light, 0.9));
  }
}

/** What a pattern draws with: the block's square, its light, its own repeatable draws. */
interface PatternPen {
  readonly ctx: CanvasRenderingContext2D;
  readonly s: number;
  readonly gap: number;
  readonly side: number;
  readonly light: Rgb;
  readonly next: () => number;
}

/** A stroke that glows: a wide soft one under a thin bright one. */
function glowStroke(pen: PatternPen, path: () => void, width: number): void {
  const { ctx, s, light } = pen;
  for (const [w, alpha] of [
    [width * 2.6, 0.22],
    [width, 0.95],
  ] as const) {
    ctx.strokeStyle = css(light, alpha);
    ctx.lineWidth = Math.max(1, s * w);
    ctx.beginPath();
    path();
    ctx.stroke();
  }
}

const PATTERNS: Readonly<Record<SeasonMaterialData['pattern'], (pen: PatternPen) => void>> = {
  /** Embers: glowing grains scattered low in the glass, and a seam of heat. */
  embers(pen) {
    const { ctx, s, gap, side, light, next } = pen;
    for (let k = 0; k < 7; k++) {
      const x = gap + (0.12 + next() * 0.76) * side;
      const y = gap + (0.4 + next() * 0.52) * side;
      const r = s * (0.025 + next() * 0.045);
      const halo = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
      halo.addColorStop(0, css(light, 0.95));
      halo.addColorStop(0.35, css(light, 0.45));
      halo.addColorStop(1, css(light, 0));
      ctx.fillStyle = halo;
      ctx.fillRect(x - r * 3, y - r * 3, r * 6, r * 6);
    }
    const y0 = gap + (0.55 + next() * 0.2) * side;
    glowStroke(
      pen,
      () => {
        ctx.moveTo(gap, y0);
        ctx.lineTo(gap + side * 0.35, y0 - side * (0.08 + next() * 0.1));
        ctx.lineTo(gap + side * 0.7, y0 + side * (next() - 0.5) * 0.2);
        ctx.lineTo(gap + side, y0 - side * 0.12);
      },
      0.03,
    );
  },
  /** Ripples: rings of light spreading from a corner. */
  ripples(pen) {
    const { ctx, gap, side, next } = pen;
    const left = next() < 0.5;
    const cx = left ? gap + side * 0.15 : gap + side * 0.85;
    const cy = gap + side * (0.8 + next() * 0.15);
    for (const radius of [0.28, 0.52, 0.76]) {
      glowStroke(pen, () => ctx.arc(cx, cy, side * radius, Math.PI * 1.05, Math.PI * 1.95), 0.022);
    }
  },
  /** A bolt: a lightning stroke across the glass, forked once. */
  bolts(pen) {
    const { ctx, gap, side, next } = pen;
    const points: [number, number][] = [];
    let x = gap + side * (0.2 + next() * 0.3);
    for (let k = 0; k <= 4; k++) {
      points.push([x, gap + (side * k) / 4]);
      x += side * (k % 2 === 0 ? 0.18 : -0.14) * (0.7 + next() * 0.6);
    }
    glowStroke(
      pen,
      () => points.forEach(([px, py], i) => (i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py))),
      0.032,
    );
    const [fx, fy] = points[2]!;
    glowStroke(
      pen,
      () => {
        ctx.moveTo(fx, fy);
        ctx.lineTo(fx + side * 0.22, fy + side * 0.12);
        ctx.lineTo(fx + side * 0.3, fy + side * 0.3);
      },
      0.018,
    );
  },
};

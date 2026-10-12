import { Tone } from '../pieces/PieceType';
import { luminance, shade, type TonePalette } from './TonePalette';

type Context = CanvasRenderingContext2D;
type Motif = (ctx: Context, centre: number, radius: number) => void;

/*
 * One engraved motif per tone, so that colours never carry information on
 * their own (colour-blind players read the motif). Chroma tones, which are
 * the ones the rules depend on, get the four most distinct motifs.
 */
const dot: Motif = (ctx, c, r) => {
  ctx.beginPath();
  ctx.arc(c, c, r * 0.45, 0, Math.PI * 2);
  ctx.fill();
};
const ring: Motif = (ctx, c, r) => {
  ctx.beginPath();
  ctx.arc(c, c, r * 0.7, 0, Math.PI * 2);
  ctx.stroke();
};
const bar: Motif = (ctx, c, r) => {
  ctx.beginPath();
  ctx.moveTo(c - r, c);
  ctx.lineTo(c + r, c);
  ctx.stroke();
};
const bars: Motif = (ctx, c, r) => {
  ctx.beginPath();
  ctx.moveTo(c - r, c - r * 0.4);
  ctx.lineTo(c + r, c - r * 0.4);
  ctx.moveTo(c - r, c + r * 0.4);
  ctx.lineTo(c + r, c + r * 0.4);
  ctx.stroke();
};
const slash: Motif = (ctx, c, r) => {
  ctx.beginPath();
  ctx.moveTo(c - r, c + r);
  ctx.lineTo(c + r, c - r);
  ctx.stroke();
};
const plus: Motif = (ctx, c, r) => {
  ctx.beginPath();
  ctx.moveTo(c - r, c);
  ctx.lineTo(c + r, c);
  ctx.moveTo(c, c - r);
  ctx.lineTo(c, c + r);
  ctx.stroke();
};
const cross: Motif = (ctx, c, r) => {
  ctx.beginPath();
  ctx.moveTo(c - r * 0.8, c - r * 0.8);
  ctx.lineTo(c + r * 0.8, c + r * 0.8);
  ctx.moveTo(c + r * 0.8, c - r * 0.8);
  ctx.lineTo(c - r * 0.8, c + r * 0.8);
  ctx.stroke();
};
const triangle: Motif = (ctx, c, r) => {
  ctx.beginPath();
  ctx.moveTo(c, c - r * 0.85);
  ctx.lineTo(c + r * 0.85, c + r * 0.65);
  ctx.lineTo(c - r * 0.85, c + r * 0.65);
  ctx.closePath();
  ctx.stroke();
};
const diamond: Motif = (ctx, c, r) => {
  ctx.beginPath();
  ctx.moveTo(c, c - r);
  ctx.lineTo(c + r, c);
  ctx.lineTo(c, c + r);
  ctx.lineTo(c - r, c);
  ctx.closePath();
  ctx.stroke();
};
const hatch: Motif = (ctx, c, r) => {
  ctx.beginPath();
  for (let offset = -r; offset <= r; offset += r * 0.66) {
    ctx.moveTo(c - r, c + offset - r * 0.5);
    ctx.lineTo(c + r, c + offset + r * 0.5);
  }
  ctx.stroke();
};

const MOTIFS: Readonly<Record<Exclude<Tone, typeof Tone.Empty>, Motif>> = {
  [Tone.I]: bar,
  [Tone.O]: dot,
  [Tone.T]: triangle,
  [Tone.S]: slash,
  [Tone.Z]: ring,
  [Tone.J]: plus,
  [Tone.L]: diamond,
  [Tone.ChromaA]: dot,
  [Tone.ChromaB]: bars,
  [Tone.ChromaC]: triangle,
  [Tone.ChromaD]: cross,
  [Tone.Garbage]: hatch,
};

/**
 * Faceted crystal blocks, pre-drawn once per tone at the current cell size.
 * Drawing a frame is then one `drawImage` per block.
 */
export class CrystalSprites {
  private readonly sprites = new Map<Tone, HTMLCanvasElement>();

  constructor(
    readonly size: number,
    private readonly palette: TonePalette,
  ) {}

  get(tone: Tone): HTMLCanvasElement {
    let sprite = this.sprites.get(tone);
    if (!sprite) {
      sprite = this.draw(tone);
      this.sprites.set(tone, sprite);
    }
    return sprite;
  }

  private draw(tone: Tone): HTMLCanvasElement {
    const s = this.size;
    const canvas = document.createElement('canvas');
    canvas.width = s;
    canvas.height = s;
    const ctx = canvas.getContext('2d');
    if (!ctx || tone === Tone.Empty) return canvas;

    const rgb = this.palette.color(tone);
    const gap = Math.max(1, Math.round(s * 0.04));
    const outer = s - gap;
    const bevel = Math.round(s * 0.2);
    const facet = (points: readonly (readonly [number, number])[], fill: string) => {
      ctx.fillStyle = fill;
      ctx.beginPath();
      points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
      ctx.closePath();
      ctx.fill();
    };

    // Body, then four bevelled facets lit from the top left.
    ctx.fillStyle = shade(rgb, 0);
    ctx.fillRect(0, 0, outer, outer);
    facet(
      [
        [0, 0],
        [outer, 0],
        [outer - bevel, bevel],
        [bevel, bevel],
      ],
      shade(rgb, 0.34),
    );
    facet(
      [
        [0, 0],
        [bevel, bevel],
        [bevel, outer - bevel],
        [0, outer],
      ],
      shade(rgb, 0.14),
    );
    facet(
      [
        [outer, 0],
        [outer, outer],
        [outer - bevel, outer - bevel],
        [outer - bevel, bevel],
      ],
      shade(rgb, -0.16),
    );
    facet(
      [
        [0, outer],
        [bevel, outer - bevel],
        [outer - bevel, outer - bevel],
        [outer, outer],
      ],
      shade(rgb, -0.32),
    );

    // Table of the gem: a faint diagonal glint.
    ctx.strokeStyle = 'rgb(255 255 255 / 0.35)';
    ctx.lineWidth = Math.max(1, s * 0.03);
    ctx.beginPath();
    ctx.moveTo(bevel + s * 0.06, outer - bevel - s * 0.12);
    ctx.lineTo(outer - bevel - s * 0.12, bevel + s * 0.06);
    ctx.stroke();

    // Engraved motif.
    const ink = luminance(rgb) > 0.35 ? 'rgb(0 0 0 / 0.38)' : 'rgb(255 255 255 / 0.5)';
    ctx.strokeStyle = ink;
    ctx.fillStyle = ink;
    ctx.lineWidth = Math.max(1.5, s * 0.07);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    MOTIFS[tone](ctx, outer / 2, (outer - bevel * 2) * 0.32);
    return canvas;
  }
}

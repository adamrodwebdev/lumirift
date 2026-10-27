import { Tone } from '@/core/Tone';
import { MOTIFS } from '@/render/motifs';
import { luminance, type Rgb, type TonePalette } from '@/render/TonePalette';

const rgba = ({ r, g, b }: Rgb, alpha: number) => `rgb(${r} ${g} ${b} / ${alpha})`;

/**
 * Blocks of tinted glass, pre-drawn once per tone: a translucent body that
 * lets the back of the tower show through, a bright rim, a vertical glint
 * (the tower is curved) and the tone's engraved motif.
 */
export class GlassSprites {
  /** The smallest block drawn: its gap on each side, and a pixel of glass. */
  static readonly MIN_SIZE = 3;

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
    const gap = Math.max(1, Math.round(s * 0.05));
    const inner = s - gap * 2;
    if (inner < 1) return canvas;

    // Body: denser at the edges, as thick glass is.
    const body = ctx.createRadialGradient(s / 2, s / 2, inner * 0.1, s / 2, s / 2, inner * 0.75);
    body.addColorStop(0, rgba(rgb, 0.72));
    body.addColorStop(1, rgba(rgb, 0.95));
    ctx.fillStyle = body;
    ctx.fillRect(gap, gap, inner, inner);

    // Rim catching the light.
    ctx.strokeStyle = rgba({ r: 255, g: 255, b: 255 }, 0.55);
    ctx.lineWidth = Math.max(1, s * 0.05);
    ctx.strokeRect(
      gap + ctx.lineWidth / 2,
      gap + ctx.lineWidth / 2,
      inner - ctx.lineWidth,
      inner - ctx.lineWidth,
    );

    // A vertical glint, slightly left of centre: the light on a curved surface.
    const glint = ctx.createLinearGradient(gap, 0, gap + inner, 0);
    glint.addColorStop(0.18, rgba({ r: 255, g: 255, b: 255 }, 0));
    glint.addColorStop(0.3, rgba({ r: 255, g: 255, b: 255 }, 0.45));
    glint.addColorStop(0.42, rgba({ r: 255, g: 255, b: 255 }, 0));
    ctx.fillStyle = glint;
    ctx.fillRect(gap, gap, inner, inner);

    // Engraved motif, so the colour never carries the information alone.
    const ink = luminance(rgb) > 0.35 ? 'rgb(0 0 0 / 0.4)' : 'rgb(255 255 255 / 0.6)';
    ctx.strokeStyle = ink;
    ctx.fillStyle = ink;
    ctx.lineWidth = Math.max(1.5, s * 0.07);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    MOTIFS[tone](ctx, s / 2, inner * 0.24);
    return canvas;
  }
}

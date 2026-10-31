import { Tone } from '@/core/Tone';
import { LINK, LINK_MASKS } from '@/families/falling/board/Links';
import { MOTIFS } from '@/render/motifs';
import { luminance, type Rgb, type TonePalette } from '@/render/TonePalette';

const rgba = ({ r, g, b }: Rgb, alpha: number) => `rgb(${r} ${g} ${b} / ${alpha})`;

/**
 * Blocks of tinted glass, pre-drawn once per tone: a translucent body that
 * lets the back of the tower show through, a bright rim, a vertical glint
 * (the tower is curved) and the tone's engraved motif. Joined to its piece
 * (1.43), a block has no rim on those sides: the piece is one pane of glass.
 */
export class GlassSprites {
  /** The smallest block drawn: its gap on each side, and a pixel of glass. */
  static readonly MIN_SIZE = 3;

  private readonly sprites = new Map<number, HTMLCanvasElement>();

  constructor(
    readonly size: number,
    private readonly palette: TonePalette,
  ) {}

  /** The block of a tone, joined on the sides `links` names (`LINK` bits). */
  get(tone: Tone, links = 0): HTMLCanvasElement {
    const key = tone * LINK_MASKS + links;
    let sprite = this.sprites.get(key);
    if (!sprite) {
      sprite = this.draw(tone, links);
      this.sprites.set(key, sprite);
    }
    return sprite;
  }

  private draw(tone: Tone, links: number): HTMLCanvasElement {
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
    const north = (links & LINK.north) !== 0;
    const east = (links & LINK.east) !== 0;
    const south = (links & LINK.south) !== 0;
    const west = (links & LINK.west) !== 0;
    // A joined side reaches the block's border, to meet the next block of the piece.
    const left = west ? 0 : gap;
    const top = north ? 0 : gap;
    const right = east ? s : s - gap;
    const bottom = south ? s : s - gap;

    if (links === 0) {
      // Body: denser at the edges, as thick glass is.
      const body = ctx.createRadialGradient(s / 2, s / 2, inner * 0.1, s / 2, s / 2, inner * 0.75);
      body.addColorStop(0, rgba(rgb, 0.72));
      body.addColorStop(1, rgba(rgb, 0.95));
      ctx.fillStyle = body;
    } else {
      // One pane: a gradient per block would ring each joint.
      ctx.fillStyle = rgba(rgb, 0.84);
    }
    ctx.fillRect(left, top, right - left, bottom - top);

    // Rim catching the light, along the free sides.
    const width = Math.max(1, s * 0.05);
    const half = width / 2;
    ctx.strokeStyle = rgba({ r: 255, g: 255, b: 255 }, 0.55);
    ctx.lineWidth = width;
    ctx.lineCap = 'square';
    ctx.beginPath();
    if (!north) {
      ctx.moveTo(left + (west ? 0 : half), top + half);
      ctx.lineTo(right - (east ? 0 : half), top + half);
    }
    if (!south) {
      ctx.moveTo(left + (west ? 0 : half), bottom - half);
      ctx.lineTo(right - (east ? 0 : half), bottom - half);
    }
    if (!west) {
      ctx.moveTo(left + half, top + (north ? 0 : half));
      ctx.lineTo(left + half, bottom - (south ? 0 : half));
    }
    if (!east) {
      ctx.moveTo(right - half, top + (north ? 0 : half));
      ctx.lineTo(right - half, bottom - (south ? 0 : half));
    }
    ctx.stroke();

    // A vertical glint, slightly left of centre: the light on a curved surface.
    const glint = ctx.createLinearGradient(gap, 0, gap + inner, 0);
    glint.addColorStop(0.18, rgba({ r: 255, g: 255, b: 255 }, 0));
    glint.addColorStop(0.3, rgba({ r: 255, g: 255, b: 255 }, 0.45));
    glint.addColorStop(0.42, rgba({ r: 255, g: 255, b: 255 }, 0));
    ctx.fillStyle = glint;
    ctx.fillRect(left, top, right - left, bottom - top);

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

import { MOTIFS } from '@/render/motifs';
import { luminance, type Rgb, type TonePalette } from '@/render/TonePalette';
import { Tone } from '../pieces/PieceType';

/**
 * A block style (a material), pre-drawn once per tone at the current cell
 * size: drawing a frame is then one `drawImage` per block. Each material
 * only says how one block looks; every one keeps the engraved motif, so
 * colour never carries the information alone.
 */
export abstract class BlockSprites {
  private readonly sprites = new Map<Tone, HTMLCanvasElement>();

  constructor(
    readonly size: number,
    protected readonly palette: TonePalette,
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
    const canvas = document.createElement('canvas');
    canvas.width = this.size;
    canvas.height = this.size;
    const ctx = canvas.getContext('2d');
    if (ctx && tone !== Tone.Empty) this.paint(ctx, tone, this.palette.color(tone));
    return canvas;
  }

  /** Draws one block of the given tone on a square of `size`. */
  protected abstract paint(ctx: CanvasRenderingContext2D, tone: Tone, rgb: Rgb): void;

  /** The tone's motif, engraved in a colour that stands out from `background`. */
  protected engrave(
    ctx: CanvasRenderingContext2D,
    tone: Exclude<Tone, typeof Tone.Empty>,
    background: Rgb,
    centre: number,
    radius: number,
    ink?: string,
  ): void {
    const colour =
      ink ?? (luminance(background) > 0.35 ? 'rgb(0 0 0 / 0.38)' : 'rgb(255 255 255 / 0.5)');
    ctx.strokeStyle = colour;
    ctx.fillStyle = colour;
    ctx.lineWidth = Math.max(1.5, this.size * 0.07);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    MOTIFS[tone](ctx, centre, radius);
  }
}

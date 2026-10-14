import { shade, type Rgb } from '@/render/TonePalette';
import type { Tone } from '../pieces/PieceType';
import { BlockSprites } from './BlockSprites';

/**
 * Rift gems, the falling family's own material: a rounded jewel lit from the
 * top left (a light band), shaded at the bottom right, with a gloss and the
 * tone's engraved motif.
 */
export class CrystalSprites extends BlockSprites {
  protected paint(ctx: CanvasRenderingContext2D, tone: Tone, rgb: Rgb): void {
    const s = this.size;
    const gap = Math.max(1, Math.round(s * 0.05));
    const outer = s - gap;
    const radius = outer * 0.18;
    const band = Math.max(1.5, outer * 0.13);

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(0, 0, outer, outer, radius);
    ctx.clip();

    // Body: a soft vertical gradient of the tone.
    const body = ctx.createLinearGradient(0, 0, 0, outer);
    body.addColorStop(0, shade(rgb, 0.12));
    body.addColorStop(1, shade(rgb, -0.1));
    ctx.fillStyle = body;
    ctx.fillRect(0, 0, outer, outer);

    // Light band along the top and left, shadow band along the bottom and right.
    const bandOf = (dx: number, dy: number, fill: string) => {
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.rect(0, 0, outer, outer);
      ctx.rect(dx, dy, outer, outer);
      ctx.fill('evenodd');
    };
    bandOf(band, band, 'rgb(255 255 255 / 0.3)');
    bandOf(-band, -band, 'rgb(0 0 0 / 0.3)');
    ctx.restore();

    // Gloss: a short pill of light near the top left.
    ctx.fillStyle = 'rgb(255 255 255 / 0.55)';
    ctx.beginPath();
    ctx.roundRect(outer * 0.2, outer * 0.17, outer * 0.3, outer * 0.12, outer * 0.06);
    ctx.fill();

    this.engrave(ctx, tone as Exclude<Tone, 0>, rgb, outer / 2, outer * 0.2);
  }
}

import { shade, type Rgb } from '@/render/TonePalette';
import { LINK } from '../board/Links';
import type { Tone } from '../pieces/PieceType';
import { BlockSprites } from './BlockSprites';

/**
 * Rift gems, the falling family's own material: a rounded jewel lit from the
 * top left (a light band), shaded at the bottom right, with a gloss and the
 * tone's engraved motif. Joined to its piece (1.43), a block loses its border
 * on those sides: the piece is one crystal, bevelled along its outline only.
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

    this.gloss(ctx, outer);
    this.engrave(ctx, tone as Exclude<Tone, 0>, rgb, outer / 2, outer * 0.2);
  }

  /**
   * A block of a crystal: one body to the border on its joined sides, rounded
   * only where two free sides meet, the bevel along its free sides, the gloss on
   * the piece's top-left blocks alone, and its own motif.
   */
  protected override paintLinked(
    ctx: CanvasRenderingContext2D,
    tone: Tone,
    rgb: Rgb,
    links: number,
  ): void {
    const s = this.size;
    const gap = Math.max(1, Math.round(s * 0.05));
    const outer = s - gap;
    const radius = outer * 0.18;
    const band = Math.max(1.5, outer * 0.13);
    const north = (links & LINK.north) !== 0;
    const east = (links & LINK.east) !== 0;
    const south = (links & LINK.south) !== 0;
    const west = (links & LINK.west) !== 0;
    const right = east ? s : outer;
    const bottom = south ? s : outer;
    const round = (free: boolean) => (free ? radius : 0);

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(0, 0, right, bottom, [
      round(!north && !west),
      round(!north && !east),
      round(!south && !east),
      round(!south && !west),
    ]);
    ctx.clip();
    // One flat body: a gradient would restart at each block and stripe the crystal.
    ctx.fillStyle = shade(rgb, 0.01);
    ctx.fillRect(0, 0, right, bottom);
    // Each band is one path, filled once: where two meet, the light does not double.
    ctx.fillStyle = 'rgb(255 255 255 / 0.3)';
    ctx.beginPath();
    if (!north) ctx.rect(0, 0, right, band);
    if (!west) ctx.rect(0, 0, band, bottom);
    ctx.fill();
    ctx.fillStyle = 'rgb(0 0 0 / 0.3)';
    ctx.beginPath();
    if (!south) ctx.rect(0, bottom - band, right, band);
    if (!east) ctx.rect(right - band, 0, band, bottom);
    ctx.fill();
    ctx.restore();

    if (!north && !west) this.gloss(ctx, outer);
    this.engrave(ctx, tone as Exclude<Tone, 0>, rgb, outer / 2, outer * 0.2);
  }

  /** A short pill of light near the top left. */
  private gloss(ctx: CanvasRenderingContext2D, outer: number): void {
    ctx.fillStyle = 'rgb(255 255 255 / 0.55)';
    ctx.beginPath();
    ctx.roundRect(outer * 0.2, outer * 0.17, outer * 0.3, outer * 0.12, outer * 0.06);
    ctx.fill();
  }
}

import { shade, type Rgb } from '@/render/TonePalette';
import type { Tone } from '../pieces/PieceType';
import { BlockSprites } from './BlockSprites';

/** Faceted crystal blocks: the falling family's own material. */
export class CrystalSprites extends BlockSprites {
  protected paint(ctx: CanvasRenderingContext2D, tone: Tone, rgb: Rgb): void {
    const s = this.size;
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

    this.engrave(ctx, tone as Exclude<Tone, 0>, rgb, outer / 2, (outer - bevel * 2) * 0.32);
  }
}

import type { Tone } from '@/core/Tone';
import type { Shape } from '@/families/placement/engine/Shape';
import { isElement } from '@/families/sand/engine/Elements';
import { GRAINS_PER_CELL } from '@/families/sand/engine/SandGrid';
import { TEXTURES } from '@/families/sand/render/SandRenderer';
import { MOTIFS } from '@/render/motifs';
import { shade, type TonePalette } from '@/render/TonePalette';

/** A piece of the hand, as it is drawn. */
export interface PaintedPiece {
  readonly shape: Shape;
  readonly tone: Tone;
}

/**
 * Draws a piece of Dunes (1.37) as the sand it will become: each cell its
 * 6 × 6 grains, with the texture of its colour as on the board (colour never
 * speaks alone), an element with its motif. `cell` is a cell's side in
 * pixels; the piece's top-left corner goes at (`left`, `top`).
 */
export function paintPiece(
  ctx: CanvasRenderingContext2D,
  piece: PaintedPiece,
  palette: TonePalette,
  at: { readonly cell: number; readonly left: number; readonly top: number },
): void {
  const { cell, left, top } = at;
  const g = GRAINS_PER_CELL;
  const grain = cell / g;
  const rgb = palette.color(piece.tone);
  const texture = TEXTURES[piece.tone];
  for (const c of piece.shape.cells) {
    for (let y = 0; y < g; y++) {
      for (let x = 0; x < g; x++) {
        const gx = c.x * g + x;
        const gy = c.y * g + y;
        const lit = texture?.(gx, gy, 0) ? 0.16 : 0;
        ctx.fillStyle = shade(rgb, ((gx * 7 + gy * 3) % 4) * 0.05 - 0.075 + lit);
        ctx.fillRect(left + gx * grain, top + gy * grain, grain + 0.5, grain + 0.5);
      }
    }
  }
  if (!isElement(piece.tone)) return;
  // An element shows its motif in the middle of the piece.
  const radius = cell * 0.42;
  ctx.save();
  ctx.translate(
    left + (piece.shape.width * cell) / 2 - radius,
    top + (piece.shape.height * cell) / 2 - radius,
  );
  ctx.strokeStyle = palette.wellBackground;
  ctx.fillStyle = palette.wellBackground;
  ctx.lineWidth = Math.max(2, cell * 0.1);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  MOTIFS[piece.tone](ctx, radius, radius * 0.75);
  ctx.restore();
}

import { shade, type TonePalette } from '@/render/TonePalette';
import type { Spot } from '../engine/DunesBoard';
import type { DunesPreview } from '../DunesController';

/** What the overlay shows this frame. */
export interface OverlayState {
  /** The piece held over the board (dragged, or picked with the keyboard). */
  readonly preview: DunesPreview | null;
  /** The opening's mark: where the first piece links the walls. */
  readonly hint: DunesPreview | null;
  /** The keyboard's cursor, while no piece is picked. */
  readonly cursor: Spot | null;
  /** Motion allowed: the mark pulses. */
  readonly motion: boolean;
}

/**
 * Drawn over the grains of the board (1.37), on the same canvas, after the
 * Sand's renderer: where the piece held would go (its colour, a dashed rim
 * in gold; red where it does not fit), the opening's mark, the cursor.
 */
export class DunesOverlay {
  draw(
    canvas: HTMLCanvasElement,
    cellPx: number,
    palette: TonePalette | null,
    state: OverlayState,
  ): void {
    const ctx = canvas.getContext('2d');
    if (!ctx || !palette || cellPx <= 0) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const line = Math.max(2, cellPx * 0.06);
    const { preview, hint, cursor } = state;
    if (hint && !preview) {
      const pulse = state.motion ? 0.55 + 0.45 * Math.sin(performance.now() / 260) : 1;
      this.cells(ctx, hint, cellPx, {
        fill: shade(palette.color(hint.tone), 0.15),
        fillAlpha: 0.22 * pulse,
        stroke: palette.accent,
        strokeAlpha: pulse,
        width: line,
      });
    }
    if (preview) {
      this.cells(ctx, preview, cellPx, {
        fill: shade(palette.color(preview.tone), 0.1),
        fillAlpha: preview.valid ? 0.32 : 0.12,
        stroke: preview.valid ? palette.accent : palette.danger,
        strokeAlpha: 1,
        width: line,
      });
    } else if (cursor) {
      ctx.globalAlpha = 0.8;
      ctx.strokeStyle = palette.accent;
      ctx.lineWidth = line;
      ctx.setLineDash([]);
      ctx.strokeRect(
        cursor.x * cellPx + line / 2,
        cursor.y * cellPx + line / 2,
        cellPx - line,
        cellPx - line,
      );
    }
    ctx.globalAlpha = 1;
    ctx.setLineDash([]);
  }

  private cells(
    ctx: CanvasRenderingContext2D,
    piece: DunesPreview,
    cellPx: number,
    style: {
      fill: string;
      fillAlpha: number;
      stroke: string;
      strokeAlpha: number;
      width: number;
    },
  ): void {
    const inset = style.width / 2 + cellPx * 0.04;
    const radius = cellPx * 0.14;
    for (const cell of piece.shape.cells) {
      const x = (piece.x + cell.x) * cellPx + inset;
      const y = (piece.y + cell.y) * cellPx + inset;
      const side = cellPx - inset * 2;
      ctx.beginPath();
      ctx.roundRect(x, y, side, side, radius);
      ctx.globalAlpha = style.fillAlpha;
      ctx.fillStyle = style.fill;
      ctx.fill();
      ctx.globalAlpha = style.strokeAlpha;
      ctx.strokeStyle = style.stroke;
      ctx.lineWidth = style.width;
      ctx.setLineDash([cellPx * 0.16, cellPx * 0.1]);
      ctx.stroke();
    }
  }
}

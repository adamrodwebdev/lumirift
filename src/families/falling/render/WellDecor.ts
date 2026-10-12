import type { FallingModeId } from '@/session/ModeId';
import type { FallingView } from '../FallingSession';
import { SilhouetteMode } from '../modes/SilhouetteMode';
import { Tone } from '../pieces/PieceType';
import type { TonePalette } from './TonePalette';

/** A mode's own scenery, drawn over the stack and under the falling piece. */
export interface WellDecor {
  draw(
    ctx: CanvasRenderingContext2D,
    view: FallingView,
    palette: TonePalette,
    cell: number,
    /** Milliseconds, frozen when effects must not move. */
    time: number,
  ): void;
}

/** Tide: a water surface ripples on top of the rows that rose from the bottom. */
class TideWater implements WellDecor {
  draw(
    ctx: CanvasRenderingContext2D,
    view: FallingView,
    palette: TonePalette,
    cell: number,
    time: number,
  ): void {
    const { board } = view;
    let level = 0;
    for (let y = board.height - 1; y >= board.hiddenRows; y--) {
      let garbage = false;
      for (let x = 0; x < board.width; x++) if (board.get(x, y) === Tone.Garbage) garbage = true;
      if (!garbage) break;
      level++;
    }
    if (level === 0) return;

    const rows = board.height - board.hiddenRows;
    const width = board.width * cell;
    const surface = (rows - level) * cell;
    const { r, g, b } = palette.color(Tone.L);
    ctx.beginPath();
    ctx.moveTo(0, rows * cell);
    for (let x = 0; x <= width; x += cell / 4) {
      ctx.lineTo(x, surface + Math.sin(x / cell + time / 380) * cell * 0.1);
    }
    ctx.lineTo(width, rows * cell);
    ctx.closePath();
    ctx.fillStyle = `rgb(${r} ${g} ${b} / 0.16)`;
    ctx.fill();
    ctx.strokeStyle = `rgb(${r} ${g} ${b} / 0.75)`;
    ctx.lineWidth = Math.max(1.5, cell * 0.06);
    ctx.stroke();
  }
}

/** Silhouette: the outline of the shape to fill, and a faint fill where it is still empty. */
class SilhouetteTarget implements WellDecor {
  draw(ctx: CanvasRenderingContext2D, view: FallingView, palette: TonePalette, cell: number): void {
    const mode = view.mode;
    if (!(mode instanceof SilhouetteMode) || cell === 0) return;
    const { board } = view;
    const { target } = mode;
    const hidden = board.hiddenRows;
    const inside = (x: number, y: number) =>
      x >= 0 && x < board.width && y >= 0 && y < board.height && target.has(y * board.width + x);

    ctx.fillStyle = palette.accent;
    ctx.globalAlpha = 0.14;
    for (const index of target) {
      const x = index % board.width;
      const y = Math.floor(index / board.width);
      if (board.get(x, y) === Tone.Empty) ctx.fillRect(x * cell, (y - hidden) * cell, cell, cell);
    }
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = palette.accent;
    ctx.lineWidth = Math.max(2, cell * 0.08);
    ctx.lineCap = 'round';
    const edge = (x1: number, y1: number, x2: number, y2: number) => {
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
    };
    ctx.beginPath();
    for (const index of target) {
      const x = index % board.width;
      const y = Math.floor(index / board.width);
      const left = x * cell;
      const top = (y - hidden) * cell;
      if (!inside(x, y - 1)) edge(left, top, left + cell, top);
      if (!inside(x, y + 1)) edge(left, top + cell, left + cell, top + cell);
      if (!inside(x - 1, y)) edge(left, top, left, top + cell);
      if (!inside(x + 1, y)) edge(left + cell, top, left + cell, top + cell);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

const DECORS: Readonly<Partial<Record<FallingModeId, WellDecor>>> = {
  tide: new TideWater(),
  silhouette: new SilhouetteTarget(),
};

export const decorFor = (mode: FallingModeId): WellDecor | null => DECORS[mode] ?? null;

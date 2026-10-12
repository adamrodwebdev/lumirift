import type { FallingModeId } from '@/session/ModeId';
import type { FallingView } from '../FallingSession';
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

const DECORS: Readonly<Partial<Record<FallingModeId, WellDecor>>> = {
  tide: new TideWater(),
};

export const decorFor = (mode: FallingModeId): WellDecor | null => DECORS[mode] ?? null;

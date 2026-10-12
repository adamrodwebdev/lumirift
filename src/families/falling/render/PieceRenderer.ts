import type { PieceSpec } from '../game/Game';
import { shapeCells } from '../pieces/Shapes';
import { CrystalSprites } from './CrystalSprites';
import type { TonePalette } from '@/render/TonePalette';

/** Draws a single piece, centred, for the hold slot and the preview queue. */
export class PieceRenderer {
  private readonly ctx: CanvasRenderingContext2D | null;
  private sprites: CrystalSprites | null = null;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d');
  }

  /** `size` is the side of the square box in CSS pixels. */
  layout(size: number, pixelRatio: number, palette: TonePalette): void {
    const px = Math.round(size * pixelRatio);
    this.canvas.width = px;
    this.canvas.height = px;
    this.canvas.style.width = `${size}px`;
    this.canvas.style.height = `${size}px`;
    this.sprites = new CrystalSprites(Math.floor(px / 4.4), palette);
  }

  render(spec: PieceSpec | null, dimmed = false): void {
    const { ctx, sprites, canvas } = this;
    if (!ctx || !sprites) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!spec) return;

    const cells = shapeCells(spec.type, 0);
    const xs = cells.map((cell) => cell.x);
    const ys = cells.map((cell) => cell.y);
    const width = Math.max(...xs) - Math.min(...xs) + 1;
    const height = Math.max(...ys) - Math.min(...ys) + 1;
    const size = sprites.size;
    const offsetX = (canvas.width - width * size) / 2 - Math.min(...xs) * size;
    const offsetY = (canvas.height - height * size) / 2 - Math.min(...ys) * size;

    ctx.globalAlpha = dimmed ? 0.4 : 1;
    const sprite = sprites.get(spec.tone);
    for (const cell of cells) {
      ctx.drawImage(
        sprite,
        Math.round(offsetX + cell.x * size),
        Math.round(offsetY + cell.y * size),
      );
    }
    ctx.globalAlpha = 1;
  }
}

import type { PieceSpec } from '../game/Game';
import { shapeCells } from '../pieces/Shapes';
import type { MaterialId } from '@/progression/Cosmetics';
import type { TonePalette } from '@/render/TonePalette';
import type { BlockSprites } from './BlockSprites';
import { blockSprites } from './materials';

/** Draws a single piece, centred, for the hold slot and the preview queue. */
export class PieceRenderer {
  private readonly ctx: CanvasRenderingContext2D | null;
  private sprites: BlockSprites | null = null;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d');
  }

  /** `size` is the side of the square box in CSS pixels. */
  private palette: TonePalette | null = null;

  layout(
    size: number,
    pixelRatio: number,
    palette: TonePalette,
    material: MaterialId = 'crystal',
  ): void {
    this.palette = palette;
    const px = Math.round(size * pixelRatio);
    this.canvas.width = px;
    this.canvas.height = px;
    this.canvas.style.width = `${size}px`;
    this.canvas.style.height = `${size}px`;
    this.sprites = blockSprites(material, Math.floor(px / 4.4), palette);
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
    cells.forEach((cell, index) => {
      const x = Math.round(offsetX + cell.x * size);
      const y = Math.round(offsetY + cell.y * size);
      ctx.drawImage(sprite, x, y);
      if (spec.bomb === index) this.drawBomb(x, y, size);
    });
    ctx.globalAlpha = 1;
  }

  /** A bomb gem on a cell of the next piece: a dark core with a red heart. */
  private drawBomb(x: number, y: number, size: number): void {
    const { ctx, palette } = this;
    if (!ctx || !palette) return;
    ctx.fillStyle = palette.wellBackground;
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size * 0.52, size * 0.28, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = palette.danger;
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size * 0.52, size * 0.13, 0, Math.PI * 2);
    ctx.fill();
  }
}

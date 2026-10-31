import type { PieceSpec } from '../game/Game';
import { shapeCells, shapeLinks } from '../pieces/Shapes';
import type { MaterialId } from '@/progression/Cosmetics';
import type { TonePalette } from '@/render/TonePalette';
import type { BlockSprites } from './BlockSprites';
import { blockSprites } from './materials';

/** A preview's box and look: what `PieceRenderer.layout` needs. */
export interface PreviewLayout {
  /** The box's width in CSS pixels; a piece's cell is 1/4.4 of it. */
  readonly width: number;
  /** Its height: the width (the hold's square), or half of it (a piece in the rift, 1.43). */
  readonly height: number;
  readonly pixelRatio: number;
  readonly palette: TonePalette;
  /** The player's block material (crystal by default). */
  readonly material?: MaterialId | undefined;
}

/** Draws a single piece, centred, for the hold slot and the preview queue. */
export class PieceRenderer {
  private readonly ctx: CanvasRenderingContext2D | null;
  private sprites: BlockSprites | null = null;
  private palette: TonePalette | null = null;
  private material: MaterialId | null = null;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d');
  }

  layout({ width, height, pixelRatio, palette, material = 'crystal' }: PreviewLayout): void {
    const px = Math.round(width * pixelRatio);
    const high = Math.round(height * pixelRatio);
    // The same box and look: the blocks drawn already serve the next piece (a crystal
    // piece needs up to four, 1.43), rather than drawn again at each piece.
    if (
      this.sprites &&
      px === this.canvas.width &&
      high === this.canvas.height &&
      this.canvas.style.width === `${width}px` &&
      palette === this.palette &&
      material === this.material
    )
      return;
    this.palette = palette;
    this.material = material;
    this.canvas.width = px;
    this.canvas.height = high;
    // The width alone: the height follows the canvas's own ratio, so that a box narrowed by
    // its place (the rift's queue) keeps its piece's shape.
    this.canvas.style.width = `${width}px`;
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
    const links = shapeLinks(spec.type, 0);
    cells.forEach((cell, index) => {
      const x = Math.round(offsetX + cell.x * size);
      const y = Math.round(offsetY + cell.y * size);
      ctx.drawImage(sprites.get(spec.tone, links[index]), x, y);
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

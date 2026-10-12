import type { FallingView } from '../FallingSession';
import type { Piece } from '../pieces/Piece';
import { CrystalSprites } from './CrystalSprites';
import type { TonePalette } from './TonePalette';

/**
 * Draws a falling-family game on a canvas: the well, the stack, the ghost and
 * the falling piece. It only reads the game (`FallingView`), never changes it.
 */
export class FallingRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  private sprites: CrystalSprites | null = null;
  private palette: TonePalette | null = null;
  /** Cell side in device pixels. */
  private cell = 0;
  private ghost = true;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly view: FallingView,
  ) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D is not available');
    this.ctx = ctx;
  }

  get columns(): number {
    return this.view.board.width;
  }

  get rows(): number {
    return this.view.board.height - this.view.board.hiddenRows;
  }

  /** Fits the well into the available box (CSS pixels), keeping square cells. */
  layout(availableWidth: number, availableHeight: number, pixelRatio: number): void {
    const cssCell = Math.max(
      4,
      Math.floor(Math.min(availableWidth / this.columns, availableHeight / this.rows)),
    );
    this.cell = Math.round(cssCell * pixelRatio);
    this.canvas.style.width = `${cssCell * this.columns}px`;
    this.canvas.style.height = `${cssCell * this.rows}px`;
    this.canvas.width = this.cell * this.columns;
    this.canvas.height = this.cell * this.rows;
    this.rebuildSprites();
  }

  setPalette(palette: TonePalette): void {
    this.palette = palette;
    this.rebuildSprites();
  }

  setGhost(enabled: boolean): void {
    this.ghost = enabled;
  }

  render(): void {
    const { ctx, cell, sprites, palette } = this;
    if (!sprites || !palette || cell === 0) return;
    const { board } = this.view;
    const hidden = board.hiddenRows;

    ctx.fillStyle = palette.wellBackground;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.drawGrid(palette.wellGrid);

    for (let y = hidden; y < board.height; y++) {
      for (let x = 0; x < board.width; x++) {
        const tone = board.get(x, y);
        if (tone !== 0) ctx.drawImage(sprites.get(tone), x * cell, (y - hidden) * cell);
      }
    }

    const active = this.view.active;
    if (!active) return;
    if (this.ghost) this.drawGhost(active, this.view.dropDistance());
    this.drawPiece(active, 0);
  }

  private drawGrid(color: string): void {
    const { ctx, cell } = this;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 1; x < this.columns; x++) {
      ctx.moveTo(x * cell + 0.5, 0);
      ctx.lineTo(x * cell + 0.5, this.canvas.height);
    }
    for (let y = 1; y < this.rows; y++) {
      ctx.moveTo(0, y * cell + 0.5);
      ctx.lineTo(this.canvas.width, y * cell + 0.5);
    }
    ctx.stroke();
  }

  private drawGhost(piece: Piece, distance: number): void {
    if (distance === 0) return;
    const { ctx } = this;
    ctx.globalAlpha = 0.28;
    this.drawPiece(piece, distance);
    ctx.globalAlpha = 1;
  }

  private drawPiece(piece: Piece, dy: number): void {
    const { ctx, cell, sprites } = this;
    if (!sprites) return;
    const hidden = this.view.board.hiddenRows;
    const sprite = sprites.get(piece.tone);
    for (const local of piece.localCells) {
      const y = piece.y + local.y + dy - hidden;
      if (y < 0) continue;
      ctx.drawImage(sprite, (piece.x + local.x) * cell, y * cell);
    }
  }

  private rebuildSprites(): void {
    this.sprites =
      this.palette && this.cell > 0 ? new CrystalSprites(this.cell, this.palette) : null;
  }
}

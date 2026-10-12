import type { FallingView } from '../FallingSession';
import type { FallingEffects } from '../fx/FallingEffects';
import type { Piece } from '../pieces/Piece';
import { CrystalSprites } from './CrystalSprites';
import { EffectsPainter } from './EffectsPainter';
import type { TonePalette } from './TonePalette';
import type { WellDecor } from './WellDecor';

/** Share of the visible height above which the well glows with danger. */
const DANGER_HEIGHT = 0.7;

/**
 * Draws a falling-family game on a canvas: the well, the stack, the ghost,
 * the falling piece and the effects. It only reads the game (`FallingView`)
 * and the effects state, never changes them.
 */
export class FallingRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly painter: EffectsPainter;
  private sprites: CrystalSprites | null = null;
  private palette: TonePalette | null = null;
  private effects: FallingEffects | null = null;
  private decor: WellDecor | null = null;
  private animated = true;
  /** Cell side in device pixels. */
  private cell = 0;
  private ghost = true;
  private dark = true;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly view: FallingView,
  ) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D is not available');
    this.ctx = ctx;
    this.painter = new EffectsPainter(ctx);
  }

  get columns(): number {
    return this.view.board.width;
  }

  get rows(): number {
    return this.view.board.height - this.view.board.hiddenRows;
  }

  /** Fits the well into the available box (CSS pixels), keeping square cells; returns the cell size. */
  layout(availableWidth: number, availableHeight: number, pixelRatio: number): number {
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
    return cssCell;
  }

  setPalette(palette: TonePalette, dark: boolean): void {
    this.palette = palette;
    this.dark = dark;
    this.rebuildSprites();
  }

  setGhost(enabled: boolean): void {
    this.ghost = enabled;
  }

  setEffects(effects: FallingEffects): void {
    this.effects = effects;
  }

  /** The mode's scenery; `animated` false freezes it (calm effects). */
  setDecor(decor: WellDecor | null, animated: boolean): void {
    this.decor = decor;
    this.animated = animated;
  }

  render(): void {
    const { ctx, cell, sprites, palette, effects } = this;
    if (!sprites || !palette || cell === 0) return;
    const { board } = this.view;
    const hidden = board.hiddenRows;
    const width = this.canvas.width;
    const height = this.canvas.height;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = palette.wellBackground;
    ctx.fillRect(0, 0, width, height);
    if (effects?.shake.active) ctx.translate(effects.shake.x * cell, effects.shake.y * cell);
    this.drawGrid(palette.wellGrid);

    if (!effects?.stackHidden) {
      for (let y = hidden; y < board.height; y++) {
        const top = (y - hidden + (effects?.rowOffset[y] ?? 0)) * cell;
        for (let x = 0; x < board.width; x++) {
          const tone = board.get(x, y);
          if (tone !== 0) ctx.drawImage(sprites.get(tone), x * cell, top);
        }
      }
    }
    this.decor?.draw(ctx, this.view, palette, cell, this.animated ? performance.now() : 0);
    if (effects) {
      this.painter.cracks(effects, sprites, palette, cell);
      this.painter.underlays(effects, palette, this.columns, this.rows, cell);
    }

    const active = this.view.active;
    if (active) {
      if (this.ghost) this.drawGhost(active, this.view.dropDistance());
      this.drawPiece(active, 0);
    }

    if (effects) this.painter.overlays(effects, palette, cell, this.dark);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.drawDanger(palette);
    if (effects && effects.beatGlow > 0) {
      // The visual metronome: the frame of the well pulses on each beat.
      ctx.globalAlpha = 0.55 * effects.beatGlow;
      ctx.strokeStyle = palette.accent;
      ctx.lineWidth = Math.max(2, cell * 0.16);
      ctx.strokeRect(
        ctx.lineWidth / 2,
        ctx.lineWidth / 2,
        width - ctx.lineWidth,
        height - ctx.lineWidth,
      );
      ctx.globalAlpha = 1;
    }
    if (effects && effects.wellFlash > 0) {
      ctx.fillStyle = `rgb(255 255 255 / ${effects.wellFlash})`;
      ctx.fillRect(0, 0, width, height);
    }
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

  /** A pulsing glow on the well's edges when the stack nears the top. */
  private drawDanger(palette: TonePalette): void {
    if (this.effects?.stackHidden) return;
    if (this.view.board.stackHeight() < this.rows * DANGER_HEIGHT) return;
    const { ctx, cell, canvas } = this;
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 260);
    const side = cell * 0.4;
    ctx.globalAlpha = 0.18 + 0.17 * pulse;
    ctx.fillStyle = palette.danger;
    ctx.fillRect(0, 0, side, canvas.height);
    ctx.fillRect(canvas.width - side, 0, side, canvas.height);
    ctx.fillRect(0, 0, canvas.width, side * 0.7);
    ctx.globalAlpha = 1;
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

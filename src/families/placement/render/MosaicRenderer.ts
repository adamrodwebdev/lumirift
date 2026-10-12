import { Tone } from '@/core/Tone';
import { ParticleKind } from '@/fx/ParticlePool';
import type { TonePalette } from '@/render/TonePalette';
import { BREAK_MS, MOSAIC_TIMINGS, type MosaicEffects } from '../fx/MosaicEffects';
import type { Preview } from '../MosaicController';
import type { MosaicView } from '../PlacementSession';
import { CeramicSprites } from './CeramicSprites';

/** What the board shows besides the tiles: the preview, the bomb's reach, the cursor. */
export interface BoardOverlay {
  readonly preview: Preview | null;
  /** Centre of the 3 × 3 square a pending bomb would clear. */
  readonly bomb: { readonly x: number; readonly y: number } | null;
  /** Keyboard cursor, when the keyboard is in use. */
  readonly cursor: { readonly x: number; readonly y: number } | null;
}

/** Draws the Mosaic board on a canvas, from the game view and the effects state. */
export class MosaicRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  private sprites: CeramicSprites | null = null;
  private palette: TonePalette | null = null;
  /** Cell side in device pixels. */
  private cell = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly view: MosaicView,
    private readonly effects: MosaicEffects,
  ) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D is not available');
    this.ctx = ctx;
  }

  /** Fits the square board in the available box; returns the cell size in CSS pixels. */
  layout(available: number, pixelRatio: number): number {
    const size = this.view.grid.size;
    const cssCell = Math.max(8, Math.floor(available / size));
    this.cell = Math.round(cssCell * pixelRatio);
    this.canvas.style.width = `${cssCell * size}px`;
    this.canvas.style.height = `${cssCell * size}px`;
    this.canvas.width = this.cell * size;
    this.canvas.height = this.cell * size;
    this.rebuild();
    return cssCell;
  }

  setPalette(palette: TonePalette): void {
    this.palette = palette;
    this.rebuild();
  }

  /** The sprites, shared with the hand pieces drawn in the same style. */
  get tiles(): CeramicSprites | null {
    return this.sprites;
  }

  render(overlay: BoardOverlay): void {
    const { ctx, cell, sprites, palette, effects } = this;
    if (!sprites || !palette || cell === 0) return;
    const { grid } = this.view;
    const full = grid.size * cell;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = palette.wellBackground;
    ctx.fillRect(0, 0, full, full);
    if (effects.shake.active) ctx.translate(effects.shake.x * cell, effects.shake.y * cell);

    // Empty sockets of the tray.
    ctx.fillStyle = palette.wellGrid;
    for (let y = 0; y < grid.size; y++) {
      for (let x = 0; x < grid.size; x++) {
        ctx.beginPath();
        ctx.roundRect(
          x * cell + cell * 0.08,
          y * cell + cell * 0.08,
          cell * 0.84,
          cell * 0.84,
          cell * 0.16,
        );
        ctx.fill();
      }
    }

    this.drawLines(overlay, palette);

    if (!effects.boardHidden) {
      for (let y = 0; y < grid.size; y++) {
        for (let x = 0; x < grid.size; x++) {
          const tone = grid.get(x, y);
          if (tone !== Tone.Empty) this.drawTile(sprites.get(tone), x, y, effects.popScale(x, y));
        }
      }
    }

    // Tiles about to break: they jump, then crack.
    for (const tile of effects.cracking) {
      const t = tile.age / BREAK_MS;
      this.drawTile(sprites.get(tile.tone), tile.x, tile.y, 1 + 0.2 * Math.sin(Math.PI * t));
      ctx.strokeStyle = palette.crack;
      ctx.lineWidth = Math.max(1, cell * 0.05);
      ctx.beginPath();
      ctx.moveTo(tile.x * cell + cell * 0.2, tile.y * cell + cell * 0.3);
      ctx.lineTo(tile.x * cell + cell * 0.5, tile.y * cell + cell * (0.3 + 0.4 * t));
      ctx.lineTo(tile.x * cell + cell * 0.8, tile.y * cell + cell * 0.7);
      ctx.stroke();
    }

    this.drawPreview(overlay, sprites, palette);
    this.drawBomb(overlay, palette);
    this.drawCursor(overlay, palette);
    this.drawParticles();
    this.drawPopups(palette);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (effects.flash > 0) {
      ctx.fillStyle = `rgb(255 255 255 / ${effects.flash})`;
      ctx.fillRect(0, 0, full, full);
    }
  }

  private drawTile(sprite: HTMLCanvasElement, x: number, y: number, scale: number): void {
    const { ctx, cell } = this;
    if (scale === 1) {
      ctx.drawImage(sprite, x * cell, y * cell);
      return;
    }
    const size = cell * scale;
    ctx.drawImage(sprite, x * cell + (cell - size) / 2, y * cell + (cell - size) / 2, size, size);
  }

  /** Rows and columns the preview would clear glow. */
  private drawLines({ preview }: BoardOverlay, palette: TonePalette): void {
    if (!preview?.valid) return;
    const { ctx, cell } = this;
    const full = this.view.grid.size * cell;
    ctx.fillStyle = palette.accent;
    ctx.globalAlpha = 0.22;
    for (const row of preview.lines.rows) ctx.fillRect(0, row * cell, full, cell);
    for (const column of preview.lines.columns) ctx.fillRect(column * cell, 0, cell, full);
    ctx.globalAlpha = 1;
  }

  private drawPreview(
    { preview }: BoardOverlay,
    sprites: CeramicSprites,
    palette: TonePalette,
  ): void {
    if (!preview) return;
    const { ctx, cell } = this;
    const size = this.view.grid.size;
    if (preview.valid) {
      const sprite = sprites.get(preview.tone);
      ctx.globalAlpha = 0.55;
      for (const c of preview.shape.cells) {
        ctx.drawImage(sprite, (preview.x + c.x) * cell, (preview.y + c.y) * cell);
      }
      ctx.globalAlpha = 1;
      return;
    }
    // Does not fit: a red outline where it would go.
    ctx.strokeStyle = palette.danger;
    ctx.lineWidth = Math.max(2, cell * 0.08);
    for (const c of preview.shape.cells) {
      const x = preview.x + c.x;
      const y = preview.y + c.y;
      if (x < 0 || y < 0 || x >= size || y >= size) continue;
      ctx.strokeRect(x * cell + cell * 0.12, y * cell + cell * 0.12, cell * 0.76, cell * 0.76);
    }
  }

  private drawBomb({ bomb }: BoardOverlay, palette: TonePalette): void {
    if (!bomb) return;
    const { ctx, cell } = this;
    ctx.fillStyle = palette.danger;
    ctx.globalAlpha = 0.25 + 0.1 * Math.sin(performance.now() / 120);
    ctx.fillRect((bomb.x - 1) * cell, (bomb.y - 1) * cell, cell * 3, cell * 3);
    ctx.globalAlpha = 1;
  }

  private drawCursor({ cursor }: BoardOverlay, palette: TonePalette): void {
    if (!cursor) return;
    const { ctx, cell } = this;
    ctx.strokeStyle = palette.accent;
    ctx.lineWidth = Math.max(2, cell * 0.08);
    ctx.strokeRect(cursor.x * cell + 2, cursor.y * cell + 2, cell - 4, cell - 4);
  }

  private drawParticles(): void {
    const { ctx, cell, effects } = this;
    const { pool, colors } = effects;
    for (let i = 0; i < pool.count; i++) {
      ctx.globalAlpha = pool.alpha(i);
      ctx.fillStyle = colors[pool.color[i]!]!;
      const x = pool.x[i]! * cell;
      const y = pool.y[i]! * cell;
      if (pool.kind[i] === ParticleKind.Shard) {
        const cos = Math.cos(pool.angle[i]!) * cell;
        const sin = Math.sin(pool.angle[i]!) * cell;
        const o = i * 6;
        const s = pool.shape;
        ctx.beginPath();
        ctx.moveTo(x + s[o]! * cos - s[o + 1]! * sin, y + s[o]! * sin + s[o + 1]! * cos);
        ctx.lineTo(x + s[o + 2]! * cos - s[o + 3]! * sin, y + s[o + 2]! * sin + s[o + 3]! * cos);
        ctx.lineTo(x + s[o + 4]! * cos - s[o + 5]! * sin, y + s[o + 4]! * sin + s[o + 5]! * cos);
        ctx.closePath();
        ctx.fill();
      } else {
        const size = pool.size[i]! * cell;
        ctx.fillRect(x - size / 2, y - size / 2, size, size);
      }
    }
    ctx.globalAlpha = 1;
  }

  private drawPopups(palette: TonePalette): void {
    const { ctx, cell, effects } = this;
    if (effects.popups.length === 0) return;
    ctx.font = `800 ${Math.round(cell * 0.6)}px ui-rounded, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = Math.max(2, cell * 0.1);
    ctx.strokeStyle = palette.wellBackground;
    ctx.fillStyle = palette.accent;
    for (const popup of effects.popups) {
      const t = popup.age / MOSAIC_TIMINGS.POPUP_MS;
      ctx.globalAlpha = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
      const y = (popup.y - t * 1.4) * cell;
      ctx.strokeText(popup.text, popup.x * cell, y);
      ctx.fillText(popup.text, popup.x * cell, y);
    }
    ctx.globalAlpha = 1;
  }

  private rebuild(): void {
    this.sprites =
      this.palette && this.cell > 0 ? new CeramicSprites(this.cell, this.palette) : null;
  }
}

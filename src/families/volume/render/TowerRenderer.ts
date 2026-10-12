import { Tone } from '@/core/Tone';
import type { FallingView } from '@/families/falling/FallingSession';
import {
  CRACK_MS,
  EFFECT_TIMINGS,
  type FallingEffects,
} from '@/families/falling/fx/FallingEffects';
import type { Piece } from '@/families/falling/pieces/Piece';
import { ParticleKind } from '@/fx/ParticlePool';
import type { TonePalette } from '@/render/TonePalette';
import { CylinderProjection, TILT } from '../camera/CylinderProjection';
import type { TowerCamera } from '../camera/TowerCamera';
import { GlassSprites } from './GlassSprites';

const { TRAIL_MS, FLASH_MS, POPUP_MS, WAVE_MS } = EFFECT_TIMINGS;
/** Share of the visible height above which the tower glows with danger. */
const DANGER_HEIGHT = 0.7;
/** Opacity of the back of the tower, seen through the glass. */
const BACK_ALPHA = 0.2;

type Face = readonly [number, number, number, number, number, number];

/**
 * Draws the Tower: the falling well rolled into a glass cylinder, seen from
 * slightly above. Each cell is a parallelogram on screen, so the sprites are
 * drawn through an affine transform. The back of the tower shows through the
 * glass. It only reads the game, the camera and the effects.
 */
export class TowerRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly projection: CylinderProjection;
  private sprites: GlassSprites | null = null;
  private palette: TonePalette | null = null;
  private ghost = true;
  private dark = true;
  /** Screen shake, in device pixels, added to every transform. */
  private offsetX = 0;
  private offsetY = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly view: FallingView,
    private readonly camera: TowerCamera,
    private readonly effects: FallingEffects,
  ) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D is not available');
    this.ctx = ctx;
    const { board } = view;
    this.projection = new CylinderProjection(board.width, board.height - board.hiddenRows);
  }

  private get columns(): number {
    return this.projection.columns;
  }

  private get rows(): number {
    return this.projection.rows;
  }

  /** Fits the tower in the box (CSS pixels); returns the width of a column face on. */
  layout(availableWidth: number, availableHeight: number, pixelRatio: number): number {
    const radius = Math.floor(
      CylinderProjection.fit(this.columns, this.rows, availableWidth, availableHeight),
    );
    const css = CylinderProjection.size(this.columns, this.rows, radius);
    this.canvas.style.width = `${Math.round(css.width)}px`;
    this.canvas.style.height = `${Math.round(css.height)}px`;
    this.canvas.width = Math.round(css.width * pixelRatio);
    this.canvas.height = Math.round(css.height * pixelRatio);
    this.projection.layout(radius * pixelRatio);
    this.rebuildSprites();
    return (radius * 2 * Math.PI) / this.columns;
  }

  setPalette(palette: TonePalette, dark: boolean): void {
    this.palette = palette;
    this.dark = dark;
    this.rebuildSprites();
  }

  setGhost(enabled: boolean): void {
    this.ghost = enabled;
  }

  render(): void {
    const { ctx, sprites, palette, effects, projection } = this;
    if (!sprites || !palette || projection.radius === 0) return;
    projection.camera = this.camera.position;
    const cell = projection.rowHeight;
    this.offsetX = effects.shake.active ? effects.shake.x * cell : 0;
    this.offsetY = effects.shake.active ? effects.shake.y * cell : 0;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = palette.wellBackground;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.drawRing(this.rows, palette.wellGrid, true);
    if (!effects.stackHidden) this.drawStack(sprites, false);
    this.drawGrid(palette.wellGrid);
    if (!effects.stackHidden) this.drawStack(sprites, true);
    this.drawCracks(sprites, palette);
    this.drawTrails(palette);
    this.drawWaves(palette);

    const active = this.view.active;
    if (active) {
      const distance = this.view.dropDistance();
      if (this.ghost && distance > 0) this.drawPiece(sprites, active, distance, 0.28);
      this.drawPiece(sprites, active, 0, 1);
    }

    this.drawFlashes();
    this.drawParticles();
    this.drawRing(0, palette.wellGrid, false);
    this.drawPopups(palette);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.drawDanger(palette);
    if (effects.wellFlash > 0) {
      ctx.fillStyle = `rgb(255 255 255 / ${effects.wellFlash})`;
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  // --- Cells ------------------------------------------------------------------

  /** Sets the transform that maps the unit square onto a face (see `CylinderProjection.face`). */
  private face(x: number, y: number, height = 1): void {
    const [a, b, c, d, e, f]: Face = this.projection.face(x, y, height);
    this.ctx.setTransform(a, b, c, d, e + this.offsetX, f + this.offsetY);
  }

  /** True when the middle of the column faces the viewer. */
  private isFront(x: number): boolean {
    return this.projection.depth(x + 0.5) > 0;
  }

  /** One glass cell, lit by its angle (the back is dimmed and unlit). */
  private drawCell(sprites: GlassSprites, tone: Tone, x: number, y: number, alpha: number): void {
    const { ctx, projection } = this;
    this.face(x, y);
    const front = this.isFront(x);
    ctx.globalAlpha = front ? alpha : alpha * BACK_ALPHA;
    ctx.drawImage(sprites.get(tone), 0, 0, 1, 1);
    if (!front) return;
    const shadow = projection.shadow(x + 0.5);
    if (shadow > 0.02) {
      ctx.globalAlpha = alpha * shadow;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, 1, 1);
    }
    const glint = projection.glint(x + 0.5);
    if (glint > 0.02) {
      ctx.globalAlpha = alpha * glint * 0.4;
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, 1, 1);
    }
  }

  /** The stack: the back (seen through the glass) or the front. */
  private drawStack(sprites: GlassSprites, front: boolean): void {
    const { board } = this.view;
    const hidden = board.hiddenRows;
    for (let x = 0; x < board.width; x++) {
      if (this.isFront(x) !== front) continue;
      for (let y = hidden; y < board.height; y++) {
        const tone = board.get(x, y);
        if (tone === Tone.Empty) continue;
        this.drawCell(sprites, tone, x, y - hidden + this.effects.rowOffset[y]!, 1);
      }
    }
    this.ctx.globalAlpha = 1;
  }

  private drawPiece(sprites: GlassSprites, piece: Piece, dy: number, alpha: number): void {
    const hidden = this.view.board.hiddenRows;
    for (const local of piece.localCells) {
      const y = piece.y + local.y + dy - hidden;
      if (y < 0) continue;
      this.drawCell(sprites, piece.tone, piece.x + local.x, y, alpha);
    }
    this.ctx.globalAlpha = 1;
  }

  // --- Structure --------------------------------------------------------------

  /** Column edges and rings of the front, faint lines etched in the glass. */
  private drawGrid(color: string): void {
    const { ctx, projection } = this;
    ctx.setTransform(1, 0, 0, 1, this.offsetX, this.offsetY);
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, projection.rowHeight * 0.03);
    ctx.beginPath();
    const first = Math.ceil(projection.camera - this.columns / 4);
    for (let x = first; x <= first + this.columns / 2; x++) {
      if (projection.depth(x) <= 0) continue;
      ctx.moveTo(projection.screenX(x), projection.screenY(x, 0));
      ctx.lineTo(projection.screenX(x), projection.screenY(x, this.rows));
    }
    for (let y = 1; y < this.rows; y++) this.frontArc(y);
    ctx.stroke();
  }

  /** A ring of the tower at height `y`: its back half, or the whole ellipse. */
  private drawRing(y: number, color: string, whole: boolean): void {
    const { ctx, projection } = this;
    ctx.setTransform(1, 0, 0, 1, this.offsetX, this.offsetY);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1.5, projection.rowHeight * 0.06);
    ctx.beginPath();
    ctx.ellipse(
      projection.centreX,
      projection.top + y * projection.rowHeight,
      projection.radius,
      projection.radius * TILT,
      0,
      0,
      Math.PI * 2,
    );
    if (whole) {
      ctx.fillStyle = color;
      ctx.fill();
    }
    ctx.stroke();
  }

  /** The front half of the ring at height `y`, added to the current path. */
  private frontArc(y: number): void {
    const { ctx, projection } = this;
    const half = this.columns / 4;
    const steps = 24;
    for (let i = 0; i <= steps; i++) {
      const x = projection.camera - half + (i / steps) * half * 2;
      const sx = projection.screenX(x);
      const sy = projection.screenY(x, y);
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
  }

  // --- Effects ----------------------------------------------------------------

  private drawCracks(sprites: GlassSprites, palette: TonePalette): void {
    const { ctx, effects, projection } = this;
    for (const crack of effects.cracks) {
      crack.tones.forEach((tone, x) => {
        if (tone !== Tone.Empty) this.drawCell(sprites, tone as Tone, x, crack.row, 1);
      });
      const progress = Math.min(1, crack.age / (CRACK_MS * 0.75));
      const points = Math.max(2, Math.ceil((crack.path.length / 2) * progress));
      ctx.setTransform(1, 0, 0, 1, this.offsetX, this.offsetY);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = palette.crack;
      ctx.lineWidth = Math.max(1.5, projection.rowHeight * 0.07);
      ctx.lineJoin = 'round';
      ctx.beginPath();
      let drawing = false;
      for (let i = 0; i < points; i++) {
        const x = crack.path[i * 2]!;
        if (projection.depth(x) <= 0) {
          drawing = false;
          continue;
        }
        const sx = projection.screenX(x);
        const sy = projection.screenY(x, crack.row + crack.path[i * 2 + 1]!);
        if (drawing) ctx.lineTo(sx, sy);
        else ctx.moveTo(sx, sy);
        drawing = true;
      }
      ctx.stroke();
    }
  }

  private drawTrails(palette: TonePalette): void {
    const { ctx } = this;
    for (const trail of this.effects.trails) {
      if (!this.isFront(trail.x)) continue;
      const rgb = palette.color(trail.tone);
      this.face(trail.x + 0.18, trail.from, trail.to + 1 - trail.from);
      const gradient = ctx.createLinearGradient(0, 0, 0, 1);
      gradient.addColorStop(0, `rgb(${rgb.r} ${rgb.g} ${rgb.b} / 0)`);
      gradient.addColorStop(1, `rgb(${rgb.r} ${rgb.g} ${rgb.b} / 0.45)`);
      ctx.globalAlpha = 1 - trail.age / TRAIL_MS;
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 0.64, 1);
    }
    ctx.globalAlpha = 1;
  }

  /** The level wave climbs the front of the tower. */
  private drawWaves(palette: TonePalette): void {
    const { ctx, projection } = this;
    for (const wave of this.effects.waves) {
      if (wave.kind !== 'level') continue;
      const t = wave.age / WAVE_MS;
      ctx.globalAlpha = 0.35 * (1 - t);
      ctx.fillStyle = palette.accent;
      const first = Math.floor(projection.camera - this.columns / 4);
      for (let x = first; x < first + this.columns / 2 + 1; x++) {
        if (!this.isFront(x)) continue;
        this.face(x, (1 - t) * this.rows - 0.6, 1.2);
        ctx.fillRect(0, 0, 1, 1);
      }
    }
    ctx.globalAlpha = 1;
  }

  private drawFlashes(): void {
    const { ctx } = this;
    ctx.fillStyle = '#fff';
    for (const flash of this.effects.flashes) {
      ctx.globalAlpha = 0.42 * (1 - flash.age / FLASH_MS);
      for (const { x, y } of flash.cells) {
        if (y < 0 || !this.isFront(x)) continue;
        this.face(x, y);
        ctx.fillRect(0, 0, 1, 1);
      }
    }
    ctx.globalAlpha = 1;
  }

  /** Debris and sparks, projected; those behind the tower are seen faintly through it. */
  private drawParticles(): void {
    const { ctx, effects, projection } = this;
    const { pool, colors } = effects;
    ctx.setTransform(1, 0, 0, 1, this.offsetX, this.offsetY);
    for (let i = 0; i < pool.count; i++) {
      const px = pool.x[i]!;
      const depth = projection.depth(px);
      const x = projection.screenX(px);
      const y = projection.screenY(px, pool.y[i]!);
      const cell = projection.rowHeight * (0.6 + 0.4 * Math.max(0, depth));
      ctx.globalAlpha = pool.alpha(i) * (depth > 0 ? 1 : BACK_ALPHA);
      const color = colors[pool.color[i]!]!;
      const kind = pool.kind[i];
      if (kind === ParticleKind.Shard) {
        const cos = Math.cos(pool.angle[i]!) * cell;
        const sin = Math.sin(pool.angle[i]!) * cell;
        const o = i * 6;
        const s = pool.shape;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(x + s[o]! * cos - s[o + 1]! * sin, y + s[o]! * sin + s[o + 1]! * cos);
        ctx.lineTo(x + s[o + 2]! * cos - s[o + 3]! * sin, y + s[o + 2]! * sin + s[o + 3]! * cos);
        ctx.lineTo(x + s[o + 4]! * cos - s[o + 5]! * sin, y + s[o + 4]! * sin + s[o + 5]! * cos);
        ctx.closePath();
        ctx.fill();
      } else if (kind === ParticleKind.Spark) {
        ctx.globalCompositeOperation = this.dark ? 'lighter' : 'source-over';
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(1, cell * 0.08);
        ctx.beginPath();
        ctx.moveTo(x - pool.vx[i]! * cell * 0.03, y - pool.vy[i]! * cell * 0.03);
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
      } else {
        const size = pool.size[i]! * cell;
        ctx.fillStyle = color;
        ctx.fillRect(x - size / 2, y - size / 2, size, size);
      }
    }
    ctx.globalAlpha = 1;
  }

  /** Points rise in the middle of the screen, always readable whatever the camera. */
  private drawPopups(palette: TonePalette): void {
    const { ctx, effects, projection } = this;
    if (effects.popups.length === 0) return;
    const cell = projection.rowHeight;
    ctx.setTransform(1, 0, 0, 1, this.offsetX, this.offsetY);
    ctx.font = `800 ${Math.round(cell * 0.75)}px ui-rounded, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = Math.max(2, cell * 0.12);
    ctx.strokeStyle = palette.wellBackground;
    ctx.fillStyle = palette.accent;
    for (const popup of effects.popups) {
      const t = popup.age / POPUP_MS;
      const y = projection.top + (popup.y + 0.5 - t * 1.6) * cell + projection.radius * TILT;
      ctx.globalAlpha = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
      ctx.strokeText(popup.text, projection.centreX, y);
      ctx.fillText(popup.text, projection.centreX, y);
    }
    ctx.globalAlpha = 1;
  }

  /** A pulsing glow on the sides when the stack nears the top. */
  private drawDanger(palette: TonePalette): void {
    if (this.effects.stackHidden) return;
    if (this.view.board.stackHeight() < this.rows * DANGER_HEIGHT) return;
    const { ctx, canvas } = this;
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 260);
    const side = this.projection.rowHeight * 0.4;
    ctx.globalAlpha = 0.18 + 0.17 * pulse;
    ctx.fillStyle = palette.danger;
    ctx.fillRect(0, 0, side, canvas.height);
    ctx.fillRect(canvas.width - side, 0, side, canvas.height);
    ctx.fillRect(0, 0, canvas.width, side * 0.7);
    ctx.globalAlpha = 1;
  }

  private rebuildSprites(): void {
    const size = Math.ceil(this.projection.rowHeight);
    this.sprites = this.palette && size > 0 ? new GlassSprites(size, this.palette) : null;
  }
}

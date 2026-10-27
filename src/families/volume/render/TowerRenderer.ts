import { Tone } from '@/core/Tone';
import type { FallingView } from '@/families/falling/FallingSession';
import {
  CRACK_MS,
  EFFECT_TIMINGS,
  type FallingEffects,
} from '@/families/falling/fx/FallingEffects';
import type { Piece } from '@/families/falling/pieces/Piece';
import { ParticleKind } from '@/fx/ParticlePool';
import { shade, type TonePalette } from '@/render/TonePalette';
import { CylinderProjection, TILT } from '../camera/CylinderProjection';
import type { TowerCamera } from '../camera/TowerCamera';
import { EYE_HURT_MS, EYE_POPUP_MS, STRIKE_MS, type EyeEffects } from '../fx/EyeEffects';
import type { EyeView } from '../TowerEye';
import { TowerMode } from '../TowerMode';
import { GlassSprites } from './GlassSprites';

const { TRAIL_MS, FLASH_MS, POPUP_MS, WAVE_MS } = EFFECT_TIMINGS;
/** Share of the visible height above which the tower glows with danger. */
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
    /** The Eye's effects, on its boss level. */
    private readonly eyeEffects: EyeEffects | null = null,
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

    const eye = this.eye;
    this.drawRing(this.rows, palette.wellGrid, true);
    if (!effects.stackHidden) this.drawStack(sprites, false);
    if (eye) this.drawEye(eye, palette, false);
    this.drawGrid(palette.wellGrid);
    if (eye) this.drawGaze(eye, palette);
    if (!effects.stackHidden) this.drawStack(sprites, true);
    this.drawCracks(sprites, palette);
    this.drawBlastZone(palette);
    this.drawTrails(palette);
    this.drawWaves(palette);

    this.drawSpawnWarning(palette);
    const active = this.view.active;
    if (active) {
      const distance = this.view.dropDistance();
      if (this.ghost && distance > 0) this.drawPiece(sprites, active, distance, 0.28);
      this.drawPiece(sprites, active, 0, 1);
    }

    this.drawFlashes();
    this.drawParticles();
    this.drawRing(0, palette.wellGrid, false);
    if (eye) {
      this.drawStrikes(eye, palette);
      this.drawEye(eye, palette, true);
    }
    this.drawPopups(palette);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (eye) this.drawEyeMarker(eye, palette);
    if (effects.wellFlash > 0) {
      ctx.fillStyle = `rgb(255 255 255 / ${effects.wellFlash})`;
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  /** The next piece in red where it would appear, when the tower leaves it no room to enter. */
  private drawSpawnWarning(palette: TonePalette): void {
    if (this.effects.stackHidden) return;
    const cells = this.view.spawnWarning();
    if (!cells) return;
    const { ctx } = this;
    let top = Number.POSITIVE_INFINITY;
    for (const at of cells) top = Math.min(top, at.y);
    const pulse = this.effects.motion ? 0.5 + 0.5 * Math.sin(performance.now() / 120) : 0.5;
    ctx.fillStyle = palette.danger;
    for (const at of cells) {
      const x = this.view.board.column(at.x);
      this.face(x, at.y - top);
      ctx.globalAlpha = (this.isFront(x) ? 1 : BACK_ALPHA) * (0.4 + 0.35 * pulse);
      ctx.fillRect(0, 0, 1, 1);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
  }

  // --- The Eye of the Tower ---------------------------------------------------

  private get eye(): EyeView | null {
    const mode = this.view.mode;
    return mode instanceof TowerMode ? mode.eye : null;
  }

  /** Where the Eye floats: above the top rings, at its place around the tower. */
  private eyeAt(eye: EyeView): { x: number; y: number; depth: number; size: number } {
    const { projection } = this;
    const depth = projection.depth(eye.centre + 0.5);
    const size = projection.rowHeight * 1.5 * (0.7 + 0.3 * Math.max(0, depth));
    // Near the edges of the tower it stays whole on screen, its glow and figures with it.
    const margin = size * 1.15;
    const x = projection.screenX(eye.centre + 0.5);
    return {
      x: Math.max(margin, Math.min(this.canvas.width - margin, x)) + this.offsetX,
      y: projection.screenY(eye.centre + 0.5, 1.7) + this.offsetY,
      depth,
      size,
    };
  }

  /** The colour of its iris: the rift's light, hotter by phase. */
  private eyeColour(eye: EyeView, palette: TonePalette): string {
    if (eye.state === 'charge' || eye.phase === 3) return palette.danger;
    return eye.phase === 2 ? palette.accent : palette.effects.rift;
  }

  /**
   * Its gaze: a beam down the columns it watches, faint while it turns,
   * reddening and pulsing as it charges.
   */
  private drawGaze(eye: EyeView, palette: TonePalette): void {
    if (eye.state === 'blind' || eye.state === 'dead') return;
    const { ctx } = this;
    const charging = eye.state === 'charge';
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / (charging ? 70 : 400));
    const strength = charging ? 0.2 + 0.35 * eye.charge * (0.6 + 0.4 * pulse) : 0.1;
    const colour = charging ? palette.danger : this.eyeColour(eye, palette);
    const { board } = this.view;
    const hidden = board.hiddenRows;
    const middle = Math.floor(eye.centre);
    for (let d = -eye.reach; d <= eye.reach; d++) {
      const x = middle + d;
      if (!this.isFront(x)) continue;
      // The beam: strong at the top, where the Eye is, fading down the tower.
      this.face(x, 0, this.rows);
      const beam = ctx.createLinearGradient(0, 0, 0, 1);
      beam.addColorStop(0, colour);
      beam.addColorStop(1, 'rgb(0 0 0 / 0)');
      ctx.globalAlpha = strength * (1 - Math.abs(d) / (eye.reach + 2));
      ctx.fillStyle = beam;
      ctx.fillRect(0, 0, 1, 1);
      if (!charging) continue;
      // Charging: where its stone will land, a blinking red frame.
      const column = board.column(x);
      let top = board.height;
      for (let y = 0; y < board.height; y++) {
        if (board.get(column, y) !== Tone.Empty) {
          top = y;
          break;
        }
      }
      const land = top - 1 - hidden;
      if (land < 0) continue;
      this.face(x, land);
      ctx.globalAlpha = 0.45 + 0.55 * pulse;
      ctx.strokeStyle = palette.danger;
      ctx.lineWidth = 0.12;
      ctx.strokeRect(0.08, 0.08, 0.84, 0.84);
    }
    ctx.globalAlpha = 1;
  }

  /**
   * The Eye itself, drawn once behind the glass (when it is round the back)
   * and once in front: a pale almond, an iris of the rift's light, a slit of
   * a pupil narrowing as it charges, a lid shut while it is blinded.
   */
  private drawEye(eye: EyeView, palette: TonePalette, front: boolean): void {
    const { x, y, depth, size } = this.eyeAt(eye);
    if (depth > 0 !== front) return;
    const { ctx } = this;
    const seen = front ? 1 : 0.3;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const w = size;
    const h = size * 0.55;
    const colour = this.eyeColour(eye, palette);
    const hurt = (this.eyeEffects?.hurt ?? 0) / EYE_HURT_MS;
    const almond = () => {
      ctx.beginPath();
      ctx.moveTo(x - w, y);
      ctx.quadraticCurveTo(x, y - h * 2, x + w, y);
      ctx.quadraticCurveTo(x, y + h * 2, x - w, y);
    };
    if (eye.state !== 'dead') {
      const glow = ctx.createRadialGradient(x, y, 0, x, y, w * 1.8);
      glow.addColorStop(0, colour);
      glow.addColorStop(1, 'rgb(0 0 0 / 0)');
      ctx.globalAlpha = seen * 0.5;
      ctx.fillStyle = glow;
      ctx.fillRect(x - w * 1.8, y - w * 1.8, w * 3.6, w * 3.6);
    }
    ctx.globalAlpha = seen;
    almond();
    if (eye.state === 'blind' || eye.state === 'dead') {
      // The lid, shut: a dark almond and its lashes.
      ctx.fillStyle = palette.wellGrid;
      ctx.fill();
      ctx.strokeStyle = colour;
      ctx.lineWidth = Math.max(1.5, size * 0.08);
      ctx.beginPath();
      ctx.moveTo(x - w * 0.9, y + h * 0.1);
      ctx.quadraticCurveTo(x, y + h * 0.9, x + w * 0.9, y + h * 0.1);
      ctx.stroke();
    } else {
      ctx.fillStyle = shade(palette.color(Tone.Lightning), 0);
      ctx.fill();
      ctx.save();
      almond();
      ctx.clip();
      // It looks down at the tower.
      const iy = y + h * 0.25;
      const iris = ctx.createRadialGradient(x, iy, 0, x, iy, h * 1.05);
      iris.addColorStop(0, shade(palette.color(Tone.Lightning), 0));
      iris.addColorStop(0.35, colour);
      iris.addColorStop(1, palette.wellBackground);
      ctx.fillStyle = iris;
      ctx.beginPath();
      ctx.arc(x, iy, h * 1.05, 0, Math.PI * 2);
      ctx.fill();
      const slit = h * (eye.state === 'charge' ? 0.12 : 0.28);
      ctx.fillStyle = palette.wellBackground;
      ctx.beginPath();
      ctx.ellipse(x, iy, slit, h * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    almond();
    ctx.strokeStyle = palette.wellBackground;
    ctx.lineWidth = Math.max(1.5, size * 0.07);
    ctx.stroke();
    if (hurt > 0) {
      almond();
      ctx.globalAlpha = hurt * seen * 0.85;
      ctx.fillStyle = 'rgb(255 255 255)';
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (front) this.drawEyePopups(x, y - h * 2.2, size, palette);
  }

  private drawEyePopups(x: number, y: number, size: number, palette: TonePalette): void {
    const popups = this.eyeEffects?.popups ?? [];
    if (popups.length === 0) return;
    const { ctx } = this;
    ctx.font = `800 ${Math.round(size * 0.7)}px ui-rounded, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = Math.max(2, size * 0.1);
    ctx.strokeStyle = palette.wellBackground;
    ctx.fillStyle = palette.accent;
    for (const popup of popups) {
      const t = popup.age / EYE_POPUP_MS;
      ctx.globalAlpha = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
      const py = y - t * size * 1.2;
      ctx.strokeText(popup.text, x, py);
      ctx.fillText(popup.text, x, py);
    }
    ctx.globalAlpha = 1;
  }

  /** The light of a strike: a ray from the Eye to each stone it dropped. */
  private drawStrikes(eye: EyeView, palette: TonePalette): void {
    const strikes = this.eyeEffects?.strikes ?? [];
    if (strikes.length === 0) return;
    const { ctx, projection } = this;
    const { x, y } = this.eyeAt(eye);
    const hidden = this.view.board.hiddenRows;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.strokeStyle = palette.danger;
    ctx.lineCap = 'round';
    for (const strike of strikes) {
      const t = strike.age / STRIKE_MS;
      ctx.globalAlpha = 1 - t;
      ctx.lineWidth = Math.max(2, projection.rowHeight * 0.18 * (1 - t));
      for (const cell of strike.cells) {
        if (!this.isFront(cell.x)) continue;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(
          projection.screenX(cell.x + 0.5) + this.offsetX,
          projection.screenY(cell.x + 0.5, cell.y - hidden + 0.5) + this.offsetY,
        );
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  /** Round the back of the tower, a chevron at the edge shows which way the Eye is. */
  private drawEyeMarker(eye: EyeView, palette: TonePalette): void {
    const { projection, ctx } = this;
    const depth = projection.depth(eye.centre + 0.5);
    if (depth > 0.15 || eye.state === 'dead') return;
    const right = Math.sin(projection.angle(eye.centre + 0.5)) > 0;
    const size = projection.rowHeight * 0.6;
    const x = right ? this.canvas.width - size * 0.9 : size * 0.9;
    // Under where the Eye shows faintly through the glass, so as not to cover it.
    const y = projection.top + projection.rowHeight * 3.6;
    const charging = eye.state === 'charge';
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / (charging ? 90 : 300));
    ctx.globalAlpha = 0.55 + 0.45 * pulse;
    ctx.fillStyle = charging ? palette.danger : this.eyeColour(eye, palette);
    const s = right ? 1 : -1;
    ctx.beginPath();
    ctx.moveTo(x + s * size * 0.5, y);
    ctx.lineTo(x - s * size * 0.4, y - size * 0.6);
    ctx.lineTo(x - s * size * 0.4, y + size * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
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
        const row = y - hidden + this.effects.rowOffset[y]!;
        this.drawCell(sprites, tone, x, row, 1);
        if (board.hasBomb(x, y)) this.drawBomb(x, row, front ? 1 : BACK_ALPHA);
      }
    }
    this.ctx.globalAlpha = 1;
  }

  /**
   * A bomb gem set in a block: a dark core with a burning heart that pulses,
   * so that a bomb is told from any colour, even through the glass.
   */
  private drawBomb(x: number, y: number, alpha: number): void {
    const { ctx } = this;
    this.face(x, y);
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 160 + x);
    const palette = this.palette;
    if (!palette) return;
    ctx.globalAlpha = alpha * 0.9;
    ctx.fillStyle = palette.wellBackground;
    ctx.beginPath();
    ctx.arc(0.5, 0.52, 0.27, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = alpha * (0.6 + 0.4 * pulse);
    ctx.fillStyle = palette.danger;
    ctx.beginPath();
    ctx.arc(0.5, 0.52, 0.12 + 0.05 * pulse, 0, Math.PI * 2);
    ctx.fill();
    // The fuse, sparking.
    ctx.strokeStyle = palette.accent;
    ctx.lineWidth = 0.06;
    ctx.beginPath();
    ctx.moveTo(0.62, 0.3);
    ctx.lineTo(0.74, 0.16);
    ctx.stroke();
    ctx.globalAlpha = alpha * pulse;
    ctx.fillStyle = palette.crack;
    ctx.beginPath();
    ctx.arc(0.76, 0.14, 0.06, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  /** The sector the bombs would blow away if the piece landed now: it glows red, pulsing. */
  private drawBlastZone(palette: TonePalette): void {
    const cells = this.view.blastPreview();
    if (cells.length === 0) return;
    const { ctx } = this;
    const hidden = this.view.board.hiddenRows;
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 120);
    for (const cell of cells) {
      // The back of the tower shows it faintly, through the glass.
      const seen = this.isFront(cell.x) ? 1 : BACK_ALPHA;
      this.face(cell.x, cell.y - hidden);
      ctx.globalAlpha = (0.35 + 0.25 * pulse) * seen;
      ctx.fillStyle = palette.danger;
      ctx.fillRect(0, 0, 1, 1);
      // Hazard stripes and a bright blinking edge: readable on every colour of glass.
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, 1, 1);
      ctx.clip();
      ctx.globalAlpha = 0.85 * seen;
      ctx.strokeStyle = palette.danger;
      ctx.lineWidth = 0.12;
      ctx.beginPath();
      for (const offset of [-0.5, 0, 0.5]) {
        ctx.moveTo(offset, 1);
        ctx.lineTo(offset + 1, 0);
      }
      ctx.stroke();
      ctx.restore();
      ctx.globalAlpha = (0.4 + 0.6 * pulse) * seen;
      ctx.strokeStyle = palette.crack;
      ctx.lineWidth = 0.1;
      ctx.strokeRect(0.05, 0.05, 0.9, 0.9);
    }
    ctx.globalAlpha = 1;
  }

  private drawPiece(sprites: GlassSprites, piece: Piece, dy: number, alpha: number): void {
    const hidden = this.view.board.hiddenRows;
    piece.localCells.forEach((local, index) => {
      const y = piece.y + local.y + dy - hidden;
      if (y < 0) return;
      this.drawCell(sprites, piece.tone, piece.x + local.x, y, alpha);
      if (piece.bomb === index) this.drawBomb(piece.x + local.x, y, alpha);
    });
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

  private rebuildSprites(): void {
    const size = Math.ceil(this.projection.rowHeight);
    // Too small a tower (its box not laid out yet: a world of the race just opening) draws nothing.
    this.sprites =
      this.palette && size >= GlassSprites.MIN_SIZE ? new GlassSprites(size, this.palette) : null;
  }
}

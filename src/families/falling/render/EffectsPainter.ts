import { ParticleKind } from '@/fx/ParticlePool';
import { Tone } from '../pieces/PieceType';
import { CRACK_MS, EFFECT_TIMINGS, type FallingEffects } from '../fx/FallingEffects';
import type { CrystalSprites } from './CrystalSprites';
import type { TonePalette } from '@/render/TonePalette';

const { TRAIL_MS, FLASH_MS, POPUP_MS, WAVE_MS } = EFFECT_TIMINGS;

/**
 * Draws the state of `FallingEffects` on the well's canvas. Coordinates are in
 * cells; `cell` converts them to device pixels.
 */
export class EffectsPainter {
  constructor(private readonly ctx: CanvasRenderingContext2D) {}

  /** Rows that are cracking: still whole, with the crack spreading across. */
  cracks(
    effects: FallingEffects,
    sprites: CrystalSprites,
    palette: TonePalette,
    cell: number,
  ): void {
    const { ctx } = this;
    for (const crack of effects.cracks) {
      const top = crack.row * cell;
      crack.tones.forEach((tone, x) => {
        if (tone !== Tone.Empty) ctx.drawImage(sprites.get(tone as Tone), x * cell, top);
      });
      const progress = Math.min(1, crack.age / (CRACK_MS * 0.75));
      const points = Math.max(2, Math.ceil((crack.path.length / 2) * progress));
      ctx.strokeStyle = palette.crack;
      ctx.lineWidth = Math.max(1.5, cell * 0.07);
      ctx.lineJoin = 'round';
      ctx.beginPath();
      for (let i = 0; i < points; i++) {
        const x = crack.path[i * 2]! * cell;
        const y = top + crack.path[i * 2 + 1]! * cell;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  /** Trails, lock flashes and waves: drawn under the falling piece. */
  underlays(
    effects: FallingEffects,
    palette: TonePalette,
    columns: number,
    rows: number,
    cell: number,
  ): void {
    const { ctx } = this;
    for (const trail of effects.trails) {
      const fade = 1 - trail.age / TRAIL_MS;
      const top = trail.from * cell;
      const bottom = (trail.to + 1) * cell;
      const gradient = ctx.createLinearGradient(0, top, 0, bottom);
      const rgb = palette.color(trail.tone);
      gradient.addColorStop(0, `rgb(${rgb.r} ${rgb.g} ${rgb.b} / 0)`);
      gradient.addColorStop(1, `rgb(${rgb.r} ${rgb.g} ${rgb.b} / ${0.45 * fade})`);
      ctx.fillStyle = gradient;
      ctx.fillRect(trail.x * cell + cell * 0.18, top, cell * 0.64, bottom - top);
    }

    for (const wave of effects.waves) {
      const t = wave.age / WAVE_MS;
      ctx.globalAlpha = 0.35 * (1 - t);
      ctx.fillStyle = palette.accent;
      if (wave.kind === 'level') {
        ctx.fillRect(0, (1 - t) * rows * cell - cell * 0.6, columns * cell, cell * 1.2);
      } else {
        ctx.fillRect(t * columns * cell - cell, 0, cell * 2, rows * cell);
      }
    }
    ctx.globalAlpha = 1;
  }

  /** Lock flashes, particles, points: drawn over everything. */
  overlays(effects: FallingEffects, palette: TonePalette, cell: number, dark: boolean): void {
    const { ctx } = this;
    for (const flash of effects.flashes) {
      ctx.fillStyle = `rgb(255 255 255 / ${0.42 * (1 - flash.age / FLASH_MS)})`;
      for (const { x, y } of flash.cells) if (y >= 0) ctx.fillRect(x * cell, y * cell, cell, cell);
    }
    this.particles(effects, cell, dark);
    this.popups(effects, palette, cell);
  }

  private particles(effects: FallingEffects, cell: number, dark: boolean): void {
    const { ctx } = this;
    const { pool, colors } = effects;
    for (let i = 0; i < pool.count; i++) {
      const x = pool.x[i]! * cell;
      const y = pool.y[i]! * cell;
      ctx.globalAlpha = pool.alpha(i);
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
        ctx.globalCompositeOperation = dark ? 'lighter' : 'source-over';
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

  private popups(effects: FallingEffects, palette: TonePalette, cell: number): void {
    if (effects.popups.length === 0) return;
    const { ctx } = this;
    ctx.font = `800 ${Math.round(cell * 0.75)}px ui-rounded, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = Math.max(2, cell * 0.12);
    ctx.strokeStyle = palette.wellBackground;
    ctx.fillStyle = palette.accent;
    for (const popup of effects.popups) {
      const t = popup.age / POPUP_MS;
      const y = (popup.y + 0.5 - t * 1.6) * cell;
      ctx.globalAlpha = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
      ctx.strokeText(popup.text, popup.x * cell, y);
      ctx.fillText(popup.text, popup.x * cell, y);
    }
    ctx.globalAlpha = 1;
  }
}

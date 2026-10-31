import { ParticleKind } from '@/fx/ParticlePool';
import { Tone } from '../pieces/PieceType';
import { CELL_RIM, CRACK_MS, EFFECT_TIMINGS, type FallingEffects } from '../fx/FallingEffects';
import type { BlockSprites } from './BlockSprites';
import type { TonePalette } from '@/render/TonePalette';
import { WellOverlay } from './WellOverlay';

const { TRAIL_MS, FLASH_MS, WAVE_MS } = EFFECT_TIMINGS;

/** How far behind the rift's front a brick takes to light up fully, in cells. */
const HEAT_SPREAD = 2;

/**
 * Draws the state of `FallingEffects` on the well's canvas. Coordinates are in
 * cells; `cell` converts them to device pixels.
 */
export class EffectsPainter {
  /** One pattern per block picture, for shards that keep their part of it. */
  private readonly patterns = new WeakMap<HTMLCanvasElement, CanvasPattern>();
  /** Reused for every textured shard: no allocation per particle and frame. */
  private readonly matrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

  /** The words, the heat and the rift's light, drawn as the Tower draws them. */
  readonly overlay: WellOverlay;

  constructor(private readonly ctx: CanvasRenderingContext2D) {
    this.overlay = new WellOverlay(ctx);
  }

  /**
   * Rows that are cracking: still whole while the rift runs along them from
   * where the piece landed; each brick lights up and shows its cracks as the
   * rift reaches it. A row still waiting for a falling piece shows nothing yet.
   */
  cracks(effects: FallingEffects, sprites: BlockSprites, palette: TonePalette, cell: number): void {
    const { ctx } = this;
    for (const crack of effects.cracks) {
      const top = crack.row * cell;
      const waiting = crack.age < 0;
      crack.tones.forEach((tone, x) => {
        if (tone === Tone.Empty || (waiting && crack.covered.has(x))) return;
        ctx.drawImage(sprites.get(tone as Tone, crack.links[x]), x * cell, top);
      });
      if (waiting) continue;

      const width = crack.tones.length;
      const progress = Math.min(1, crack.age / (CRACK_MS * 0.75));
      const reach = progress * (Math.max(crack.origin, width - crack.origin) + HEAT_SPREAD);
      // Each brick heats up and cracks from its break point as the rift arrives.
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = Math.max(1, cell * 0.045);
      for (let x = 0; x < width; x++) {
        const lit = Math.min(1, (reach - Math.abs(x + 0.5 - crack.origin)) / HEAT_SPREAD);
        if (lit <= 0 || crack.tones[x] === Tone.Empty) continue;
        ctx.fillStyle = `rgb(255 243 214 / ${0.38 * lit})`;
        ctx.fillRect(x * cell, top, cell, cell);
        const px = (x + crack.inner[x * 2]!) * cell;
        const py = top + crack.inner[x * 2 + 1]! * cell;
        ctx.globalAlpha = 0.85 * lit;
        ctx.strokeStyle = palette.crack;
        ctx.beginPath();
        for (let i = 0; i < CELL_RIM.length; i += 2) {
          ctx.moveTo(px, py);
          ctx.lineTo((x + CELL_RIM[i]!) * cell, top + CELL_RIM[i + 1]! * cell);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // The rift itself, both ways from its origin: a wide glow, a gold halo, a white-hot core.
      const from = Math.max(0, crack.origin - reach);
      const to = Math.min(width, crack.origin + reach);
      if (to <= from) continue;
      ctx.beginPath();
      ctx.moveTo(from * cell, top + this.crackY(crack.path, from) * cell);
      for (let i = 0; i < crack.path.length; i += 2) {
        const px = crack.path[i]!;
        if (px > from && px < to) ctx.lineTo(px * cell, top + crack.path[i + 1]! * cell);
      }
      ctx.lineTo(to * cell, top + this.crackY(crack.path, to) * cell);
      ctx.globalAlpha = 0.3;
      ctx.strokeStyle = palette.effects.rift;
      ctx.lineWidth = cell * 0.55;
      ctx.stroke();
      ctx.globalAlpha = 0.7;
      ctx.strokeStyle = palette.accent;
      ctx.lineWidth = cell * 0.2;
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = palette.crack;
      ctx.lineWidth = Math.max(1.5, cell * 0.08);
      ctx.stroke();
    }
  }

  /** Hard drops on their way down: the piece speeds up, a streak behind it. */
  drops(effects: FallingEffects, sprites: BlockSprites, palette: TonePalette, cell: number): void {
    const { ctx } = this;
    for (const drop of effects.drops) {
      const k = Math.min(1, drop.age / drop.duration);
      const lift = drop.distance * (1 - k * k);
      const rgb = palette.color(drop.tone);
      // The streak: in each column, from where the piece left to where it is now.
      for (const cell0 of drop.cells) {
        const above = drop.cells.some((other) => other.x === cell0.x && other.y < cell0.y);
        if (above) continue;
        const from = Math.max(0, cell0.y - drop.distance) * cell;
        const now = (cell0.y - lift) * cell;
        if (now <= from) continue;
        const gradient = ctx.createLinearGradient(0, from, 0, now);
        gradient.addColorStop(0, `rgb(${rgb.r} ${rgb.g} ${rgb.b} / 0)`);
        gradient.addColorStop(1, `rgb(${rgb.r} ${rgb.g} ${rgb.b} / 0.4)`);
        ctx.fillStyle = gradient;
        ctx.fillRect(cell0.x * cell + cell * 0.18, from, cell * 0.64, now - from);
      }
      drop.cells.forEach(({ x, y }, index) => {
        const at = y - lift;
        if (at > -1) ctx.drawImage(sprites.get(drop.tone, drop.links[index]), x * cell, at * cell);
      });
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
      if (trail.age < 0) continue;
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
  overlays(
    effects: FallingEffects,
    palette: TonePalette,
    cell: number,
    dark: boolean,
    sprites?: BlockSprites,
  ): void {
    const { ctx } = this;
    for (const flash of effects.flashes) {
      if (flash.age < 0) continue;
      ctx.fillStyle = `rgb(255 255 255 / ${0.42 * (1 - flash.age / FLASH_MS)})`;
      for (const { x, y } of flash.cells) if (y >= 0) ctx.fillRect(x * cell, y * cell, cell, cell);
    }
    this.particles(effects, cell, dark, sprites);
    this.popups(effects, palette, cell);
  }

  /** The height of the crack at `x` cells along its row. */
  private crackY(path: Float32Array, x: number): number {
    const step = path[2]! - path[0]!;
    const i = Math.min(path.length / 2 - 2, Math.max(0, Math.floor(x / step)));
    const t = (x - path[i * 2]!) / step;
    return path[i * 2 + 1]! + (path[i * 2 + 3]! - path[i * 2 + 1]!) * t;
  }

  private pattern(sprite: HTMLCanvasElement): CanvasPattern | null {
    let pattern = this.patterns.get(sprite);
    if (!pattern) {
      pattern = this.ctx.createPattern(sprite, 'no-repeat') ?? undefined;
      if (!pattern) return null;
      this.patterns.set(sprite, pattern);
    }
    return pattern;
  }

  private particles(
    effects: FallingEffects,
    cell: number,
    dark: boolean,
    sprites: BlockSprites | undefined,
  ): void {
    const { ctx, matrix } = this;
    const { pool, colors } = effects;
    for (let i = 0; i < pool.count; i++) {
      const x = pool.x[i]! * cell;
      const y = pool.y[i]! * cell;
      ctx.globalAlpha = pool.alpha(i);
      const color = colors[pool.color[i]!]!;
      const kind = pool.kind[i];
      if (kind === ParticleKind.Shard) {
        const unitCos = Math.cos(pool.angle[i]!);
        const unitSin = Math.sin(pool.angle[i]!);
        const cos = unitCos * cell;
        const sin = unitSin * cell;
        const o = i * 6;
        const s = pool.shape;
        const tone = pool.texture[i]!;
        const pattern = tone >= 0 && sprites ? this.pattern(sprites.get(tone as Tone)) : null;
        if (pattern) {
          // The block's picture, turned with the shard: its centre stays under the shard's.
          const u = pool.uv[i * 2]! * cell;
          const v = pool.uv[i * 2 + 1]! * cell;
          matrix.a = unitCos;
          matrix.b = unitSin;
          matrix.c = -unitSin;
          matrix.d = unitCos;
          matrix.e = x - (u * unitCos - v * unitSin);
          matrix.f = y - (u * unitSin + v * unitCos);
          pattern.setTransform(matrix);
          ctx.fillStyle = pattern;
        } else {
          ctx.fillStyle = color;
        }
        ctx.beginPath();
        ctx.moveTo(x + s[o]! * cos - s[o + 1]! * sin, y + s[o]! * sin + s[o + 1]! * cos);
        ctx.lineTo(x + s[o + 2]! * cos - s[o + 3]! * sin, y + s[o + 2]! * sin + s[o + 3]! * cos);
        ctx.lineTo(x + s[o + 4]! * cos - s[o + 5]! * sin, y + s[o + 4]! * sin + s[o + 5]! * cos);
        ctx.closePath();
        ctx.fill();
        if (pattern) {
          // A fresh break catches the light along its edges.
          ctx.strokeStyle = 'rgb(255 255 255 / 0.3)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
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
    this.overlay.words(
      effects,
      palette,
      { cell, wellWidth: effects.width * cell },
      (popup, rise) => ({
        x: popup.x * cell,
        y: (popup.y + 0.5 - rise) * cell,
      }),
    );
  }
}

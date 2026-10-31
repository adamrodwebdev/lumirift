import { ParticleKind } from '@/fx/ParticlePool';
import { Tone } from '../pieces/PieceType';
import {
  EFFECT_TIMINGS,
  type CrackingRow,
  type FallingEffects,
  type RiftJoin,
} from '../fx/FallingEffects';
import {
  chunkPose,
  crackY,
  leakLight,
  openingLight,
  pieceLight,
  RIFT,
  riftPhase,
  seamLight,
  type ChunkPose,
  type PieceLight,
} from '../fx/RiftOpening';
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
   * The rift opening the cleared rows (1.44): it runs from where the piece
   * landed to both walls, heating the row; the row splits along it into its
   * pieces, light between them; the seam swallows them, flares and closes.
   * Several lines: the cracks join at the origin; a RIFT! opens into one
   * light. A row still waiting for a falling piece shows nothing of it yet.
   */
  cracks(effects: FallingEffects, sprites: BlockSprites, palette: TonePalette, cell: number): void {
    const { ctx } = this;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const crack of effects.cracks) {
      const top = crack.row * cell;
      if (crack.age < RIFT.runMs) {
        const waiting = crack.age < 0;
        crack.tones.forEach((tone, x) => {
          if (tone === Tone.Empty || (waiting && crack.covered.has(x))) return;
          ctx.drawImage(sprites.get(tone as Tone, crack.links[x]), x * cell, top);
        });
        if (!waiting) this.running(crack, riftPhase(crack.age).run, palette, cell);
        continue;
      }
      const phase = riftPhase(crack.age);
      const light = pieceLight(phase, crack.still);
      if (light.alpha > 0.01)
        crack.chunks.forEach((chunk, index) => {
          const pose = chunkPose(chunk, phase, crack.still);
          if (pose.scaleX > 0.01 && pose.scaleY > 0.01)
            this.chunk(crack, index, pose, { sprites, palette, top, cell, light });
        });
      const leak = leakLight(phase, crack.still);
      if (leak > 0) this.leaks(crack, leak, palette, cell);
      const seam = seamLight(phase, crack.still);
      this.riftPath(crack.path, top, cell, 0, crack.tones.length);
      this.riftStroke(palette, cell, seam.strength, seam.width);
    }
    for (const join of effects.joins)
      if (join.age >= RIFT.runMs) this.join(join, palette, cell, effects.width);
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

  /** The rift running both ways from its origin: each brick heats up as it passes. */
  private running(crack: CrackingRow, run: number, palette: TonePalette, cell: number): void {
    const { ctx } = this;
    const width = crack.tones.length;
    const top = crack.row * cell;
    const reach = run * (Math.max(crack.origin, width - crack.origin) + HEAT_SPREAD);
    ctx.fillStyle = palette.effects.rift;
    for (let x = 0; x < width; x++) {
      const lit = Math.min(1, (reach - Math.abs(x + 0.5 - crack.origin)) / HEAT_SPREAD);
      if (lit <= 0) continue;
      ctx.globalAlpha = 0.3 * lit;
      ctx.fillRect(x * cell, top, cell, cell);
    }
    const from = Math.max(0, crack.origin - reach);
    const to = Math.min(width, crack.origin + reach);
    if (to <= from) return;
    this.riftPath(crack.path, top, cell, from, to);
    this.riftStroke(palette, cell, 1, 0.07);
  }

  /**
   * One piece of a row, moved, turned and squashed about its centre: each of
   * its blocks' pictures inside its outline, the shatter style's tint over
   * it as the row splits, the rift's glow as the seam draws it in.
   */
  private chunk(
    crack: CrackingRow,
    index: number,
    pose: ChunkPose,
    at: {
      readonly sprites: BlockSprites;
      readonly palette: TonePalette;
      readonly top: number;
      readonly cell: number;
      readonly light: PieceLight;
    },
  ): void {
    const { ctx, matrix } = this;
    const { sprites, top, cell, light } = at;
    const chunk = crack.chunks[index]!;
    const px = chunk.pivotX * cell;
    const py = top + chunk.pivotY * cell;
    ctx.save();
    ctx.translate(px, py + pose.dy * cell);
    ctx.rotate(pose.turn);
    ctx.scale(pose.scaleX, pose.scaleY);
    ctx.translate(-px, -py);
    const outline = chunk.outline;
    ctx.beginPath();
    ctx.moveTo(outline[0]! * cell, top + outline[1]! * cell);
    for (let i = 2; i < outline.length; i += 2)
      ctx.lineTo(outline[i]! * cell, top + outline[i + 1]! * cell);
    ctx.closePath();
    ctx.globalAlpha = light.alpha;
    for (let x = chunk.x0; x < chunk.x1; x++) {
      const sprite = sprites.get(crack.tones[x] as Tone, crack.links[x]);
      const pattern = this.pattern(sprite);
      if (!pattern) continue;
      // The block's picture where the block was: the piece carries it as it moves.
      matrix.a = cell / sprite.width;
      matrix.b = 0;
      matrix.c = 0;
      matrix.d = cell / sprite.height;
      matrix.e = x * cell;
      matrix.f = top;
      pattern.setTransform(matrix);
      ctx.fillStyle = pattern;
      ctx.fill();
    }
    const tint = crack.tints?.[index];
    if (tint && light.tint > 0) {
      ctx.globalAlpha = light.alpha * light.tint;
      ctx.fillStyle = tint;
      ctx.fill();
    }
    if (light.glow > 0) {
      ctx.globalAlpha = light.alpha * light.glow;
      ctx.fillStyle = at.palette.effects.rift;
      ctx.fill();
    }
    ctx.restore();
  }

  /** Light between a row's pieces as it splits, down each place two pieces meet. */
  private leaks(crack: CrackingRow, light: number, palette: TonePalette, cell: number): void {
    const { ctx } = this;
    const top = crack.row * cell;
    ctx.globalAlpha = 0.85 * light;
    ctx.strokeStyle = palette.effects.riftCore;
    ctx.lineWidth = Math.max(1, cell * 0.035);
    ctx.beginPath();
    for (const x of crack.seams) {
      ctx.moveTo((x + 0.04) * cell, top + 1);
      ctx.lineTo((x - 0.05) * cell, top + crackY(crack.path, x) * cell);
      ctx.lineTo((x + 0.03) * cell, top + cell - 1);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  /**
   * The crack joining the rows of a clear of several lines, down from its
   * origin through the rows it took; a RIFT!'s rows open into one light.
   */
  private join(join: RiftJoin, palette: TonePalette, cell: number, width: number): void {
    const { ctx } = this;
    const phase = riftPhase(join.age);
    const top = join.top * cell;
    const path = join.path;
    ctx.beginPath();
    for (let i = 0; i < path.length - 1; i++) {
      if (!join.cleared[Math.floor(i / 2)]) continue;
      ctx.moveTo(path[i]! * cell, top + (i / 2) * cell);
      ctx.lineTo(path[i + 1]! * cell, top + ((i + 1) / 2) * cell);
    }
    this.riftStroke(palette, cell, phase.split * (1 - phase.close), 0.06);
    const light = join.rift && !join.still ? openingLight(join.age) : 0;
    if (light <= 0) return;
    // The opening's light, an oval over the rows, from the origin.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(join.origin * cell, top + (join.rows / 2) * cell);
    ctx.scale(width * 0.55 * cell, join.rows * 0.62 * cell);
    const lens = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    lens.addColorStop(0, palette.effects.riftCore);
    lens.addColorStop(0.45, palette.effects.rift);
    lens.addColorStop(1, 'rgb(0 0 0 / 0)');
    ctx.globalAlpha = 0.6 * light;
    ctx.fillStyle = lens;
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /** The crack's path along a row, from `from` to `to` cells. */
  private riftPath(path: Float32Array, top: number, cell: number, from: number, to: number): void {
    const { ctx } = this;
    ctx.beginPath();
    ctx.moveTo(from * cell, top + crackY(path, from) * cell);
    for (let i = 0; i < path.length; i += 2) {
      const x = path[i]!;
      if (x > from && x < to) ctx.lineTo(x * cell, top + path[i + 1]! * cell);
    }
    ctx.lineTo(to * cell, top + crackY(path, to) * cell);
  }

  /** The rift's light along the current path: a wide glow, a gold halo, a white-hot core `core` cells wide. */
  private riftStroke(palette: TonePalette, cell: number, alpha: number, core: number): void {
    if (alpha <= 0) return;
    const { ctx } = this;
    ctx.globalAlpha = 0.32 * alpha;
    ctx.strokeStyle = palette.effects.rift;
    ctx.lineWidth = cell * (core + 0.48);
    ctx.stroke();
    ctx.globalAlpha = 0.7 * alpha;
    ctx.strokeStyle = palette.accent;
    ctx.lineWidth = cell * (core + 0.13);
    ctx.stroke();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = palette.crack;
    ctx.lineWidth = Math.max(1.5, cell * core);
    ctx.stroke();
    ctx.globalAlpha = 1;
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
      if (kind === ParticleKind.Shard || kind === ParticleKind.Flake) {
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
      } else if (kind === ParticleKind.Ember) {
        ctx.globalCompositeOperation = dark ? 'lighter' : 'source-over';
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, Math.max(0.8, pool.size[i]! * cell), 0, Math.PI * 2);
        ctx.fill();
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

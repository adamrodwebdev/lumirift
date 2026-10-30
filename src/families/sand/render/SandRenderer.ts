import { Tone } from '@/core/Tone';
import { ParticleKind } from '@/fx/ParticlePool';
import { BEAM, BeamPaint, lowestBlocks } from '@/families/falling/render/LandingBeam';
import { parseHex, shade, type Rgb, type TonePalette } from '@/render/TonePalette';
import { BADGE_BREAK_MS, type SandEffects } from '../fx/SandEffects';
import { WORM_RADIUS } from '../engine/DuneWorm';
import { GRAINS_PER_CELL } from '../engine/SandGrid';
import type { SandPiece } from '../engine/SandPiece';
import type { SandView } from '../SandSession';

/** Above this share of the height, the well glows with danger. */

/**
 * Each colour of sand has its own texture, so colour never carries the
 * information alone: a checkerboard, horizontal stripes, vertical stripes, dots.
 * Dunes' hand draws its pieces with them too (1.37).
 */
export const TEXTURES: Readonly<
  Partial<Record<Tone, (x: number, y: number, frame: number) => boolean>>
> = {
  [Tone.ChromaA]: (x, y) => ((x + y) & 1) === 0,
  [Tone.ChromaB]: (_x, y) => y % 3 === 0,
  [Tone.ChromaC]: (x) => x % 3 === 0,
  [Tone.ChromaD]: (x, y) => x % 3 === 1 && y % 3 === 1,
  [Tone.Water]: (x, y, frame) => (x + y + (frame >> 2)) % 4 === 0,
  [Tone.Fire]: (x, y, frame) => (x * 7 + y * 13 + frame) % 5 === 0,
  // Oil: a slow sheen; ice: a still crystal mesh; seeds: specks; acid: bubbling;
  // the blaze flickers fast; lightning crackles.
  [Tone.Oil]: (x, y, frame) => (x * 2 + y + (frame >> 4)) % 7 === 0,
  [Tone.Ice]: (x, y) => (x + y) % 4 === 0 || (x - y + 64) % 4 === 0,
  [Tone.Seed]: (x, y) => (x * 3 + y * 5) % 7 === 0,
  [Tone.Acid]: (x, y, frame) => (x * 5 + y * 11 + (frame >> 1)) % 6 === 0,
  [Tone.Blaze]: (x, y, frame) => (x * 7 + y * 3 + frame * 3) % 4 === 0,
  [Tone.Lightning]: (x, y, frame) => (x * 3 + y * 7 + frame * 5) % 4 !== 0,
};
/** A vine (sand that holds still) shows leaf-like diagonal veins over its colour. */
const VINE_TEXTURE = (x: number, y: number) => (x + 2 * y) % 5 === 0;
/**
 * Steam is drawn as a soft cloud over the well: each grain adds to a small
 * density map (a third of the size), smoothed when scaled up; the cloud is
 * thick where steam gathers, thin at its edges, and shimmers.
 */
const FOG_SCALE = 3;
const FOG_GRAIN = 34;
const FOG_MAX = 185;

/** A theme colour lightened (amount > 0) or darkened, as CSS. */
const shadeCss = (hex: string, amount: number) => shade(parseHex(hex), amount);

const pack = ({ r, g, b }: Rgb): number => (255 << 24) | (b << 16) | (g << 8) | r;
const mix = ({ r, g, b }: Rgb, amount: number): Rgb => {
  const f = (c: number) => Math.round(amount >= 0 ? c + (255 - c) * amount : c * (1 + amount));
  return { r: f(r), g: f(g), b: f(b) };
};

/**
 * Draws the sand well pixel by pixel: one pixel per grain in a small image,
 * scaled up without smoothing, then the piece outline, particles and overlays.
 */
export class SandRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly image: HTMLCanvasElement;
  private readonly imageCtx: CanvasRenderingContext2D;
  private readonly pixels: ImageData;
  private readonly buffer: Uint32Array;
  /** Packed colours: [tone][shade 0–3][texture 0–1]. */
  private lut = new Uint32Array(32 * 8);
  private readonly fog: HTMLCanvasElement;
  private readonly fogCtx: CanvasRenderingContext2D;
  private readonly fogPixels: ImageData;
  private readonly fogBuffer: Uint32Array;
  private readonly fogDensity: Uint16Array;
  private fogColour = 0;
  /** Grains already darkened by the Guardian's shadow this frame. */
  private readonly shaded: Uint8Array;
  private background = 0;
  private palette: TonePalette | null = null;
  /** Side of a cell in device pixels; a grain is cell / GRAINS_PER_CELL. */
  private cell = 0;
  /** The player's landing guide: the landing beam since 1.43 (the setting keeps its name). */
  private ghost = true;
  private readonly beam: BeamPaint;
  /** The falling piece's lowest block per column, for the landing beam (reused). */
  private readonly lows = new Int8Array(4);
  private frame = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly view: SandView,
    private readonly effects: SandEffects,
  ) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D is not available');
    this.ctx = ctx;
    this.beam = new BeamPaint(ctx);
    const { width, height } = view.grid;
    this.image = document.createElement('canvas');
    this.image.width = width;
    this.image.height = height;
    this.imageCtx = this.image.getContext('2d')!;
    this.pixels = this.imageCtx.createImageData(width, height);
    this.buffer = new Uint32Array(this.pixels.data.buffer);
    this.fog = document.createElement('canvas');
    this.fog.width = Math.ceil(width / FOG_SCALE);
    this.fog.height = Math.ceil(height / FOG_SCALE);
    this.fogCtx = this.fog.getContext('2d')!;
    this.fogPixels = this.fogCtx.createImageData(this.fog.width, this.fog.height);
    this.fogBuffer = new Uint32Array(this.fogPixels.data.buffer);
    this.fogDensity = new Uint16Array(this.fog.width * this.fog.height);
    this.shaded = new Uint8Array(width * height);
  }

  /** Fits the well (10 × 18 cells) in the box (CSS pixels); returns the cell size. */
  layout(availableWidth: number, availableHeight: number, pixelRatio: number): number {
    const columns = this.view.grid.width / GRAINS_PER_CELL;
    const rows = this.view.grid.height / GRAINS_PER_CELL;
    const cssCell = Math.max(
      GRAINS_PER_CELL,
      Math.floor(Math.min(availableWidth / columns, availableHeight / rows)),
    );
    this.cell = Math.round(cssCell * pixelRatio);
    this.canvas.style.width = `${cssCell * columns}px`;
    this.canvas.style.height = `${cssCell * rows}px`;
    this.canvas.width = this.cell * columns;
    this.canvas.height = this.cell * rows;
    return cssCell;
  }

  setPalette(palette: TonePalette): void {
    this.palette = palette;
    this.background = pack(parseHex(palette.wellBackground));
    const steam = parseHex(palette.effects.steam);
    this.fogColour = (steam.b << 16) | (steam.g << 8) | steam.r;
    for (let tone = 1; tone <= Tone.Blaze; tone++) {
      const rgb = palette.color(tone as Tone);
      for (let shade = 0; shade < 4; shade++) {
        for (let texture = 0; texture < 2; texture++) {
          this.lut[tone * 8 + shade * 2 + texture] = pack(
            mix(rgb, (shade - 1.5) * 0.05 + texture * 0.16),
          );
        }
      }
    }
  }

  setGhost(enabled: boolean): void {
    this.ghost = enabled;
  }

  render(): void {
    const { ctx, cell, palette, effects } = this;
    if (!palette || cell === 0) return;
    this.frame++;
    this.paintGrains();
    const grain = cell / GRAINS_PER_CELL;
    const width = this.canvas.width;
    const height = this.canvas.height;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = palette.wellBackground;
    ctx.fillRect(0, 0, width, height);
    if (effects.camera.active) ctx.translate(effects.camera.x * grain, effects.camera.y * grain);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.image, 0, 0, width, height);
    this.drawFog(width, height);

    const warning = effects.hidden ? null : this.view.spawnWarning();
    if (warning) this.drawSpawnWarning(warning, grain, palette);
    const piece = this.view.active;
    if (piece) {
      if (this.ghost) this.drawBeam(piece, this.view.dropDistance(), palette, grain);
      this.outline(piece, 0, palette.accent, grain);
    }
    this.drawWind(grain, palette);
    this.drawWorm(grain, palette);
    this.drawBolts(grain);
    this.drawParticles(grain);
    this.drawPopups(grain, palette);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (effects.flash > 0) {
      ctx.fillStyle = `rgb(255 248 220 / ${(effects.flash * 0.35).toFixed(3)})`;
      ctx.fillRect(0, 0, width, height);
    }
    this.drawCombo(palette);
  }

  /**
   * Steam hides what is behind it: a soft cloud drawn over the grains (the
   * outline of the falling piece is drawn on top, so it is never hidden).
   */
  private drawFog(width: number, height: number): void {
    const { tones } = this.view.grid;
    const W = this.view.grid.width;
    const fw = this.fog.width;
    const density = this.fogDensity;
    density.fill(0);
    let any = false;
    for (let i = 0; i < tones.length; i++) {
      if (tones[i] !== Tone.Steam) continue;
      any = true;
      const fx = ((i % W) / FOG_SCALE) | 0;
      const k = ((i / W / FOG_SCALE) | 0) * fw + fx;
      // A grain thickens its spot of the map, and a little the spots around it.
      density[k] = density[k]! + FOG_GRAIN;
      for (const n of [k - 1, k + 1, k - fw, k + fw]) {
        if (n >= 0 && n < density.length) density[n] = density[n]! + (FOG_GRAIN >> 1);
      }
    }
    if (!any || this.effects.hidden) return;
    const buffer = this.fogBuffer;
    const shimmer = this.frame * 0.05;
    for (let k = 0; k < density.length; k++) {
      const d = density[k]!;
      if (d === 0) {
        buffer[k] = 0;
        continue;
      }
      const wave = 0.85 + 0.15 * Math.sin(shimmer + (k % fw) * 0.7 + ((k / fw) | 0) * 0.45);
      const alpha = Math.min(FOG_MAX, d) * wave;
      buffer[k] = ((alpha & 255) << 24) | this.fogColour;
    }
    this.fogCtx.putImageData(this.fogPixels, 0, 0);
    const { ctx } = this;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.fog, 0, 0, width, height);
    ctx.imageSmoothingEnabled = false;
  }

  /**
   * The Guardian under the sand: only its shadow, the grains above its body
   * darkening and rippling as it swims (darker when it only passes by, in a
   * teaser: there is no fight to keep readable, only a threat to show).
   */
  private paintWormShadow(): void {
    const worm = this.view.worm;
    if (!worm || worm.out || worm.state === 'dead' || this.effects.hidden) return;
    const { grid } = this.view;
    const W = grid.width;
    const passing = this.view.isTeasing;
    const reach = WORM_RADIUS + (passing ? 3 : 2);
    const [deep, light] = passing ? [0.4, 0.52] : [0.62, 0.74];
    // Each grain darkens once, however many segments of the body lie under it.
    const shaded = this.shaded;
    shaded.fill(0);
    for (let k = 0; k < worm.xs.length; k++) {
      const cx = worm.xs[k]!;
      const cy = worm.ys[k]!;
      for (
        let y = Math.max(0, Math.floor(cy - reach));
        y <= Math.min(grid.height - 1, cy + reach);
        y++
      ) {
        for (let x = Math.max(0, Math.floor(cx - reach)); x <= Math.min(W - 1, cx + reach); x++) {
          const i = y * W + x;
          if (grid.tones[i] === 0 || shaded[i] || (x - cx) ** 2 + (y - cy) ** 2 > reach * reach) {
            continue;
          }
          shaded[i] = 1;
          const ripple = ((x + y + (this.frame >> 2)) & 3) === 0;
          this.buffer[i] = this.darken(this.buffer[i]!, ripple ? deep : light);
        }
      }
    }
  }

  private darken(colour: number, keep: number): number {
    const r = (colour & 255) * keep;
    const g = ((colour >> 8) & 255) * keep;
    const b = ((colour >> 16) & 255) * keep;
    return (255 << 24) | (b << 16) | (g << 8) | r;
  }

  /**
   * The Guardian above the sand: red cracks where it is about to burst out,
   * then its body, its eyes and the glowing rift on its brow (its weak point).
   */
  private drawWorm(grain: number, palette: TonePalette): void {
    const worm = this.view.worm;
    if (!worm || worm.state === 'dead' || this.effects.hidden) return;
    const { ctx } = this;
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 90);
    const warnAt = worm.warnAt;
    if (warnAt !== null) {
      const top = worm.surfaceAt(warnAt);
      ctx.globalAlpha = 0.12 + 0.12 * pulse;
      ctx.fillStyle = palette.danger;
      ctx.fillRect((warnAt - 8) * grain, 0, 16 * grain, top * grain);
      ctx.globalAlpha = 0.5 + 0.5 * pulse;
      ctx.strokeStyle = palette.danger;
      ctx.lineWidth = Math.max(1.5, grain * 0.9);
      ctx.beginPath();
      for (const k of [-1, 0, 1]) {
        ctx.moveTo((warnAt + 0.5) * grain, top * grain);
        ctx.lineTo((warnAt + k * 6) * grain, (top + 6 + (k === 0 ? 3 : 0)) * grain);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (!worm.out) {
      // Passing by in a teaser: its eyes glow through the sand.
      if (this.view.isTeasing) this.drawBuriedEyes(worm.headX, worm.headY, grain, palette, pulse);
      return;
    }
    const hurt = this.effects.wormHurt > 0;
    // A dark hide, lighter than the well, ringed with the rift's gold.
    const body = shadeCss(palette.wellBackground, 0.22);
    const ring = shadeCss(palette.wellBackground, 0.34);
    for (let k = worm.xs.length - 1; k >= 0; k--) {
      const x = worm.xs[k]!;
      const y = worm.ys[k]!;
      // Below the surface, the body is hidden by the sand it swims in.
      if (k > 2 && y > worm.surfaceAt(x) + 2) continue;
      const r = (WORM_RADIUS + (k === 0 ? 1.2 : 0) - k * 0.06) * grain;
      ctx.fillStyle = hurt ? palette.crack : k % 2 ? body : ring;
      ctx.beginPath();
      ctx.arc((x + 0.5) * grain, (y + 0.5) * grain, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = palette.accent;
      ctx.lineWidth = Math.max(1, grain * 0.25);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    const hx = worm.headX;
    const hy = worm.headY;
    // The weak point: a rift glowing on its brow, brighter while it is bare.
    ctx.globalAlpha = worm.exposed ? 0.6 + 0.4 * pulse : 0.35;
    ctx.fillStyle = palette.accent;
    ctx.beginPath();
    ctx.arc((hx + 0.5) * grain, (hy - 1.2) * grain, grain * 1.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = palette.crack;
    for (const ex of [-1.6, 1.6]) {
      ctx.beginPath();
      ctx.arc((hx + 0.5 + ex) * grain, (hy + 0.8) * grain, grain * 0.7, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /** Two red eyes under the sand, each in a halo, pulsing. */
  private drawBuriedEyes(
    hx: number,
    hy: number,
    grain: number,
    palette: TonePalette,
    pulse: number,
  ): void {
    const { ctx } = this;
    for (const ex of [-1.6, 1.6]) {
      const x = (hx + 0.5 + ex) * grain;
      const y = (hy + 0.8) * grain;
      ctx.globalAlpha = 0.18 + 0.14 * pulse;
      ctx.fillStyle = palette.danger;
      ctx.beginPath();
      ctx.arc(x, y, grain * 2.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.7 + 0.3 * pulse;
      ctx.fillStyle = palette.crack;
      ctx.beginPath();
      ctx.arc(x, y, grain * 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /** Lightning bolts: a bright jagged line that fades. */
  private drawBolts(grain: number): void {
    const { ctx, effects } = this;
    if (effects.bolts.length === 0) return;
    const colour = this.palette?.color(Tone.Lightning);
    const rgb = colour ? `${colour.r} ${colour.g} ${colour.b}` : '255 242 160';
    for (const bolt of effects.bolts) {
      const fade = 1 - effects.boltProgress(bolt);
      ctx.lineJoin = 'round';
      for (const [width, alpha] of [
        [grain * 3.2, 0.25],
        [grain * 1.1, 1],
      ] as const) {
        ctx.strokeStyle = `rgb(${rgb} / ${(alpha * fade).toFixed(3)})`;
        ctx.lineWidth = Math.max(1, width);
        ctx.beginPath();
        bolt.points.forEach(([x, y], k) =>
          k === 0 ? ctx.moveTo(x * grain, y * grain) : ctx.lineTo(x * grain, y * grain),
        );
        ctx.stroke();
      }
    }
  }

  /** Grains and the falling piece into the small image, one pixel each. */
  private paintGrains(): void {
    const { grid, active } = this.view;
    const { tones, grain } = grid;
    const W = grid.width;
    const buffer = this.buffer;
    const hidden = this.effects.hidden;
    const fixed = grid.fixed;
    for (let i = 0; i < tones.length; i++) {
      const tone = tones[i]!;
      if (tone === 0 || tone === Tone.Steam || hidden) {
        buffer[i] = this.background;
        continue;
      }
      const x = i % W;
      const y = (i / W) | 0;
      buffer[i] = fixed[i]
        ? this.lut[tone * 8 + grain[i]! * 2 + (VINE_TEXTURE(x, y) ? 1 : 0)]!
        : this.colour(tone, grain[i]!, x, y);
    }
    this.paintWormShadow();
    const target = hidden ? null : this.view.elementTarget();
    if (target) {
      // What the falling fire would burn, or the lightning strike, flickers in its colour.
      const lightning = active?.tone === Tone.Lightning;
      const mark = lightning ? Tone.Lightning : Tone.Fire;
      // Lightning marks every other grain: what it would break must be unmistakable.
      const every = lightning ? 1 : 3;
      for (const i of target) {
        if (((i * 7 + (this.frame >> 2)) & every) === 0) {
          buffer[i] = this.colour(mark, 3, i % W, (i / W) | 0);
        }
      }
    }
    if (active && !hidden) {
      const g = GRAINS_PER_CELL;
      for (const cell of active.localCells) {
        for (let y = 0; y < g; y++) {
          for (let x = 0; x < g; x++) {
            const gx = active.x + cell.x * g + x;
            const gy = active.y + cell.y * g + y;
            if (gx < 0 || gy < 0 || gx >= W || gy >= grid.height) continue;
            buffer[gy * W + gx] = this.colour(active.tone, (x * 3 + y) & 3, gx, gy);
          }
        }
      }
    }
    this.imageCtx.putImageData(this.pixels, 0, 0);
  }

  private colour(tone: number, shade: number, x: number, y: number): number {
    const texture = TEXTURES[tone as Tone]?.(x, y, this.frame) ? 1 : 0;
    return this.lut[tone * 8 + shade * 2 + texture]!;
  }

  /** The outline of a piece (or of where it would land). */
  /**
   * The combo badge, top right of the well: a ring that runs dry, and what
   * the next clear would score with (red, pulsing, when nearly dry).
   */
  private drawCombo(palette: TonePalette): void {
    const combo = this.view.comboGauge;
    if (this.effects.hidden) return;
    if (combo.fill <= 0) {
      this.drawBrokenBadge(palette);
      return;
    }
    const { ctx, cell, canvas } = this;
    // A notch bigger at each step (1.41), where things may move.
    const grow = this.effects.motion ? Math.min(1.4, 1 + 0.06 * Math.max(0, combo.next - 2)) : 1;
    const radius = cell * 1.25 * grow;
    const x = canvas.width - cell * 1.9;
    const y = cell * 1.9;
    const low = combo.fill < 0.3;
    const color = low ? palette.danger : palette.accent;
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(2, cell * 0.22);
    ctx.globalAlpha = 0.4;
    ctx.strokeStyle = palette.wellGrid;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha =
      low && this.effects.motion ? 0.65 + 0.35 * Math.sin(performance.now() / 90) : 1;
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * combo.fill);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.font = `900 ${Math.round(cell * 0.85 * grow)}px ui-rounded, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`×${combo.next}`, x, y + cell * 0.04);
    ctx.globalAlpha = 1;
    ctx.lineCap = 'butt';
  }

  /** A combo of ×3 or more just broke (1.41): its badge splits and fades away. */
  private drawBrokenBadge(palette: TonePalette): void {
    const broken = this.effects.badgeBreak;
    if (!broken) return;
    const { ctx, cell, canvas } = this;
    const t = broken.age / BADGE_BREAK_MS;
    const x = canvas.width - cell * 1.9;
    const y = cell * 1.9;
    const radius = cell * 1.25;
    const apart = cell * 0.3 * t;
    ctx.globalAlpha = 1 - t;
    ctx.strokeStyle = palette.danger;
    ctx.fillStyle = palette.danger;
    ctx.lineWidth = Math.max(2, cell * 0.22);
    ctx.font = `900 ${Math.round(cell * 0.85)}px ui-rounded, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // The two halves drift apart, a crack between them.
    for (const side of [-1, 1] as const) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(side < 0 ? 0 : x, 0, side < 0 ? x : canvas.width - x, canvas.height);
      ctx.clip();
      ctx.translate(side * apart, side * apart * 0.4);
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillText(`×${broken.multiplier}`, x, y + cell * 0.04);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  /** The next piece in red where it would appear, when the sand leaves it no room to enter. */
  private drawSpawnWarning(piece: SandPiece, grain: number, palette: TonePalette): void {
    const { ctx } = this;
    const g = GRAINS_PER_CELL;
    const pulse = this.effects.motion ? 0.5 + 0.5 * Math.sin(performance.now() / 120) : 0.5;
    ctx.fillStyle = palette.danger;
    ctx.globalAlpha = 0.26 + 0.26 * pulse;
    for (const cell of piece.localCells) {
      ctx.fillRect(
        (piece.x + cell.x * g) * grain,
        (piece.y + cell.y * g) * grain,
        g * grain,
        g * grain,
      );
    }
    ctx.globalAlpha = 1;
    this.outline(piece, 0, palette.danger, grain);
    ctx.globalAlpha = 1;
  }

  /** The landing beam (1.43): from each column of the piece, light down to where it will rest. */
  private drawBeam(piece: SandPiece, dy: number, palette: TonePalette, grain: number): void {
    if (dy <= 0) return;
    const { ctx, beam } = this;
    const g = GRAINS_PER_CELL;
    const cell = g * grain;
    const rgb = palette.color(piece.tone);
    const { glow, core } = beam.cap(piece.tone, rgb);
    const lows = lowestBlocks(piece.localCells, this.lows);
    for (let local = 0; local < lows.length; local++) {
      const low = lows[local]!;
      if (low < 0) continue;
      const x = (piece.x + local * g) * grain;
      const top = (piece.y + (low + 1) * g) * grain;
      const bottom = top + dy * grain;
      ctx.save();
      ctx.translate(x, top);
      ctx.scale(cell, bottom - top);
      beam.fillShaft(piece.tone, rgb);
      ctx.restore();
      const inset = ((1 - BEAM.cap) / 2) * cell;
      const thick = Math.max(2, cell * 0.08);
      ctx.fillStyle = glow;
      ctx.fillRect(x + inset * 0.6, bottom - thick * 2, cell - inset * 1.2, thick * 3);
      ctx.fillStyle = core;
      ctx.fillRect(x + inset, bottom - thick * 1.25, cell - inset * 2, thick);
    }
  }

  private outline(piece: SandPiece, dy: number, color: string, grain: number): void {
    const { ctx } = this;
    const g = GRAINS_PER_CELL;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1, grain * 0.6);
    for (const cell of piece.localCells) {
      ctx.strokeRect(
        (piece.x + cell.x * g) * grain,
        (piece.y + dy + cell.y * g) * grain,
        g * grain,
        g * grain,
      );
    }
  }

  private drawWind(grain: number, palette: TonePalette): void {
    const direction = this.effects.wind;
    if (direction === 0) return;
    const { ctx } = this;
    const width = this.canvas.width;
    ctx.strokeStyle = palette.accent;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = Math.max(1, grain * 0.5);
    ctx.beginPath();
    for (let k = 0; k < 14; k++) {
      const y = ((k * 53) % this.view.grid.height) * grain;
      const travel = ((this.frame * 9 + k * 97) % (width + 200)) - 100;
      const x = direction > 0 ? travel : width - travel;
      ctx.moveTo(x, y);
      ctx.lineTo(x - direction * grain * 14, y);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  private drawParticles(grain: number): void {
    const { ctx, effects } = this;
    const { pool, colors } = effects;
    for (let i = 0; i < pool.count; i++) {
      ctx.globalAlpha = pool.alpha(i);
      const x = pool.x[i]! * grain;
      const y = pool.y[i]! * grain;
      if (pool.kind[i] === ParticleKind.Spark) {
        ctx.strokeStyle = colors[pool.color[i]!]!;
        ctx.lineWidth = Math.max(1, grain * 0.7);
        ctx.beginPath();
        ctx.moveTo(x - pool.vx[i]! * grain * 0.02, y - pool.vy[i]! * grain * 0.02);
        ctx.lineTo(x, y);
        ctx.stroke();
      } else {
        const size = pool.size[i]! * grain;
        ctx.fillStyle = colors[pool.color[i]!]!;
        ctx.fillRect(x - size / 2, y - size / 2, size, size);
      }
    }
    ctx.globalAlpha = 1;
  }

  private drawPopups(grain: number, palette: TonePalette): void {
    const { ctx, effects } = this;
    if (effects.popups.length === 0) return;
    ctx.font = `800 ${Math.round(grain * GRAINS_PER_CELL * 0.75)}px ui-rounded, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = Math.max(2, grain * 0.8);
    ctx.strokeStyle = palette.wellBackground;
    ctx.fillStyle = palette.accent;
    for (const popup of effects.popups) {
      const t = effects.popupProgress(popup);
      ctx.globalAlpha = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
      const y = (popup.y - t * 10) * grain;
      ctx.strokeText(popup.text, popup.x * grain, y);
      ctx.fillText(popup.text, popup.x * grain, y);
    }
    ctx.globalAlpha = 1;
  }
}

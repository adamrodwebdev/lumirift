import { Tone } from '@/core/Tone';
import { ParticleKind } from '@/fx/ParticlePool';
import { parseHex, type Rgb, type TonePalette } from '@/render/TonePalette';
import type { SandEffects } from '../fx/SandEffects';
import { GRAINS_PER_CELL } from '../engine/SandGrid';
import type { SandPiece } from '../engine/SandPiece';
import type { SandView } from '../SandSession';

/** Above this share of the height, the well glows with danger. */
const DANGER_HEIGHT = 0.7;

/**
 * Each colour of sand has its own texture, so colour never carries the
 * information alone: a checkerboard, horizontal stripes, vertical stripes, dots.
 */
const TEXTURES: Readonly<Partial<Record<Tone, (x: number, y: number, frame: number) => boolean>>> =
  {
    [Tone.ChromaA]: (x, y) => ((x + y) & 1) === 0,
    [Tone.ChromaB]: (_x, y) => y % 3 === 0,
    [Tone.ChromaC]: (x) => x % 3 === 0,
    [Tone.ChromaD]: (x, y) => x % 3 === 1 && y % 3 === 1,
    [Tone.Water]: (x, y, frame) => (x + y + (frame >> 2)) % 4 === 0,
    [Tone.Fire]: (x, y, frame) => (x * 7 + y * 13 + frame) % 5 === 0,
  };

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
  private lut = new Uint32Array(16 * 8);
  private background = 0;
  private palette: TonePalette | null = null;
  /** Side of a cell in device pixels; a grain is cell / GRAINS_PER_CELL. */
  private cell = 0;
  private ghost = true;
  private frame = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly view: SandView,
    private readonly effects: SandEffects,
  ) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D is not available');
    this.ctx = ctx;
    const { width, height } = view.grid;
    this.image = document.createElement('canvas');
    this.image.width = width;
    this.image.height = height;
    this.imageCtx = this.image.getContext('2d')!;
    this.pixels = this.imageCtx.createImageData(width, height);
    this.buffer = new Uint32Array(this.pixels.data.buffer);
  }

  /** Fits the 10 × 20 cell well in the box (CSS pixels); returns the cell size. */
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
    for (let tone = 1; tone <= 14; tone++) {
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
    if (effects.shake.active) ctx.translate(effects.shake.x * grain, effects.shake.y * grain);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.image, 0, 0, width, height);

    const piece = this.view.active;
    if (piece) {
      if (this.ghost) this.outline(piece, this.view.dropDistance(), palette.wellGrid, grain);
      this.outline(piece, 0, palette.accent, grain);
    }
    this.drawWind(grain, palette);
    this.drawParticles(grain);
    this.drawPopups(grain, palette);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.drawDanger(palette);
  }

  /** Grains and the falling piece into the small image, one pixel each. */
  private paintGrains(): void {
    const { grid, active } = this.view;
    const { tones, grain } = grid;
    const W = grid.width;
    const buffer = this.buffer;
    const hidden = this.effects.hidden;
    for (let i = 0; i < tones.length; i++) {
      const tone = tones[i]!;
      buffer[i] =
        tone === 0 || hidden ? this.background : this.colour(tone, grain[i]!, i % W, (i / W) | 0);
    }
    const target = hidden ? null : this.view.fireTarget();
    if (target) {
      for (const i of target) {
        if (((i * 7 + (this.frame >> 2)) & 3) === 0) {
          buffer[i] = this.colour(Tone.Fire, 3, i % W, (i / W) | 0);
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

  private drawDanger(palette: TonePalette): void {
    if (this.effects.hidden) return;
    if (this.view.grid.sandHeight() < this.view.grid.height * DANGER_HEIGHT) return;
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
}

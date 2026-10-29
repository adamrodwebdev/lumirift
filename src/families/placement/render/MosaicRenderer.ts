import { Tone } from '@/core/Tone';
import { ParticleKind } from '@/fx/ParticlePool';
import type { TonePalette } from '@/render/TonePalette';
import {
  BREAK_MS,
  FLIGHT_MS,
  GOLEM_EYES,
  MOSAIC_TIMINGS,
  PARRY_MS,
  type MosaicEffects,
} from '../fx/MosaicEffects';
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

/** The lines of the Golem's face, in cells. */
const GOLEM_MASK: readonly (readonly (readonly [number, number])[])[] = [
  [
    [1.2, 1.7],
    [2.6, 1.2],
    [3.7, 1.6],
    [4, 2],
    [4.3, 1.6],
    [5.4, 1.2],
    [6.8, 1.7],
  ],
  [
    [1.4, 3.6],
    [2.4, 4.2],
    [3.4, 4],
  ],
  [
    [6.6, 3.6],
    [5.6, 4.2],
    [4.6, 4],
  ],
  [
    [2.5, 5.7],
    [3.3, 5.4],
    [4, 5.6],
    [4.7, 5.4],
    [5.5, 5.7],
  ],
  [
    [4, 2.6],
    [3.8, 3.4],
    [4.2, 4.2],
  ],
];
const CROSSHAIR = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

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
    // Same size: nothing to do (resizing a canvas clears it).
    if (
      Math.round(cssCell * pixelRatio) === this.cell &&
      this.canvas.style.width === `${cssCell * size}px`
    ) {
      return cssCell;
    }
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
    if (effects.camera.active) ctx.translate(effects.camera.x * cell, effects.camera.y * cell);

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

    this.drawGolem(palette);
    this.drawLines(overlay, palette);

    if (!effects.boardHidden) {
      for (let y = 0; y < grid.size; y++) {
        for (let x = 0; x < grid.size; x++) {
          const tone = grid.get(x, y);
          if (tone === Tone.Empty || effects.inFlight(x, y)) continue;
          const scale = effects.popScale(x, y);
          this.drawTile(sprites.get(tone), x, y, scale);
          const glow = effects.popGlow(x, y);
          if (glow > 0) this.drawGlow(x, y, scale, glow);
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

    this.drawTargets(palette);
    this.drawFlights(sprites);
    this.drawParries(palette);
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

  /** A tile just set down shines, then its light fades. */
  private drawGlow(x: number, y: number, scale: number, alpha: number): void {
    const { ctx, cell } = this;
    const size = cell * scale * 0.84;
    ctx.fillStyle = `rgb(255 255 255 / ${alpha})`;
    ctx.beginPath();
    ctx.roundRect(
      x * cell + (cell - size) / 2,
      y * cell + (cell - size) / 2,
      size,
      size,
      cell * 0.16 * scale,
    );
    ctx.fill();
  }

  /**
   * The Ceramic Golem: its face is the board, seen through the empty sockets
   * (the tiles are its armour). Its eyes burn amber, then hotter by phase,
   * flash white when hurt and go dark when it falls.
   */
  private drawGolem(palette: TonePalette): void {
    const golem = this.view.golem;
    if (!golem) return;
    const { ctx, cell } = this;
    // The mask: brow, cheekbones, the slit of the mouth, a crack of age, all
    // mended with gold (kintsugi), a dark groove under a gold seam.
    const [, gold = palette.accent] = palette.effects.gold;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const [colour, width, alpha] of [
      [palette.wellBackground, 0.2, 0.9],
      [gold, 0.08, golem.defeated ? 0.3 : 0.7],
    ] as const) {
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = colour;
      ctx.lineWidth = Math.max(2, cell * width);
      for (const points of GOLEM_MASK) {
        ctx.beginPath();
        points.forEach(([x, y], i) =>
          i === 0 ? ctx.moveTo(x * cell, y * cell) : ctx.lineTo(x * cell, y * cell),
        );
        ctx.stroke();
      }
    }
    ctx.restore();

    const hurt = this.effects.golemHurt > 0;
    const colour = golem.defeated
      ? palette.wellGrid
      : hurt
        ? 'rgb(255 255 255)'
        : golem.phase === 1
          ? palette.accent
          : palette.danger;
    const pulse = 0.8 + 0.2 * Math.sin(performance.now() / (golem.phase === 3 ? 90 : 260));
    for (const eye of GOLEM_EYES) {
      const x = eye.x * cell;
      const y = eye.y * cell;
      if (!golem.defeated) {
        const glow = ctx.createRadialGradient(x, y, 0, x, y, cell * 1.2);
        glow.addColorStop(0, colour);
        glow.addColorStop(1, 'rgb(0 0 0 / 0)');
        ctx.globalAlpha = 0.45 * pulse;
        ctx.fillStyle = glow;
        ctx.fillRect(x - cell * 1.2, y - cell * 1.2, cell * 2.4, cell * 2.4);
      }
      // An almond eye, narrower as it angers, with a dark slit of a pupil.
      const w = cell * 0.5;
      const h = cell * (golem.phase === 1 ? 0.3 : golem.phase === 2 ? 0.24 : 0.17);
      ctx.globalAlpha = golem.defeated ? 0.6 : pulse;
      ctx.fillStyle = colour;
      ctx.beginPath();
      ctx.moveTo(x - w, y);
      ctx.quadraticCurveTo(x, y - h * 2, x + w, y);
      ctx.quadraticCurveTo(x, y + h * 2, x - w, y);
      ctx.fill();
      if (!golem.defeated) {
        ctx.globalAlpha = 0.75;
        ctx.fillStyle = palette.wellBackground;
        ctx.beginPath();
        ctx.ellipse(x, y, cell * 0.07, h * 0.8, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  /** The cells the Golem aims at: a pulsing crosshair, with the placements left before it throws. */
  private drawTargets(palette: TonePalette): void {
    const golem = this.view.golem;
    if (!golem || golem.defeated || golem.targets.length === 0) return;
    const { ctx, cell } = this;
    const urgent = golem.countdown <= 1;
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / (urgent ? 110 : 240));
    ctx.save();
    ctx.strokeStyle = palette.danger;
    ctx.fillStyle = palette.danger;
    ctx.lineWidth = Math.max(2, cell * 0.08);
    ctx.font = `800 ${Math.round(cell * 0.32)}px ui-rounded, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const { x, y } of golem.targets) {
      const cx = (x + 0.5) * cell;
      const cy = (y + 0.5) * cell;
      ctx.globalAlpha = 0.18 + 0.22 * pulse;
      ctx.fillRect(x * cell + cell * 0.08, y * cell + cell * 0.08, cell * 0.84, cell * 0.84);
      ctx.globalAlpha = 0.65 + 0.35 * pulse;
      const r = cell * (0.3 + 0.04 * pulse);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
      for (const [dx, dy] of CROSSHAIR) {
        ctx.beginPath();
        ctx.moveTo(cx + dx * r * 0.55, cy + dy * r * 0.55);
        ctx.lineTo(cx + dx * r * 1.3, cy + dy * r * 1.3);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.fillText(String(golem.countdown), x * cell + cell * 0.8, y * cell + cell * 0.2);
    }
    ctx.restore();
  }

  /** Stones in the air, on an arc from the Golem's eyes, growing as they come. */
  private drawFlights(sprites: CeramicSprites): void {
    const { ctx, cell, effects } = this;
    const sprite = sprites.get(Tone.Stone);
    for (const flight of effects.flights) {
      if (flight.age < flight.delay) continue;
      const t = Math.min(1, (flight.age - flight.delay) / FLIGHT_MS);
      const x = flight.from.x + (flight.x + 0.5 - flight.from.x) * t;
      const y = flight.from.y + (flight.y + 0.5 - flight.from.y) * t - 1.6 * Math.sin(Math.PI * t);
      const size = cell * (0.45 + 0.55 * t);
      ctx.drawImage(sprite, x * cell - size / 2, y * cell - size / 2, size, size);
    }
  }

  /** A parried stone: a ring of light spreading from the cell. */
  private drawParries(palette: TonePalette): void {
    const { ctx, cell, effects } = this;
    if (effects.parries.length === 0) return;
    ctx.strokeStyle = palette.accent;
    ctx.lineWidth = Math.max(2, cell * 0.1);
    for (const parry of effects.parries) {
      const t = parry.age / PARRY_MS;
      ctx.globalAlpha = 1 - t;
      ctx.beginPath();
      ctx.arc(
        (parry.x + 0.5) * cell,
        (parry.y + 0.5) * cell,
        cell * (0.3 + 0.9 * t),
        0,
        Math.PI * 2,
      );
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
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
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = Math.max(2, cell * 0.1);
    ctx.strokeStyle = palette.wellBackground;
    for (const popup of effects.popups) {
      const t = popup.age / MOSAIC_TIMINGS.POPUP_MS;
      // The streak's word and shout (1.41): bolder, in their heat, glowing.
      const word = popup.kind === 'label' || popup.kind === 'shout';
      const size = popup.size ?? (popup.kind === 'shout' ? 0.75 : 0.6);
      ctx.font = `${word ? 900 : 800} ${Math.round(cell * size)}px ui-rounded, system-ui, sans-serif`;
      ctx.globalAlpha = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
      const y = (popup.y - t * (word ? 0.8 : 1.4)) * cell;
      ctx.strokeText(popup.text, popup.x * cell, y);
      const heat = popup.heat ? palette.effects.heat[popup.heat] : null;
      if (heat) {
        ctx.shadowColor = heat;
        ctx.shadowBlur = cell * 0.6;
      }
      ctx.fillStyle = heat ?? palette.accent;
      ctx.fillText(popup.text, popup.x * cell, y);
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;
  }

  private rebuild(): void {
    this.sprites =
      this.palette && this.cell > 0 ? new CeramicSprites(this.cell, this.palette) : null;
  }
}

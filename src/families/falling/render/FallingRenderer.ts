import type { FallingView } from '../FallingSession';
import type { FallingEffects } from '../fx/FallingEffects';
import type { Piece } from '../pieces/Piece';
import { Tone } from '../pieces/PieceType';
import type { MaterialId } from '@/progression/Cosmetics';
import type { BlockSprites } from './BlockSprites';
import { blockSprites } from './materials';
import { EffectsPainter } from './EffectsPainter';
import { BEAM, BeamPaint, lowestBlocks } from './LandingBeam';
import type { TonePalette } from '@/render/TonePalette';
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
  private readonly beam: BeamPaint;
  /** The falling piece's lowest block per column, for the landing beam (reused). */
  private readonly lows = new Int8Array(4);
  private sprites: BlockSprites | null = null;
  private material: MaterialId = 'crystal';
  private palette: TonePalette | null = null;
  private effects: FallingEffects | null = null;
  private decor: WellDecor | null = null;
  private animated = true;
  /** Cell side in device pixels. */
  private cell = 0;
  /** The player's landing guide: the landing beam since 1.43 (the setting keeps its name). */
  private ghost = true;
  private dark = true;

  private dangerEdge = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly view: FallingView,
  ) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D is not available');
    this.ctx = ctx;
    this.painter = new EffectsPainter(ctx);
    this.beam = new BeamPaint(ctx);
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

  /** The player's block material. */
  setMaterial(material: MaterialId): void {
    if (material === this.material) return;
    this.material = material;
    this.rebuildSprites();
  }

  /**
   * The red edges of a well in danger. The game screen shows the player's
   * danger itself (cracks, vignette); a well watched from aside, the duel's
   * opponent, wears them.
   */
  setDangerEdge(enabled: boolean): void {
    this.dangerEdge = enabled;
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
    if (effects?.camera.active) {
      // The camera: its offset, and its tilt around the well's centre (1.41). A tilt that
      // moves the corners by less than half a pixel is not drawn, and the offset stays on
      // whole pixels meanwhile: the blocks keep their sharp, cheap copy.
      const { x, y, angle } = effects.camera;
      if (Math.abs(angle) * Math.hypot(width, height) < 1) {
        ctx.translate(Math.round(x * cell), Math.round(y * cell));
      } else {
        ctx.translate(width / 2 + x * cell, height / 2 + y * cell);
        ctx.rotate(angle);
        ctx.translate(-width / 2, -height / 2);
      }
    }
    this.drawGrid(palette.wellGrid);
    this.decor?.drawBehind?.(ctx, this.view, palette, cell, this.animated ? performance.now() : 0);

    if (!effects?.stackHidden) {
      // A hard-dropped piece is drawn falling until it lands, not in the stack.
      const covered = effects?.coveredCells() ?? null;
      const squash = effects?.squash ?? null;
      for (let y = hidden; y < board.height; y++) {
        const shift = (effects?.rowOffset[y] ?? 0) + (effects?.rowDip[y] ?? 0);
        const top = (y - hidden + shift) * cell;
        for (let x = 0; x < board.width; x++) {
          const tone = board.get(x, y);
          const index = y * board.width + x;
          if (tone === 0 || covered?.has(index)) continue;
          const height = squash?.get(index);
          // The blocks of one piece are drawn as one crystal (1.43).
          const sprite = sprites.get(tone, board.links(x, y));
          if (height === undefined) {
            ctx.drawImage(sprite, x * cell, top);
          } else {
            // A landed block squashes on its base, a little wider (1.41).
            const wide = 1 + (1 - height) / 2;
            ctx.drawImage(
              sprite,
              (x + (1 - wide) / 2) * cell,
              top + (1 - height) * cell,
              wide * cell,
              height * cell,
            );
          }
        }
      }
    }
    if (!effects?.stackHidden) this.drawStone(palette);
    this.decor?.draw(ctx, this.view, palette, cell, this.animated ? performance.now() : 0);
    if (effects) {
      this.painter.cracks(effects, sprites, palette, cell);
      this.painter.underlays(effects, palette, this.columns, this.rows, cell);
      this.painter.drops(effects, sprites, palette, cell);
    }

    this.drawSpawnWarning(palette);
    const active = this.view.active;
    if (active) {
      if (this.ghost) this.drawBeam(active, this.view.dropDistance(), palette);
      this.drawPiece(active, 0);
    }

    if (effects) this.painter.overlays(effects, palette, cell, this.dark, sprites);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (this.dangerEdge) this.drawDanger(palette);
    if (effects) this.painter.overlay.heat(effects, palette, cell);
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
    if (effects) this.painter.overlay.riftLight(effects);
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

  /**
   * The next piece in red where it would appear, when the well has no room
   * left for it to enter: the last warning before the end.
   */
  private drawSpawnWarning(palette: TonePalette): void {
    if (this.effects?.stackHidden) return;
    const cells = this.view.spawnWarning();
    if (!cells) return;
    const { ctx, cell } = this;
    let top = Number.POSITIVE_INFINITY;
    for (const at of cells) top = Math.min(top, at.y);
    const pulse = this.effects?.motion ? 0.5 + 0.5 * Math.sin(performance.now() / 120) : 0.5;
    const line = Math.max(2, cell * 0.12);
    ctx.fillStyle = palette.danger;
    ctx.strokeStyle = palette.danger;
    ctx.lineWidth = line;
    for (const at of cells) {
      const x = at.x * cell;
      const y = (at.y - top) * cell;
      ctx.globalAlpha = 0.28 + 0.27 * pulse;
      ctx.fillRect(x, y, cell, cell);
      ctx.globalAlpha = 1;
      ctx.strokeRect(x + line / 2, y + line / 2, cell - line, cell - line);
    }
    ctx.globalAlpha = 1;
  }

  /** A pulsing glow on the well's edges when the stack nears the top (the duel's other well). */
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

  /**
   * Rift stone (1.43): a crack along each slab of garbage, and in an attack row's gap a
   * vein of light, so the way through reads before the player aims. The crack's shape
   * comes from the row's gap, so that it stays the same while the row rises.
   */
  private drawStone(palette: TonePalette): void {
    const { ctx, cell, effects } = this;
    const { board } = this.view;
    const hidden = board.hiddenRows;
    const { stone, rift, riftCore } = palette.effects;
    for (let y = hidden; y < board.height; y++) {
      let stones = 0;
      let empties = 0;
      let gap = -1;
      for (let x = 0; x < board.width; x++) {
        const tone = board.get(x, y);
        if (tone === Tone.Garbage) stones++;
        else if (tone === Tone.Empty) {
          empties++;
          gap = x;
        }
      }
      if (stones === 0) continue;
      const shift = (effects?.rowOffset[y] ?? 0) + (effects?.rowDip[y] ?? 0);
      const top = (y - hidden + shift) * cell;
      const seed = gap + 1;
      ctx.strokeStyle = stone.crack;
      ctx.lineWidth = Math.max(1, cell * 0.045);
      ctx.lineJoin = 'round';
      ctx.beginPath();
      let drawing = false;
      for (let x = 0; x < board.width; x++) {
        if (board.get(x, y) !== Tone.Garbage) {
          drawing = false;
          continue;
        }
        const from = top + cell * (0.35 + 0.3 * jitter(seed, x));
        const to = top + cell * (0.35 + 0.3 * jitter(seed, x + 1));
        if (!drawing) ctx.moveTo(x * cell + cell * 0.12, from);
        ctx.lineTo((x + 0.5) * cell, top + cell * (0.3 + 0.4 * jitter(x, seed)));
        ctx.lineTo(
          (x + 1) * cell -
            (x + 1 < board.width && board.get(x + 1, y) === Tone.Garbage ? 0 : cell * 0.12),
          to,
        );
        drawing = true;
      }
      ctx.stroke();
      if (empties === 1 && stones === board.width - 1)
        this.drawVein(gap, top, rift, riftCore, seed);
    }
  }

  /** The vein of light in an attack row's gap: a glow, then a bright jagged core. */
  private drawVein(x: number, top: number, glow: string, core: string, seed: number): void {
    const { ctx, cell } = this;
    const middle = (x + 0.5) * cell;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const [colour, width, alpha] of [
      [glow, cell * 0.34, 0.28],
      [glow, cell * 0.16, 0.5],
      [core, Math.max(1.5, cell * 0.06), 1],
    ] as const) {
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = colour;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(middle, top + cell * 0.04);
      for (let k = 1; k <= 4; k++) {
        const sway = k === 4 ? 0 : (jitter(seed, k) - 0.5) * cell * 0.18;
        ctx.lineTo(middle + sway, top + (cell * k) / 4 - (k === 4 ? cell * 0.04 : 0));
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  /** The landing beam (1.43): light from each column of the piece down to where it will rest. */
  private drawBeam(piece: Piece, distance: number, palette: TonePalette): void {
    if (distance === 0) return;
    const { ctx, cell, beam } = this;
    const hidden = this.view.board.hiddenRows;
    const rgb = palette.color(piece.tone);
    const shaft = beam.shaft(piece.tone, rgb);
    const { glow, core } = beam.cap(piece.tone, rgb);
    const lows = lowestBlocks(piece.localCells, this.lows);
    for (let local = 0; local < lows.length; local++) {
      const low = lows[local]!;
      if (low < 0) continue;
      const x = (piece.x + local) * cell;
      const top = (piece.y + low + 1 - hidden) * cell;
      const bottom = top + distance * cell;
      ctx.save();
      ctx.translate(x, top);
      ctx.scale(cell, bottom - top);
      ctx.fillStyle = shaft;
      ctx.fillRect((1 - BEAM.width) / 2, 0, BEAM.width, 1);
      ctx.restore();
      const inset = ((1 - BEAM.cap) / 2) * cell;
      const thick = Math.max(2, cell * 0.08);
      ctx.fillStyle = glow;
      ctx.fillRect(x + inset * 0.6, bottom - thick * 2, cell - inset * 1.2, thick * 3);
      ctx.fillStyle = core;
      ctx.fillRect(x + inset, bottom - thick * 1.25, cell - inset * 2, thick);
    }
  }

  private drawPiece(piece: Piece, dy: number): void {
    const { ctx, cell, sprites } = this;
    if (!sprites) return;
    const hidden = this.view.board.hiddenRows;
    const links = piece.links;
    piece.localCells.forEach((local, index) => {
      const y = piece.y + local.y + dy - hidden;
      if (y < 0) return;
      ctx.drawImage(sprites.get(piece.tone, links[index]), (piece.x + local.x) * cell, y * cell);
    });
  }

  private rebuildSprites(): void {
    this.sprites =
      this.palette && this.cell > 0 ? blockSprites(this.material, this.cell, this.palette) : null;
  }
}

/** A steady pseudo-random number in [0, 1) for two integers: cracks keep their shape. */
function jitter(a: number, b: number): number {
  const value = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

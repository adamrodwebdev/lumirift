import { Tone } from '@/core/Tone';
import { blockSprites } from '@/families/falling/render/materials';
import type { BlockSprites } from '@/families/falling/render/BlockSprites';
import type { MaterialId, ShatterId } from '@/progression/Cosmetics';
import { TonePalette } from '@/render/TonePalette';
import type { ModeId } from '@/session/ModeId';
import { ART_CELL, ART_HEIGHT, ART_WIDTH, MODE_ART } from './modeArt';

/** The menus draw with the game's own blocks: the same gems, the same light. */
const MAX_SPRITE_SETS = 40;
/** Room left around a mode's picture once cropped (art units). */
const ART_MARGIN = 4;
/** A mode's picture never grows past blocks of about 26 px: big tiles get room, not giants. */
const MAX_ART_SCALE = 3.2;

interface ArtBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

const random = (seed: number) => {
  let state = seed;
  return () => {
    state = (state * 9301 + 49297) % 233280;
    return state / 233280;
  };
};

/** Sizes a canvas to its box (CSS pixels) for the screen's density; returns its context. */
export function fitCanvas(
  canvas: HTMLCanvasElement,
): { ctx: CanvasRenderingContext2D; width: number; height: number; ratio: number } | null {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx || width === 0 || height === 0) return null;
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  return { ctx, width, height, ratio };
}

/**
 * Draws the menus' pictures with the game's blocks: each mode's picture, a
 * sample of each material, the Atelier's little well. Loaded after the first
 * paint (the gems are the game's render code).
 */
export class GemArt {
  private readonly sets = new Map<string, BlockSprites>();
  private readonly bounds = new Map<ModeId, ArtBox>();

  constructor(readonly palette: TonePalette) {}

  static fromDocument(): GemArt {
    return new GemArt(TonePalette.fromElement(document.documentElement));
  }

  /** The blocks of a material, `px` device pixels wide. */
  sprites(material: MaterialId, px: number): BlockSprites {
    const size = Math.max(4, Math.round(px));
    const key = `${material}:${size}`;
    let set = this.sets.get(key);
    if (!set) {
      set = blockSprites(material, size, this.palette);
      this.sets.set(key, set);
      if (this.sets.size > MAX_SPRITE_SETS) this.sets.delete(this.sets.keys().next().value!);
    }
    return set;
  }

  /** A mode's picture, cropped to what it shows and centred in its canvas. */
  drawMode(canvas: HTMLCanvasElement, mode: ModeId): void {
    const fit = fitCanvas(canvas);
    if (!fit) return;
    const { ctx, width, height, ratio } = fit;
    ctx.clearRect(0, 0, width, height);
    const box = this.boundsOf(mode);
    const k = Math.min(width / box.width, height / box.height, MAX_ART_SCALE);
    this.paintMode(
      ctx,
      mode,
      k,
      (width - box.width * k) / 2 - box.x * k,
      (height - box.height * k) / 2 - box.y * k,
      ratio,
    );
  }

  /** Paints a mode's picture at scale `k` (CSS px per art unit), its corner at (ox, oy). */
  private paintMode(
    ctx: CanvasRenderingContext2D,
    mode: ModeId,
    k: number,
    ox: number,
    oy: number,
    ratio: number,
  ): void {
    const block = (ART_CELL - 2) * k;
    for (const shape of MODE_ART[mode]) {
      if (shape.kind === 'blocks') {
        const sprite = this.sprites('crystal', block * ratio).get(shape.tone as Tone);
        for (const [x, y] of shape.cells)
          ctx.drawImage(
            sprite,
            ox + (x * ART_CELL + 1) * k,
            oy + (y * ART_CELL - 9) * k,
            block,
            block,
          );
        continue;
      }
      const { r, g, b } = this.palette.color((shape.kind === 'path' ? shape.tone : 12) as Tone);
      ctx.save();
      ctx.translate(ox, oy);
      ctx.scale(k, k);
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = `rgb(${r} ${g} ${b})`;
      ctx.setLineDash(shape.kind === 'path' && shape.dashed ? [4, 4] : []);
      if (shape.kind === 'path') ctx.stroke(new Path2D(shape.d));
      else {
        ctx.beginPath();
        ctx.ellipse(shape.cx, shape.cy, shape.rx, shape.ry, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  /**
   * The part of a mode's 120 × 80 picture that holds something, with a small
   * margin: found once by painting it and reading where the ink went.
   */
  private boundsOf(mode: ModeId): ArtBox {
    const known = this.bounds.get(mode);
    if (known) return known;
    let box: ArtBox = { x: 0, y: 0, width: ART_WIDTH, height: ART_HEIGHT };
    const ctx = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    if (ctx) {
      ctx.canvas.width = ART_WIDTH;
      ctx.canvas.height = ART_HEIGHT;
      this.paintMode(ctx, mode, 1, 0, 0, 1);
      const { data } = ctx.getImageData(0, 0, ART_WIDTH, ART_HEIGHT);
      let left = ART_WIDTH;
      let top = ART_HEIGHT;
      let right = -1;
      let bottom = -1;
      for (let y = 0; y < ART_HEIGHT; y++)
        for (let x = 0; x < ART_WIDTH; x++) {
          if (data[(y * ART_WIDTH + x) * 4 + 3]! < 24) continue;
          left = Math.min(left, x);
          right = Math.max(right, x);
          top = Math.min(top, y);
          bottom = Math.max(bottom, y);
        }
      if (right >= 0) {
        const x = Math.max(0, left - ART_MARGIN);
        const y = Math.max(0, top - ART_MARGIN);
        box = {
          x,
          y,
          width: Math.min(ART_WIDTH, right + 1 + ART_MARGIN) - x,
          height: Math.min(ART_HEIGHT, bottom + 1 + ART_MARGIN) - y,
        };
      }
    }
    this.bounds.set(mode, box);
    return box;
  }

  /** Four blocks of a material, as on the Atelier's shelf. */
  drawMaterial(canvas: HTMLCanvasElement, material: MaterialId): void {
    const fit = fitCanvas(canvas);
    if (!fit) return;
    const { ctx, width, height, ratio } = fit;
    ctx.clearRect(0, 0, width, height);
    const size = Math.floor(Math.min(width, height) / 2.4);
    const ox = (width - size * 2) / 2;
    const oy = (height - size * 2) / 2;
    const set = this.sprites(material, size * ratio);
    const blocks: readonly [Tone, number, number][] = [
      [Tone.T, 0, 0],
      [Tone.Z, 1, 0],
      [Tone.I, 0, 1],
      [Tone.L, 1, 1],
    ];
    for (const [tone, x, y] of blocks)
      ctx.drawImage(set.get(tone), ox + x * size, oy + y * size, size, size);
  }

  /** The bits of a shatter signature, as on the Atelier's shelf and stage. */
  drawShards(
    ctx: CanvasRenderingContext2D,
    shatter: ShatterId,
    box: { x: number; y: number; width: number; height: number },
    count: number,
    size: number,
  ): void {
    const next = random(17);
    const vivid = [Tone.I, Tone.O, Tone.T, Tone.S, Tone.Z, Tone.J, Tone.L];
    const { petals, gold } = this.palette.effects;
    for (let i = 0; i < count; i++) {
      const x = box.x + next() * box.width;
      const y = box.y + next() * box.height;
      const z = size * (0.6 + next() * 0.8);
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(next() * Math.PI * 2);
      ctx.globalAlpha = 0.55 + next() * 0.45;
      if (shatter === 'petals' || shatter === 'gold') {
        const colours = shatter === 'petals' ? petals : gold;
        ctx.fillStyle = colours[Math.floor(next() * colours.length)] ?? this.palette.crack;
        ctx.beginPath();
        if (shatter === 'petals') ctx.ellipse(0, 0, z * 0.7, z * 0.35, 0, 0, Math.PI * 2);
        else ctx.rect(-z / 2, -z / 3, z * 0.9, z * 0.6);
        ctx.fill();
      } else {
        const { r, g, b } = this.palette.color(vivid[Math.floor(next() * vivid.length)]!);
        ctx.fillStyle = `rgb(${r} ${g} ${b})`;
        ctx.beginPath();
        if (shatter === 'confetti') ctx.rect(-z / 2, -z / 4, z, z / 2);
        else {
          ctx.moveTo(0, -z);
          ctx.lineTo(z * 0.7, z * 0.6);
          ctx.lineTo(-z * 0.6, z * 0.4);
          ctx.closePath();
        }
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  /** A shatter signature on the shelf: its bits, scattered. */
  drawShatter(canvas: HTMLCanvasElement, shatter: ShatterId): void {
    const fit = fitCanvas(canvas);
    if (!fit) return;
    const { ctx, width, height } = fit;
    ctx.clearRect(0, 0, width, height);
    const box = { x: width * 0.15, y: height * 0.15, width: width * 0.7, height: height * 0.7 };
    this.drawShards(ctx, shatter, box, 16, Math.min(width, height) * 0.07);
  }

  /**
   * The Atelier's stage: a small well wearing the chosen material; with a
   * shatter signature, a cleared row bursting into it.
   */
  drawStage(canvas: HTMLCanvasElement, material: MaterialId, shatter: ShatterId | null): void {
    const fit = fitCanvas(canvas);
    if (!fit) return;
    const { ctx, width, height, ratio } = fit;
    ctx.clearRect(0, 0, width, height);
    const map = [
      '........',
      '...3....',
      '..333...',
      '........',
      '........',
      '1....55.',
      '11.6655.',
      '7166652.',
      '77762222',
    ];
    const columns = 8;
    const rows = map.length;
    const cell = Math.floor(Math.min((width * 0.62) / columns, (height * 0.88) / rows));
    const ox = Math.round((width - columns * cell) / 2);
    const oy = Math.round((height - rows * cell) / 2);
    ctx.fillStyle = this.palette.wellBackground;
    ctx.beginPath();
    ctx.roundRect(ox - 5, oy - 5, columns * cell + 10, rows * cell + 10, 12);
    ctx.fill();
    const set = this.sprites(material, cell * ratio);
    map.forEach((line, y) => {
      for (let x = 0; x < line.length; x++) {
        const mark = line.charAt(x);
        if (mark !== '.')
          ctx.drawImage(set.get(Number(mark) as Tone), ox + x * cell, oy + y * cell, cell, cell);
      }
    });
    if (shatter) {
      // The cleared row: a seam of light, brightest at its heart.
      const middle = oy + 4.5 * cell;
      const seam = ctx.createLinearGradient(0, middle - cell, 0, middle + cell);
      seam.addColorStop(0, 'transparent');
      seam.addColorStop(0.5, this.palette.crack);
      seam.addColorStop(1, 'transparent');
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = seam;
      ctx.fillRect(ox, middle - cell, columns * cell, cell * 2);
      ctx.globalAlpha = 1;
      const box = { x: ox, y: middle - cell * 2.2, width: columns * cell, height: cell * 4.4 };
      this.drawShards(ctx, shatter, box, 46, cell * 0.3);
    }
  }
}

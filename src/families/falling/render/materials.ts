import type { MaterialId } from '@/progression/Cosmetics';
import { mixRgb, parseHex, shade, type Rgb, type TonePalette } from '@/render/TonePalette';
import { LINK } from '../board/Links';
import type { Tone } from '../pieces/PieceType';
import { SEASON_MATERIALS, type SeasonMaterialId } from '@/seasons/SeasonData';
import { BlockSprites } from './BlockSprites';
import { CrystalSprites } from './CrystalSprites';
import { SeasonGlassSprites } from './SeasonGlassSprites';

type Engraved = Exclude<Tone, 0>;
const rgba = ({ r, g, b }: Rgb, alpha: number) => `rgb(${r} ${g} ${b} / ${alpha})`;

/** Dark glass lit from inside by a glowing tube of the tone's colour. */
class NeonSprites extends BlockSprites {
  protected paint(ctx: CanvasRenderingContext2D, tone: Tone, rgb: Rgb): void {
    const s = this.size;
    const inset = Math.max(2, s * 0.12);
    const background = parseHex(this.palette.wellBackground);
    ctx.fillStyle = rgba(rgb, 0.16);
    ctx.fillRect(1, 1, s - 2, s - 2);
    ctx.shadowColor = rgba(rgb, 0.9);
    ctx.shadowBlur = s * 0.25;
    ctx.strokeStyle = shade(rgb, 0.25);
    ctx.lineWidth = Math.max(1.5, s * 0.09);
    ctx.strokeRect(inset, inset, s - inset * 2, s - inset * 2);
    ctx.shadowBlur = 0;
    this.engrave(ctx, tone as Engraved, background, s / 2, s * 0.2, shade(rgb, 0.4));
  }
}

/** Folded paper: flat and light, one corner turned down. */
class PaperSprites extends BlockSprites {
  protected paint(ctx: CanvasRenderingContext2D, tone: Tone, rgb: Rgb): void {
    const s = this.size;
    const gap = Math.max(1, Math.round(s * 0.05));
    const fold = s * 0.26;
    const sheet = mixRgb(rgb, 0.32);
    ctx.fillStyle = shade(rgb, 0.32);
    ctx.beginPath();
    ctx.moveTo(gap, gap);
    ctx.lineTo(s - gap - fold, gap);
    ctx.lineTo(s - gap, gap + fold);
    ctx.lineTo(s - gap, s - gap);
    ctx.lineTo(gap, s - gap);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = shade(rgb, -0.25);
    ctx.lineWidth = Math.max(1, s * 0.03);
    ctx.stroke();
    // The folded corner.
    ctx.fillStyle = shade(rgb, 0.05);
    ctx.beginPath();
    ctx.moveTo(s - gap - fold, gap);
    ctx.lineTo(s - gap - fold, gap + fold);
    ctx.lineTo(s - gap, gap + fold);
    ctx.closePath();
    ctx.fill();
    this.engrave(ctx, tone as Engraved, sheet, s / 2, s * 0.22, shade(rgb, -0.45));
  }

  /** One sheet per piece (1.43): edged on its free sides, folded at its top-right block only. */
  protected override paintLinked(
    ctx: CanvasRenderingContext2D,
    tone: Tone,
    rgb: Rgb,
    links: number,
  ): void {
    const s = this.size;
    const gap = Math.max(1, Math.round(s * 0.05));
    const fold = s * 0.26;
    const north = (links & LINK.north) !== 0;
    const east = (links & LINK.east) !== 0;
    const south = (links & LINK.south) !== 0;
    const west = (links & LINK.west) !== 0;
    const left = west ? 0 : gap;
    const top = north ? 0 : gap;
    const right = east ? s : s - gap;
    const bottom = south ? s : s - gap;
    const folded = !north && !east;
    ctx.fillStyle = shade(rgb, 0.32);
    ctx.beginPath();
    ctx.moveTo(left, top);
    ctx.lineTo(folded ? right - fold : right, top);
    if (folded) ctx.lineTo(right, top + fold);
    ctx.lineTo(right, bottom);
    ctx.lineTo(left, bottom);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = shade(rgb, -0.25);
    ctx.lineWidth = Math.max(1, s * 0.03);
    ctx.lineCap = 'square';
    ctx.beginPath();
    if (!north) {
      ctx.moveTo(left, top);
      ctx.lineTo(folded ? right - fold : right, top);
    }
    if (folded) {
      ctx.moveTo(right - fold, top);
      ctx.lineTo(right, top + fold);
    }
    if (!east) {
      ctx.moveTo(right, folded ? top + fold : top);
      ctx.lineTo(right, bottom);
    }
    if (!south) {
      ctx.moveTo(left, bottom);
      ctx.lineTo(right, bottom);
    }
    if (!west) {
      ctx.moveTo(left, top);
      ctx.lineTo(left, bottom);
    }
    ctx.stroke();
    if (folded) {
      ctx.fillStyle = shade(rgb, 0.05);
      ctx.beginPath();
      ctx.moveTo(right - fold, top);
      ctx.lineTo(right - fold, top + fold);
      ctx.lineTo(right, top + fold);
      ctx.closePath();
      ctx.fill();
    }
    this.engrave(ctx, tone as Engraved, mixRgb(rgb, 0.32), s / 2, s * 0.22, shade(rgb, -0.45));
  }
}

/** Eight-by-eight pixel blocks, lit from the top left like an old console. */
class PixelSprites extends BlockSprites {
  protected paint(ctx: CanvasRenderingContext2D, tone: Tone, rgb: Rgb): void {
    const s = this.size;
    const p = s / 8;
    const cell = (x: number, y: number, w: number, h: number, fill: string) => {
      ctx.fillStyle = fill;
      ctx.fillRect(Math.round(x * p), Math.round(y * p), Math.ceil(w * p), Math.ceil(h * p));
    };
    cell(0, 0, 8, 8, shade(rgb, -0.45));
    cell(0, 0, 7, 7, shade(rgb, 0));
    cell(0, 0, 7, 1, shade(rgb, 0.4));
    cell(0, 0, 1, 7, shade(rgb, 0.25));
    cell(1, 6, 6, 1, shade(rgb, -0.2));
    cell(6, 1, 1, 6, shade(rgb, -0.2));
    cell(2, 2, 1, 1, shade(rgb, 0.55));
    this.engrave(ctx, tone as Engraved, rgb, s * 0.44, s * 0.18);
  }

  /** One console sprite per piece (1.43): lit and shaded along its free sides only. */
  protected override paintLinked(
    ctx: CanvasRenderingContext2D,
    tone: Tone,
    rgb: Rgb,
    links: number,
  ): void {
    const s = this.size;
    const p = s / 8;
    const cell = (x: number, y: number, w: number, h: number, fill: string) => {
      ctx.fillStyle = fill;
      ctx.fillRect(Math.round(x * p), Math.round(y * p), Math.ceil(w * p), Math.ceil(h * p));
    };
    const north = (links & LINK.north) !== 0;
    const east = (links & LINK.east) !== 0;
    const south = (links & LINK.south) !== 0;
    const west = (links & LINK.west) !== 0;
    const right = east ? 8 : 7;
    const bottom = south ? 8 : 7;
    const from = west ? 0 : 1;
    const down = north ? 0 : 1;
    if (!south) cell(0, 7, 8, 1, shade(rgb, -0.45));
    if (!east) cell(7, 0, 1, 8, shade(rgb, -0.45));
    cell(0, 0, right, bottom, shade(rgb, 0));
    if (!north) cell(0, 0, right, 1, shade(rgb, 0.4));
    if (!west) cell(0, 0, 1, bottom, shade(rgb, 0.25));
    if (!south) cell(from, 6, right - from, 1, shade(rgb, -0.2));
    if (!east) cell(6, down, 1, bottom - down, shade(rgb, -0.2));
    if (!north && !west) cell(2, 2, 1, 1, shade(rgb, 0.55));
    this.engrave(ctx, tone as Engraved, rgb, s * 0.44, s * 0.18);
  }
}

/** Black volcanic glass, edged with the tone's colour, a long glossy reflection. */
class ObsidianSprites extends BlockSprites {
  protected paint(ctx: CanvasRenderingContext2D, tone: Tone, rgb: Rgb): void {
    const s = this.size;
    const gap = Math.max(1, Math.round(s * 0.04));
    const body = ctx.createLinearGradient(0, 0, s, s);
    body.addColorStop(0, shade(rgb, -0.62));
    body.addColorStop(1, shade(rgb, -0.82));
    ctx.fillStyle = body;
    ctx.fillRect(gap, gap, s - gap * 2, s - gap * 2);
    ctx.strokeStyle = shade(rgb, 0.1);
    ctx.lineWidth = Math.max(1.5, s * 0.08);
    ctx.strokeRect(gap * 2, gap * 2, s - gap * 4, s - gap * 4);
    const gloss = ctx.createLinearGradient(0, 0, s, 0);
    gloss.addColorStop(0.15, 'rgb(255 255 255 / 0)');
    gloss.addColorStop(0.25, 'rgb(255 255 255 / 0.28)');
    gloss.addColorStop(0.35, 'rgb(255 255 255 / 0)');
    ctx.fillStyle = gloss;
    ctx.fillRect(gap, gap, s - gap * 2, s - gap * 2);
    this.engrave(ctx, tone as Engraved, { r: 0, g: 0, b: 0 }, s / 2, s * 0.22, shade(rgb, 0.3));
  }
}

/** Gold ingots set with a gem of the tone's colour. */
class GoldSprites extends BlockSprites {
  // A joined side is filled from the metal, short of the gem set in each block.
  protected override readonly edge = 0.18;

  protected paint(ctx: CanvasRenderingContext2D, tone: Tone, rgb: Rgb): void {
    const s = this.size;
    const [light = '#f6dc8c', middle = '#c99a2e', dark = '#8a6414'] = this.palette.effects.gold;
    const gap = Math.max(1, Math.round(s * 0.04));
    const metal = ctx.createLinearGradient(0, 0, s, s);
    metal.addColorStop(0, light);
    metal.addColorStop(0.5, middle);
    metal.addColorStop(1, dark);
    ctx.fillStyle = metal;
    ctx.fillRect(gap, gap, s - gap * 2, s - gap * 2);
    // The gem, which carries the tone and its motif.
    const gem = s * 0.56;
    const at = (s - gem) / 2;
    ctx.fillStyle = shade(rgb, 0);
    ctx.fillRect(at, at, gem, gem);
    ctx.strokeStyle = dark;
    ctx.lineWidth = Math.max(1, s * 0.04);
    ctx.strokeRect(at, at, gem, gem);
    this.engrave(ctx, tone as Engraved, rgb, s / 2, gem * 0.3);
  }
}

/** Scales of the Dune Wyrm: overlapping rows of sand-gold scales over the tone's colour. */
class DunesSprites extends BlockSprites {
  protected paint(ctx: CanvasRenderingContext2D, tone: Tone, rgb: Rgb): void {
    const s = this.size;
    const [light = '#f6dc8c', , dark = '#8a6414'] = this.palette.effects.gold;
    const gap = Math.max(1, Math.round(s * 0.04));
    ctx.fillStyle = shade(rgb, -0.15);
    ctx.fillRect(gap, gap, s - gap * 2, s - gap * 2);
    // Three rows of scales, each row shifted by half a scale, lit at the top.
    const scale = (s - gap * 2) / 3;
    ctx.save();
    ctx.beginPath();
    ctx.rect(gap, gap, s - gap * 2, s - gap * 2);
    ctx.clip();
    for (let row = 0; row < 4; row++) {
      const y = gap + row * scale * 0.8;
      const offset = row % 2 ? scale / 2 : 0;
      for (let col = -1; col < 4; col++) {
        const x = gap + col * scale + offset;
        ctx.fillStyle = shade(rgb, 0.18 - row * 0.08);
        ctx.beginPath();
        ctx.arc(x + scale / 2, y, scale / 2, 0, Math.PI);
        ctx.fill();
        ctx.strokeStyle = row === 0 ? light : dark;
        ctx.lineWidth = Math.max(1, s * 0.035);
        ctx.stroke();
      }
    }
    ctx.restore();
    ctx.strokeStyle = dark;
    ctx.lineWidth = Math.max(1, s * 0.05);
    ctx.strokeRect(gap, gap, s - gap * 2, s - gap * 2);
    this.engrave(ctx, tone as Engraved, rgb, s / 2, s * 0.2, light);
  }
}

/** Kintsugi, from the Ceramic Golem: glazed tiles broken and mended with veins of gold. */
class KintsugiSprites extends BlockSprites {
  protected paint(ctx: CanvasRenderingContext2D, tone: Tone, rgb: Rgb): void {
    const s = this.size;
    const [light = '#f6dc8c', middle = '#c99a2e', dark = '#8a6414'] = this.palette.effects.gold;
    const gap = Math.max(1, Math.round(s * 0.05));
    const side = s - gap * 2;
    ctx.beginPath();
    ctx.roundRect(gap, gap, side, side, s * 0.14);
    const glaze = ctx.createRadialGradient(s * 0.3, s * 0.26, s * 0.04, s / 2, s / 2, s * 0.75);
    glaze.addColorStop(0, shade(rgb, 0.35));
    glaze.addColorStop(0.5, shade(rgb, 0));
    glaze.addColorStop(1, shade(rgb, -0.3));
    ctx.fillStyle = glaze;
    ctx.fill();
    ctx.strokeStyle = shade(rgb, -0.4);
    ctx.lineWidth = Math.max(1, s * 0.04);
    ctx.stroke();
    // The mended cracks: a fixed pattern per tone, gold with a light edge.
    ctx.save();
    ctx.clip();
    let seed = tone * 7919 + 104729;
    const next = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let k = 0; k < 2; k++) {
      const points: [number, number][] = [];
      let x = k === 0 ? gap : gap + next() * side;
      let y = k === 0 ? gap + next() * side : gap;
      for (let j = 0; j < 4; j++) {
        points.push([x, y]);
        x += (k === 0 ? 0.3 : (next() - 0.5) * 0.5) * s;
        y += (k === 0 ? (next() - 0.5) * 0.5 : 0.3) * s;
      }
      for (const [width, colour] of [
        [0.11, dark],
        [0.07, middle],
        [0.025, light],
      ] as const) {
        ctx.strokeStyle = colour;
        ctx.lineWidth = Math.max(1, s * width);
        ctx.beginPath();
        points.forEach(([px, py], i) => (i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
        ctx.stroke();
      }
    }
    ctx.restore();
    ctx.fillStyle = 'rgb(255 255 255 / 0.35)';
    ctx.beginPath();
    ctx.ellipse(s * 0.32, s * 0.24, s * 0.14, s * 0.06, -0.5, 0, Math.PI * 2);
    ctx.fill();
    this.engrave(ctx, tone as Engraved, rgb, s / 2, s * 0.18);
  }
}

type SpriteFactory = new (size: number, palette: TonePalette) => BlockSprites;

const MATERIAL_SPRITES: Readonly<Record<Exclude<MaterialId, SeasonMaterialId>, SpriteFactory>> = {
  crystal: CrystalSprites,
  neon: NeonSprites,
  paper: PaperSprites,
  pixel: PixelSprites,
  obsidian: ObsidianSprites,
  gold: GoldSprites,
  dunes: DunesSprites,
  kintsugi: KintsugiSprites,
};

/** The blocks of a material at a given size; a season's are its glass, from its data (1.36). */
export function blockSprites(
  material: MaterialId,
  size: number,
  palette: TonePalette,
): BlockSprites {
  const season = SEASON_MATERIALS.find((look) => look.id === material);
  if (season) return new SeasonGlassSprites(size, palette, season);
  return new MATERIAL_SPRITES[material as Exclude<MaterialId, SeasonMaterialId>](size, palette);
}

import type { MaterialId } from '@/progression/Cosmetics';
import { mixRgb, parseHex, shade, type Rgb, type TonePalette } from '@/render/TonePalette';
import type { Tone } from '../pieces/PieceType';
import { BlockSprites } from './BlockSprites';
import { CrystalSprites } from './CrystalSprites';

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

type SpriteFactory = new (size: number, palette: TonePalette) => BlockSprites;

const MATERIAL_SPRITES: Readonly<Record<MaterialId, SpriteFactory>> = {
  crystal: CrystalSprites,
  neon: NeonSprites,
  paper: PaperSprites,
  pixel: PixelSprites,
  obsidian: ObsidianSprites,
  gold: GoldSprites,
};

/** The blocks of a material at a given size. */
export function blockSprites(
  material: MaterialId,
  size: number,
  palette: TonePalette,
): BlockSprites {
  return new MATERIAL_SPRITES[material](size, palette);
}

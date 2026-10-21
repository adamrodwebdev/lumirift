import { Tone } from '@/core/Tone';
import { MOTIFS } from '@/render/motifs';
import { luminance, shade, type Rgb, type TonePalette } from '@/render/TonePalette';

const rgba = ({ r, g, b }: Rgb, alpha: number) => `rgb(${r} ${g} ${b} / ${alpha})`;

/**
 * Glazed ceramic tiles, pre-drawn once per tone at the current cell size:
 * a rounded tile, a glossy glaze, a darker rim, fine crackle lines and the
 * tone's engraved motif (for colour-blind players).
 */
export class CeramicSprites {
  private readonly sprites = new Map<Tone, HTMLCanvasElement>();

  constructor(
    readonly size: number,
    private readonly palette: TonePalette,
  ) {}

  get(tone: Tone): HTMLCanvasElement {
    let sprite = this.sprites.get(tone);
    if (!sprite) {
      sprite = this.draw(tone);
      this.sprites.set(tone, sprite);
    }
    return sprite;
  }

  private draw(tone: Tone): HTMLCanvasElement {
    const s = this.size;
    const canvas = document.createElement('canvas');
    canvas.width = s;
    canvas.height = s;
    const ctx = canvas.getContext('2d');
    if (!ctx || tone === Tone.Empty) return canvas;

    const rgb = this.palette.color(tone);
    if (tone === Tone.Stone || tone === Tone.CrackedStone) {
      this.drawStone(ctx, rgb, tone === Tone.CrackedStone);
      return canvas;
    }
    const inset = Math.max(1, Math.round(s * 0.06));
    const side = s - inset * 2;
    const radius = s * 0.2;

    // Body.
    ctx.beginPath();
    ctx.roundRect(inset, inset, side, side, radius);
    ctx.fillStyle = shade(rgb, -0.04);
    ctx.fill();

    // Glaze: light pooling towards the top left.
    const glaze = ctx.createRadialGradient(
      s * 0.32,
      s * 0.28,
      s * 0.05,
      s * 0.45,
      s * 0.45,
      s * 0.75,
    );
    glaze.addColorStop(0, rgba({ r: 255, g: 255, b: 255 }, 0.42));
    glaze.addColorStop(0.45, rgba(rgb, 0));
    glaze.addColorStop(1, rgba({ r: 0, g: 0, b: 0 }, 0.22));
    ctx.fillStyle = glaze;
    ctx.fill();

    // Rim.
    ctx.lineWidth = Math.max(1, s * 0.05);
    ctx.strokeStyle = shade(rgb, -0.35);
    ctx.stroke();

    // Crackle of the glaze: fixed per tone, so a tone always looks the same.
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = rgba({ r: 0, g: 0, b: 0 }, 0.13);
    ctx.lineWidth = Math.max(0.6, s * 0.02);
    let seed = tone * 9301 + 49297;
    const next = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      let x = inset + next() * side;
      let y = inset + next() * side;
      ctx.moveTo(x, y);
      for (let j = 0; j < 3; j++) {
        x += (next() - 0.5) * s * 0.45;
        y += (next() - 0.5) * s * 0.45;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();

    // Specular highlight.
    ctx.fillStyle = rgba({ r: 255, g: 255, b: 255 }, 0.4);
    ctx.beginPath();
    ctx.ellipse(s * 0.33, s * 0.24, s * 0.16, s * 0.07, -0.5, 0, Math.PI * 2);
    ctx.fill();

    // Engraved motif.
    const ink = luminance(rgb) > 0.35 ? 'rgb(0 0 0 / 0.38)' : 'rgb(255 255 255 / 0.55)';
    ctx.strokeStyle = ink;
    ctx.fillStyle = ink;
    ctx.lineWidth = Math.max(1.5, s * 0.07);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    MOTIFS[tone](ctx, s / 2, side * 0.2);
    return canvas;
  }

  /**
   * A stone of the Golem: a rough, matte chunk, not a glazed tile, so that it
   * reads at once as foreign to the mosaic. Cracked, a deep fissure splits it.
   */
  private drawStone(ctx: CanvasRenderingContext2D, rgb: Rgb, cracked: boolean): void {
    const s = this.size;
    // A chunky outline, the same for every stone.
    const outline: readonly (readonly [number, number])[] = [
      [0.12, 0.22],
      [0.34, 0.08],
      [0.7, 0.1],
      [0.9, 0.3],
      [0.92, 0.7],
      [0.74, 0.92],
      [0.3, 0.9],
      [0.08, 0.7],
    ];
    ctx.beginPath();
    outline.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x * s, y * s) : ctx.lineTo(x * s, y * s)));
    ctx.closePath();
    const body = ctx.createLinearGradient(0, 0, s, s);
    body.addColorStop(0, shade(rgb, 0.22));
    body.addColorStop(1, shade(rgb, -0.32));
    ctx.fillStyle = body;
    ctx.fill();
    ctx.lineWidth = Math.max(1, s * 0.05);
    ctx.strokeStyle = shade(rgb, -0.55);
    ctx.stroke();
    // Grain of the stone.
    ctx.save();
    ctx.clip();
    let seed = 4271;
    const next = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    for (let i = 0; i < 14; i++) {
      ctx.fillStyle =
        next() < 0.5 ? rgba({ r: 0, g: 0, b: 0 }, 0.18) : rgba({ r: 255, g: 255, b: 255 }, 0.14);
      ctx.beginPath();
      ctx.arc(next() * s, next() * s, s * (0.02 + next() * 0.035), 0, Math.PI * 2);
      ctx.fill();
    }
    if (cracked) {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (const [width, colour] of [
        [0.12, rgba({ r: 0, g: 0, b: 0 }, 0.7)],
        [0.04, rgba({ r: 255, g: 255, b: 255 }, 0.25)],
      ] as const) {
        ctx.strokeStyle = colour;
        ctx.lineWidth = Math.max(1, s * width);
        ctx.beginPath();
        ctx.moveTo(s * 0.3, s * 0.08);
        ctx.lineTo(s * 0.46, s * 0.4);
        ctx.lineTo(s * 0.38, s * 0.58);
        ctx.lineTo(s * 0.6, s * 0.92);
        ctx.moveTo(s * 0.46, s * 0.4);
        ctx.lineTo(s * 0.86, s * 0.46);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
}

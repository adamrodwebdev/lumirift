import type { TonePalette } from '@/render/TonePalette';
import { EFFECT_TIMINGS, type FallingEffects, type Popup } from '../fx/FallingEffects';

const { POPUP_MS } = EFFECT_TIMINGS;

/** Where a word is drawn on the canvas (px), `rise` cells above its place as it ages. */
export type WordPlace = (popup: Popup, rise: number) => { readonly x: number; readonly y: number };

/** A word drawn once with its glow (px): its picture, and the width of its text alone. */
interface WordSprite {
  readonly canvas: HTMLCanvasElement;
  readonly text: number;
}

/** A word wider than this share of the well shrinks to fit (a long shout, in Russian). */
const FIT = 0.94;

const wordFont = (px: number, word: boolean) =>
  `${word ? 900 : 800} ${px}px 'Unbounded Variable', ui-rounded, system-ui, sans-serif`;

/** The colour, fully transparent (`#rrggbb` tokens): a glow fades out without darkening. */
function faded(color: string): string {
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color)?.[1];
  if (!hex) return 'rgb(0 0 0 / 0)';
  return `#${hex.length === 3 ? hex.replace(/./g, (digit) => digit + digit) : hex}00`;
}

/**
 * What the falling well and the Tower draw over their play alike (1.41): the
 * words (points, the word of a moment, a combo's shout), a combo's heat on the
 * edges and the rift's warm light. Glows are blurred once, never per frame: a
 * word's picture is drawn with its glow when it appears, the heat's glow is a
 * gradient (a canvas blur costs its whole area on every frame: nearly 30 ms
 * an image for the heat alone, rastered by the processor slowed four times).
 * Sizes are in device pixels.
 */
export class WellOverlay {
  private readonly sprites = new WeakMap<Popup, WordSprite | null>();
  /** The heat's glow, one gradient per colour, placed on each edge by the transform. */
  private readonly glows = new Map<string, CanvasGradient>();

  constructor(private readonly ctx: CanvasRenderingContext2D) {}

  /**
   * The words: each pops in (bigger, then settling), rises and fades; a
   * combo's word wears its heat. Drawn under the current transform.
   */
  words(
    effects: FallingEffects,
    palette: TonePalette,
    scale: { readonly cell: number; readonly wellWidth: number },
    place: WordPlace,
  ): void {
    if (effects.popups.length === 0) return;
    const { ctx } = this;
    for (const popup of effects.popups) {
      if (popup.age < 0) continue;
      const t = popup.age / (popup.life ?? POPUP_MS);
      const word = popup.kind === 'label' || popup.kind === 'shout';
      const { x, y } = place(popup, t * (popup.kind === 'shout' ? 0.6 : word ? 0.8 : 1.6));
      ctx.globalAlpha = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
      const sprite = word ? this.sprite(popup, palette, scale) : null;
      if (!sprite) {
        this.plain(popup, palette, scale, { x, y });
        continue;
      }
      // Words pop in (a quick overshoot), never wider than the well.
      const punch = popup.punch ?? 0.35;
      const pop = Math.min(
        1 + punch * Math.max(0, 1 - popup.age / (popup.punchMs ?? 160)),
        Math.max(1, (scale.wellWidth * FIT) / sprite.text),
      );
      const width = sprite.canvas.width * pop;
      const height = sprite.canvas.height * pop;
      ctx.drawImage(sprite.canvas, x - width / 2, y - height / 2, width, height);
    }
    ctx.globalAlpha = 1;
  }

  /**
   * A combo's heat on the canvas' edges: a glow in its colour that rises with
   * each clear of the chain and fades once it ends. Screen space.
   */
  heat(effects: FallingEffects, palette: TonePalette, cell: number): void {
    if (effects.heat <= 0) return;
    const { ctx } = this;
    const { width, height } = ctx.canvas;
    const color = palette.effects.heat[effects.heatColor];
    const glow = cell * (0.4 + 0.8 * effects.heat);
    ctx.globalAlpha = 0.25 + 0.55 * effects.heat;
    ctx.fillStyle = this.glow(color);
    // The unit square, its gradient running from the edge inwards, on each side in turn.
    ctx.setTransform(glow, 0, 0, height, 0, 0);
    ctx.fillRect(0, 0, 1, 1);
    ctx.setTransform(-glow, 0, 0, height, width, 0);
    ctx.fillRect(0, 0, 1, 1);
    ctx.setTransform(0, glow, width, 0, 0, 0);
    ctx.fillRect(0, 0, 1, 1);
    ctx.setTransform(0, -glow, width, 0, 0, height);
    ctx.fillRect(0, 0, 1, 1);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const line = Math.max(2, cell * (0.08 + 0.14 * effects.heat));
    ctx.strokeStyle = color;
    ctx.lineWidth = line;
    ctx.strokeRect(line / 2, line / 2, width - line, height - line);
    ctx.globalAlpha = 1;
  }

  /** The rift's own light over the whole canvas: warm, added to the picture, never a white veil. */
  riftLight(effects: FallingEffects): void {
    if (effects.wellFlash <= 0) return;
    const { ctx } = this;
    const { width, height } = ctx.canvas;
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgb(255 170 80 / ${effects.wellFlash})`;
    ctx.fillRect(0, 0, width, height);
    ctx.globalCompositeOperation = 'source-over';
  }

  /** Points, small and quick: plain text, no glow (a word too, where it has no picture). */
  private plain(
    popup: Popup,
    palette: TonePalette,
    { cell, wellWidth }: { readonly cell: number; readonly wellWidth: number },
    at: { readonly x: number; readonly y: number },
  ): void {
    const { ctx } = this;
    const word = popup.kind === 'label' || popup.kind === 'shout';
    let size = Math.round(cell * (popup.size ?? (word ? 1.05 : 0.75)));
    ctx.font = wordFont(size, word);
    const wide = ctx.measureText(popup.text).width;
    if (wide > wellWidth * FIT) {
      size = Math.floor((size * wellWidth * FIT) / wide);
      ctx.font = wordFont(size, word);
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = Math.max(2, cell * 0.12);
    ctx.strokeStyle = palette.wellBackground;
    ctx.strokeText(popup.text, at.x, at.y);
    const heat = popup.heat ? palette.effects.heat[popup.heat] : null;
    ctx.fillStyle = heat ?? (word ? palette.crack : palette.accent);
    ctx.fillText(popup.text, at.x, at.y);
  }

  /** The word's picture, drawn on its first frame; null where the page cannot make one. */
  private sprite(
    popup: Popup,
    palette: TonePalette,
    scale: { readonly cell: number; readonly wellWidth: number },
  ): WordSprite | null {
    let sprite = this.sprites.get(popup);
    if (sprite === undefined) {
      sprite = this.drawSprite(popup, palette, scale);
      this.sprites.set(popup, sprite);
    }
    return sprite;
  }

  private drawSprite(
    popup: Popup,
    palette: TonePalette,
    { cell, wellWidth }: { readonly cell: number; readonly wellWidth: number },
  ): WordSprite | null {
    const canvas = this.ctx.canvas.ownerDocument.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    let size = Math.round(cell * (popup.size ?? (popup.kind === 'shout' ? 0.85 : 1.05)));
    ctx.font = wordFont(size, true);
    let text = ctx.measureText(popup.text).width;
    if (text > wellWidth * FIT) {
      size = Math.floor((size * wellWidth * FIT) / text);
      ctx.font = wordFont(size, true);
      text = ctx.measureText(popup.text).width;
    }
    const blur = cell * (popup.kind === 'shout' ? 0.9 : 0.7);
    const line = Math.max(2, cell * 0.12);
    // A blur reaches about one and a half times its size beyond the letters.
    const margin = Math.ceil(blur * 1.5 + line);
    canvas.width = Math.ceil(text + 2 * margin);
    canvas.height = Math.ceil(size * 1.5 + 2 * margin);
    // Sizing the canvas reset its state.
    ctx.font = wordFont(size, true);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const x = canvas.width / 2;
    const y = canvas.height / 2;
    ctx.lineWidth = line;
    ctx.strokeStyle = palette.wellBackground;
    ctx.strokeText(popup.text, x, y);
    const heat = popup.heat ? palette.effects.heat[popup.heat] : null;
    ctx.shadowColor = heat ?? palette.effects.rift;
    ctx.shadowBlur = blur;
    ctx.fillStyle = heat ?? palette.crack;
    ctx.fillText(popup.text, x, y);
    return { canvas, text };
  }

  private glow(color: string): CanvasGradient {
    let gradient = this.glows.get(color);
    if (!gradient) {
      gradient = this.ctx.createLinearGradient(0, 0, 1, 0);
      gradient.addColorStop(0, color);
      gradient.addColorStop(1, faded(color));
      this.glows.set(color, gradient);
    }
    return gradient;
  }
}

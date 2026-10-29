import type { TonePalette } from '@/render/TonePalette';
import { EFFECT_TIMINGS, type FallingEffects, type Popup } from '../fx/FallingEffects';

const { POPUP_MS } = EFFECT_TIMINGS;

/** Where a word is drawn on the canvas (px), `rise` cells above its place as it ages. */
export type WordPlace = (popup: Popup, rise: number) => { readonly x: number; readonly y: number };

/**
 * The well's words (1.41), drawn alike by the falling well and the Tower:
 * points, the word of a moment, a combo's shout. A word pops in (bigger, then
 * settling), rises and fades; a combo's word wears its heat, a word wider than
 * the well (a long shout, in Russian) shrinks to fit. `cell` and `wellWidth`
 * are in device pixels.
 */
export function paintWords(
  ctx: CanvasRenderingContext2D,
  effects: FallingEffects,
  palette: TonePalette,
  scale: { readonly cell: number; readonly wellWidth: number },
  place: WordPlace,
): void {
  if (effects.popups.length === 0) return;
  const { cell, wellWidth } = scale;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = Math.max(2, cell * 0.12);
  ctx.strokeStyle = palette.wellBackground;
  for (const popup of effects.popups) {
    if (popup.age < 0) continue;
    const t = popup.age / (popup.life ?? POPUP_MS);
    const word = popup.kind === 'label' || popup.kind === 'shout';
    // Words pop in (a quick overshoot), then rise slower than the points.
    const punch = word ? (popup.punch ?? 0.35) : 0;
    const pop = 1 + punch * Math.max(0, 1 - popup.age / (popup.punchMs ?? 160));
    const base = popup.size ?? (popup.kind === 'shout' ? 0.85 : word ? 1.05 : 0.75);
    const font = (px: number) =>
      `${word ? 900 : 800} ${px}px 'Unbounded Variable', ui-rounded, system-ui, sans-serif`;
    let size = Math.round(cell * base * pop);
    ctx.font = font(size);
    const wide = ctx.measureText(popup.text).width;
    if (wide > wellWidth * 0.94) {
      size = Math.floor((size * wellWidth * 0.94) / wide);
      ctx.font = font(size);
    }
    const { x, y } = place(popup, t * (popup.kind === 'shout' ? 0.6 : word ? 0.8 : 1.6));
    ctx.globalAlpha = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
    ctx.strokeText(popup.text, x, y);
    const heat = popup.heat ? palette.effects.heat[popup.heat] : null;
    if (word) {
      ctx.shadowColor = heat ?? palette.effects.rift;
      ctx.shadowBlur = cell * (popup.kind === 'shout' ? 0.9 : 0.7);
    }
    ctx.fillStyle = heat ?? (word ? palette.crack : palette.accent);
    ctx.fillText(popup.text, x, y);
    ctx.shadowBlur = 0;
  }
  ctx.globalAlpha = 1;
}

/**
 * A combo's heat on the canvas' edges (1.41): a glow in its colour that rises
 * with each clear of the chain and fades once it ends. Screen space.
 */
export function paintHeat(
  ctx: CanvasRenderingContext2D,
  effects: FallingEffects,
  palette: TonePalette,
  cell: number,
): void {
  if (effects.heat <= 0) return;
  const { width, height } = ctx.canvas;
  const color = palette.effects.heat[effects.heatColor];
  const line = Math.max(2, cell * (0.08 + 0.14 * effects.heat));
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = cell * (0.4 + 0.8 * effects.heat);
  ctx.globalAlpha = 0.25 + 0.55 * effects.heat;
  ctx.lineWidth = line;
  ctx.strokeRect(line / 2, line / 2, width - line, height - line);
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
}

/** The rift's own light over the whole canvas: warm, added to the picture, never a white veil. */
export function paintRiftLight(ctx: CanvasRenderingContext2D, effects: FallingEffects): void {
  if (effects.wellFlash <= 0) return;
  const { width, height } = ctx.canvas;
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = `rgb(255 170 80 / ${effects.wellFlash})`;
  ctx.fillRect(0, 0, width, height);
  ctx.globalCompositeOperation = 'source-over';
}

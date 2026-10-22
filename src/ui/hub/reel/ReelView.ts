import type { EffectsProfile } from '@/fx/EffectsProfile';
import type { TonePalette } from '@/render/TonePalette';
import type { Scene } from '@/showcase/Scene';

/** What a family's well needs to draw a scene of the title screen's reel. */
export interface ReelContext {
  readonly canvas: HTMLCanvasElement;
  /** The player's effect level, without the shake (a title screen). */
  readonly profile: () => EffectsProfile;
  readonly palette: () => TonePalette;
  readonly dark: () => boolean;
  readonly formatPoints: (points: number) => string;
  /** The combo's word, translated ("COMBO ×3"). */
  readonly comboWord: (combo: number) => string;
}

/**
 * A scene's well on the title screen: the family's own renderer and effects,
 * as in a game, without input or sound.
 */
export interface ReelView {
  /** Fits the well in its box (CSS pixels). */
  layout(width: number, height: number, pixelRatio: number): void;
  /** The theme changed: the colours are read again. */
  repaint(): void;
  /** Time passes for the effects (and the camera). */
  update(deltaMs: number): void;
  /** Draws the well as it is. */
  render(): void;
  dispose(): void;
}

export type ReelViewFactory = (scene: Scene, context: ReelContext) => ReelView;

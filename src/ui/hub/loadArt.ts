import type { GemArt } from './GemArt';
import type { HubScene } from './HubScene';
import type { HomeReel } from './reel/HomeReel';

let art: Promise<GemArt> | null = null;

/**
 * The menus' gem pictures, loaded once and shared, after the first paint:
 * they use the game's render code, which the first screen does not wait for.
 */
export function loadGemArt(): Promise<GemArt> {
  art ??= import('./GemArt').then(({ GemArt: Art }) => Art.fromDocument());
  return art;
}

/** The title screen's living backdrop, on a canvas. */
export async function createHubScene(canvas: HTMLCanvasElement, still: boolean): Promise<HubScene> {
  const [{ HubScene: Scene }, gems] = await Promise.all([import('./HubScene'), loadGemArt()]);
  return new Scene(canvas, gems, still);
}

/** The title screen's reel (real games playing their best moments), after the first paint. */
export async function createHomeReel(
  ...args: ConstructorParameters<typeof HomeReel>
): Promise<HomeReel> {
  const { HomeReel: Reel } = await import('./reel/HomeReel');
  return new Reel(...args);
}

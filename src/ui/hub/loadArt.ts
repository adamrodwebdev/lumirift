import type { GemArt } from './GemArt';
import type { HubScene } from './HubScene';

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

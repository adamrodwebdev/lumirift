import type { GemArt } from './GemArt';
import type { HubScene } from './HubScene';
import type { HomeReel } from './reel/HomeReel';

let art: Promise<GemArt> | null = null;
let loaded: Promise<void> | null = null;

/**
 * Resolves once the page has loaded and the browser has a moment free: the
 * menus' pictures never compete with the first screen for the network or the
 * processor (the title, the Play button come first).
 */
export function afterLoad(): Promise<void> {
  loaded ??= new Promise<void>((resolve) => {
    const idle = () => {
      if ('requestIdleCallback' in window) requestIdleCallback(() => resolve(), { timeout: 1500 });
      else setTimeout(resolve, 200);
    };
    if (document.readyState === 'complete') idle();
    else window.addEventListener('load', idle, { once: true });
  });
  return loaded;
}

/**
 * The menus' gem pictures, loaded once and shared, after the first screen:
 * they use the game's render code, which the first screen does not wait for.
 */
export function loadGemArt(): Promise<GemArt> {
  art ??= afterLoad()
    .then(() => import('./GemArt'))
    .then(({ GemArt: Art }) => Art.fromDocument());
  return art;
}

/** The title screen's living backdrop, on a canvas. */
export async function createHubScene(canvas: HTMLCanvasElement, still: boolean): Promise<HubScene> {
  await afterLoad();
  const [{ HubScene: Scene }, gems] = await Promise.all([import('./HubScene'), loadGemArt()]);
  return new Scene(canvas, gems, still);
}

/** The title screen's reel (real games playing their best moments), after the first screen. */
export async function createHomeReel(
  ...args: ConstructorParameters<typeof HomeReel>
): Promise<HomeReel> {
  await afterLoad();
  const { HomeReel: Reel } = await import('./reel/HomeReel');
  return new Reel(...args);
}

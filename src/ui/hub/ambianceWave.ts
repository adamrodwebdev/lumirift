/** How long the light takes to sweep the screen, then to fade (ms). */
const SWEEP_MS = 800;
const FADE_MS = 700;

/**
 * A new ambiance announces itself: a wave of its light spreads from the place
 * the player touched across the whole screen, then fades into the backdrop
 * (whose colours meanwhile cross-fade, see ambiances.css). Nothing with
 * reduced motion or calmer effects: the cross-fade alone says it there.
 */
export function ambianceWave(ambiance: string, from: HTMLElement): void {
  const root = document.documentElement;
  const calm =
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
    root.dataset.motion === 'still';
  if (calm || typeof from.animate !== 'function') return;
  const box = from.getBoundingClientRect();
  const x = box.left + box.width / 2;
  const y = box.top + box.height / 2;
  const wave = document.createElement('div');
  wave.className = 'ambiance-wave';
  wave.dataset.ambiancePreview = ambiance;
  wave.style.setProperty('--wave-x', `${Math.round(x)}px`);
  wave.style.setProperty('--wave-y', `${Math.round(y)}px`);
  wave.setAttribute('aria-hidden', 'true');
  document.body.append(wave);
  // Far enough to cover the farthest corner.
  const reach = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  const animation = wave.animate(
    [
      { '--wave-r': '0px', opacity: 1, easing: 'cubic-bezier(0.25, 0.6, 0.35, 1)' },
      {
        '--wave-r': `${Math.ceil(reach + 160)}px`,
        opacity: 1,
        offset: SWEEP_MS / (SWEEP_MS + FADE_MS),
      },
      { '--wave-r': `${Math.ceil(reach + 160)}px`, opacity: 0 },
    ],
    { duration: SWEEP_MS + FADE_MS },
  );
  const done = () => wave.remove();
  animation.onfinish = done;
  animation.oncancel = done;
}

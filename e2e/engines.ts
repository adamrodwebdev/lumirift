/**
 * Playwright's Firefox, playing a touch screen, sends the mouse's events
 * without the pointer events the game listens to (a piece lifted, a page
 * swiped, a cell tapped on the board; seen in the CI, 3 November 2026): the
 * tests that press and drag with the mouse play Firefox at the desktop only.
 * Chrome and WebKit play them on the phone, Firefox's clicks still count.
 */
export const FIREFOX_TOUCH_MOUSE = 'Firefox as a touch screen: the mouse sends no pointer events';

/**
 * How many times the usual time each engine's tests and their waits are given
 * (playwright.config.ts, `E2E_ENGINE`). The CI's WebKit draws without a
 * graphics card, about twice as slowly; on its iPhone, three times the pixels,
 * a game's time crawls further, as its frames count 100 ms at most.
 */
export const ENGINE_PACE = { chrome: 1, firefox: 1, webkit: 2 } as const;

/**
 * A test's own wait of `ms`, at the engine's pace (1.46.2): the waits given
 * by hand do not follow the config's. The guide's first line, 2.1 s of game
 * time, took more than 15 s on the CI's WebKit iPhone on a slow runner
 * (4 November), 13 s on a usual one.
 */
export function paced(ms: number): number {
  const engine = process.env.E2E_ENGINE ?? 'chrome';
  // An unknown engine never gets this far: the config refuses it.
  return Object.hasOwn(ENGINE_PACE, engine)
    ? ms * ENGINE_PACE[engine as keyof typeof ENGINE_PACE]
    : ms;
}

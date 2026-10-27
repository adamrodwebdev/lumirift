import type { Page } from '@playwright/test';

/*
 * The game's time in the timed journeys (the race). Once the game is on, the
 * page's clock stands still and moves only with the test's frames: a slow
 * machine adds no time of its own (on CI, the frames' round trips once put
 * the race 5 s ahead of the test, past a 3 s announcement). The page's clock
 * must have been installed (`page.clock.install()`).
 */

/** The clock stops, a second ahead (it never goes back): from now on, only frames move it. */
export async function freezeTime(page: Page): Promise<void> {
  const now = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(now + 1000);
}

/** Game time, 100 ms a frame. */
export async function play(page: Page, ms: number): Promise<void> {
  for (let t = 0; t < ms; t += 100) await page.clock.fastForward(100);
}

/** Game time, 100 ms a frame, until `done` holds: at most `ms` (the caller checks the result). */
export async function playUntil(
  page: Page,
  ms: number,
  done: () => Promise<boolean>,
): Promise<void> {
  for (let t = 0; t < ms && !(await done()); t += 100) await page.clock.fastForward(100);
}

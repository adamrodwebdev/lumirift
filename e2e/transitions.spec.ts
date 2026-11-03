import { expect, test, type Locator, type Page } from '@playwright/test';
import { closeDailyGift } from './dailyGift';

/*
 * The transitions (1.42): what arrives takes a tap from its first frame, what
 * leaves takes none; with reduced motion, nothing moves, everything fades.
 * The taps here do not wait for the motion to end (`force`: no wait for a
 * still element), as a hurried player's do not.
 */

const tab = (page: Page, name: string) => page.getByRole('tab', { name });
const panel = (page: Page, name: string) => page.getByRole('tabpanel', { name });
const settingsButton = (page: Page) => page.getByRole('button', { name: 'Réglages' });
const settingsWindow = (page: Page) => page.getByRole('dialog', { name: 'Réglages' });

/** A tap now, wherever the element is in its motion. */
const tapNow = (target: Locator) => target.click({ force: true });

/** The transforms of the animations running on `selector` (and its content) that move something. */
const moving = (page: Page, selector: string) =>
  page.evaluate((selector) => {
    // A transform that leaves everything in place, once the browser computes it on a box of its
    // own: each engine writes its keyframes its way (Firefox keeps `translateY(calc(0rem))`).
    const probe = document.createElement('div');
    probe.style.cssText =
      'position: fixed; inline-size: 100px; block-size: 100px; visibility: hidden';
    document.body.append(probe);
    const still = (transform: string) => {
      probe.style.transform = transform;
      const computed = getComputedStyle(probe).transform;
      return computed === 'none' || new DOMMatrix(computed).isIdentity;
    };
    const element = document.querySelector(selector);
    const moves = element
      ? element
          .getAnimations({ subtree: true })
          .flatMap((animation) => (animation.effect as KeyframeEffect).getKeyframes())
          .map((frame) => frame.transform)
          .filter(
            (transform): transform is string => typeof transform === 'string' && !still(transform),
          )
      : ['nothing at ' + selector];
    probe.remove();
    return moves;
  }, selector);

/** From the Modes page, a mode is started; the game's well shows. */
async function playClassic(page: Page) {
  await tab(page, 'Modes').click();
  await panel(page, 'Modes').getByRole('button', { name: 'Classique', exact: true }).click();
  await panel(page, 'Modes').getByRole('button', { name: 'Jouer' }).click();
  await expect(page.locator('canvas[role="img"]').first()).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await closeDailyGift(page);
  await page.goto('/');
  await page.locator('main').waitFor();
});

/**
 * Waits for the first element at `selector` to come on screen, then says whether a tap at its
 * centre lands on it, and how long after the call it was (ms).
 */
const firstTap = (page: Page, selector: string) =>
  page.evaluate(async (selector) => {
    const asked = performance.now();
    const target = document.querySelector(selector)!;
    for (;;) {
      const box = target.getBoundingClientRect();
      const x = box.x + box.width / 2;
      const y = box.y + box.height / 2;
      if (x > 0 && x < innerWidth && y > 0 && y < innerHeight) {
        const hit = document.elementFromPoint(x, y);
        return { lands: target.contains(hit), afterMs: performance.now() - asked };
      }
      await new Promise((resolve) => setTimeout(resolve, 8));
    }
  }, selector);

test('a page sliding in takes a tap at once', async ({ page }) => {
  await tab(page, 'Modes').click();
  // As soon as a tile of the new page comes on screen, still sliding, a tap lands on it.
  const tap = await firstTap(page, '#hub-panel-modes .tile');
  expect(tap.lands).toBe(true);
});

test('a page sliding in comes on screen within its slide', async ({ page, browserName }) => {
  test.skip(
    browserName === 'webkit',
    'Not timed in WebKit: the CI draws it without a graphics card, twice as slowly (500 ms)',
  );
  await tab(page, 'Modes').click();
  const tap = await firstTap(page, '#hub-panel-modes .tile');
  expect(tap.afterMs).toBeLessThan(260);
});

test('a window the player opens answers at once; closed, the page behind does too', async ({
  page,
}) => {
  await settingsButton(page).click();
  // As soon as its first control comes on screen, within what was a 350 ms wait until 1.42, a
  // tap lands on it (the windows' guard is for those that rise by themselves).
  const tap = await firstTap(page, 'dialog[open] .sheet__body :is(button, input, select)');
  expect(tap.lands).toBe(true);
  expect(tap.afterMs).toBeLessThan(300);
  await expect(settingsWindow(page)).toBeVisible();
  await page.keyboard.press('Escape');
  // Closed at once, even while it fades away: the menu behind takes the next tap.
  await tapNow(tab(page, 'Carte'));
  await expect(tab(page, 'Carte')).toHaveAttribute('aria-selected', 'true');
});

test('back from a game, the menu takes a tap as it rises', async ({ page }) => {
  await playClassic(page);
  await page.keyboard.press('KeyP');
  // A slow device: each frame comes 100 ms late, so the menu waits a while for its first paint.
  await page.evaluate(() => {
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (callback) =>
      raf((time) => void setTimeout(() => callback(time), 100));
  });
  await page
    .getByRole('dialog', { name: 'Pause' })
    .getByRole('button', { name: 'Quitter' })
    .click();
  // As soon as the menu is in place, before its first paint: the light that still covers it
  // lets the tap through (1.45.2: it took the taps of those two frames, lost on a slow machine).
  await page.locator('.hub').waitFor({ state: 'attached' });
  await tapNow(tab(page, 'Atelier'));
  await expect(tab(page, 'Atelier')).toHaveAttribute('aria-selected', 'true');
});

test.describe('with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('the transitions only fade: a window, a page, the rift', async ({ page }) => {
    await expect(page.locator('html')).toHaveAttribute('data-transitions', 'fade');

    await settingsButton(page).click();
    expect(await moving(page, 'dialog[open]')).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(settingsWindow(page)).toBeHidden();

    await tab(page, 'Modes').click();
    expect(await moving(page, '#hub-panel-modes')).toEqual([]);
    // The pages jump, the one shown fades in.
    const track = await page
      .locator('.hub__track')
      .evaluate((element) => element.getAnimations().length);
    expect(track).toBe(0);

    await panel(page, 'Modes').getByRole('button', { name: 'Classique', exact: true }).click();
    await panel(page, 'Modes').getByRole('button', { name: 'Jouer' }).click();
    expect(await moving(page, '.wipe')).toEqual([]);
    await expect(page.locator('canvas[role="img"]').first()).toBeVisible();
  });
});

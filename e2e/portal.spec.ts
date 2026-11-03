import { expect, test, type Page } from '@playwright/test';

/** The training's line over the well (its words are also read out, off screen: never those). */
const lineOver = (page: Page, text: string) => page.locator('.toast--line', { hasText: text });

/**
 * The first line shows 1.3 s before the bolt's shock replaces it: what the
 * player has on screen then, read at once in the page. The words a player
 * can read (a word has a letter; what only a screen reader hears left out).
 */
const firstScreen = (page: Page) =>
  page.evaluate(() => {
    const game = document.querySelector<HTMLElement>('.game')!;
    const count = (text: string) => text.split(/\s+/).filter((word) => /\p{L}/u.test(word)).length;
    const unseen = [...game.querySelectorAll<HTMLElement>('.sr-only')];
    const line = document.querySelector('.toast--line')!.getBoundingClientRect();
    const well = document.querySelector('canvas[role="img"]')!.getBoundingClientRect();
    const key = document.querySelector<HTMLElement>('.toast--line kbd [aria-hidden="true"]');
    const gesture = document.querySelector<HTMLElement>('.gesture');
    return {
      words: count(game.innerText) - unseen.reduce((sum, each) => sum + count(each.innerText), 0),
      goals: document.querySelectorAll('[role="group"].goal').length,
      legends: document.querySelectorAll('.game__help').length,
      key: key && key.offsetParent !== null ? key.innerText.trim() : null,
      gesture: gesture?.dataset.action ?? null,
      lineTop: line.top - well.top,
      lineBottom: line.bottom - well.top,
      wellHeight: well.height,
    };
  });

/**
 * The portals' first run (1.29), on the CrazyGames build: its SDK runs in its
 * local mode on localhost, where the player's language is always English. A
 * new player lands in the training's first step, with no title screen and no
 * menu; the pause offers to pass it, then the menus open, for good. Its first
 * seconds (1.46): one short line over the well, the bolt low over the water,
 * its shock within moments even if the player does nothing. A desktop, with
 * its keys, whatever the project's device (a phone shows the gesture instead).
 */
test.describe('on a desktop', () => {
  test.use({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
  });

  test('a new player on a portal starts in the training, and may pass it', async ({ page }) => {
    await page.goto('/');
    const line = lineOver(page, 'Drop lightning into the water!');
    await expect(line).toBeVisible();
    const first = await firstScreen(page);
    await expect(page.getByRole('tab', { name: 'Home' })).toHaveCount(0);
    // Nothing else to read yet: no goal (it comes with the Wyrm), no legend, the key under the line.
    expect(first).toMatchObject({ goals: 0, legends: 0, key: 'SPACE', gesture: null });
    expect(first.words).toBeLessThan(15);
    // At the top of the well, over the sand still empty there.
    expect(first.lineTop).toBeGreaterThanOrEqual(0);
    expect(first.lineBottom).toBeLessThan(first.wellHeight * 0.3);
    // Left alone, the bolt shocks the bed at once; the reward says what it did, in the line's place.
    await expect(page.locator('.toast__head', { hasText: 'Shock!' })).toBeVisible({
      timeout: 3000,
    });
    await expect(line).toBeHidden();

    // The pause: no menu yet, the training may be passed.
    await page.getByRole('button', { name: 'Pause' }).click();
    const pause = page.getByRole('dialog', { name: 'Paused' });
    await expect(pause.getByRole('button', { name: 'Resume' })).toBeVisible();
    await expect(pause.getByRole('button', { name: 'Restart' })).toHaveCount(0);
    await expect(pause.getByRole('button', { name: 'Quit' })).toHaveCount(0);
    await pause.getByRole('button', { name: 'Skip the training' }).click();

    // The menus open, and the next visit starts on them.
    await expect(page.getByRole('tab', { name: 'Home' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('tab', { name: 'Home' })).toBeVisible();
  });
});

/**
 * A phone held upright (1.46): the line's gesture is drawn big over the well,
 * and the training's goal comes with the Wyrm, about twelve seconds in, in a
 * row kept for it from the start: the well never moves.
 */
test.describe('on a phone held upright', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('the gesture shows how; the goal comes with the Wyrm, the well still', async ({ page }) => {
    test.setTimeout(45_000);
    await page.goto('/');
    await expect(lineOver(page, 'Drop lightning into the water!')).toBeVisible();
    // A touch screen shows the gesture (drawn once the well is measured), not the keys.
    await expect(page.locator('.gesture[data-action="drop"]')).toBeAttached();
    expect(await firstScreen(page)).toMatchObject({ gesture: 'drop', key: null, goals: 0 });
    const well = page.getByRole('img', { name: 'Sand well' });
    const before = await well.boundingBox();
    const goal = page.getByRole('group', { name: 'Goal' });
    await expect(goal).toBeVisible({ timeout: 25_000 });
    await expect(goal).toContainText('Training');
    await expect(goal).toContainText('Drive off the Wyrm');
    expect(await well.boundingBox()).toEqual(before);
  });
});

/**
 * A phone held sideways (640 × 360) in the longest language: the training's
 * longest line stays inside the well, whole (1.46; the guide's card fitted
 * under the score in 1.45.2). Without the SDK, the saved language applies.
 */
test.describe('on a short landscape phone', () => {
  test.use({ viewport: { width: 640, height: 360 }, isMobile: true, hasTouch: true });

  test('the longest line fits over the well, in Russian', async ({ page }) => {
    await page.route(/sdk\.crazygames\.com/, (route) => route.abort());
    await page.addInitScript(() =>
      localStorage.setItem('stackrift:settings', JSON.stringify({ locale: 'ru' })),
    );
    await page.goto('/');
    // The second piece's line, after the shock's reward: the longest the training says in Russian.
    const line = lineOver(page, 'Соедините стенки одним цветом!');
    await expect(line).toBeVisible({ timeout: 10_000 });
    const well = (await page.getByRole('img', { name: 'Песчаное поле' }).boundingBox())!;
    const fit = await line.evaluate((words) => ({
      box: words.getBoundingClientRect().toJSON() as DOMRect,
      spill: words.scrollWidth - words.clientWidth,
    }));
    expect(fit.spill).toBeLessThanOrEqual(1);
    expect(fit.box.left).toBeGreaterThanOrEqual(well.x);
    expect(fit.box.right).toBeLessThanOrEqual(well.x + well.width);
    expect(fit.box.bottom).toBeLessThanOrEqual(360);
  });
});

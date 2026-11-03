import { expect, test } from '@playwright/test';

/**
 * The portals' first run (1.29), on the CrazyGames build: its SDK runs in its
 * local mode on localhost, where the player's language is always English. A
 * new player lands in the training's first step, with no title screen and no
 * menu; the pause offers to pass it, then the menus open, for good.
 */
test('a new player on a portal starts in the training, and may pass it', async ({ page }) => {
  await page.goto('/');
  const goal = page.getByRole('group', { name: 'Goal' });
  await expect(goal).toContainText('Training');
  await expect(goal).toContainText('Drive off the Wyrm');
  await expect(page.getByRole('tab', { name: 'Home' })).toHaveCount(0);
  // The guide says what to do with the piece in play (a bolt over the water first), beside the well, never over it.
  const guide = page
    .getByText('Lightning on water shatters the sand around it: drop it!')
    .filter({ visible: true });
  await expect(guide).toBeVisible();
  const well = await page.getByRole('img', { name: 'Sand well' }).boundingBox();
  const line = await guide.boundingBox();
  expect(line!.y + line!.height <= well!.y || line!.x + line!.width <= well!.x).toBe(true);

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

/**
 * A phone held sideways (640 × 360) in the longest language: the guide keeps
 * the room of its longest line under the score, whole and on the screen, the
 * training's goal standing in the right column (1.45.2). Without the SDK, the
 * saved language applies.
 */
test.describe('on a short landscape phone', () => {
  test.use({ viewport: { width: 640, height: 360 }, isMobile: true, hasTouch: true });

  test('the guide fits, in Russian', async ({ page }) => {
    await page.route(/sdk\.crazygames\.com/, (route) => route.abort());
    await page.addInitScript(() =>
      localStorage.setItem('stackrift:settings', JSON.stringify({ locale: 'ru' })),
    );
    await page.goto('/');
    const card = page.locator('.game__guide');
    await expect(card).toBeVisible();
    await expect(page.getByRole('group', { name: 'Цель' })).toContainText('Обучение');
    const fit = await card.evaluate((guide) => {
      const box = guide.getBoundingClientRect();
      const line = guide.querySelector('.guide__line:not(.guide__line--room)')!;
      return {
        spill: guide.scrollHeight - guide.clientHeight,
        lineBelow: line.getBoundingClientRect().bottom - box.bottom,
        cardBelow: box.bottom - innerHeight,
      };
    });
    expect(fit.spill).toBeLessThanOrEqual(1);
    expect(fit.lineBelow).toBeLessThanOrEqual(1);
    expect(fit.cardBelow).toBeLessThanOrEqual(0);
  });
});

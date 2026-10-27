import { expect, test, type Page } from '@playwright/test';

/*
 * The Rift Race (1.34), in French: closed until the campaign reaches 4-4,
 * then a run through the worlds, the clock and the shifts seen coming, and
 * the end window with the week's record. The game's clock is driven by hand.
 */

/** The levels won before 4-4: the three worlds played, the Tower last (4-3). */
const WON = [
  ...['1-1', '1-2', '1-3', '1-4', '1-5', '1-6'],
  ...['2-1', '2-2', '2-3', '2-4', '2-5', '2-6', '2-7'],
  ...['3-1', '3-2', '3-3', '3-4', '3-5', '3-6', '3-7'],
  ...['4-1', '4-2', '4-3'],
];

const modes = (page: Page) => page.getByRole('tabpanel', { name: 'Modes' });
const banner = (page: Page) => modes(page).getByRole('button', { name: /^Course de la faille/ });

/** Game time, 100 ms a frame. */
async function play(page: Page, ms: number) {
  for (let t = 0; t < ms; t += 100) await page.clock.fastForward(100);
}

test.beforeEach(async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  await page.locator('main').waitFor();
});

test('the race waits for the campaign: it opens once the three worlds were played', async ({
  page,
}) => {
  await page.getByRole('tab', { name: 'Modes' }).click();
  await banner(page).click();
  await expect(modes(page)).toContainText('S’ouvre au niveau 4-4');
  await expect(modes(page).getByRole('button', { name: 'Jouer' })).toBeDisabled();
});

test('a run of the race: the clock, the worlds, the shift seen coming, the week’s record', async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.evaluate((won) => {
    const stars = Object.fromEntries(won.map((id) => [id, 2]));
    localStorage.setItem('stackrift:campaign', JSON.stringify({ stars, ranks: {} }));
    localStorage.setItem('stackrift:profile', JSON.stringify({ games: 12 }));
  }, WON);
  await page.reload();
  await page.getByRole('tab', { name: 'Modes' }).click();
  await banner(page).click();
  await expect(modes(page)).toContainText('Trois mondes, un seul chrono');
  await modes(page).getByRole('button', { name: 'Jouer' }).click();
  await expect(page.locator('canvas[role="img"]').first()).toBeVisible();

  const timer = page.getByRole('timer');
  await expect(timer).toHaveAccessibleName('Temps restant : 1:30, 99 secondes au plus');
  const worlds = page.getByRole('list', { name: 'Les mondes de la course' });
  await expect(worlds.locator('[aria-current="step"]')).toContainText('Puits');

  // Three seconds before the shift, the next world is announced: its lines count double.
  await play(page, 37_000);
  await expect(page.getByText('La faille change de monde : Sable.')).toBeAttached();
  await expect(page.locator('.shift')).toContainText('Les lignes comptent double');
  // The wipe, then the Sand on a fresh board, 10 s on the clock for reaching it.
  await play(page, 4_000);
  await expect(worlds.locator('[aria-current="step"]')).toContainText('Sable');
  await expect(page.locator('.shift')).toHaveCount(0);
  await expect(timer).toHaveAccessibleName(/^Temps restant\s:\s(1:00|0:59),/);

  // Only the clock ends the run; its window shows the record and the week's.
  await play(page, 90_000);
  const over = page.getByRole('dialog');
  await expect(over).toBeVisible({ timeout: 15_000 });
  await expect(over).toContainText(/Nouveau record|Record de la semaine/);
  await expect(over.getByRole('button', { name: 'Rejouer' })).toBeVisible();
});

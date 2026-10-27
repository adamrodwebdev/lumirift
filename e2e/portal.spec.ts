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

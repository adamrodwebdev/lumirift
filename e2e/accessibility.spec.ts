import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/*
 * Automatic WCAG 2.2 AA audits (axe-core) of every screen and dialog, in
 * the game's one theme (the Rift). They complement Lighthouse, which only audits the home page.
 */

const audit = async (page: Page) => {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const summary = violations.map(
    (v) => `${v.id}: ${v.help} — ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`,
  );
  expect(summary).toEqual([]);
};

const modesPage = (page: Page) => page.getByRole('tabpanel', { name: 'Modes' });

const openMode = async (page: Page, name: string) => {
  await page.getByRole('tab', { name: 'Modes' }).click();
  await modesPage(page).getByRole('button', { name, exact: true }).click();
  await modesPage(page).getByRole('button', { name: 'Jouer' }).click();
  if (name === 'Duel') await page.getByRole('button', { name: /IA normale/ }).click();
  await expect(page.locator('canvas[role="img"]').first()).toBeVisible();
};

for (const theme of ['dark'] as const) {
  test.describe(`${theme} theme`, () => {
    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await page.goto('/');
    });

    test('the menu: home, modes and Atelier pages', async ({ page }) => {
      await audit(page);
      for (const name of ['Modes', 'Atelier']) {
        await page.getByRole('tab', { name }).click();
        await expect(page.getByRole('tab', { name })).toHaveAttribute('aria-selected', 'true');
        await audit(page);
      }
    });

    test('settings and objectives', async ({ page }) => {
      await page.getByRole('button', { name: 'Réglages' }).click();
      await expect(page.getByRole('dialog', { name: 'Réglages' })).toBeVisible();
      await audit(page);
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: /Objectifs du jour/ }).click();
      await expect(page.getByRole('dialog', { name: 'Objectifs du jour' })).toBeVisible();
      await audit(page);
    });

    test('duel opponent choice', async ({ page }) => {
      await page.getByRole('tab', { name: 'Modes' }).click();
      await modesPage(page).getByRole('button', { name: 'Duel', exact: true }).click();
      await modesPage(page).getByRole('button', { name: 'Jouer' }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await audit(page);
    });

    for (const mode of ['Classique', 'Duel', 'Sable', 'Mosaïque', 'Tour']) {
      test(`${mode}: game, pause and end`, async ({ page }) => {
        await openMode(page, mode);
        await audit(page);
        await page.keyboard.press('KeyP');
        await expect(page.getByRole('dialog', { name: 'Pause' })).toBeVisible();
        await audit(page);
      });
    }

    test('end of a game', async ({ page }) => {
      await openMode(page, 'Classique');
      const over = page.getByRole('dialog', { name: 'Partie terminée' });
      for (let i = 0; i < 60 && !(await over.isVisible()); i++) {
        await page.keyboard.press('Space');
        await page.waitForTimeout(60);
      }
      await expect(over).toBeVisible({ timeout: 5000 });
      await audit(page);
    });
  });
}

for (const theme of ['dark'] as const) {
  test(`${theme} theme: campaign map, level and upgrades`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await page.goto('/');
    await page.getByRole('tab', { name: 'Carte' }).click();
    const map = page.getByRole('tabpanel', { name: 'Carte' });
    await expect(map.getByRole('heading', { name: 'Premiers blocs' })).toBeVisible();
    await audit(page);
    await map.getByRole('button', { name: /1-1/ }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await audit(page);
    await page.keyboard.press('Escape');
    await map.getByRole('button', { name: /^Améliorations/ }).click();
    await expect(page.getByRole('dialog', { name: 'Améliorations' })).toBeVisible();
    await audit(page);
  });
}

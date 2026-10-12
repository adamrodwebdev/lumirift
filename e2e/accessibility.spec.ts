import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/*
 * Automatic WCAG 2.2 AA audits (axe-core) of every screen and dialog, in
 * both themes. They complement Lighthouse, which only audits the home page.
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

const openMode = async (page: Page, name: string) => {
  await page
    .locator('.modes__grid .mode')
    .filter({ has: page.locator('.mode__name', { hasText: new RegExp(`^${name}$`) }) })
    .click();
  if (name === 'Duel') await page.getByRole('button', { name: /IA normale/ }).click();
  await expect(page.locator('canvas[role="img"]').first()).toBeVisible();
};

for (const theme of ['light', 'dark'] as const) {
  test.describe(`${theme} theme`, () => {
    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
      await page.goto('/');
    });

    test('home page', async ({ page }) => {
      await audit(page);
    });

    test('settings and Atelier', async ({ page }) => {
      await page.getByRole('button', { name: 'Réglages' }).click();
      await expect(page.getByRole('dialog', { name: 'Réglages' })).toBeVisible();
      await audit(page);
      await page.keyboard.press('Escape');
      await page.getByRole('button', { name: 'Atelier' }).click();
      await expect(page.getByRole('dialog', { name: 'Atelier' })).toBeVisible();
      await audit(page);
    });

    test('duel opponent choice', async ({ page }) => {
      await page
        .locator('.modes__grid .mode')
        .filter({ has: page.locator('.mode__name', { hasText: /^Duel$/ }) })
        .click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await audit(page);
    });

    for (const mode of ['Classique', 'Duel', 'Sable', 'Mosaïque', 'Tour']) {
      test(`${mode}: game, pause and end`, async ({ page }) => {
        await openMode(page, mode);
        await audit(page);
        await page.keyboard.press('Escape');
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

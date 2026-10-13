import { expect, test, type Page } from '@playwright/test';

/*
 * The player's journeys, in French (the browser's language), on a phone and
 * on a desktop. Each test starts from an empty device: no settings, no records.
 */

const MODES = [
  'Classique',
  'Marée',
  'Renversement',
  'Chroma',
  'Miroir',
  'Fusion',
  'Bascule',
  'Silhouette',
  'Rythme',
  'Duel',
  'Mosaïque',
  'Sable',
  'Tour',
];

const modeButton = (page: Page, name: string) =>
  page
    .locator('.track .mode')
    .filter({ has: page.locator('.mode__name', { hasText: new RegExp(`^${name}$`) }) });

/** The page never scrolls sideways. */
async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

async function openMode(page: Page, name: string) {
  await modeButton(page, name).click();
  if (name === 'Duel') await page.getByRole('button', { name: /IA normale/ }).click();
  // The duel shows two wells: the player's comes first.
  await expect(page.locator('canvas[role="img"]').first()).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('the home page presents the game, the daily challenge and every mode', async ({ page }) => {
  await expect(page).toHaveTitle('Stackrift — le jeu de blocs réinventé');
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await expect(page.getByRole('heading', { name: 'Défi du jour' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Niveau 1' })).toBeVisible();
  for (const name of MODES) await expect(modeButton(page, name)).toBeVisible();
  await expectNoHorizontalScroll(page);
});

for (const name of MODES) {
  test(`${name}: the game opens, pauses and quits`, async ({ page }) => {
    await openMode(page, name);
    await expect(page.getByRole('definition').first()).toBeVisible();
    await expectNoHorizontalScroll(page);
    await page.keyboard.press('Escape');
    const pause = page.getByRole('dialog', { name: 'Pause' });
    await expect(pause).toBeVisible();
    await pause.getByRole('button', { name: 'Reprendre' }).click();
    await expect(pause).toBeHidden();
    await page.keyboard.press('Escape');
    await page
      .getByRole('dialog', { name: 'Pause' })
      .getByRole('button', { name: 'Quitter' })
      .click();
    await expect(page.getByRole('heading', { name: 'Modes de jeu' })).toBeVisible();
  });
}

test('a classic game is played with the keyboard to the end, then counted', async ({ page }) => {
  await openMode(page, 'Classique');
  const over = page.getByRole('dialog', { name: 'Partie terminée' });
  for (let i = 0; i < 60 && !(await over.isVisible()); i++) {
    await page.keyboard.press('Space');
    await page.waitForTimeout(60);
  }
  await expect(over).toBeVisible({ timeout: 5000 });
  await expect(over.getByText('Nouveau record')).toBeVisible();
  // The record shows on the home page.
  await over.getByRole('button', { name: 'Accueil' }).click();
  await expect(modeButton(page, 'Classique')).toContainText('Record');
});

test('the daily challenge is timed', async ({ page }) => {
  await page.getByRole('button', { name: 'Relever le défi' }).click();
  await expect(page.getByText('Temps restant')).toBeVisible();
});

test('the Mosaic is played with the keyboard', async ({ page }) => {
  await openMode(page, 'Mosaïque');
  const score = page.locator('.hud__item').first().locator('dd');
  await expect(score).toHaveText('0');
  await page.keyboard.press('Digit1');
  await page.keyboard.press('Enter');
  await expect(score).not.toHaveText('0');
});

test('the language and the theme are remembered', async ({ page }) => {
  await page.getByRole('button', { name: 'Réglages' }).click();
  const settings = page.getByRole('dialog', { name: 'Réglages' });
  await settings.getByLabel('Langue').selectOption('en');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.keyboard.press('Escape');
  const theme = await page.locator('html').getAttribute('data-theme');
  await page.getByRole('button', { name: /Switch to (light|dark) theme/ }).click();
  const switched = theme === 'dark' ? 'light' : 'dark';
  await expect(page.locator('html')).toHaveAttribute('data-theme', switched);

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Game modes' })).toBeVisible();
  await expect(page).toHaveTitle('Stackrift — the falling-blocks game, reinvented');
  await expect(page.locator('html')).toHaveAttribute('data-theme', switched);
});

test('the Atelier shows the collection; locked items say how to earn them', async ({ page }) => {
  await page.getByRole('button', { name: 'Atelier' }).click();
  const atelier = page.getByRole('dialog', { name: 'Atelier' });
  await expect(atelier).toBeVisible();
  const crystal = atelier.getByRole('button', { name: /Cristal/ });
  await expect(crystal).toHaveAttribute('aria-pressed', 'true');
  const neon = atelier.getByRole('button', { name: /Néon/ });
  await expect(neon).toHaveAttribute('aria-disabled', 'true');
  await expect(neon).toContainText('Niveau 3');
  // A locked item cannot be worn, even when activated from the keyboard.
  await neon.focus();
  await page.keyboard.press('Enter');
  await expect(crystal).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Escape');
  await expect(atelier).toBeHidden();
});

test('no error reaches the console while playing', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.reload();
  for (const name of ['Classique', 'Sable', 'Mosaïque', 'Tour']) {
    await openMode(page, name);
    await page.keyboard.press('Space');
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: 'Accueil' }).click();
  }
  expect(errors).toEqual([]);
});

test('keyboard users skip to the content and land on each new screen', async ({ page }) => {
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Aller au contenu' })).toBeFocused();
  await modeButton(page, 'Classique').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('canvas[role="img"]')).toBeVisible();
  await expect(page.locator('main')).toBeFocused();
  // The game still answers the keyboard with the focus on the main region.
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Pause' })).toBeVisible();
});

test('no horizontal scroll from 320 to 1920 px, at home and in every family', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'desktop', 'One sweep is enough');
  for (const width of [320, 360, 640, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/');
    await expectNoHorizontalScroll(page);
    for (const name of ['Classique', 'Duel', 'Sable', 'Mosaïque', 'Tour']) {
      await openMode(page, name);
      await expectNoHorizontalScroll(page);
      await page.getByRole('button', { name: 'Accueil' }).click();
    }
  }
});

test('the modes swiper pages through the modes and filters them by family', async ({ page }) => {
  const next = page.getByRole('button', { name: 'Modes suivants' });
  const previous = page.getByRole('button', { name: 'Modes précédents' });
  await expect(previous).toBeDisabled();
  await next.click();
  await expect(previous).toBeEnabled();
  await page.getByRole('button', { name: 'Placement', exact: true }).click();
  await expect(page.locator('.track .mode')).toHaveCount(1);
  await expect(modeButton(page, 'Mosaïque')).toBeVisible();
});

test('the campaign: map, a level, its goal, then back to the map', async ({ page }) => {
  await page.getByRole('button', { name: 'Carte et améliorations' }).click();
  await expect(page.getByRole('heading', { name: 'Campagne', level: 1 })).toBeVisible();
  // Only the first level is open.
  await expect(page.getByRole('button', { name: /1-2/ })).toHaveAttribute('aria-disabled', 'true');
  await page.getByRole('button', { name: /1-1/ }).click();
  const detail = page.getByRole('dialog', { name: 'Niveau 1-1 · Classique' });
  await expect(detail).toContainText('Effacer 5 lignes');
  await detail.getByRole('button', { name: 'Jouer' }).click();
  await expect(page.getByRole('group', { name: 'Objectif' })).toContainText('0 / 5');
  await expect(page.locator('canvas[role="img"]')).toBeVisible();
  await page.keyboard.press('Escape');
  await page
    .getByRole('dialog', { name: 'Pause' })
    .getByRole('button', { name: 'Quitter' })
    .click();
  await expect(page.getByRole('heading', { name: 'Campagne', level: 1 })).toBeVisible();
});

test('the upgrades are bought with campaign stars, and refunded', async ({ page }) => {
  await page.evaluate(() =>
    localStorage.setItem(
      'stackrift:campaign',
      JSON.stringify({ stars: { '1-1': 3, '1-2': 2 }, ranks: {} }),
    ),
  );
  await page.reload();
  await page.getByRole('button', { name: 'Carte et améliorations' }).click();
  await page.getByRole('button', { name: /^Améliorations/ }).click();
  const shop = page.getByRole('dialog', { name: 'Améliorations' });
  await expect(shop).toContainText('5 étoiles disponibles');
  const phoenix = shop.getByRole('listitem').filter({ hasText: 'Phénix' });
  await phoenix.getByRole('button', { name: /Améliorer/ }).click();
  await expect(shop).toContainText('3 étoiles disponibles');
  await expect(phoenix.getByRole('img', { name: 'Rang 1 sur 3' })).toBeVisible();
  await shop.getByRole('button', { name: 'Rendre toutes les étoiles' }).click();
  await expect(shop).toContainText('5 étoiles disponibles');
});

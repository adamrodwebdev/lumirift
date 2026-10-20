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

type Tab = 'Accueil' | 'Modes' | 'Carte' | 'Atelier';
/** The menu's tabs and their pages. */
const tab = (page: Page, name: Tab) => page.getByRole('tab', { name });
const panel = (page: Page, name: Tab) => page.getByRole('tabpanel', { name });
const modeTile = (page: Page, name: string) =>
  panel(page, 'Modes').getByRole('button', { name, exact: true });

/** The page never scrolls sideways. */
async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

/** A game has no page header: the pause leads home. */
async function quitGame(page: Page) {
  await page.keyboard.press('KeyP');
  await page
    .getByRole('dialog', { name: 'Pause' })
    .getByRole('button', { name: 'Quitter' })
    .click();
}

/** From the Modes page: the tile shows the mode, Play starts it. */
async function openMode(page: Page, name: string) {
  await tab(page, 'Modes').click();
  await modeTile(page, name).click();
  await panel(page, 'Modes').getByRole('button', { name: 'Jouer' }).click();
  if (name === 'Duel') await page.getByRole('button', { name: /IA normale/ }).click();
  // The duel shows two wells: the player's comes first.
  await expect(page.locator('canvas[role="img"]').first()).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('the title screen: the logo, one big Play, the daily challenge, every mode', async ({
  page,
}) => {
  await expect(page).toHaveTitle('Lumirift Blocks — le jeu de blocs réinventé');
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await expect(page.getByRole('heading', { name: 'Lumirift Blocks', level: 1 })).toBeVisible();
  const home = panel(page, 'Accueil');
  await expect(home.getByRole('button', { name: /^Jouer/ })).toBeVisible();
  await expect(home.getByRole('button', { name: /Défi du jour/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Niveau 1,/ })).toBeVisible();
  await expect(tab(page, 'Accueil')).toHaveAttribute('aria-selected', 'true');
  await tab(page, 'Modes').click();
  for (const name of MODES) await expect(modeTile(page, name)).toBeVisible();
  // The menu is one screen: nothing scrolls, either way.
  await expectNoHorizontalScroll(page);
  const overflow = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('the first game is guided, step by step, and the guide can be skipped', async ({ page }) => {
  await panel(page, 'Accueil')
    .getByRole('button', { name: /^Jouer/ })
    .click();
  await expect(page.locator('canvas[role="img"]').first()).toBeVisible();
  const coach = page.getByRole('status').filter({ hasText: 'Déplacez la pièce' });
  await expect(coach).toBeVisible();
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByText('Tournez-la')).toBeVisible();
  await page.getByRole('button', { name: 'Passer le guide' }).click();
  await expect(page.getByText('Tournez-la')).toBeHidden();
});

for (const name of MODES) {
  test(`${name}: the game opens, pauses and quits`, async ({ page }) => {
    await openMode(page, name);
    await expect(page.getByRole('definition').first()).toBeVisible();
    await expectNoHorizontalScroll(page);
    await page.keyboard.press('KeyP');
    const pause = page.getByRole('dialog', { name: 'Pause' });
    await expect(pause).toBeVisible();
    await pause.getByRole('button', { name: 'Reprendre' }).click();
    await expect(pause).toBeHidden();
    await page.keyboard.press('KeyP');
    await page
      .getByRole('dialog', { name: 'Pause' })
      .getByRole('button', { name: 'Quitter' })
      .click();
    // Back to the page the game was started from.
    await expect(tab(page, 'Modes')).toHaveAttribute('aria-selected', 'true');
    await expect(modeTile(page, name)).toBeVisible();
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
  // The record shows with the mode, back on the Modes page.
  await over.getByRole('button', { name: 'Accueil' }).click();
  await modeTile(page, 'Classique').click();
  await expect(panel(page, 'Modes')).toContainText('Record');
});

test('the daily challenge is timed', async ({ page }) => {
  await panel(page, 'Accueil')
    .getByRole('button', { name: /Défi du jour/ })
    .click();
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

test('the language is remembered; the game has one look, the Rift', async ({ page }) => {
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Réglages' }).click();
  const settings = page.getByRole('dialog', { name: 'Réglages' });
  await settings.getByLabel('Langue').selectOption('en');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.keyboard.press('Escape');

  await page.reload();
  await expect(page.getByRole('tab', { name: 'Home' })).toBeVisible();
  await expect(page).toHaveTitle('Lumirift Blocks — the falling-blocks game, reinvented');
});

test('the Atelier shows the collection; locked items say how to earn them', async ({ page }) => {
  // The player's chip leads to the Atelier.
  await page.getByRole('button', { name: /^Niveau 1,/ }).click();
  await expect(tab(page, 'Atelier')).toHaveAttribute('aria-selected', 'true');
  const atelier = panel(page, 'Atelier');
  const crystal = atelier.getByRole('button', { name: /^Cristal/ });
  await expect(crystal).toHaveAttribute('aria-pressed', 'true');
  const neon = atelier.getByRole('button', { name: /^Néon/ });
  await expect(neon).toContainText('Niveau 3');
  // A locked item is shown, never worn, even when chosen twice from the keyboard.
  await neon.focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect(atelier.getByText('Pour débloquer Néon : Niveau 3.')).toBeVisible();
  await expect(crystal).toHaveAttribute('aria-pressed', 'true');
});

test('in the Atelier, a first tap tries a look on the stage, a second wears it', async ({
  page,
}) => {
  // Level 3: Neon is open.
  await page.evaluate(() => localStorage.setItem('stackrift:profile', JSON.stringify({ xp: 300 })));
  await page.reload();
  await tab(page, 'Atelier').click();
  const atelier = panel(page, 'Atelier');
  const neon = atelier.getByRole('button', { name: /^Néon/ });
  await neon.click();
  await expect(neon).toHaveAttribute('aria-pressed', 'false');
  await expect(neon).toContainText('Aperçu');
  await expect(atelier).toContainText(/(Touchez|Cliquez) encore pour porter/);
  await neon.click();
  await expect(neon).toHaveAttribute('aria-pressed', 'true');
  await expect(atelier.getByText(/Vous portez : Néon/)).toBeVisible();
  const saved = await page.evaluate(() => localStorage.getItem('stackrift:profile') ?? '');
  expect(saved).toContain('"material":"neon"');
});

test('looks earned since the last visit are new: a badge on the Atelier, until seen', async ({
  page,
}) => {
  // Level 3, only the starting looks seen: Neon and Aurora are new.
  await page.evaluate(() =>
    localStorage.setItem(
      'stackrift:profile',
      JSON.stringify({ xp: 300, seen: ['material.crystal', 'ambiance.night', 'shatter.shards'] }),
    ),
  );
  await page.reload();
  await expect(tab(page, 'Atelier')).toHaveAccessibleName(/2 nouveautés/);
  await tab(page, 'Atelier').click();
  const atelier = panel(page, 'Atelier');
  // The shelf opens on a kind with something new; trying a look counts as seeing it.
  const neon = atelier.getByRole('button', { name: /^Néon, Nouveau/ });
  await expect(neon).toBeVisible();
  await neon.click();
  await expect(atelier.getByRole('button', { name: /^Néon/ })).not.toHaveAccessibleName(/Nouveau/);
  await expect(tab(page, 'Atelier')).toHaveAccessibleName(/1 nouveauté/);
  // Aurora waits on the Ambiance shelf; leaving the Atelier after it counts as seen.
  await atelier.getByRole('button', { name: /^Ambiance/ }).click();
  await expect(atelier.getByRole('button', { name: /^Aurore, Nouveau/ })).toBeVisible();
  await tab(page, 'Accueil').click();
  await expect(tab(page, 'Atelier')).toHaveAccessibleName('Atelier');
  await page.reload();
  await expect(tab(page, 'Atelier')).toHaveAccessibleName('Atelier');
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
    await quitGame(page);
  }
  expect(errors).toEqual([]);
});

test('keyboard users skip to the content and land on each new screen', async ({ page }) => {
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Aller au contenu' })).toBeFocused();
  // The tabs: the arrows go from page to page.
  await tab(page, 'Accueil').focus();
  await page.keyboard.press('ArrowRight');
  await expect(tab(page, 'Modes')).toBeFocused();
  await expect(tab(page, 'Modes')).toHaveAttribute('aria-selected', 'true');
  await modeTile(page, 'Classique').focus();
  await page.keyboard.press('Enter');
  await panel(page, 'Modes').getByRole('button', { name: 'Jouer' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('canvas[role="img"]')).toBeVisible();
  await expect(page.locator('main')).toBeFocused();
  // The game still answers the keyboard with the focus on the main region.
  await page.keyboard.press('KeyP');
  await expect(page.getByRole('dialog', { name: 'Pause' })).toBeVisible();
});

test('no horizontal scroll from 320 to 1920 px, at home and in every family', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'desktop', 'One sweep is enough');
  // Without the screen changes' light, the sweep goes faster.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const width of [320, 360, 640, 768, 1024, 1440, 1920]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/');
    await expectNoHorizontalScroll(page);
    for (const name of ['Classique', 'Duel', 'Sable', 'Mosaïque', 'Tour']) {
      await openMode(page, name);
      await expectNoHorizontalScroll(page);
      await quitGame(page);
    }
  }
});

test('the menu pages follow a swipe, and the tabs follow the pages', async ({ page }) => {
  const box = await page.locator('.hub__pages').boundingBox();
  if (!box) throw new Error('No pages');
  const y = box.y + box.height * 0.3;
  const swipe = async (from: number, to: number) => {
    await page.mouse.move(box.x + box.width * from, y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * to, y, { steps: 8 });
    await page.mouse.up();
  };
  await swipe(0.8, 0.2);
  await expect(tab(page, 'Modes')).toHaveAttribute('aria-selected', 'true');
  await swipe(0.8, 0.2);
  await expect(tab(page, 'Carte')).toHaveAttribute('aria-selected', 'true');
  await swipe(0.2, 0.8);
  await expect(tab(page, 'Modes')).toHaveAttribute('aria-selected', 'true');
  // A short, slow drag goes back where it was, and starts nothing.
  await page.mouse.move(box.x + box.width * 0.5, y);
  await page.mouse.down();
  for (let i = 1; i <= 4; i++) {
    await page.mouse.move(box.x + box.width * 0.5 - i * 8, y);
    await page.waitForTimeout(60);
  }
  await page.mouse.up();
  await expect(tab(page, 'Modes')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('canvas[role="img"]')).toHaveCount(0);
});

test('the campaign: map, a level, its goal, then back to the map', async ({ page }) => {
  // The stars lead to the map.
  await page.getByRole('button', { name: /étoiles sur 90/ }).click();
  const map = panel(page, 'Carte');
  await expect(map.getByRole('heading', { name: 'Premiers blocs' })).toBeVisible();
  // Only the first level is open; a closed one says what opens it.
  await map.getByRole('button', { name: /1-2/ }).click();
  const closed = page.getByRole('dialog', { name: 'Niveau 1-2 · Classique' });
  await expect(closed).toContainText('Gagnez le niveau 1-1 pour ouvrir celui-ci.');
  await expect(closed.getByRole('button', { name: 'Jouer' })).toBeDisabled();
  await page.keyboard.press('Escape');
  // The chapters turn like pages.
  await map.getByRole('button', { name: 'Chapitre suivant' }).click();
  await expect(map.getByRole('heading', { name: 'Courants' })).toBeVisible();
  await map.getByRole('button', { name: 'Chapitre précédent' }).click();
  await map.getByRole('button', { name: /1-1/ }).click();
  // The campaign opens with Sand, a mode no other game has.
  const detail = page.getByRole('dialog', { name: 'Niveau 1-1 · Sable' });
  await expect(detail).toContainText('Effacer 2 zones');
  await detail.getByRole('button', { name: 'Jouer' }).click();
  await expect(page.getByRole('group', { name: 'Objectif' })).toContainText('0 / 2');
  await expect(page.locator('canvas[role="img"]')).toBeVisible();
  await page.keyboard.press('KeyP');
  await page
    .getByRole('dialog', { name: 'Pause' })
    .getByRole('button', { name: 'Quitter' })
    .click();
  await expect(tab(page, 'Carte')).toHaveAttribute('aria-selected', 'true');
  await expect(map.getByRole('heading', { name: 'Premiers blocs' })).toBeVisible();
});

test('the upgrades are bought with campaign stars, and refunded', async ({ page }) => {
  await page.evaluate(() =>
    localStorage.setItem(
      'stackrift:campaign',
      JSON.stringify({ stars: { '1-1': 3, '1-2': 2 }, ranks: {} }),
    ),
  );
  await page.reload();
  await tab(page, 'Carte').click();
  await panel(page, 'Carte')
    .getByRole('button', { name: /^Améliorations/ })
    .click();
  const shop = page.getByRole('dialog', { name: 'Améliorations' });
  await expect(shop).toContainText('5 étoiles disponibles');
  // The upgrade chosen in the grid is bought below it.
  const phoenix = shop.getByRole('listitem').filter({ hasText: 'Phénix' });
  await phoenix.getByRole('button').click();
  await expect(phoenix.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  await shop.getByRole('button', { name: /Améliorer/ }).click();
  await expect(shop).toContainText('3 étoiles disponibles');
  await expect(phoenix.getByRole('img', { name: 'Rang 1 sur 3' })).toBeVisible();
  await shop.getByRole('button', { name: 'Tout reprendre' }).click();
  await expect(shop).toContainText('5 étoiles disponibles');
});

test('a game fills the screen: no page header, its own pause and sound buttons', async ({
  page,
}) => {
  await openMode(page, 'Classique');
  await expect(page.getByRole('banner')).toHaveCount(0);
  const sound = page.getByRole('button', { name: 'Couper le son' });
  await sound.click();
  await expect(page.getByRole('button', { name: 'Activer le son' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Pause' }).click();
  const pause = page.getByRole('dialog', { name: 'Pause' });
  await pause.getByRole('button', { name: 'Réglages' }).click();
  await expect(page.getByRole('dialog', { name: 'Réglages' })).toBeVisible();
  // The page itself never scrolls during a game.
  const overflow = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('touch screens play with gestures; the buttons come back from the settings', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'mobile', 'Touch screens only');
  await openMode(page, 'Classique');
  await expect(page.getByRole('group', { name: 'Déplacer et descendre' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Pause' }).click();
  const pause = page.getByRole('dialog', { name: 'Pause' });
  await expect(pause.getByText('Toucher à deux doigts')).toBeVisible();
  await pause.getByRole('button', { name: 'Réglages' }).click();
  const settings = page.getByRole('dialog', { name: 'Réglages' });
  await settings.getByRole('radio', { name: 'Boutons' }).check();
  await page.keyboard.press('Escape');
  await pause.getByRole('button', { name: 'Reprendre' }).click();
  await expect(page.getByRole('group', { name: 'Déplacer et descendre' })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Tourner et faire tomber' })).toBeVisible();
});

test('a tap on the hold box keeps the piece for later', async ({ page }) => {
  await openMode(page, 'Classique');
  const hold = page.getByRole('button', { name: 'Réserve' });
  await expect(hold).not.toHaveClass(/stage__box--used/);
  await hold.click();
  await expect(hold).toHaveClass(/stage__box--used/);
});

test('every window fits the screen, without scrolling, from 360 × 640 to the desktop', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'desktop', 'One sweep is enough');
  test.setTimeout(120_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => {
    localStorage.setItem(
      'stackrift:campaign',
      JSON.stringify({ stars: { '1-1': 3, '1-2': 2, '1-3': 3 }, ranks: { phoenix: 1 } }),
    );
  });
  /** The window on top scrolls by this much (0: it fits). */
  const overflow = async () => {
    await page.waitForTimeout(250);
    return page.evaluate(() => {
      const open = [...document.querySelectorAll('dialog[open]')].at(-1);
      return open ? open.scrollHeight - open.clientHeight : -1;
    });
  };
  for (const [width, height] of [
    [360, 640],
    [390, 844],
    [640, 360],
    [844, 390],
    [1280, 800],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    const size = `${width} × ${height}`;
    await page.getByRole('button', { name: 'Réglages' }).click();
    expect(await overflow(), `${size}: settings`).toBe(0);
    await page.keyboard.press('Escape');
    await panel(page, 'Accueil')
      .getByRole('button', { name: /Objectifs du jour/ })
      .click();
    expect(await overflow(), `${size}: objectives`).toBe(0);
    await page.keyboard.press('Escape');
    await tab(page, 'Modes').click();
    await modeTile(page, 'Duel').click();
    await panel(page, 'Modes').getByRole('button', { name: 'Jouer' }).click();
    expect(await overflow(), `${size}: opponents`).toBe(0);
    await page.keyboard.press('Escape');
    await tab(page, 'Carte').click();
    await panel(page, 'Carte').getByRole('button', { name: /1-4/ }).click();
    expect(await overflow(), `${size}: level`).toBe(0);
    await page.keyboard.press('Escape');
    await panel(page, 'Carte')
      .getByRole('button', { name: /^Améliorations/ })
      .click();
    expect(await overflow(), `${size}: upgrades`).toBe(0);
    await page.keyboard.press('Escape');
    await openMode(page, 'Classique');
    await page.keyboard.press('KeyP');
    expect(await overflow(), `${size}: pause`).toBe(0);
    await page.keyboard.press('Escape');
    const over = page.getByRole('dialog', { name: 'Partie terminée' });
    for (let i = 0; i < 80 && !(await over.isVisible()); i++) {
      await page.keyboard.press('Space');
      await page.waitForTimeout(60);
    }
    await expect(over).toBeVisible({ timeout: 5000 });
    expect(await overflow(), `${size}: end of the game`).toBe(0);
  }
});

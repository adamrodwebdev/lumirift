import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { closeDailyGift } from './dailyGift';

/*
 * Dunes (1.37), on the build of its sandbox test: Dunes alone, its home and
 * its Atelier (`vite build --mode dunes`, served on its own port). In French.
 */

const tab = (page: Page, name: string) => page.getByRole('tab', { name });
const home = (page: Page) => page.getByRole('tabpanel', { name: 'Accueil' });
const board = (page: Page) => page.getByRole('img', { name: 'Plateau des Dunes' });
const hand = (page: Page) => page.getByRole('group', { name: 'Vos trois pièces' });
const swapButton = (page: Page) => page.getByRole('button', { name: /^Échanger votre main/ });

/** The opening's mark (the bed's cut, always the same): where the first pair links the walls. */
const MARK = { x: 6, y: 8 };
const COLUMNS = 9;

const audit = async (page: Page) => {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(', ')}`)).toEqual([]);
};

async function startDunes(page: Page) {
  await closeDailyGift(page);
  await page.goto('/');
  await home(page).getByRole('button', { name: /Jouer/ }).click();
  await expect(board(page)).toBeVisible();
}

/** The middle of a cell of the board, in the page's pixels. */
async function cellCentre(page: Page, x: number, y: number) {
  const box = (await board(page).boundingBox())!;
  const cell = box.width / COLUMNS;
  return { x: box.x + (x + 0.5) * cell, y: box.y + (y + 0.5) * cell, cell };
}

test('the build shows Dunes alone: its home and its Atelier, Play starts it', async ({ page }) => {
  await closeDailyGift(page);
  await page.goto('/');
  await expect(page.getByRole('tab')).toHaveCount(2);
  await expect(tab(page, 'Accueil')).toBeVisible();
  await expect(tab(page, 'Atelier')).toBeVisible();
  await expect(home(page).getByText('Défi du jour')).toHaveCount(0);
  await expect(home(page)).toContainText(
    'Posez le sable de votre main : reliez les deux murs d’une même couleur.',
  );
  await home(page).getByRole('button', { name: /Jouer/ }).click();
  await expect(page.getByRole('group', { name: 'Objectif' })).toContainText('Niveau D-1');
  await expect(page.getByRole('group', { name: 'Objectif' })).toContainText('Effacez 1 zone');
  await expect(hand(page).getByRole('button')).toHaveCount(3);
  await expect(swapButton(page)).toHaveAccessibleName('Échanger votre main (1 restant)');
});

test('the opening: the first piece put on its mark links the walls, D-2 and a swap more', async ({
  page,
}) => {
  await startDunes(page);
  // Picked with a tap, put down with a tap on its cell.
  await hand(page).getByRole('button').first().click();
  const mark = await cellCentre(page, MARK.x, MARK.y);
  await page.mouse.click(mark.x, mark.y);
  await expect(page.getByRole('group', { name: 'Objectif' })).toContainText('Niveau D-2', {
    timeout: 10_000,
  });
  await expect(swapButton(page)).toHaveAccessibleName('Échanger votre main (2 restants)');
});

test('a piece dragged onto the board goes down where it is held', async ({ page }, info) => {
  test.skip(info.project.name !== 'dunes-desktop', 'The mouse lifts a piece a little');
  await startDunes(page);
  const piece = (await hand(page).getByRole('button').first().boundingBox())!;
  const target = await cellCentre(page, MARK.x, MARK.y);
  // The pair (two cells wide) is held by its middle, floating 0.6 cell above the pointer.
  const x = target.x + target.cell / 2;
  const y = target.y + target.cell * 0.6;
  await page.mouse.move(piece.x + piece.width / 2, piece.y + piece.height / 2);
  await page.mouse.down();
  await page.mouse.move(x, y, { steps: 12 });
  await page.mouse.up();
  await expect(hand(page).getByRole('button').first()).toHaveAccessibleName('Emplacement vide');
  await expect(page.getByRole('group', { name: 'Objectif' })).toContainText('Niveau D-2', {
    timeout: 10_000,
  });
});

test('the keys play: 1 to 3 pick, the arrows aim, Space puts down, R swaps the hand', async ({
  page,
}) => {
  await startDunes(page);
  await board(page).click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('Digit2');
  await expect(hand(page).getByRole('button').nth(1)).toHaveAttribute('aria-pressed', 'true');
  for (let k = 0; k < 4; k++) await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Space');
  await expect(hand(page).getByRole('button').nth(1)).toHaveAccessibleName('Emplacement vide');
  await page.keyboard.press('KeyR');
  // Its falling sand may link the opening's zone, before R or after it (about one game in
  // three): that level won brings a swap. Either way R used one: none left on D-1, one on D-2.
  await expect
    .poll(async () => {
      const level = await page.getByRole('group', { name: 'Objectif' }).textContent();
      const swaps = await swapButton(page).getAttribute('aria-label');
      return level?.includes('Niveau D-2')
        ? swaps === 'Échanger votre main (1 restant)'
        : swaps === 'Échanger votre main (0 restant)';
    })
    .toBe(true);
  await expect(hand(page).getByRole('button', { name: 'Emplacement vide' })).toHaveCount(0);
  await page.keyboard.press('KeyP');
  const pause = page.getByRole('dialog', { name: 'Pause' });
  await expect(pause).toBeVisible();
  await pause.getByRole('button', { name: 'Quitter' }).click();
  await expect(tab(page, 'Accueil')).toBeVisible();
});

test('passes the accessibility audit, its home and its board', async ({ page }) => {
  await closeDailyGift(page);
  await page.goto('/');
  await expect(tab(page, 'Accueil')).toBeVisible();
  await audit(page);
  await home(page).getByRole('button', { name: /Jouer/ }).click();
  await expect(board(page)).toBeVisible();
  await audit(page);
});

test('the season’s page says the week’s element comes in Dunes', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-28T12:00:00Z'));
  await closeDailyGift(page);
  await page.goto('/');
  await home(page)
    .getByRole('button', { name: /^Semaine/ })
    .click();
  await expect(page.getByRole('region', { name: 'Avant-saison' })).toContainText(
    'Toutes les parties des Dunes comptent.',
  );
});

/** The screens a phone, a landscape phone and zooms give, and the board's least share of the height. */
const SIZES = [
  { name: '320 × 568', width: 320, height: 568, scale: 1, touch: true, board: 0.4 },
  { name: '844 × 390', width: 844, height: 390, scale: 1, touch: true, board: 0.5 },
  { name: 'a 200 % zoom', width: 640, height: 400, scale: 2, touch: false, board: 0.55 },
  { name: 'a 400 % zoom', width: 320, height: 256, scale: 4, touch: false, board: 0 },
] as const;

async function openAt(browser: Browser, size: (typeof SIZES)[number], locale = 'fr-FR') {
  const context = await browser.newContext({
    baseURL: 'http://localhost:4181/',
    viewport: { width: size.width, height: size.height },
    deviceScaleFactor: size.scale,
    hasTouch: size.touch,
    isMobile: size.touch,
    locale,
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  await closeDailyGift(page);
  await page.goto('/');
  await page.locator('main').waitFor();
  return { context, page };
}

test('fits every key size: no scroll, nothing outside, the board keeps its share', async ({
  browser,
}, info) => {
  test.skip(info.project.name !== 'dunes-desktop', 'Own contexts: once is enough');
  test.setTimeout(120_000);
  for (const size of SIZES) {
    const { context, page } = await openAt(browser, size);
    await page.locator('main').getByRole('button', { name: /Jouer/ }).click();
    await expect(page.locator('.dunes__canvas')).toBeVisible();
    await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => done(null))));
    const measure = await page.evaluate(() => ({
      sideways: document.documentElement.scrollWidth - innerWidth,
      down: document.documentElement.scrollHeight - innerHeight,
      share: document.querySelector('.dunes__canvas')!.getBoundingClientRect().height / innerHeight,
    }));
    expect(measure.sideways, `${size.name}: sideways scroll`).toBeLessThanOrEqual(0);
    if (size.board > 0) {
      expect(measure.down, `${size.name}: the game fits`).toBeLessThanOrEqual(0);
      expect(measure.share, `${size.name}: the board's share`).toBeGreaterThan(size.board);
    }
    await context.close();
  }
});

test('reads in Russian without a cut word: the hand, the swap, the goal', async ({
  browser,
}, info) => {
  test.skip(info.project.name !== 'dunes-desktop', 'Own contexts: once is enough');
  for (const size of [SIZES[0], SIZES[1]]) {
    const { context, page } = await openAt(browser, size, 'ru-RU');
    await page
      .locator('main')
      .getByRole('button', { name: /Играть/ })
      .click();
    await expect(page.locator('.dunes__canvas')).toBeVisible();
    const cut = await page.evaluate(() =>
      [...document.querySelectorAll('.dunes button, .dunes p, .goal p')]
        .filter((element) => element.scrollWidth > element.clientWidth + 1)
        .map((element) => element.textContent.trim()),
    );
    expect(cut, size.name).toEqual([]);
    await context.close();
  }
});

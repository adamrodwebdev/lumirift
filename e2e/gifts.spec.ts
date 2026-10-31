import { expect, test, type Page } from '@playwright/test';
import { giftDialog } from './dailyGift';
import { seedStorage } from './seed';

/*
 * The gift calendar and the collections (1.35), in French. Nothing before
 * the first game; then the calendar rises over the menu once a local day,
 * its gift is claimed once, a reload does not bring it back, the next day
 * brings the next gift and a clock turned back brings none. The browser's
 * date is set by hand (its timers run). The Atelier's sets show how far
 * each one is, and a complete set's ambiance is worn like any other.
 */

const tab = (page: Page, name: string) => page.getByRole('tab', { name });
const panel = (page: Page, name: string) => page.getByRole('tabpanel', { name });
const giftButton = (page: Page) =>
  panel(page, 'Accueil').getByRole('button', { name: /^Cadeau du jour/ });

/** The menu, after a reload: the calendar may rise 600 ms after it shows. */
async function openMenu(page: Page) {
  await page.reload();
  await page.locator('main').waitFor();
}

/** The menu on a device holding this profile. */
async function openWith(page: Page, profile: Record<string, unknown>) {
  await seedStorage(page, { 'stackrift:profile': profile });
  await page.goto('/');
  await page.locator('main').waitFor();
}

test('nothing before the first game; after it, the day’s gift rises over the menu, once', async ({
  page,
}) => {
  await page.goto('/');
  await page.locator('main').waitFor();
  await expect(giftButton(page)).toHaveCount(0);
  await page.waitForTimeout(1000);
  await expect(giftDialog(page)).toBeHidden();

  // The first game, played to its end, then back to the menu.
  await tab(page, 'Modes').click();
  await panel(page, 'Modes').getByRole('button', { name: 'Classique', exact: true }).click();
  await panel(page, 'Modes').getByRole('button', { name: 'Jouer' }).click();
  const over = page.getByRole('dialog', { name: 'Partie terminée' });
  for (let i = 0; i < 60 && !(await over.isVisible()); i++) {
    await page.keyboard.press('Space');
    await page.waitForTimeout(60);
  }
  await expect(over).toBeVisible({ timeout: 5000 });
  await over.getByRole('button', { name: 'Accueil' }).click();

  const gift = giftDialog(page);
  await expect(gift).toBeVisible();
  await expect(gift).toContainText('Jour 1 sur 7');
  await expect(tab(page, 'Accueil')).toHaveAccessibleName(/Cadeau du jour à récupérer/);
  await gift.getByRole('button', { name: /^Récupérer \+50\sXP$/ }).click();
  await expect(gift.getByRole('status')).toHaveText(/^\+50\sXP\s! Demain\s: \+60\sXP\.$/);
  await expect(gift.getByRole('listitem').first()).toContainText('Reçu');
  await gift.getByRole('button', { name: 'Continuer' }).click();
  await expect(gift).toBeHidden();
  await expect(tab(page, 'Accueil')).not.toHaveAccessibleName(/récupérer/);

  // A reload the same day: the calendar stays down; its button tells tomorrow's gift.
  await openMenu(page);
  await page.waitForTimeout(1000);
  await expect(giftDialog(page)).toBeHidden();
  await giftButton(page).click();
  await expect(giftDialog(page)).toContainText(
    /Le cadeau du jour est récupéré\. Demain\s: \+60\sXP/,
  );
  await expect(giftDialog(page).getByRole('button', { name: /^Récupérer/ })).toHaveCount(0);
});

test('a player already busy in the menu is not interrupted: the gift waits for them', async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('stackrift:profile'))
      localStorage.setItem(
        'stackrift:profile',
        JSON.stringify({ games: 3, gifts: { next: 1, lastDay: '20261020', shownDay: null } }),
      );
  });
  // The page's time stands still: the menu shows, then the player acts before the calendar's 600 ms.
  await page.clock.install({ time: new Date(2026, 9, 27, 12, 0) });
  await page.clock.pauseAt(new Date(2026, 9, 27, 12, 0, 1));
  await page.goto('/');
  await page.locator('main').waitFor();
  await page.clock.runFor(450);
  await page.getByRole('button', { name: 'Réglages' }).click();
  await page.clock.runFor(2000);
  await expect(page.getByRole('dialog', { name: 'Réglages' })).toBeVisible();
  await expect(giftDialog(page)).toBeHidden();
  await page.keyboard.press('Escape');
  await page.clock.runFor(500);
  await expect(tab(page, 'Accueil')).toHaveAccessibleName(/Cadeau du jour à récupérer/);
  // The next visit, left alone, the calendar rises.
  await page.reload();
  await page.locator('main').waitFor();
  await page.clock.runFor(1000);
  await expect(giftDialog(page)).toBeVisible();
});

test('the next day brings the next gift; a clock turned back brings none', async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 9, 31, 23, 58));
  await openWith(page, { games: 2, gifts: { next: 1, lastDay: '20261030', shownDay: null } });
  const gift = giftDialog(page);
  await expect(gift).toContainText('Jour 2 sur 7');
  await gift.getByRole('button', { name: /^Récupérer \+60\sXP$/ }).click();
  await gift.getByRole('button', { name: 'Continuer' }).click();

  // Past midnight, into November: the third gift, by itself.
  await page.clock.setFixedTime(new Date(2026, 10, 1, 0, 1));
  await openMenu(page);
  await expect(gift).toContainText('Jour 3 sur 7');
  await gift.getByRole('button', { name: /^Récupérer \+70\sXP$/ }).click();
  await gift.getByRole('button', { name: 'Continuer' }).click();

  // A flight west takes the day back to October: nothing rises, nothing to claim.
  await page.clock.setFixedTime(new Date(2026, 9, 31, 22, 0));
  await openMenu(page);
  await page.waitForTimeout(1000);
  await expect(gift).toBeHidden();
  await giftButton(page).click();
  await expect(gift.getByRole('button', { name: /^Récupérer/ })).toHaveCount(0);
  const saved = await page.evaluate(() => localStorage.getItem('stackrift:profile') ?? '');
  expect(JSON.parse(saved).gifts).toMatchObject({ next: 3, lastDay: '20261101' });
});

test('back after a week away: a gift of welcome comes with the day’s, the streak with it', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date(2026, 9, 27, 12, 0));
  await openWith(page, {
    games: 9,
    lastVisit: '20261012',
    gifts: { next: 6, lastDay: '20261011', shownDay: null },
    streak: { count: 3, best: 3, lastDay: '20261026' },
  });
  const gift = giftDialog(page);
  await expect(gift).toContainText(/Bon retour\s! \+150\sXP s’ajoutent au cadeau du jour\./);
  await expect(gift).toContainText('3 jours d’affilée au défi du jour.');
  await expect(gift).toContainText(/À 7 jours\s: \+150\sXP\./);
  // The seventh day: a look, the first one the player does not have.
  await gift.getByRole('button', { name: 'Récupérer Obsidienne' }).click();
  await expect(gift.getByRole('status')).toHaveText(/^Obsidienne est à vous\s!/);
  await gift.getByRole('button', { name: 'Continuer' }).click();
  // The streak's flame on the daily challenge's card.
  await expect(panel(page, 'Accueil').getByText(/Série au défi\s: 3 jours/)).toBeAttached();
  const saved = JSON.parse(await page.evaluate(() => localStorage.getItem('stackrift:profile')!));
  expect(saved).toMatchObject({ welcomeBack: false, gifted: ['material.obsidian'] });
  expect(saved.xp).toBe(150);
});

test('a gift that completes a set says so: its ambiance comes with it', async ({ page }) => {
  // Level 10 (Neon, Pixel, Confetti) and Obsidian already given: day 7 brings Cosmos.
  await openWith(page, {
    games: 30,
    xp: 2400,
    gifted: ['material.obsidian'],
    gifts: { next: 6, lastDay: '20200101', shownDay: null },
  });
  const gift = giftDialog(page);
  await gift.getByRole('button', { name: 'Récupérer Cosmos' }).click();
  await expect(gift.getByRole('status')).toContainText(
    /L’ensemble Arcade est complet\s: l’ambiance Synthwave est à vous aussi\s!/,
  );
});

test('the Atelier’s sets: how far each one is, and a complete set’s ambiance to wear', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  // Level 12: Neon, Pixel, Confetti and Cosmos earned, the Arcade set complete.
  await openWith(page, { xp: 3300, seen: [] });
  await tab(page, 'Atelier').click();
  const atelier = panel(page, 'Atelier');
  await atelier.getByRole('button', { name: 'Ensembles' }).click();
  await expect(atelier).toContainText(
    'Réunissez toutes les nouveautés d’un ensemble pour débloquer son ambiance.',
  );
  await expect(atelier.getByRole('button', { name: /^Arcade, Complet\s!/ })).toBeVisible();
  const garden = atelier.getByRole('button', { name: /^Jardin de nuit, 3 sur 4/ });
  await garden.click();
  await expect(garden).toHaveAttribute('aria-pressed', 'true');
  await expect(atelier.locator('[aria-live="polite"]')).toContainText(
    /3 sur 4\s: complétez-le pour débloquer l’ambiance Lanternes/,
  );

  // The Synthwave ambiance waits on the Ambiance shelf: tried, then worn.
  await atelier.getByRole('button', { name: /^Ambiance/ }).click();
  const synthwave = atelier.getByRole('button', { name: /^Synthwave/ });
  await synthwave.click();
  await synthwave.click();
  await expect(synthwave).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('html')).toHaveAttribute('data-ambiance', 'synthwave');
  const saved = await page.evaluate(() => localStorage.getItem('stackrift:profile') ?? '');
  expect(saved).toContain('"ambiance":"synthwave"');
});

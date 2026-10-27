import { expect, test, type Page } from '@playwright/test';
import { closeDailyGift } from './dailyGift';

/*
 * The seasons and the week's event (1.36), in French. The browser's date is
 * set by hand (its timers run): the preseason's lightning week, then the
 * opening of Season 1 on 14 December at midnight UTC, the same moment for a
 * player in Auckland and one in Los Angeles.
 */

const tab = (page: Page, name: string) => page.getByRole('tab', { name });
const panel = (page: Page, name: string) => page.getByRole('tabpanel', { name });
const banner = (page: Page) => panel(page, 'Accueil').getByRole('button', { name: /^Semaine/ });

/** The menu on a device holding this saved data (the season's, the profile's). */
async function openWith(page: Page, saved: Record<string, unknown>) {
  await closeDailyGift(page);
  await page.goto('/');
  await page.evaluate((data) => {
    for (const [key, value] of Object.entries(data))
      localStorage.setItem(key, JSON.stringify(value));
  }, saved);
  await page.reload();
  await page.locator('main').waitFor();
}

test('the week’s event on the home opens the season’s page; Escape brings the home back', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-10-28T12:00:00Z'));
  await openWith(page, { 'stackrift:profile': { games: 3 } });
  await expect(banner(page)).toHaveAccessibleName(
    /^Semaine de la foudre, encore 4\sj\s: Faites tomber 25 éclairs \(0 sur 25\)\. Avant-saison, palier 0\s: ouvrir la saison\.$/,
  );
  await banner(page).click();
  const season = page.getByRole('region', { name: 'Avant-saison' });
  await expect(season.getByRole('heading', { name: 'Avant-saison' })).toBeFocused();
  await expect(season).toContainText('Palier 0');
  await expect(
    season.getByRole('list', { name: 'Les paliers de la saison' }).getByRole('listitem'),
  ).toHaveCount(10);
  await expect(season.getByRole('button', { name: /^Récupérer/ })).toHaveCount(0);
  await expect(season).toContainText(/Ensuite\s: Saison 1 · Braises/);
  await page.keyboard.press('Escape');
  await expect(season).toHaveCount(0);
  await expect(banner(page)).toBeFocused();
});

test('the track’s rewards are claimed one by one or all at once, and stay claimed', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-10-28T12:00:00Z'));
  await openWith(page, {
    'stackrift:profile': { games: 3, xp: 0 },
    'stackrift:season': { season: 'preseason', points: 760, week: '20261026', deeds: 20 },
  });
  await expect(banner(page)).toContainText('20/25');
  await banner(page).click();
  const season = page.getByRole('region', { name: 'Avant-saison' });
  await season.getByRole('button', { name: /^Récupérer le palier 1\s: \+100\sXP$/ }).click();
  await expect(season.getByRole('button', { name: /^Récupérer le palier/ })).toHaveCount(2);
  await season.getByRole('button', { name: 'Tout récupérer (2)' }).click();
  await expect(season.getByRole('button', { name: /^Récupérer/ })).toHaveCount(0);
  const xp = () =>
    page.evaluate(() => JSON.parse(localStorage.getItem('stackrift:profile')!).xp as number);
  expect(await xp()).toBe(100 + 110 + 120);
  await page.reload();
  await banner(page).click();
  await expect(page.getByRole('region', { name: 'Avant-saison' })).toContainText('Palier 3');
  await expect(page.getByRole('button', { name: /^Récupérer/ })).toHaveCount(0);
});

for (const timezoneId of ['Pacific/Auckland', 'America/Los_Angeles']) {
  test.describe(`a player in ${timezoneId}`, () => {
    test.use({ timezoneId });

    test('Season 1 opens on 14 December at midnight UTC, and the preseason gives what it left', async ({
      page,
    }) => {
      await page.clock.setFixedTime(new Date('2026-12-13T23:59:00Z'));
      await openWith(page, {
        'stackrift:profile': { games: 3, xp: 0 },
        // Every preseason tier reached, none claimed.
        'stackrift:season': { season: 'preseason', points: 2500, week: '20261207' },
      });
      await expect(banner(page)).toHaveAccessibleName(
        /^Semaine de l’acide, dernier jour.*Avant-saison/,
      );

      await page.clock.setFixedTime(new Date('2026-12-14T00:01:00Z'));
      await page.reload();
      await expect(banner(page)).toHaveAccessibleName(
        /^Semaine du feu, encore 6\sj.*Saison 1 · Braises, palier 0/,
      );
      // The preseason's ten tiers, given on the way: their experience and their look.
      const profile = await page.evaluate(
        () =>
          JSON.parse(localStorage.getItem('stackrift:profile')!) as {
            xp: number;
            gifted: string[];
          },
      );
      expect(profile.gifted).toContain('shatter.riftspark');
      expect(profile.xp).toBe(100 + 110 + 120 + 130 + 140 + 160 + 170 + 180 + 190);
      await banner(page).click();
      const season = page.getByRole('region', { name: 'Saison 1 · Braises' });
      await expect(
        season.getByRole('list', { name: 'Les paliers de la saison' }).getByRole('listitem'),
      ).toHaveCount(30);
      await expect(season).toContainText(
        /L’ensemble Braises\s: réunissez ses nouveautés, et Verre du phénix est à vous\./,
      );
    });
  });
}

test('the Atelier shows a season’s looks from its start, never months ahead', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-28T12:00:00Z'));
  await openWith(page, { 'stackrift:profile': { games: 3 } });
  await tab(page, 'Atelier').click();
  const atelier = panel(page, 'Atelier');
  await atelier.getByRole('button', { name: 'Éclats', exact: true }).click();
  await expect(atelier.getByRole('button', { name: /^Étincelles de la faille/ })).toBeVisible();
  await expect(atelier.getByRole('button', { name: /^Flammèches/ })).toHaveCount(0);
  await atelier.getByRole('button', { name: 'Ensembles' }).click();
  await expect(atelier.getByRole('button', { name: /^Braises/ })).toHaveCount(0);

  await page.clock.setFixedTime(new Date('2026-12-14T09:00:00Z'));
  await page.reload();
  await tab(page, 'Atelier').click();
  await atelier.getByRole('button', { name: 'Blocs', exact: true }).click();
  await expect(atelier.getByRole('button', { name: /^Verre de braise/ })).toBeVisible();
  await atelier.getByRole('button', { name: 'Ensembles' }).click();
  await expect(atelier.getByRole('button', { name: /^Braises, 0 sur 3/ })).toBeVisible();
});

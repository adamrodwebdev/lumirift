import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { freezeTime, play, playUntil } from './gameTime';
import { localDay, seedStorage } from './seed';

/*
 * Automatic WCAG 2.2 AA audits (axe-core) of every screen and dialog, in
 * the game's one theme (the Rift). They complement Lighthouse, which only audits the home page.
 */

/**
 * The transitions done (1.42): an audit never reads a window or a page halfway
 * through its fade. Polled from here: some tests freeze the page's own clock.
 */
const settled = async (page: Page) => {
  for (let tries = 0; tries < 40; tries++) {
    const moving = await page.evaluate(() =>
      document.getAnimations().some((animation) => {
        const timing = animation.effect?.getTiming();
        return (
          animation.playState === 'running' &&
          timing?.iterations !== Infinity &&
          Number(timing?.duration) <= 1000
        );
      }),
    );
    if (!moving) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
};

const audit = async (page: Page) => {
  await settled(page);
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
      await page.locator('main').waitFor();
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

    test('the race: its clock and worlds, the shift announced, a Guardian, the pause, its end', async ({
      page,
    }) => {
      test.setTimeout(120_000);
      await page.clock.install();
      const won = ['1', '2', '3']
        .flatMap((chapter) => [1, 2, 3, 4, 5, 6, 7].map((n) => `${chapter}-${n}`))
        .filter((id) => id !== '1-7')
        .concat(['4-1', '4-2', '4-3']);
      await seedStorage(page, {
        'stackrift:campaign': { stars: Object.fromEntries(won.map((id) => [id, 2])), ranks: {} },
      });
      await page.reload();
      await page.getByRole('tab', { name: 'Modes' }).click();
      await modesPage(page)
        .getByRole('button', { name: /^Course de la faille/ })
        .click();
      await modesPage(page).getByRole('button', { name: 'Jouer' }).click();
      await expect(page.locator('canvas[role="img"]').first()).toBeVisible();
      // The game's time moves only with the test's frames (gameTime.ts); an audit runs
      // on the page's own timers, so time flows while it runs, then stands still again.
      await freezeTime(page);
      const auditRace = async () => {
        await page.clock.resume();
        await audit(page);
        await freezeTime(page);
      };
      await auditRace();
      // The second shift: announced with its Guardian, then the Guardian's card.
      const shift = page.locator('.shift');
      await play(page, 75_000);
      await playUntil(page, 5_000, () => shift.isVisible());
      await expect(shift).toBeVisible();
      await auditRace();
      const guardian = page.getByRole('status', { name: /Œil de la Tour/ });
      await playUntil(page, 6_000, () => guardian.isVisible());
      await expect(guardian).toBeVisible();
      await auditRace();
      await page.keyboard.press('KeyP');
      const pause = page.getByRole('dialog', { name: 'Pause' });
      await expect(pause).toBeVisible();
      await auditRace();
      await pause.getByRole('button', { name: 'Reprendre' }).click();
      const over = page.getByRole('dialog', { name: 'Partie terminée' });
      await playUntil(page, 60_000, () => over.isVisible());
      await expect(over).toBeVisible();
      await page.clock.resume();
      await audit(page);
    });

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

test('the gift calendar, as it rises and once claimed, and the Atelier’s sets', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  // Back after a week away, on a streak, the day's gift waiting.
  await seedStorage(page, {
    'stackrift:profile': {
      games: 9,
      xp: 900,
      lastVisit: localDay(-10),
      gifts: { next: 2, lastDay: localDay(-11), shownDay: null },
      streak: { count: 3, best: 3, lastDay: localDay(-1) },
    },
  });
  await page.goto('/');
  await page.locator('main').waitFor();
  const gift = page.getByRole('dialog', { name: 'Cadeau du jour' });
  await expect(gift).toBeVisible();
  await audit(page);
  await gift.getByRole('button', { name: /^Récupérer/ }).click();
  await expect(gift.getByRole('button', { name: 'Continuer' })).toBeVisible();
  await audit(page);
  await gift.getByRole('button', { name: 'Continuer' }).click();
  await audit(page);
  await page.getByRole('tab', { name: 'Atelier' }).click();
  const atelier = page.getByRole('tabpanel', { name: 'Atelier' });
  await atelier.getByRole('button', { name: 'Ensembles' }).click();
  await expect(atelier.getByRole('button', { name: /^Arcade/ })).toBeVisible();
  await audit(page);
});

test('the week’s event and the season’s page, with rewards waiting', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.setFixedTime(new Date('2026-12-16T12:00:00Z'));
  await seedStorage(page, {
    'stackrift:season': {
      season: 'embers',
      points: 1700,
      claimed: [1, 2],
      week: '20261214',
      deeds: 9,
    },
  });
  await page.goto('/');
  await page.locator('main').waitFor();
  const event = page
    .getByRole('tabpanel', { name: 'Accueil' })
    .getByRole('button', { name: /^Semaine/ });
  await expect(event).toBeVisible();
  await audit(page);
  await event.click();
  const season = page.getByRole('region', { name: 'Saison 1 · Braises' });
  await expect(season.getByRole('button', { name: /^Tout récupérer/ })).toBeVisible();
  await audit(page);
});

test('new looks: the badge of the Atelier tab and the marks on the shelf', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seedStorage(page, { 'stackrift:profile': { xp: 300, seen: [] } });
  await page.goto('/');
  await page.locator('main').waitFor();
  await audit(page);
  await page.getByRole('tab', { name: 'Atelier' }).click();
  await expect(page.getByRole('button', { name: /^Néon, Nouveau/ })).toBeVisible();
  await audit(page);
});

for (const theme of ['dark'] as const) {
  test(`${theme} theme: campaign map, level and upgrades`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: 'reduce' });
    await page.goto('/');
    await page.locator('main').waitFor();
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

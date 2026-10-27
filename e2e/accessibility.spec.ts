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
      await page.evaluate(() => {
        const won = ['1', '2', '3']
          .flatMap((chapter) => [1, 2, 3, 4, 5, 6, 7].map((n) => `${chapter}-${n}`))
          .filter((id) => id !== '1-7')
          .concat(['4-1', '4-2', '4-3']);
        const stars = Object.fromEntries(won.map((id) => [id, 2]));
        localStorage.setItem('stackrift:campaign', JSON.stringify({ stars, ranks: {} }));
      });
      await page.reload();
      await page.getByRole('tab', { name: 'Modes' }).click();
      await modesPage(page)
        .getByRole('button', { name: /^Course de la faille/ })
        .click();
      await modesPage(page).getByRole('button', { name: 'Jouer' }).click();
      await expect(page.locator('canvas[role="img"]').first()).toBeVisible();
      await audit(page);
      const play = async (ms: number) => {
        for (let t = 0; t < ms; t += 100) await page.clock.fastForward(100);
      };
      // The second shift: announced with its Guardian, then the Guardian's card.
      await play(78_500);
      await expect(page.locator('.shift')).toBeVisible();
      await audit(page);
      await play(4_000);
      await expect(page.getByRole('status', { name: /Œil de la Tour/ })).toBeVisible();
      await audit(page);
      await page.keyboard.press('KeyP');
      await expect(page.getByRole('dialog', { name: 'Pause' })).toBeVisible();
      await audit(page);
      await page
        .getByRole('dialog', { name: 'Pause' })
        .getByRole('button', { name: 'Reprendre' })
        .click();
      await play(40_000);
      await expect(page.getByRole('dialog', { name: 'Partie terminée' })).toBeVisible({
        timeout: 10_000,
      });
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
  await page.goto('/');
  await page.locator('main').waitFor();
  // Back after a week away, on a streak, the day's gift waiting.
  await page.evaluate(() => {
    const day = (offset: number) => {
      const date = new Date();
      date.setDate(date.getDate() + offset);
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
    };
    localStorage.setItem(
      'stackrift:profile',
      JSON.stringify({
        games: 9,
        xp: 900,
        lastVisit: day(-10),
        gifts: { next: 2, lastDay: day(-11), shownDay: null },
        streak: { count: 3, best: 3, lastDay: day(-1) },
      }),
    );
  });
  await page.reload();
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

test('new looks: the badge of the Atelier tab and the marks on the shelf', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.locator('main').waitFor();
  await page.evaluate(() =>
    localStorage.setItem('stackrift:profile', JSON.stringify({ xp: 300, seen: [] })),
  );
  await page.reload();
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

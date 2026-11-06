import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { closeDailyGift } from './dailyGift';
import { seedStorage } from './seed';

/*
 * The lines of the world (1.46.6): a sentence of the story where players
 * already look, in the parchment tone, under a short mark of the Rift's
 * light. Each one fits its place in two lines at most on a 390 px phone, is
 * never cut, and keeps to three on a 320 px one (CAHIER § 9 terdecies), in
 * each of the four languages: the map's ten chapters, the season's page, a
 * Guardian's trophy in the Atelier. The seasons and trophies not on screen are
 * measured in the same place, their line set in it. The end windows' lines
 * are measured by hand: no journey wins a Guardian's level. Under the
 * chapter's line, the map's levels keep their room on short phones.
 */

type Tree = { readonly [key: string]: string | Tree };

/** A language's messages, read from its file (the journeys never import the game's code). */
const messages = (code: string): Tree =>
  JSON.parse(readFileSync(resolve('src/i18n/locales', `${code}.json`), 'utf8')) as Tree;
const message = (tree: Tree, path: string): string =>
  String(path.split('.').reduce<unknown>((node, key) => (node as Tree)[key], tree));

const LANGUAGES = [
  { code: 'fr', browser: 'fr-FR' },
  { code: 'en', browser: 'en-US' },
  { code: 'ru', browser: 'ru-RU' },
  { code: 'id', browser: 'id-ID' },
] as const;
const SEASONS = ['preseason', 'embers', 'tides', 'storm'] as const;
const GUARDIANS = ['duneWorm', 'ceramicGolem', 'towerEye', 'riftHeart'] as const;
/**
 * The phones, and the most lines a line of the world may take on each. At
 * 320 px the season's line shares its row with the back button (232 px).
 */
const PHONES = [
  { width: 390, height: 844, lines: 2 },
  { width: 320, height: 640, lines: 3 },
] as const;

/** How a line of the world sits: its lines of text, and whether anything cuts it. */
interface Fit {
  readonly text: string;
  readonly lines: number;
  readonly cut: boolean;
}

/**
 * Measures the line of the world in `scope` (its own text, or `text` set in
 * its place first, the fonts loaded, the page at rest): its height in lines,
 * and a cut by its box, the screen or a box around it that hides what
 * overflows. At rest: the hub's pages slide for about 300 ms after a tab is
 * chosen, and a line measured on the way in sits half off the screen.
 */
const fit = (page: Page, scope: string, text?: string): Promise<Fit> =>
  page.locator(`${scope} .lore__line`).evaluate(
    async (line: HTMLElement, { swap }: { swap: string | null }) => {
      if (swap !== null) line.textContent = swap;
      await document.fonts.ready;
      // Two frames for a slide just asked to start, then every motion that ends (not the loops).
      await new Promise((frame) => requestAnimationFrame(() => requestAnimationFrame(frame)));
      await Promise.all(
        document
          .getAnimations()
          .filter((motion) => motion.playState === 'running')
          .filter((motion) => motion.effect?.getComputedTiming().endTime !== Infinity)
          .map((motion) => motion.finished.catch(() => motion)),
      );
      const box = line.getBoundingClientRect();
      let cut = line.scrollWidth > line.clientWidth + 1 || box.left < -1;
      cut ||= box.right > document.documentElement.clientWidth + 1;
      for (let up = line.parentElement; up && up !== document.body; up = up.parentElement) {
        const { overflowX, overflowY } = getComputedStyle(up);
        if (overflowX === 'visible' && overflowY === 'visible') continue;
        const frame = up.getBoundingClientRect();
        cut ||= box.left < frame.left - 1 || box.right > frame.right + 1;
        cut ||= overflowY !== 'auto' && (box.top < frame.top - 1 || box.bottom > frame.bottom + 1);
      }
      const lines = Math.round(box.height / parseFloat(getComputedStyle(line).lineHeight));
      return { text: line.textContent, lines, cut };
    },
    { swap: text ?? null },
  );

/** Every line is judged, so that one run names all those that do not fit. */
const fits = (where: string, { text, lines, cut }: Fit, most: number) => {
  expect.soft(cut, `${where}: cut, “${text}”`).toBe(false);
  expect.soft(lines, `${where}: ${lines} lines, “${text}”`).toBeLessThanOrEqual(most);
};

/**
 * Phones whose map path is short, and whether the chapter's line shows on
 * them. Under the line, a phone of 320 × 568 laid the levels on each other,
 * even in two rows, so it hides the line; one of 360 × 740 zigzagged them
 * onto each other, so its path crosses in two rows (1.46.6).
 */
const SHORT_PHONES = [
  { width: 320, height: 568, line: false },
  { width: 320, height: 640, line: true },
  { width: 360, height: 740, line: true },
  { width: 390, height: 844, line: true },
] as const;

/**
 * The map's levels whose disc lies under another level (its disc, name or
 * stars), the page at rest: "Niveau 3-6 under Niveau 3-7". Each part is
 * measured on its own: a button is as wide as its longest name, and its
 * empty corners may brush a neighbour's disc without covering anything.
 */
const covered = (page: Page): Promise<string[]> =>
  page.evaluate(async () => {
    await new Promise((frame) => requestAnimationFrame(() => requestAnimationFrame(frame)));
    await Promise.all(
      document
        .getAnimations()
        .filter((motion) => motion.playState === 'running')
        .filter((motion) => motion.effect?.getComputedTiming().endTime !== Infinity)
        .map((motion) => motion.finished.catch(() => motion)),
    );
    const levels = [...document.querySelectorAll<HTMLElement>('.path__levels .node__button')];
    const name = (level: HTMLElement) => level.getAttribute('aria-label')?.split(' · ')[0] ?? '?';
    return levels.flatMap((level) => {
      const disc = level.querySelector('.node__disc')?.getBoundingClientRect();
      if (!disc) return [];
      return levels
        .filter((other) => other !== level)
        .filter((other) =>
          [...other.querySelectorAll('.node__disc, .node__label, .node__stars')].some((part) => {
            const box = part.getBoundingClientRect();
            const across = Math.min(disc.right, box.right) - Math.max(disc.left, box.left);
            const down = Math.min(disc.bottom, box.bottom) - Math.max(disc.top, box.top);
            return across > 1 && down > 1;
          }),
        )
        .map((other) => `${name(level)} under ${name(other)}`);
    });
  });

/**
 * Every level of the ten chapters won once but the finale (10-7): each shows
 * its name and its stars, and the map opens on the last chapter.
 */
const PLAYED = Object.fromEntries(
  Array.from({ length: 10 }, (_, chapter) =>
    Array.from({ length: 7 }, (_, level) => [`${chapter + 1}-${level + 1}`, 1] as const),
  )
    .flat()
    .filter(([id]) => id !== '10-7'),
);

for (const { code, browser } of LANGUAGES) {
  test.describe(code, () => {
    test.use({ locale: browser });
    const words = messages(code);
    const say = (path: string) => message(words, path);

    test(`${code}: every line of the world fits its place, from 390 to 320 px`, async ({
      page,
    }, info) => {
      test.skip(info.project.name !== 'mobile', 'The phone sizes are set here');
      test.setTimeout(90_000);
      // A day of the preseason: its page has a season to tell, whenever the suite runs.
      await page.clock.setFixedTime(new Date('2026-11-06T12:00:00Z'));
      await closeDailyGift(page);
      // Every Guardian defeated: each trophy is owned, the Dune scales worn.
      await seedStorage(page, {
        'stackrift:profile': {
          games: 3,
          bosses: [...GUARDIANS],
          equipment: { material: 'dunes', ambiance: 'night', shatter: 'shards' },
        },
      });
      const tab = (name: string) => page.getByRole('tab', { name: say(`hub.tabs.${name}`) });
      const panel = (name: string) => page.getByRole('tabpanel', { name: say(`hub.tabs.${name}`) });
      for (const phone of PHONES) {
        const size = `${phone.width} × ${phone.height}`;
        await page.setViewportSize({ width: phone.width, height: phone.height });
        await page.goto('/');

        // The map: the line of each chapter, under its title.
        await tab('map').click();
        for (let chapter = 1; chapter <= 10; chapter++) {
          const line = await fit(page, '.map__lore');
          expect(line.text).toBe(say(`lore.chapter.${chapter}`));
          fits(`${size}, chapter ${chapter}`, line, phone.lines);
          if (chapter < 10) {
            await panel('map')
              .getByRole('button', { name: say('hub.nextChapter') })
              .click();
          }
        }

        // The Atelier: the Dune scales say their line in their note's place; the other trophies' too.
        await tab('atelier').click();
        const worn = await fit(page, '.showcase');
        expect(worn.text).toBe(say('lore.trophy.duneWorm'));
        for (const guardian of GUARDIANS) {
          fits(
            `${size}, trophy of ${guardian}`,
            await fit(page, '.showcase', say(`lore.trophy.${guardian}`)),
            phone.lines,
          );
        }

        // The season's page, from the week's banner: its line under the title, then the others'.
        await tab('home').click();
        await panel('home').locator('.event').click();
        await expect(page.locator('.season__lore')).toBeVisible();
        for (const season of SEASONS) {
          fits(
            `${size}, season ${season}`,
            await fit(page, '.season', say(`lore.season.${season}`)),
            phone.lines,
          );
        }
        await page.keyboard.press('Escape');
      }
    });

    test(`${code}: the chapter's line leaves the map's levels their room`, async ({
      page,
    }, info) => {
      test.skip(info.project.name !== 'mobile', 'The phone sizes are set here');
      test.setTimeout(90_000);
      await closeDailyGift(page);
      await seedStorage(page, {
        'stackrift:profile': { games: 3 },
        'stackrift:campaign': { stars: PLAYED, ranks: {} },
      });
      const panel = page.getByRole('tabpanel', { name: say('hub.tabs.map') });
      for (const phone of SHORT_PHONES) {
        const size = `${phone.width} × ${phone.height}`;
        await page.setViewportSize({ width: phone.width, height: phone.height });
        await page.goto('/');
        await page.getByRole('tab', { name: say('hub.tabs.map') }).click();
        await expect.soft(page.locator('.map__lore')).toBeVisible({ visible: phone.line });
        // From the chapter the map opens on (the last), back to the first.
        for (let chapter = 10; chapter >= 1; chapter--) {
          expect.soft(await covered(page), `${size}, chapter ${chapter}`).toEqual([]);
          if (chapter > 1) {
            await panel.getByRole('button', { name: say('hub.prevChapter') }).click();
          }
        }
      }
    });
  });
}

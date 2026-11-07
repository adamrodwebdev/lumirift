import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { devices, expect, test, type Browser, type Page, type TestInfo } from '@playwright/test';
import { closeDailyGift } from './dailyGift';
import { paced } from './engines';
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
  { code: 'fr', locale: 'fr-FR' },
  { code: 'en', locale: 'en-US' },
  { code: 'ru', locale: 'ru-RU' },
  { code: 'id', locale: 'id-ID' },
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
 * stars), or whose disc and ring reach the chapter dots, the page at rest:
 * "Niveau 3-6 under Niveau 3-7", "Niveau 3-7 under the dots". Each part is
 * measured on its own: a button is as wide as its longest name, and its
 * empty corners may brush a neighbour's disc without covering anything.
 * Discs and dots are round: they touch when their centres are closer than
 * their radii (a Guardian's radius takes in its ring, its outline). Measured
 * once `chapter` is the only one on the map: a turned chapter fades out while
 * the next fades in, both in place, and Vue starts that fade two frames late
 * (the CI's WebKit measured them on top of each other).
 */
const covered = (page: Page, chapter: number): Promise<string[]> =>
  page.evaluate(
    async ({ chapter, frames }) => {
      const frame = () => new Promise((done) => requestAnimationFrame(done));
      /** A level's id, from its name: "Niveau 3-1 · Mosaïque, 1 étoile" gives 3-1. */
      const id = (label: string) => label.split(' · ')[0]?.split(' ').at(-1);
      const alone = () => {
        const fields = [...document.querySelectorAll('.path__field')];
        const first = fields.at(0)?.querySelector('.node__button')?.getAttribute('aria-label');
        return fields.length === 1 && id(first ?? '') === `${chapter}-1`;
      };
      for (let left = frames; left > 0 && !alone(); left--) await frame();
      if (!alone()) return [`chapter ${chapter} never alone on the map`];
      await frame();
      await frame();
      await Promise.all(
        document
          .getAnimations()
          .filter((motion) => motion.playState === 'running')
          .filter((motion) => motion.effect?.getComputedTiming().endTime !== Infinity)
          .map((motion) => motion.finished.catch(() => motion)),
      );
      const levels = [...document.querySelectorAll<HTMLElement>('.path__levels .node__button')];
      const name = (level: HTMLElement) => level.getAttribute('aria-label')?.split(' · ')[0] ?? '?';
      const round = (element: Element, ring = 0) => {
        const box = element.getBoundingClientRect();
        const x = box.left + box.width / 2;
        return { x, y: box.top + box.height / 2, radius: box.width / 2 + ring };
      };
      const dots = [...document.querySelectorAll('.map__dots i')].map((dot) => round(dot));
      return levels.flatMap((level) => {
        const disc = level.querySelector('.node__disc');
        if (!disc) return [];
        const box = disc.getBoundingClientRect();
        const under = levels
          .filter((other) => other !== level)
          .filter((other) =>
            [...other.querySelectorAll('.node__disc, .node__label, .node__stars')].some((part) => {
              const them = part.getBoundingClientRect();
              const across = Math.min(box.right, them.right) - Math.max(box.left, them.left);
              const down = Math.min(box.bottom, them.bottom) - Math.max(box.top, them.top);
              return across > 1 && down > 1;
            }),
          )
          .map((other) => `${name(level)} under ${name(other)}`);
        const style = getComputedStyle(disc);
        const ring =
          style.outlineStyle === 'none'
            ? 0
            : parseFloat(style.outlineWidth) + parseFloat(style.outlineOffset);
        const reach = round(disc, ring);
        const touched = dots.some(
          (dot) => Math.hypot(dot.x - reach.x, dot.y - reach.y) < reach.radius + dot.radius - 1,
        );
        return touched ? [...under, `${name(level)} under the dots`] : under;
      });
    },
    { chapter, frames: paced(600) },
  );

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

/**
 * A phone of this size, held as a player holds it (touch, a mobile page), in
 * the language's own locale. Each size has its own context, as the other
 * sweeps do: Firefox's mobile emulation never finishes a `setViewportSize`.
 * Less motion, as the system can ask: the hub's pages then fade in place
 * instead of sliding, so a line is measured where it rests (the CI's WebKit
 * measured trophies and chapters mid-slide, its slide unseen by
 * `getAnimations()`).
 */
async function phoneAt(
  browser: Browser,
  info: TestInfo,
  phone: { readonly width: number; readonly height: number; readonly locale: string },
): Promise<Page> {
  const context = await browser.newContext({
    baseURL: info.project.use.baseURL,
    viewport: { width: phone.width, height: phone.height },
    deviceScaleFactor: devices['Pixel 7'].deviceScaleFactor,
    hasTouch: true,
    isMobile: true,
    locale: phone.locale,
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  await closeDailyGift(page);
  return page;
}

for (const { code, locale } of LANGUAGES) {
  test.describe(code, () => {
    const words = messages(code);
    const say = (path: string) => message(words, path);

    test(`${code}: every line of the world fits its place, from 390 to 320 px`, async ({
      browser,
    }, info) => {
      test.skip(info.project.name !== 'desktop', 'Its own phones: once per engine');
      test.setTimeout(paced(120_000));
      for (const phone of PHONES) {
        const size = `${phone.width} × ${phone.height}`;
        const page = await phoneAt(browser, info, { ...phone, locale });
        // A day of the preseason: its page has a season to tell, whenever the suite runs.
        await page.clock.setFixedTime(new Date('2026-11-06T12:00:00Z'));
        // Every Guardian defeated: each trophy is owned, the Dune scales worn.
        await seedStorage(page, {
          'stackrift:profile': {
            games: 3,
            bosses: [...GUARDIANS],
            equipment: { material: 'dunes', ambiance: 'night', shatter: 'shards' },
          },
        });
        const tab = (name: string) => page.getByRole('tab', { name: say(`hub.tabs.${name}`) });
        const panel = (name: string) =>
          page.getByRole('tabpanel', { name: say(`hub.tabs.${name}`) });
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
        await page.context().close();
      }
    });

    test(`${code}: the chapter's line leaves the map's levels their room`, async ({
      browser,
    }, info) => {
      test.skip(info.project.name !== 'desktop', 'Its own phones: once per engine');
      test.setTimeout(paced(120_000));
      for (const phone of SHORT_PHONES) {
        const size = `${phone.width} × ${phone.height}`;
        const page = await phoneAt(browser, info, { ...phone, locale });
        await seedStorage(page, {
          'stackrift:profile': { games: 3 },
          'stackrift:campaign': { stars: PLAYED, ranks: {} },
        });
        await page.goto('/');
        await page.getByRole('tab', { name: say('hub.tabs.map') }).click();
        await expect.soft(page.locator('.map__lore')).toBeVisible({ visible: phone.line });
        // From the chapter the map opens on (the last), back to the first.
        const panel = page.getByRole('tabpanel', { name: say('hub.tabs.map') });
        for (let chapter = 10; chapter >= 1; chapter--) {
          expect.soft(await covered(page, chapter), `${size}, chapter ${chapter}`).toEqual([]);
          if (chapter > 1) {
            await panel.getByRole('button', { name: say('hub.prevChapter') }).click();
          }
        }
        await page.context().close();
      }
    });
  });
}

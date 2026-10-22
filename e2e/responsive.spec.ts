import { expect, test, type Browser, type Page } from '@playwright/test';

/*
 * The responsive guards (1.26): no sideways scroll from 320 to 2560 px, and
 * four key sizes: a small phone (320 × 568) and a phone on its side
 * (844 × 390), both touch screens played with gestures (the default), then a
 * 200 % zoom (640 × 400 at 2×) and a 400 % zoom (320 × 256 at 4×, the floor
 * of WCAG's reflow); the on-screen buttons, an option, apart. They open their
 * own browser contexts: they run once, in the desktop project.
 */

const FAMILIES = ['Classique', 'Duel', 'Sable', 'Mosaïque', 'Tour'] as const;
const TABS = ['Accueil', 'Modes', 'Carte', 'Atelier'] as const;

const tab = (page: Page, name: string) => page.getByRole('tab', { name });
const panel = (page: Page, name: string) => page.getByRole('tabpanel', { name });

async function openMode(page: Page, name: string) {
  await tab(page, 'Modes').click();
  await panel(page, 'Modes').getByRole('button', { name, exact: true }).click();
  await panel(page, 'Modes').getByRole('button', { name: 'Jouer' }).click();
  if (name === 'Duel') await page.getByRole('button', { name: /IA normale/ }).click();
  await expect(page.locator('canvas[role="img"]').first()).toBeAttached();
  await settle(page);
}

async function quitGame(page: Page) {
  await page.keyboard.press('KeyP');
  await page
    .getByRole('dialog', { name: 'Pause' })
    .getByRole('button', { name: 'Quitter' })
    .click();
  await page.locator('main').waitFor();
}

/** Two frames: the layout, then the canvases, follow a resize. */
const settle = (page: Page) =>
  page.evaluate(
    () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))),
  );

/**
 * Nothing sticks out sideways: the page does not scroll, nothing outside a
 * scroller passes the edge (a hidden overflow would mask it), and no control
 * is cut by the edge (the menu clips its pages).
 */
async function expectFits(page: Page, where: string) {
  const found = await page.evaluate(() => {
    const root = document.documentElement;
    const vw = root.clientWidth;
    const inScroller = (el: Element) => {
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement)
        if (getComputedStyle(p).overflowX !== 'visible') return true;
      return false;
    };
    const name = (el: Element) =>
      el.getAttribute('aria-label') ??
      `${el.tagName.toLowerCase()}.${el.getAttribute('class') ?? ''} ${el.textContent.trim().slice(0, 24)}`;
    const out = (el: Element) => {
      const box = el.getBoundingClientRect();
      return box.width > 1 && (box.right > vw + 1 || box.left < -1);
    };
    const shown = (el: Element) => el.checkVisibility() && !el.closest('[inert]');
    return {
      scroll: root.scrollWidth - vw,
      past: [...document.body.querySelectorAll('*')]
        .filter((el) => out(el) && shown(el) && !inScroller(el))
        .slice(0, 5)
        .map(name),
      cut: [...document.querySelectorAll('button, a[href], [role="tab"], input, select')]
        .filter((el) => shown(el) && out(el))
        .slice(0, 5)
        .map(name),
    };
  });
  expect(
    found.scroll,
    `${where}: the page scrolls sideways (${found.past.join(', ')})`,
  ).toBeLessThanOrEqual(0);
  expect(found.past, `${where}: past the edge`).toEqual([]);
  expect(found.cut, `${where}: controls cut by the edge`).toEqual([]);
}

/** Touch targets: 44 px, 48 px for the game's frequent controls (directive 4). */
async function expectThumbSized(page: Page, where: string) {
  const small = await page.evaluate(() => {
    const vw = innerWidth;
    const vh = innerHeight;
    return [
      ...document.querySelectorAll(
        'a[href], button, input:not([type="hidden"]), select, summary, [role="button"], [role="tab"]',
      ),
    ]
      .filter((el) => el.checkVisibility() && !el.closest('[inert]'))
      .map((el) => ({
        el,
        box: (el.closest('label') ?? el).getBoundingClientRect(),
        floor: el.matches('.control, .stage__box--hold') ? 48 : 44,
      }))
      .filter(({ box }) => box.right > 0 && box.left < vw && box.bottom > 0 && box.top < vh)
      .filter(({ box, floor }) => box.width < floor - 0.5 || box.height < floor - 0.5)
      .map(
        ({ el, box }) =>
          `${el.getAttribute('aria-label') ?? el.textContent.trim().slice(0, 24)} ${Math.round(box.width)}×${Math.round(box.height)}`,
      );
  });
  expect(small, `${where}: targets under a thumb's size`).toEqual([]);
}

/** The HUD reads at a glance: labels 14 px at least, numbers 16 px (windows aside). */
async function expectReadableHud(page: Page, where: string) {
  const small = await page.evaluate(() => {
    const size = (el: Element) => parseFloat(getComputedStyle(el).fontSize);
    const under = (selector: string, floor: number) =>
      [...document.querySelectorAll(selector)]
        .filter((el) => el.checkVisibility() && !el.closest('dialog') && size(el) < floor - 0.01)
        .map((el) => `${el.className} ${size(el).toFixed(1)} px`);
    return [
      ...under(
        '.hud__label, .stage__label, .legend__action, .opponent__label, .goal__level, .goal__text, .goal__count',
        14,
      ),
      ...under('.hud__value, .hud__best-value', 16),
    ];
  });
  expect(small, `${where}: HUD text too small`).toEqual([]);
}

/** The dashboard stays whole on screen: a counter cut by the edge is lost. */
async function expectHudInside(page: Page, where: string) {
  const cut = await page.evaluate(() => {
    const vw = innerWidth;
    return [...document.querySelectorAll('.game__score, .game__stats, .game__goal, .game__help')]
      .filter((el) => el.checkVisibility())
      .filter((el) => {
        const box = el.getBoundingClientRect();
        return box.left < -1 || box.right > vw + 1;
      })
      .map((el) => el.className);
  });
  expect(cut, `${where}: the dashboard runs off the screen`).toEqual([]);
}

/** The share of the screen's height the well (or the Mosaic's board) takes. */
const wellShare = (page: Page) =>
  page.evaluate(() => {
    const well = document.querySelector('.stage__canvas, .mosaic__canvas');
    return well ? well.getBoundingClientRect().height / innerHeight : 0;
  });

test('no sideways scroll from 320 to 2560 px, every 20 px, in the menu and every family', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'desktop', 'One sweep is enough');
  test.setTimeout(300_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.locator('main').waitFor();
  const sweep = async (where: string) => {
    for (let width = 320; width <= 2560; width += 20) {
      await page.setViewportSize({ width, height: 800 });
      await settle(page);
      await expectFits(page, `${where} @${width}`);
    }
    await page.setViewportSize({ width: 1280, height: 800 });
  };
  for (const name of TABS) {
    await tab(page, name).click();
    await sweep(name);
  }
  for (const name of FAMILIES) {
    await openMode(page, name);
    await sweep(name);
    await quitGame(page);
  }
});

interface KeySize {
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly scale?: number;
  /** A touch screen (played with gestures, the default). */
  readonly touch?: boolean;
  /** The least share of the screen's height the well keeps in a game. */
  readonly well?: number;
}

const KEY_SIZES: readonly KeySize[] = [
  { name: '320 × 568', width: 320, height: 568, touch: true, well: 0.4 },
  { name: '844 × 390', width: 844, height: 390, touch: true, well: 0.5 },
  { name: 'a 200 % zoom', width: 640, height: 400, scale: 2, well: 0.55 },
  { name: 'a 400 % zoom', width: 320, height: 256, scale: 4 },
];

async function openAt(browser: Browser, size: KeySize, controls?: 'buttons') {
  const context = await browser.newContext({
    baseURL: 'http://localhost:4177/',
    viewport: { width: size.width, height: size.height },
    deviceScaleFactor: size.scale ?? 1,
    hasTouch: size.touch ?? false,
    isMobile: size.touch ?? false,
    locale: 'fr-FR',
    reducedMotion: 'reduce',
  });
  if (controls)
    await context.addInitScript(
      (scheme) => localStorage.setItem('stackrift:settings', JSON.stringify({ controls: scheme })),
      controls,
    );
  const page = await context.newPage();
  await page.goto('/');
  await page.locator('main').waitFor();
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  return { context, page };
}

for (const size of KEY_SIZES)
  test(`at ${size.name}: the menu, its windows and every family fit and read well`, async ({
    browser,
  }, info) => {
    test.skip(info.project.name !== 'desktop', 'Own contexts: once is enough');
    test.setTimeout(180_000);
    const { context, page } = await openAt(browser, size);
    const tiny = size.height < 320;
    for (const name of TABS) {
      await tab(page, name).click();
      await settle(page);
      await expectFits(page, `${size.name}, ${name}`);
      if (size.touch) await expectThumbSized(page, `${size.name}, ${name}`);
    }

    await tab(page, 'Accueil').click();
    if (tiny) {
      // The page scrolls to Play, and no challenge loses the end of its words.
      const play = panel(page, 'Accueil').getByRole('button', { name: /^Jouer/ });
      await play.scrollIntoViewIfNeeded();
      await expect(play).toBeInViewport({ ratio: 1 });
      const cut = await panel(page, 'Accueil')
        .locator('.challenge__text > *')
        .evaluateAll((texts) =>
          texts
            .filter(
              (el) => el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1,
            )
            .map((el) => el.textContent),
        );
      expect(cut, 'challenges cut at 400 %').toEqual([]);
    }

    await page.getByRole('button', { name: 'Réglages' }).click();
    await settle(page);
    await expectFits(page, `${size.name}, settings`);
    if (size.touch) await expectThumbSized(page, `${size.name}, settings`);
    await page.keyboard.press('Escape');

    for (const name of FAMILIES) {
      await openMode(page, name);
      const where = `${size.name}, ${name}`;
      await expectFits(page, where);
      await expectHudInside(page, where);
      if (size.touch) await expectThumbSized(page, where);
      // At 400 %, the game is spared (WCAG exempts games): it only has to fit.
      if (!tiny) await expectReadableHud(page, where);
      if (size.well)
        expect(await wellShare(page), `${where}: the well's share of the height`).toBeGreaterThan(
          size.well,
        );
      await quitGame(page);
    }
    await context.close();
  });

test('the on-screen buttons, an option of the settings, keep a thumb’s size', async ({
  browser,
}, info) => {
  test.skip(info.project.name !== 'desktop', 'Own contexts: once is enough');
  test.setTimeout(120_000);
  for (const size of KEY_SIZES.filter((key) => key.touch)) {
    const { context, page } = await openAt(browser, size, 'buttons');
    for (const name of ['Classique', 'Sable', 'Tour']) {
      await openMode(page, name);
      const where = `${size.name}, ${name}, buttons`;
      await expect(page.locator('.control').first()).toBeVisible();
      await expectFits(page, where);
      await expectThumbSized(page, where);
      expect(await wellShare(page), `${where}: the well's share of the height`).toBeGreaterThan(
        0.33,
      );
      await quitGame(page);
    }
    await context.close();
  }
});

import { expect, test, type Page } from '@playwright/test';

/*
 * The game in Russian, the longest of its languages: a browser set to Russian
 * gets it, the words count as Russian counts (1 звезда, 3 звезды, 5 звёзд),
 * and every screen keeps its words inside, from a 320 px phone to the desktop.
 */
test.use({ locale: 'ru-RU' });

const tab = (page: Page, name: string) => page.getByRole('tab', { name });
const panel = (page: Page, name: string) => page.getByRole('tabpanel', { name });

/** Opens a mode from the Modes page, the normal AI for the duel. */
async function openMode(page: Page, name: string) {
  await tab(page, 'Режимы').click();
  await panel(page, 'Режимы').getByRole('button', { name, exact: true }).click();
  await panel(page, 'Режимы').getByRole('button', { name: 'Играть' }).click();
  if (name === 'Дуэль') await page.getByRole('button', { name: /Обычный ИИ/ }).click();
  await expect(page.locator('canvas[role="img"]').first()).toBeVisible();
}

/**
 * What does not fit, on the screen as it is: a page that scrolls sideways, a
 * control cut by the screen's edge, a word cut by its box, a HUD label wider
 * than its column. (A mode's pitch is cut to its lines on purpose: not checked.)
 */
const misfits = (page: Page) =>
  page.evaluate(() => {
    const issues: string[] = [];
    const width = document.documentElement.clientWidth;
    const height = document.documentElement.clientHeight;
    if (document.documentElement.scrollWidth > width) issues.push('the page scrolls sideways');
    const dialog = document.querySelector('dialog[open]');
    // The skip link waits above the screen until a keyboard reaches it.
    const shown = (element: Element) =>
      !element.closest('[inert]') &&
      !element.closest('.sr-only, .skip') &&
      (!dialog || dialog.contains(element)) &&
      getComputedStyle(element).visibility !== 'hidden';
    for (const control of document.querySelectorAll('button, a, [role="tab"]')) {
      const box = control.getBoundingClientRect();
      if (shown(control) && box.width > 1 && (box.left < -1 || box.right > width + 1))
        issues.push(`off screen: ${control.getAttribute('aria-label') ?? control.textContent}`);
      // A page of the menu or a game is one screen: nothing below its bottom edge.
      if (shown(control) && !dialog && box.height > 1 && (box.top < -1 || box.bottom > height + 1))
        issues.push(
          `below the screen: ${control.getAttribute('aria-label') ?? control.textContent}`,
        );
    }
    for (const element of document.querySelectorAll('body *')) {
      if (!shown(element) || element.closest('.detail__pitch')) continue;
      const own = [...element.childNodes].some(
        (node) => node.nodeType === 3 && node.textContent?.trim(),
      );
      const style = getComputedStyle(element);
      // A word hidden for the eyes on purpose (1 px wide, read aloud) is not cut.
      const visible = element.getBoundingClientRect().width > 1;
      if (
        own &&
        visible &&
        style.overflowX !== 'visible' &&
        element.scrollWidth > element.clientWidth + 1
      )
        issues.push(`cut: ${element.textContent.trim()}`);
    }
    for (const item of document.querySelectorAll('.hud__item')) {
      const label = item.querySelector('dt');
      if (label && label.getBoundingClientRect().width > item.getBoundingClientRect().width + 1)
        issues.push(`HUD label wider than its column: ${label.textContent}`);
    }
    return issues;
  });

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.locator('main').waitFor();
});

test('a browser in Russian gets the game in Russian', async ({ page }) => {
  await expect(page).toHaveTitle('Lumirift Blocks — падающие блоки по-новому');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  for (const name of ['Главная', 'Режимы', 'Карта', 'Ателье'])
    await expect(tab(page, name)).toBeVisible();
  await expect(panel(page, 'Главная').getByRole('button', { name: /^Играть/ })).toBeVisible();
});

test('the words agree with the numbers, as Russian counts', async ({ page }) => {
  await page.evaluate(() =>
    localStorage.setItem(
      'stackrift:campaign',
      JSON.stringify({ stars: { '1-1': 3, '1-2': 2 }, ranks: {} }),
    ),
  );
  await page.reload();
  await tab(page, 'Карта').click();
  await panel(page, 'Карта')
    .getByRole('button', { name: /^Улучшения/ })
    .click();
  const shop = page.getByRole('dialog', { name: 'Улучшения' });
  await expect(shop).toContainText('Доступно 5 звёзд');
  const phoenix = shop.getByRole('listitem').filter({ hasText: 'Феникс' });
  await phoenix.getByRole('button').click();
  // Its first rank brings 4 rows: "few" (ряда), not "one" or "many".
  await expect(shop).toContainText('исчезают 4 нижних ряда');
  await shop.getByRole('button', { name: /Улучшить/ }).click();
  await expect(shop).toContainText('Доступно 3 звезды');
});

test('every screen keeps its Russian words inside, from 320 px to the desktop', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'desktop', 'One sweep is enough');
  test.setTimeout(240_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  for (const [width, height] of [
    [320, 568],
    [390, 844],
    [640, 360],
    [844, 390],
    [1280, 800],
  ] as const) {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await page.locator('main').waitFor();
    const size = `${width} × ${height}`;
    for (const name of ['Главная', 'Режимы', 'Карта', 'Ателье']) {
      await tab(page, name).click();
      await page.waitForTimeout(200);
      expect(await misfits(page), `${size}: ${name}`).toEqual([]);
    }
    await page.getByRole('button', { name: 'Настройки' }).click();
    expect(await misfits(page), `${size}: settings`).toEqual([]);
    // The keys window (keyboards only): each action beside its two key caps.
    await page.getByRole('button', { name: 'Настроить' }).click();
    await expect(page.getByRole('dialog', { name: 'Управление с клавиатуры' })).toBeVisible();
    expect(await misfits(page), `${size}: keys`).toEqual([]);
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    for (const name of ['Классика', 'Песок', 'Мозаика', 'Башня', 'Дуэль', 'Силуэт', 'Ритм']) {
      await openMode(page, name);
      expect(await misfits(page), `${size}: ${name}`).toEqual([]);
      await page.keyboard.press('KeyP');
      const pause = page.getByRole('dialog', { name: 'Пауза' });
      await expect(pause).toBeVisible();
      expect(await misfits(page), `${size}: pause`).toEqual([]);
      await pause.getByRole('button', { name: 'Выйти' }).click();
    }
  }
});

test('a level’s goal keeps its whole width beside a hold box, on a phone', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'desktop', 'Own sizes: once is enough');
  test.setTimeout(180_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  // Every level open: the map turns to any chapter.
  const stars: Record<string, number> = {};
  for (let chapter = 1; chapter <= 5; chapter++)
    for (let level = 1; level <= 7; level++) stars[`${chapter}-${level}`] = 3;
  await page.evaluate(
    (all) => localStorage.setItem('stackrift:campaign', JSON.stringify({ stars: all, ranks: {} })),
    stars,
  );
  // Classic, the Flip and its button, a duel, the Tower: the hold box's families (1.30 fix).
  for (const [width, height] of [
    [320, 568],
    [360, 640],
  ] as const) {
    await page.setViewportSize({ width, height });
    for (const id of ['1-3', '2-2', '1-6', '4-3']) {
      await page.goto('/');
      await tab(page, 'Карта').click();
      const map = panel(page, 'Карта');
      const back = map.getByRole('button', { name: 'Предыдущая глава' });
      while (await back.isEnabled()) {
        await back.click();
        await page.waitForTimeout(300);
      }
      for (let turn = 1; turn < Number(id.split('-')[0]); turn++) {
        await map.getByRole('button', { name: 'Следующая глава' }).click();
        await page.waitForTimeout(300);
      }
      await map.getByRole('button', { name: new RegExp(`(^|[^0-9])${id}([^0-9]|$)`) }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Играть', exact: true }).click();
      const goal = page.getByRole('group', { name: 'Цель' });
      await expect(goal).toBeVisible();
      const fit = await goal.evaluate((card) => {
        const level = card.querySelector('.goal__level')!;
        const text = card.querySelector('.goal__text')!;
        const line = parseFloat(getComputedStyle(level).lineHeight);
        return {
          levelOnOneLine: level.getBoundingClientRect().height < line * 1.5,
          textWhole: text.scrollHeight <= text.clientHeight + 1,
          wide: card.getBoundingClientRect().width >= window.innerWidth * 0.8,
        };
      });
      expect(fit, `${width} × ${height}: ${id}`).toEqual({
        levelOnOneLine: true,
        textWhole: true,
        wide: true,
      });
    }
  }
});

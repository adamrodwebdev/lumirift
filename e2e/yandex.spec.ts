import { expect, test, type Page } from '@playwright/test';
import { closeDailyGift, giftDialog } from './dailyGift';

/**
 * The Yandex Games build (1.30), with a stand-in for the SDK Yandex serves at
 * `/sdk.js`: it records every call, takes the player's language from `?lang=`,
 * keeps the player's data for the tab, and fires the platform's pauses on
 * demand. Labels are in Russian, Yandex's language for these players.
 */
const FAKE_SDK = `(() => {
  const params = new URLSearchParams(location.search);
  const calls = [];
  const listeners = {};
  const store = JSON.parse(sessionStorage.getItem('fake-yandex-data') || '{}');
  const later = (callback) => setTimeout(() => callback && callback(true), 100);
  const ysdk = {
    features: {
      LoadingAPI: { ready: () => calls.push('ready') },
      GameplayAPI: { start: () => calls.push('start'), stop: () => calls.push('stop') },
    },
    environment: { i18n: { lang: params.get('lang') || 'ru' } },
    adv: {
      showFullscreenAdv: ({ callbacks }) => {
        calls.push('fullscreen');
        if (callbacks.onOpen) callbacks.onOpen();
        later(callbacks.onClose);
      },
      showRewardedVideo: ({ callbacks }) => {
        calls.push('rewarded');
        if (callbacks.onOpen) callbacks.onOpen();
        if (callbacks.onRewarded) callbacks.onRewarded();
        later(callbacks.onClose);
      },
    },
    getPlayer: () => Promise.resolve({
      getData: () => Promise.resolve({ ...store }),
      setData: (data) => {
        Object.assign(store, data);
        sessionStorage.setItem('fake-yandex-data', JSON.stringify(data));
        calls.push('setData');
        return Promise.resolve();
      },
    }),
    on: (event, listener) => (listeners[event] = listeners[event] || []).push(listener),
  };
  window.__yandex = { calls, fire: (event) => (listeners[event] || []).forEach((listener) => listener()) };
  window.YaGames = { init: () => { calls.push('init'); return Promise.resolve(ysdk); } };
})();`;

interface FakeYandex {
  readonly calls: string[];
  fire(event: 'game_api_pause' | 'game_api_resume'): void;
}

async function open(page: Page, lang = 'ru') {
  await closeDailyGift(page);
  await page.route('**/sdk.js', (route) =>
    route.fulfill({ contentType: 'text/javascript', body: FAKE_SDK }),
  );
  await page.goto(`/?lang=${lang}`);
}

const calls = (page: Page) =>
  page.evaluate(() => (window as unknown as { __yandex: FakeYandex }).__yandex.calls);
const fire = (page: Page, event: 'game_api_pause' | 'game_api_resume') =>
  page.evaluate(
    (name) => (window as unknown as { __yandex: FakeYandex }).__yandex.fire(name),
    event,
  );
const last = async (page: Page, kinds: readonly string[]) =>
  (await calls(page)).filter((call) => kinds.includes(call)).at(-1);

test('a new player on Yandex: the SDK first, the training in Russian, then ready and the gameplay', async ({
  page,
}) => {
  await open(page);
  const goal = page.getByRole('group', { name: 'Цель' });
  await expect(goal).toContainText('Обучение');
  await expect(
    page.getByText('Молния в воде разбивает песок вокруг — сбросьте её!').filter({ visible: true }),
  ).toBeVisible();
  await expect.poll(() => calls(page)).toEqual(expect.arrayContaining(['ready', 'start']));
  const list = await calls(page);
  expect(list[0]).toBe('init');
  expect(list.filter((call) => call === 'ready')).toHaveLength(1);
  expect(list.indexOf('start')).toBeGreaterThan(list.indexOf('ready'));
});

test('a Yandex pause stops the game, which waits for the player to resume it', async ({ page }) => {
  await open(page);
  await expect.poll(() => last(page, ['start', 'stop'])).toBe('start');
  await fire(page, 'game_api_pause');
  const pause = page.getByRole('dialog', { name: 'Пауза' });
  await expect(pause).toBeVisible();
  expect(await last(page, ['start', 'stop'])).toBe('stop');
  // Yandex resumes: the game stays on its pause window, so Yandex still hears it stopped.
  await fire(page, 'game_api_resume');
  await expect(pause).toBeVisible();
  expect(await last(page, ['start', 'stop'])).toBe('stop');
  await pause.getByRole('button', { name: 'Продолжить' }).click();
  await expect.poll(() => last(page, ['start', 'stop'])).toBe('start');
});

test('no browser menu and no selection anywhere in the frame (rules 1.6.1.8, 1.6.2.7)', async ({
  page,
}) => {
  await open(page);
  const goal = page.getByRole('group', { name: 'Цель' });
  await expect(goal).toContainText('Обучение');
  // Off the well too: moderators right-click and long-press everywhere.
  const prevented = await goal.evaluate((element) => {
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    element.dispatchEvent(event);
    return event.defaultPrevented;
  });
  expect(prevented).toBe(true);
  expect(await page.evaluate(() => getComputedStyle(document.body).userSelect)).toBe('none');
});

test('a Ukrainian player reads Russian, sees no version number, and keeps the progress', async ({
  page,
}) => {
  await open(page, 'uk');
  await expect(page.getByRole('group', { name: 'Цель' })).toContainText('Обучение');
  await page.getByRole('button', { name: 'Пауза' }).click();
  await page.getByRole('button', { name: 'Пропустить обучение' }).click();
  await expect(page.getByRole('tab', { name: 'Главная' })).toBeVisible();
  // Rule 1.14: no build version among the settings.
  await page.getByRole('button', { name: 'Настройки' }).click();
  const settings = page.getByRole('dialog', { name: 'Настройки' });
  await expect(settings).toBeVisible();
  await expect(settings).not.toContainText('Версия');
  // The save went to the player's data: the next visit opens on the menus.
  await expect.poll(() => calls(page)).toContain('setData');
  await page.reload();
  await expect(page.getByRole('tab', { name: 'Главная' })).toBeVisible();
});

/** A player of ten minutes, the training done: the menus open, a continue may be offered. */
const SEASONED = JSON.stringify({
  'stackrift:profile': JSON.stringify({ trained: true, games: 3, playedMs: 600_000 }),
});

/** A Classic game run calmly past two minutes, then lost to its stack. */
async function loseAClassicRun(page: Page) {
  test.setTimeout(120_000);
  const modes = page.getByRole('tabpanel', { name: 'Modes' });
  await page.getByRole('tab', { name: 'Modes' }).click();
  await modes.getByRole('button', { name: 'Classic', exact: true }).click();
  await modes.getByRole('button', { name: 'Play' }).click();
  await expect(page.locator('canvas[role="img"]').first()).toBeVisible();
  // A run worth a continue lasts two minutes at least. The game's clock steps 100 ms a
  // frame; the pieces go to the walls by turns, so that the stack stays low meanwhile.
  for (let step = 0; step < 1300; step++) {
    if (step % 30 === 0) {
      const wall = Math.floor(step / 205) % 2 === 0 ? 'ArrowLeft' : 'ArrowRight';
      for (let move = 0; move < 5; move++) await page.keyboard.press(wall);
    }
    await page.clock.fastForward(100);
  }
  await expect(page.locator('.danger--broken')).toHaveCount(0);
  await dropUntilLost(page);
}

async function dropUntilLost(page: Page) {
  for (let drop = 0; drop < 40 && !(await page.locator('.danger--broken').count()); drop++) {
    await page.keyboard.press('Space');
    await page.clock.fastForward(100);
  }
  // The window rises once the well has broken.
  await page.clock.fastForward(1500);
}

test('a lost game may continue once for an ad: the top of the well clears and play goes on', async ({
  page,
}) => {
  await page.addInitScript((data) => {
    if (!sessionStorage.getItem('fake-yandex-data'))
      sessionStorage.setItem('fake-yandex-data', data);
  }, SEASONED);
  await page.clock.install();
  await open(page, 'en');
  await loseAClassicRun(page);

  const offer = page.getByRole('region', { name: 'Continue this game' });
  await expect(offer).toBeVisible();
  // Watch and decline alike, Play again working all along (the portals ask for it).
  await expect(offer.getByRole('button', { name: 'No thanks' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play again' })).toBeEnabled();
  await offer.getByRole('button', { name: 'Watch an ad to continue this game' }).click();
  await page.clock.fastForward(500);
  expect(await calls(page)).toContain('rewarded');
  await expect(offer).toBeHidden();
  await expect(page.locator('.danger--broken')).toHaveCount(0);

  // Lost again: no second offer; the end settles at once and Play again beats.
  await dropUntilLost(page);
  await expect(page.getByRole('button', { name: 'Play again' })).toHaveClass(/again--beat/);
  await expect(page.getByRole('region', { name: 'Continue this game' })).toHaveCount(0);
});

test('a continue let go: its ring runs out, the experience shows in its place', async ({
  page,
}) => {
  await page.addInitScript((data) => {
    if (!sessionStorage.getItem('fake-yandex-data'))
      sessionStorage.setItem('fake-yandex-data', data);
  }, SEASONED);
  await page.clock.install();
  await open(page, 'en');
  await loseAClassicRun(page);

  const offer = page.getByRole('region', { name: 'Continue this game' });
  await expect(offer).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play again' })).not.toHaveClass(/again--beat/);
  // Five seconds, then the offer goes and the game's end settles in the same window.
  await page.clock.fastForward(5200);
  await expect(offer).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Progress' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play again' })).toHaveClass(/again--beat/);
  expect(await calls(page)).not.toContain('rewarded');
});

test('a locked ambiance worn for one game after an ad, shown at once around the menus', async ({
  page,
}) => {
  await page.addInitScript((data) => {
    if (!sessionStorage.getItem('fake-yandex-data'))
      sessionStorage.setItem('fake-yandex-data', data);
  }, SEASONED);
  await open(page, 'en');
  await page.getByRole('tab', { name: 'Atelier' }).click();
  const atelier = page.getByRole('tabpanel', { name: 'Atelier' });
  await atelier.getByRole('button', { name: 'Ambiance', exact: true }).click();
  await atelier.getByRole('button', { name: /^Cosmos/ }).click();
  await atelier.getByRole('button', { name: 'Watch an ad to wear Cosmos for one game' }).click();
  await expect(atelier.getByText('Yours for your next game: Cosmos')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-ambiance', 'cosmos');
  expect(await calls(page)).toContain('rewarded');
  // Still locked: the shelf only lends it.
  await expect(atelier.getByRole('button', { name: /^Cosmos/ })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
});

test('the day’s gift doubled for an ad the player chooses, once a newcomer’s grace is over', async ({
  page,
}) => {
  await page.addInitScript(
    (data) => {
      if (!sessionStorage.getItem('fake-yandex-data'))
        sessionStorage.setItem('fake-yandex-data', data);
    },
    JSON.stringify({
      'stackrift:profile': JSON.stringify({
        trained: true,
        games: 3,
        playedMs: 600_000,
        gifts: { next: 2, lastDay: '20200101', shownDay: null },
      }),
    }),
  );
  await open(page, 'en');
  // This journey is about the calendar: it stays open.
  await page.removeLocatorHandler(giftDialog(page));
  const gift = giftDialog(page);
  await gift.getByRole('button', { name: 'Watch an ad to double today’s gift to 140 XP' }).click();
  await expect(gift.getByRole('status')).toHaveText('+140 XP! Tomorrow: +80 XP.');
  expect(await calls(page)).toContain('rewarded');
});

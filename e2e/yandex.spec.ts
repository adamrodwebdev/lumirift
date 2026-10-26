import { expect, test, type Page } from '@playwright/test';

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
  await expect(goal).toContainText('Этап 1/2');
  await expect(page.getByText('Положите воду на песок.').filter({ visible: true })).toBeVisible();
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
  await expect(goal).toContainText('Этап 1/2');
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
  await expect(page.getByRole('group', { name: 'Цель' })).toContainText('Этап 1/2');
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

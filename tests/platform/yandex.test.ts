import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AD_MAX_MS,
  AD_OPEN_TIMEOUT_MS,
  SAVE_INTERVAL_MS,
  YandexPlatform,
  type YandexAdCallbacks,
  type YandexPlayer,
  type YandexSdk,
} from '@/platform/yandex/YandexPlatform';

/** How the fake SDK plays the next ad. */
type Scenario = 'watched' | 'closedEarly' | 'skipped' | 'error' | 'stall' | 'openForever';

/** A Yandex SDK double: records calls and saves, fires its pause events on demand. */
function fakeYandex({
  lang = 'ru',
  data = {},
  playerFails = false,
}: { lang?: string; data?: Record<string, unknown>; playerFails?: boolean } = {}) {
  const calls: string[] = [];
  const writes: Record<string, string>[] = [];
  const listeners = new Map<string, () => void>();
  let scenario: Scenario = 'watched';
  let failingWrites = 0;
  const play = (callbacks: YandexAdCallbacks, rewarded: boolean) => {
    calls.push(rewarded ? 'rewarded' : 'fullscreen');
    if (scenario === 'skipped') callbacks.onClose?.(false);
    else if (scenario === 'error') callbacks.onError?.(new Error('no ad'));
    else if (scenario !== 'stall') {
      callbacks.onOpen?.();
      if (scenario === 'watched' && rewarded) callbacks.onRewarded?.();
      if (scenario !== 'openForever') callbacks.onClose?.(true);
    }
  };
  const player: YandexPlayer = {
    getData: () => {
      calls.push('getData');
      return Promise.resolve(data);
    },
    setData: (values, flush) => {
      writes.push({ ...values });
      calls.push(`setData(${flush})`);
      if (failingWrites > 0) {
        failingWrites--;
        return Promise.reject(new Error('too many requests'));
      }
      return Promise.resolve();
    },
  };
  const sdk: YandexSdk = {
    features: {
      LoadingAPI: { ready: () => calls.push('ready') },
      GameplayAPI: { start: () => calls.push('start'), stop: () => calls.push('stop') },
    },
    environment: { i18n: { lang } },
    adv: {
      showFullscreenAdv: ({ callbacks }) => play(callbacks, false),
      showRewardedVideo: ({ callbacks }) => play(callbacks, true),
    },
    getPlayer: (options) => {
      calls.push(`getPlayer(${options.scopes})`);
      return playerFails ? Promise.reject(new Error('no player')) : Promise.resolve(player);
    },
    on: (event, listener) => listeners.set(event, listener),
  };
  return {
    yaGames: {
      init: () => {
        calls.push('init');
        return Promise.resolve(sdk);
      },
    },
    calls,
    writes,
    fire: (event: 'game_api_pause' | 'game_api_resume') => listeners.get(event)?.(),
    playNext: (next: Scenario) => (scenario = next),
    failWrites: (count: number) => (failingWrites = count),
  };
}

const hooks = () => ({ onStart: vi.fn(), onEnd: vi.fn() });
const create = (fake: ReturnType<typeof fakeYandex>) =>
  YandexPlatform.create(fake.yaGames, () => Date.now());

describe('YandexPlatform (1.30)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('initializes the SDK before any call, and reads the language and every save at once', async () => {
    const fake = fakeYandex({ lang: 'uk', data: { 'stackrift:profile': '{"games":3}', other: 1 } });
    const platform = await create(fake);
    expect(fake.calls).toEqual(['init', 'getPlayer(false)', 'getData']);
    expect(platform.locale).toBe('uk');
    expect(platform.storage?.get('stackrift:profile')).toBe('{"games":3}');
    expect(platform.storage?.get('other')).toBeNull();
    // A portal: the training first, no link out, no version shown, Escape left to the browser.
    expect(platform.firstRun).toBe('training');
    expect(platform.allowsExternalLinks).toBe(false);
    expect(platform.showsVersion).toBe(false);
    expect(platform.reservesEscape).toBe(true);
    expect(platform.stopsOnAutoPause).toBe(true);
    // Yandex's own fallback for this Ukrainian player: Russian.
    expect(platform.russianForNeighbours).toBe(true);
  });

  it('runs without Yandex (no SDK, or no player data): saves in the browser, no ad', async () => {
    const alone = await YandexPlatform.create(undefined);
    expect(alone.storage).toBeNull();
    expect(alone.locale).toBeNull();
    expect(alone.supportsRewarded).toBe(false);
    alone.ready();
    await expect(alone.midgameAd(hooks())).resolves.toBeUndefined();
    const noPlayer = await create(fakeYandex({ playerFails: true }));
    expect(noPlayer.storage).toBeNull();
    expect(noPlayer.locale).toBe('ru');
  });

  it('says ready once, then marks the gameplay only on a change, never before ready', async () => {
    const fake = fakeYandex();
    const platform = await create(fake);
    fake.calls.length = 0;
    // A portal's first run plays at once: the start waits for ready.
    platform.gameplayStart();
    expect(fake.calls).toEqual([]);
    platform.ready();
    platform.ready();
    expect(fake.calls).toEqual(['ready', 'start']);
    platform.gameplayStart();
    platform.gameplayStop();
    platform.gameplayStop();
    platform.gameplayStart();
    platform.gameOver();
    expect(fake.calls).toEqual(['ready', 'start', 'stop', 'start', 'stop']);
  });

  it('passes on Yandex pauses, and sends the save as the game is paused', async () => {
    const fake = fakeYandex();
    const platform = await create(fake);
    const paused: boolean[] = [];
    platform.onPauseChange((value) => paused.push(value));
    platform.storage?.set('stackrift:settings', 'a');
    fake.fire('game_api_pause');
    expect(fake.writes).toEqual([{ 'stackrift:settings': 'a' }]);
    fake.fire('game_api_resume');
    expect(paused).toEqual([true, false]);
  });

  it('groups the saves of one moment, then waits 4 s between requests, the last value kept', async () => {
    const fake = fakeYandex({ data: { 'stackrift:records': 'r' } });
    const platform = await create(fake);
    const storage = platform.storage!;
    storage.set('stackrift:settings', '1');
    storage.set('stackrift:profile', 'p');
    vi.advanceTimersByTime(300);
    // The whole object, sent at once: Yandex replaces it.
    expect(fake.writes).toEqual([
      { 'stackrift:records': 'r', 'stackrift:settings': '1', 'stackrift:profile': 'p' },
    ]);
    // Right after: the next request waits 4 s after the first one.
    storage.set('stackrift:settings', '2');
    storage.set('stackrift:settings', '3');
    vi.advanceTimersByTime(SAVE_INTERVAL_MS - 100);
    expect(fake.writes).toHaveLength(1);
    vi.advanceTimersByTime(100);
    expect(fake.writes).toHaveLength(2);
    expect(fake.writes[1]?.['stackrift:settings']).toBe('3');
    expect(fake.calls.filter((call) => call.startsWith('setData'))).toEqual([
      'setData(true)',
      'setData(true)',
    ]);
  });

  it('tries a refused save once more, never in a loop', async () => {
    const fake = fakeYandex();
    const platform = await create(fake);
    fake.failWrites(5);
    platform.storage?.set('stackrift:profile', 'p');
    await vi.advanceTimersByTimeAsync(300);
    await vi.advanceTimersByTimeAsync(SAVE_INTERVAL_MS * 5);
    expect(fake.writes).toHaveLength(2);
  });

  it('plays a fullscreen ad at a break, the sound off only while it plays', async () => {
    const fake = fakeYandex();
    const platform = await create(fake);
    const watched = hooks();
    await platform.midgameAd(watched);
    expect(watched.onStart).toHaveBeenCalledOnce();
    expect(watched.onEnd).toHaveBeenCalledOnce();
    // Too soon after the last one: Yandex closes it unshown, the game goes on.
    fake.playNext('skipped');
    const skipped = hooks();
    await platform.midgameAd(skipped);
    expect(skipped.onStart).not.toHaveBeenCalled();
    expect(platform.supportsRewarded).toBe(true);
  });

  it('never waits forever on an ad: 12 s to open, 2 minutes open at most', async () => {
    const fake = fakeYandex();
    const platform = await create(fake);
    fake.playNext('stall');
    const stalled = platform.midgameAd(hooks());
    vi.advanceTimersByTime(AD_OPEN_TIMEOUT_MS);
    await expect(stalled).resolves.toBeUndefined();
    fake.playNext('openForever');
    const open = hooks();
    const forever = platform.midgameAd(open);
    vi.advanceTimersByTime(AD_MAX_MS);
    await forever;
    expect(open.onEnd).toHaveBeenCalledOnce();
  });

  it('rewards only a watched rewarded ad, and offers none after a failed one', async () => {
    const fake = fakeYandex();
    const platform = await create(fake);
    await expect(platform.rewardedAd(hooks())).resolves.toBe(true);
    fake.playNext('closedEarly');
    await expect(platform.rewardedAd(hooks())).resolves.toBe(false);
    expect(platform.supportsRewarded).toBe(true);
    // No ad-block signal on Yandex: an error ends the offers for this visit.
    fake.playNext('error');
    await expect(platform.rewardedAd(hooks())).resolves.toBe(false);
    expect(platform.supportsRewarded).toBe(false);
    fake.playNext('watched');
    await expect(platform.rewardedAd(hooks())).resolves.toBe(false);
  });
});

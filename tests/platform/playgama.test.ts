import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FULL_EDITION } from '@/platform/Edition';
import { PlaygamaPlatform, type PlaygamaBridge } from '@/platform/playgama/PlaygamaPlatform';
import type { TelegramWebApp } from '@/platform/playgama/TelegramShell';
import { SAVED_KEYS } from '@/platform/savedKeys';

type Listener = (value: never) => void;

/** A Bridge double: records messages and saves, fires events on demand; `id` is where it says it runs. */
function fakeBridge(saved: Record<string, string> = {}, adsBlocked = false, id = 'playgama') {
  const listeners = new Map<string, Listener>();
  const messages: string[] = [];
  const writes: { keys: readonly string[]; values: readonly string[] }[] = [];
  const store = new Map(Object.entries(saved));
  const ads: string[] = [];
  const initialize = vi.fn(() => Promise.resolve());
  const get = vi.fn((keys: readonly string[]) =>
    Promise.resolve(keys.map((key) => store.get(key) ?? null)),
  );
  const bridge: PlaygamaBridge = {
    initialize,
    EVENT_NAME: {
      AUDIO_STATE_CHANGED: 'audio',
      PAUSE_STATE_CHANGED: 'pause',
      INTERSTITIAL_STATE_CHANGED: 'interstitial',
      REWARDED_STATE_CHANGED: 'rewarded',
    },
    platform: {
      id,
      language: 'fr',
      isAudioEnabled: true,
      sendMessage: (message) => messages.push(message),
      on: (event, listener) => listeners.set(event, listener),
    },
    storage: {
      get,
      set: (keys, values) => {
        writes.push({ keys, values });
        keys.forEach((key, index) => store.set(key, values[index] ?? ''));
        return Promise.resolve();
      },
    },
    advertisement: {
      isInterstitialSupported: true,
      isRewardedSupported: true,
      on: (event, listener) => listeners.set(event, listener),
      showInterstitial: (placement) => ads.push(placement ?? ''),
      showRewarded: (placement) => ads.push(`rewarded:${placement ?? ''}`),
      checkAdBlock: () => Promise.resolve(adsBlocked),
    },
  };
  const fire = (event: string, value: unknown) => listeners.get(event)?.(value as never);
  return { bridge, messages, writes, ads, fire, initialize, get };
}

describe('PlaygamaPlatform', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('initializes the Bridge, then reads every saved key in one call', async () => {
    const fake = fakeBridge({ 'stackrift:records': '{"classic":10}' });
    const platform = await PlaygamaPlatform.create(fake.bridge);
    expect(fake.initialize).toHaveBeenCalledOnce();
    expect(fake.get).toHaveBeenCalledOnce();
    expect(fake.get).toHaveBeenCalledWith(SAVED_KEYS, false);
    expect(platform.storage.get('stackrift:records')).toBe('{"classic":10}');
    expect(platform.storage.get('stackrift:profile')).toBeNull();
    expect(platform.locale).toBe('fr');
    // Escape is the portal's: it leaves full screen.
    expect(platform.reservesEscape).toBe(true);
    // A new player starts in the training, before any menu (1.29).
    expect(platform.firstRun).toBe('training');
    // English for every language the game lacks, Ukrainian too (Playgama's checklist, 1.30.1).
    expect(platform.russianForNeighbours).toBe(false);
  });

  it('groups a burst of saves into one Bridge call', async () => {
    const fake = fakeBridge();
    const platform = await PlaygamaPlatform.create(fake.bridge);
    platform.storage.set('stackrift:settings', 'a');
    platform.storage.set('stackrift:settings', 'b');
    platform.storage.set('stackrift:profile', 'c');
    expect(fake.writes).toHaveLength(0);
    vi.advanceTimersByTime(300);
    expect(fake.writes).toEqual([
      { keys: ['stackrift:settings', 'stackrift:profile'], values: ['b', 'c'] },
    ]);
  });

  it('sends game_ready once, and level messages in order', async () => {
    const fake = fakeBridge();
    const platform = await PlaygamaPlatform.create(fake.bridge);
    platform.ready();
    platform.ready();
    platform.gameplayStart();
    platform.gameplayStop();
    platform.gameplayStart();
    platform.gameOver(false);
    platform.gameplayStop();
    platform.gameplayStart();
    platform.gameOver(true);
    expect(fake.messages).toEqual([
      'game_ready',
      'level_started',
      'level_paused',
      'level_resumed',
      'level_failed',
      'level_started',
      'level_completed',
    ]);
  });

  it('keeps a first run’s level messages until game_ready (a portal’s training plays at once)', async () => {
    const fake = fakeBridge();
    const platform = await PlaygamaPlatform.create(fake.bridge);
    platform.gameplayStart();
    expect(fake.messages).toEqual([]);
    platform.ready();
    platform.gameplayStop();
    expect(fake.messages).toEqual(['game_ready', 'level_started', 'level_paused']);
  });

  it('follows the platform sound and pause', async () => {
    const fake = fakeBridge();
    const platform = await PlaygamaPlatform.create(fake.bridge);
    const muted: boolean[] = [];
    const paused: boolean[] = [];
    platform.onMuteChange((value) => muted.push(value));
    platform.onPauseChange((value) => paused.push(value));
    fake.fire('audio', false);
    fake.fire('pause', true);
    fake.fire('pause', false);
    expect(platform.muted).toBe(true);
    expect(muted).toEqual([true]);
    expect(paused).toEqual([true, false]);
  });

  it('silences the game only while an interstitial is open', async () => {
    const fake = fakeBridge();
    const platform = await PlaygamaPlatform.create(fake.bridge);
    const hooks = { onStart: vi.fn(), onEnd: vi.fn() };
    const ad = platform.midgameAd(hooks);
    expect(fake.ads).toEqual(['game_over']);
    fake.fire('interstitial', 'loading');
    fake.fire('interstitial', 'opened');
    expect(hooks.onStart).toHaveBeenCalledOnce();
    fake.fire('interstitial', 'closed');
    await ad;
    expect(hooks.onEnd).toHaveBeenCalledOnce();
  });

  it('goes on when the ad is refused or never comes', async () => {
    const fake = fakeBridge();
    const platform = await PlaygamaPlatform.create(fake.bridge);
    const hooks = { onStart: vi.fn(), onEnd: vi.fn() };
    const refused = platform.midgameAd(hooks);
    fake.fire('interstitial', 'failed');
    await refused;
    const silent = platform.midgameAd(hooks);
    vi.advanceTimersByTime(1500);
    await silent;
    expect(hooks.onStart).not.toHaveBeenCalled();
    expect(hooks.onEnd).not.toHaveBeenCalled();
  });

  it('rewards only once the Bridge confirms the rewarded ad was watched', async () => {
    const fake = fakeBridge();
    const platform = await PlaygamaPlatform.create(fake.bridge);
    expect(platform.supportsRewarded).toBe(true);
    const hooks = { onStart: vi.fn(), onEnd: vi.fn() };
    const watched = platform.rewardedAd(hooks);
    expect(fake.ads).toEqual(['rewarded:double_xp']);
    fake.fire('rewarded', 'loading');
    fake.fire('rewarded', 'opened');
    expect(hooks.onStart).toHaveBeenCalledOnce();
    fake.fire('rewarded', 'rewarded');
    fake.fire('rewarded', 'closed');
    await expect(watched).resolves.toBe(true);
    expect(hooks.onEnd).toHaveBeenCalledOnce();
  });

  it('gives nothing for a rewarded ad closed early, failed or never shown', async () => {
    const fake = fakeBridge();
    const platform = await PlaygamaPlatform.create(fake.bridge);
    const hooks = { onStart: vi.fn(), onEnd: vi.fn() };
    const closed = platform.rewardedAd(hooks);
    fake.fire('rewarded', 'opened');
    fake.fire('rewarded', 'closed');
    await expect(closed).resolves.toBe(false);
    const failed = platform.rewardedAd(hooks);
    fake.fire('rewarded', 'failed');
    await expect(failed).resolves.toBe(false);
    const silent = platform.rewardedAd(hooks);
    vi.advanceTimersByTime(1500);
    await expect(silent).resolves.toBe(false);
  });

  it('runs without the SDK: no messages, a save in memory', async () => {
    const platform = await PlaygamaPlatform.create(null);
    platform.ready();
    platform.storage.set('stackrift:settings', 'x');
    expect(platform.storage.get('stackrift:settings')).toBe('x');
    expect(platform.locale).toBeNull();
    await expect(platform.midgameAd({ onStart: vi.fn(), onEnd: vi.fn() })).resolves.toBe(undefined);
    expect(platform.supportsRewarded).toBe(false);
    await expect(platform.rewardedAd({ onStart: vi.fn(), onEnd: vi.fn() })).resolves.toBe(false);
  });

  it('offers and asks for no ad when the browser blocks them (Bridge would wait for good)', async () => {
    const fake = fakeBridge({}, true);
    const platform = await PlaygamaPlatform.create(fake.bridge);
    await Promise.resolve();
    expect(platform.supportsRewarded).toBe(false);
    await platform.midgameAd({ onStart: () => {}, onEnd: () => {} });
    expect(await platform.rewardedAd({ onStart: () => {}, onEnd: () => {} })).toBe(false);
    expect(fake.ads).toEqual([]);
    // Without a blocker, both stay on offer.
    const open = await PlaygamaPlatform.create(fakeBridge().bridge);
    await Promise.resolve();
    expect(open.supportsRewarded).toBe(true);
  });
});

/** Telegram's Mini App object, as a double: records its calls, fires its events on demand. */
function fakeTelegram(version = '8.0') {
  const calls: string[] = [];
  const handlers = new Map<string, () => void>();
  const webApp: TelegramWebApp = {
    isVersionAtLeast: (wanted) => Number(version) >= Number(wanted),
    expand: () => calls.push('expand'),
    disableVerticalSwipes: () => calls.push('swipes off'),
    enableVerticalSwipes: () => calls.push('swipes on'),
    onEvent: (event, handler) => handlers.set(event, handler),
  };
  return { webApp, calls, fire: (event: string) => handlers.get(event)?.() };
}

describe('PlaygamaPlatform in Telegram (a partner copy, 1.46.5)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("reads the save under names Telegram's cloud accepts, a long value from its parts", async () => {
    const records = JSON.stringify({ daily: 'd'.repeat(9000) });
    const fake = fakeBridge(
      {
        stackrift_records: '@parts:3',
        stackrift_records_1: records.slice(0, 4096),
        stackrift_records_2: records.slice(4096, 8192),
        stackrift_records_3: records.slice(8192),
        stackrift_settings: '{"volume":1}',
      },
      false,
      'telegram',
    );
    const platform = await PlaygamaPlatform.create(fake.bridge, FULL_EDITION, null);
    expect(fake.get).toHaveBeenNthCalledWith(
      1,
      SAVED_KEYS.map((key) => key.replace(':', '_')),
      false,
    );
    expect(fake.get).toHaveBeenNthCalledWith(
      2,
      ['stackrift_records_1', 'stackrift_records_2', 'stackrift_records_3'],
      false,
    );
    expect(platform.storage.get('stackrift:records')).toBe(records);
    expect(platform.storage.get('stackrift:settings')).toBe('{"volume":1}');
  });

  it('writes a long value as announced parts Telegram can hold, a short one whole', async () => {
    const fake = fakeBridge({}, false, 'telegram');
    const platform = await PlaygamaPlatform.create(fake.bridge, FULL_EDITION, null);
    const records = JSON.stringify({ daily: 'd'.repeat(5000) });
    platform.storage.set('stackrift:records', records);
    platform.storage.set('stackrift:settings', '{}');
    vi.advanceTimersByTime(300);
    expect(fake.writes).toEqual([
      {
        keys: [
          'stackrift_records',
          'stackrift_records_1',
          'stackrift_records_2',
          'stackrift_settings',
        ],
        values: ['@parts:2', records.slice(0, 4096), records.slice(4096), '{}'],
      },
    ]);
  });

  it('opens at full height and turns the swipe that closes the app off while the player plays', async () => {
    const telegram = fakeTelegram('8.0');
    const platform = await PlaygamaPlatform.create(
      fakeBridge({}, false, 'telegram').bridge,
      FULL_EDITION,
      telegram.webApp,
    );
    expect(telegram.calls).toEqual(['expand']);
    platform.gameplayStart();
    platform.gameplayStop();
    platform.gameplayStart();
    platform.gameOver(true);
    expect(telegram.calls).toEqual([
      'expand',
      'swipes off',
      'swipes on',
      'swipes off',
      'swipes on',
    ]);
  });

  it('leaves the swipes alone on a client older than Telegram 7.7', async () => {
    const telegram = fakeTelegram('7.6');
    const platform = await PlaygamaPlatform.create(
      fakeBridge({}, false, 'telegram').bridge,
      FULL_EDITION,
      telegram.webApp,
    );
    platform.gameplayStart();
    platform.gameplayStop();
    expect(telegram.calls).toEqual(['expand']);
  });

  it('pauses the game when Telegram is minimised, saving first, and lets it go on when it is back', async () => {
    const telegram = fakeTelegram();
    const fake = fakeBridge({}, false, 'telegram');
    const platform = await PlaygamaPlatform.create(fake.bridge, FULL_EDITION, telegram.webApp);
    const pauses: boolean[] = [];
    platform.onPauseChange((paused) => pauses.push(paused));
    platform.storage.set('stackrift:settings', '{}');
    telegram.fire('deactivated');
    expect(fake.writes).toEqual([{ keys: ['stackrift_settings'], values: ['{}'] }]);
    telegram.fire('activated');
    expect(pauses).toEqual([true, false]);
  });

  it('starts without the SDK when it never finishes starting (Telegram without a user)', async () => {
    const fake = fakeBridge({}, false, 'telegram');
    fake.initialize.mockReturnValue(new Promise<void>(() => undefined));
    const starting = PlaygamaPlatform.create(fake.bridge, FULL_EDITION, null);
    await vi.advanceTimersByTimeAsync(15_000);
    const platform = await starting;
    expect(fake.get).not.toHaveBeenCalled();
    platform.ready();
    platform.storage.set('stackrift:settings', '{}');
    expect(platform.storage.get('stackrift:settings')).toBe('{}');
    expect(fake.messages).toEqual([]);
  });

  it('goes on when an old client refuses a call', async () => {
    const telegram = fakeTelegram();
    const refusing: TelegramWebApp = {
      ...telegram.webApp,
      expand: () => {
        throw new Error('WebAppMethodUnsupported');
      },
    };
    const platform = await PlaygamaPlatform.create(
      fakeBridge({}, false, 'telegram').bridge,
      FULL_EDITION,
      refusing,
    );
    expect(() => platform.gameplayStart()).not.toThrow();
  });

  it("does nothing of Telegram's on Playgama itself, even with a Telegram object in the page", async () => {
    const telegram = fakeTelegram();
    const fake = fakeBridge({ 'stackrift:settings': '{}' });
    const platform = await PlaygamaPlatform.create(fake.bridge, FULL_EDITION, telegram.webApp);
    platform.gameplayStart();
    expect(telegram.calls).toEqual([]);
    expect(fake.get).toHaveBeenCalledWith(SAVED_KEYS, false);
    expect(platform.storage.get('stackrift:settings')).toBe('{}');
  });
});

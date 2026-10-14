import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PlaygamaPlatform,
  SAVED_KEYS,
  type PlaygamaBridge,
} from '@/platform/playgama/PlaygamaPlatform';

type Listener = (value: never) => void;

/** A Bridge double: records messages and saves, fires events on demand. */
function fakeBridge(saved: Record<string, string> = {}) {
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
    },
    platform: {
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
      on: (event, listener) => listeners.set(event, listener),
      showInterstitial: (placement) => ads.push(placement ?? ''),
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

  it('runs without the SDK: no messages, a save in memory', async () => {
    const platform = await PlaygamaPlatform.create(null);
    platform.ready();
    platform.storage.set('stackrift:settings', 'x');
    expect(platform.storage.get('stackrift:settings')).toBe('x');
    expect(platform.locale).toBeNull();
    await expect(platform.midgameAd({ onStart: vi.fn(), onEnd: vi.fn() })).resolves.toBe(undefined);
  });
});

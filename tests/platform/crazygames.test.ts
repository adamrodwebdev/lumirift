import { afterEach, describe, expect, it, vi } from 'vitest';
import { CrazyGamesPlatform } from '@/platform/crazygames/CrazyGamesPlatform';
import { WebPlatform } from '@/platform/Platform';

type Callbacks = { adStarted(): void; adFinished(): void; adError(error: unknown): void };

/** A fake CrazyGames SDK (v3), recording what the game calls. */
function fakeSdk(environment: 'local' | 'crazygames' | 'disabled' = 'crazygames') {
  const calls: string[] = [];
  const store = new Map<string, string>();
  let settingsListener: ((settings: { muteAudio?: boolean }) => void) | null = null;
  let ad: Callbacks | null = null;
  const sdk = {
    environment,
    init: vi.fn(() => Promise.resolve()),
    game: {
      gameplayStart: () => calls.push('gameplayStart'),
      gameplayStop: () => calls.push('gameplayStop'),
      loadingStart: () => calls.push('loadingStart'),
      loadingStop: () => calls.push('loadingStop'),
      happytime: () => calls.push('happytime'),
      settings: { muteAudio: false },
      addSettingsChangeListener: (listener: typeof settingsListener) =>
        (settingsListener = listener),
      removeSettingsChangeListener: () => (settingsListener = null),
    },
    user: { systemInfo: { locale: 'id-ID' } },
    data: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
    },
    ad: {
      requestAd: (type: string, callbacks: Callbacks) => {
        calls.push(`ad:${type}`);
        ad = callbacks;
      },
    },
  };
  (globalThis as unknown as { window: unknown }).window = { CrazyGames: { SDK: sdk } };
  return {
    calls,
    store,
    mute: (muted: boolean) => settingsListener?.({ muteAudio: muted }),
    ad: () => ad,
  };
}

/** The browser storage the platform falls back on (none in Node: memory). */
(globalThis as unknown as { localStorage?: unknown }).localStorage = undefined;

afterEach(() => {
  delete (globalThis as unknown as { window?: unknown }).window;
});

describe('CrazyGamesPlatform', () => {
  it('reports gameplay and loading once per change, and celebrates', async () => {
    const sdk = fakeSdk();
    const platform = await CrazyGamesPlatform.create();
    platform.loadingStart();
    platform.loadingStop();
    platform.gameplayStart();
    platform.gameplayStart();
    platform.gameplayStop();
    platform.gameplayStop();
    platform.happyTime();
    expect(sdk.calls).toEqual([
      'loadingStart',
      'loadingStop',
      'gameplayStart',
      'gameplayStop',
      'happytime',
    ]);
  });

  it('takes the player language from the portal, and forbids links out', async () => {
    fakeSdk();
    const platform = await CrazyGamesPlatform.create();
    expect(platform.locale).toBe('id-ID');
    expect(platform.allowsExternalLinks).toBe(false);
  });

  it('stops the sound only while an ad really plays, and goes on after it', async () => {
    const sdk = fakeSdk();
    const platform = await CrazyGamesPlatform.create();
    const hooks = { onStart: vi.fn(), onEnd: vi.fn() };
    const done = platform.midgameAd(hooks);
    expect(sdk.calls).toContain('ad:midgame');
    expect(hooks.onStart).not.toHaveBeenCalled();
    sdk.ad()!.adStarted();
    expect(hooks.onStart).toHaveBeenCalledOnce();
    sdk.ad()!.adFinished();
    await done;
    expect(hooks.onEnd).toHaveBeenCalledOnce();
  });

  it('goes on at once when no ad comes (Basic Launch, adblock, no fill)', async () => {
    const sdk = fakeSdk();
    const platform = await CrazyGamesPlatform.create();
    const hooks = { onStart: vi.fn(), onEnd: vi.fn() };
    const done = platform.midgameAd(hooks);
    sdk.ad()!.adError('unfilled');
    await done;
    expect(hooks.onStart).not.toHaveBeenCalled();
    expect(hooks.onEnd).not.toHaveBeenCalled();
  });

  it('follows the portal mute button', async () => {
    const sdk = fakeSdk();
    const platform = await CrazyGamesPlatform.create();
    const listener = vi.fn();
    const off = platform.onMuteChange(listener);
    sdk.mute(true);
    expect(listener).toHaveBeenCalledWith(true);
    off();
    sdk.mute(false);
    expect(listener).toHaveBeenCalledOnce();
  });

  it('saves in the Data module', async () => {
    const sdk = fakeSdk();
    const platform = await CrazyGamesPlatform.create();
    platform.storage!.set('stackrift:records', '{"classic":10}');
    expect(sdk.store.get('stackrift:records')).toBe('{"classic":10}');
    expect(platform.storage!.get('stackrift:records')).toBe('{"classic":10}');
  });

  it('does nothing off the portal (SDK disabled or missing)', async () => {
    const sdk = fakeSdk('disabled');
    const platform = await CrazyGamesPlatform.create();
    platform.gameplayStart();
    await platform.midgameAd({ onStart: vi.fn(), onEnd: vi.fn() });
    expect(sdk.calls).toEqual([]);
    expect(platform.storage).toBeNull();
    delete (globalThis as unknown as { window?: unknown }).window;
    (globalThis as unknown as { window: unknown }).window = {};
    expect((await CrazyGamesPlatform.create()).locale).toBeNull();
  });
});

describe('WebPlatform', () => {
  it('has no portal: links allowed, no ad, nothing reported', async () => {
    const platform = new WebPlatform();
    expect(platform.allowsExternalLinks).toBe(true);
    const hooks = { onStart: vi.fn(), onEnd: vi.fn() };
    await platform.midgameAd();
    expect(hooks.onStart).not.toHaveBeenCalled();
  });
});

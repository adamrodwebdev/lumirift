import type { KeyValueStorage } from '@/services/KeyValueStorage';
import { FULL_EDITION } from '../Edition';
import type { AdHooks, Platform } from '../Platform';
import { SAVED_KEYS } from '../savedKeys';

/** What Yandex calls back around an ad. */
export interface YandexAdCallbacks {
  onOpen?: () => void;
  onClose?: (wasShown: boolean) => void;
  onError?: (error: unknown) => void;
  onRewarded?: () => void;
}

/** The player's data on Yandex's servers, kept whether or not the player is logged in. */
export interface YandexPlayer {
  getData(): Promise<Readonly<Record<string, unknown>>>;
  /** Replaces the whole object; `flush` sends it at once instead of queuing it. */
  setData(data: Readonly<Record<string, string>>, flush: boolean): Promise<void>;
}

/** The part of the Yandex Games SDK (v2) the game uses. */
export interface YandexSdk {
  readonly features: {
    readonly LoadingAPI?: { ready(): void };
    readonly GameplayAPI?: { start(): void; stop(): void };
  };
  readonly environment: { readonly i18n: { readonly lang: string } };
  readonly adv: {
    showFullscreenAdv(options: { callbacks: YandexAdCallbacks }): void;
    showRewardedVideo(options: { callbacks: YandexAdCallbacks }): void;
  };
  /** `scopes: false`: never the old permission window for the name and photo. */
  getPlayer(options: { scopes: boolean }): Promise<YandexPlayer>;
  /** Yandex pauses the game for its ads, its purchase window, another tab or a minimized window. */
  on(event: 'game_api_pause' | 'game_api_resume', listener: () => void): unknown;
}

declare global {
  interface Window {
    YaGames?: { init(): Promise<YandexSdk> };
  }
}

/**
 * Yandex allows 100 player-data requests in 5 minutes, reads included: the
 * saves of one moment leave together, then at most one request every 4 s
 * (75 in 5 minutes), the latest value always kept.
 */
export const SAVE_INTERVAL_MS = 4000;
/** The writes of one moment (a slider, the end of a game) leave in one request. */
const SAVE_GATHER_MS = 300;
/** An ad that has not opened by then will not: the game goes on (no ad-block signal on Yandex). */
export const AD_OPEN_TIMEOUT_MS = 12_000;
/** The longest an open ad may keep the game waiting. */
export const AD_MAX_MS = 120_000;

/**
 * The player's data on Yandex's servers as the game's storage: read once at
 * start (one request), kept in memory, and written whole, since Yandex replaces
 * the object, without ever going over its rate limit (rules 1.9 and 1.14).
 */
export class PlayerDataStorage implements KeyValueStorage {
  private dirty = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private lastSent = Number.NEGATIVE_INFINITY;
  /** A failed write is tried once more, never in a loop (Yandex counts every request). */
  private retrying = false;

  private constructor(
    private readonly player: YandexPlayer,
    private readonly values: Map<string, string>,
    private readonly now: () => number,
  ) {}

  /** Every saved key in one read; null when Yandex keeps no data for this player. */
  static async load(
    sdk: YandexSdk,
    now: () => number = () => performance.now(),
  ): Promise<PlayerDataStorage | null> {
    try {
      const player = await sdk.getPlayer({ scopes: false });
      const data = await player.getData();
      const values = new Map<string, string>();
      for (const key of SAVED_KEYS) {
        const value = data[key];
        if (typeof value === 'string') values.set(key, value);
      }
      return new PlayerDataStorage(player, values, now);
    } catch {
      return null;
    }
  }

  get(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  set(key: string, value: string): void {
    this.values.set(key, value);
    this.dirty = true;
    this.schedule(SAVE_GATHER_MS);
  }

  /** Sends what waits at once: the page is being hidden and may never come back. */
  flush(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
    this.send();
  }

  private schedule(delay: number): void {
    if (this.timer !== undefined) return;
    const wait = Math.max(delay, this.lastSent + SAVE_INTERVAL_MS - this.now());
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.send();
    }, wait);
  }

  private send(): void {
    if (!this.dirty) return;
    this.dirty = false;
    this.lastSent = this.now();
    const data = Object.fromEntries(this.values);
    this.player.setData(data, true).then(
      () => (this.retrying = false),
      () => {
        if (this.retrying) return;
        this.retrying = true;
        this.dirty = true;
        this.schedule(SAVE_INTERVAL_MS);
      },
    );
  }
}

/**
 * The game on Yandex Games (SDK v2, version 1.30): the SDK loaded from the
 * relative `/sdk.js` and initialized before any call, the ready signal and the
 * gameplay marks, the player's language, saves in the player's data, the
 * platform's pauses, and its fullscreen and rewarded ads (rules 1.3, 1.9,
 * 1.19, 2.14, 4.4, 4.5, 4.7 of `references/yandex-games.md`). Off Yandex (no
 * `YaGames`), every call is a no-op and the save stays in the browser.
 */
export class YandexPlatform implements Platform {
  readonly id = 'yandex';
  readonly edition = FULL_EDITION;
  /** A new player plays the training before any menu (the user's rule for portals). */
  readonly firstRun = 'training';
  // Rule 8.4.2: no link out of Yandex Games.
  readonly allowsExternalLinks = false;
  readonly reservesEscape = true;
  // The game stays on its pause window after a lost focus: Yandex must hear it stopped.
  readonly stopsOnAutoPause = true;
  // Rule 1.14: a build version is developer information.
  readonly showsVersion = false;
  // Yandex has no mute button of its own: the game's sound setting decides.
  readonly muted = false;
  readonly locale: string | null;
  private readonly pauseListeners = new Set<(paused: boolean) => void>();
  private isReady = false;
  /** The game says the player plays. */
  private playing = false;
  /** What Yandex was told last. */
  private told = false;
  /** An ad failed or never opened: no ad-block signal on Yandex, so no reward is offered again. */
  private rewardedBroken = false;

  private constructor(
    private readonly sdk: YandexSdk | null,
    readonly storage: PlayerDataStorage | null,
  ) {
    this.locale = sdk?.environment.i18n.lang || null;
    if (!sdk) return;
    const tell = (paused: boolean) => {
      if (paused) storage?.flush();
      this.pauseListeners.forEach((listener) => listener(paused));
    };
    sdk.on('game_api_pause', () => tell(true));
    sdk.on('game_api_resume', () => tell(false));
    if (typeof document === 'undefined') return;
    // No browser menu anywhere in the frame: moderators right-click and long-press everywhere (1.6.1.8, 1.6.2.7).
    document.addEventListener('contextmenu', (event) => event.preventDefault());
    // A hidden or closing page: what waits leaves now, the player may never come back.
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) storage?.flush();
    });
    window.addEventListener('pagehide', () => storage?.flush());
  }

  /**
   * `/sdk.js` is loaded by the page itself (rule 1.19.1); `YaGames.init()`
   * comes before anything else. `now` paces the saves (tests pass their own).
   */
  static async create(
    yaGames: Window['YaGames'] = typeof window === 'undefined' ? undefined : window.YaGames,
    now: () => number = () => performance.now(),
  ): Promise<YandexPlatform> {
    if (!yaGames) return new YandexPlatform(null, null);
    try {
      const sdk = await yaGames.init();
      return new YandexPlatform(sdk, await PlayerDataStorage.load(sdk, now));
    } catch {
      return new YandexPlatform(null, null);
    }
  }

  onMuteChange(): () => void {
    return () => undefined;
  }

  onPauseChange(listener: (paused: boolean) => void): () => void {
    this.pauseListeners.add(listener);
    return () => this.pauseListeners.delete(listener);
  }

  /** Once, when the player can interact (rule 1.19.2); the gameplay marks follow it. */
  ready(): void {
    if (this.isReady) return;
    this.isReady = true;
    this.call((sdk) => sdk.features.LoadingAPI?.ready());
    this.tellGameplay();
  }

  // Modes load in a fraction of a second: Yandex has no loading marks to send.
  loadingStart(): void {}
  loadingStop(): void {}

  gameplayStart(): void {
    this.playing = true;
    this.tellGameplay();
  }

  gameplayStop(): void {
    this.playing = false;
    this.tellGameplay();
  }

  gameOver(): void {
    this.gameplayStop();
  }

  happyTime(): void {}

  /**
   * A fullscreen ad at a break, right after the player's button (rule 4.4:
   * never inside a level). Yandex spaces them itself: one asked too soon
   * closes at once, unshown, and the game goes on.
   */
  midgameAd(hooks: AdHooks): Promise<void> {
    const sdk = this.sdk;
    if (!sdk) return Promise.resolve();
    return this.show(hooks, (callbacks) => sdk.adv.showFullscreenAdv({ callbacks })).then(
      () => undefined,
    );
  }

  get supportsRewarded(): boolean {
    return this.sdk !== null && !this.rewardedBroken;
  }

  /** The reward is due only on `onRewarded` (rule 4.5): closing early or an error gives nothing. */
  rewardedAd(hooks: AdHooks): Promise<boolean> {
    const sdk = this.sdk;
    if (!sdk || this.rewardedBroken) return Promise.resolve(false);
    return this.show(
      hooks,
      (callbacks) => sdk.adv.showRewardedVideo({ callbacks }),
      () => (this.rewardedBroken = true),
    );
  }

  /** Yandex hears the gameplay once ready, and only when it changes (rule 1.19.3). */
  private tellGameplay(): void {
    if (!this.isReady || this.playing === this.told) return;
    this.told = this.playing;
    const playing = this.playing;
    this.call((sdk) =>
      playing ? sdk.features.GameplayAPI?.start() : sdk.features.GameplayAPI?.stop(),
    );
  }

  /**
   * One ad: the sound stops only once it opens; an ad that never opens, or
   * stays open too long, lets the game go on. Resolves true once rewarded.
   */
  private show(
    hooks: AdHooks,
    open: (callbacks: YandexAdCallbacks) => void,
    onFailure?: () => void,
  ): Promise<boolean> {
    return new Promise((resolve) => {
      let opened = false;
      let rewarded = false;
      let settled = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const finish = (failed: boolean) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (opened) hooks.onEnd();
        if (failed) onFailure?.();
        resolve(rewarded);
      };
      timer = setTimeout(() => finish(true), AD_OPEN_TIMEOUT_MS);
      try {
        open({
          onOpen: () => {
            if (settled || opened) return;
            opened = true;
            hooks.onStart();
            clearTimeout(timer);
            timer = setTimeout(() => finish(false), AD_MAX_MS);
          },
          onRewarded: () => (rewarded = true),
          onClose: () => finish(false),
          onError: () => finish(true),
        });
      } catch {
        finish(true);
      }
    });
  }

  private call(action: (sdk: YandexSdk) => void): void {
    if (!this.sdk) return;
    try {
      action(this.sdk);
    } catch {
      // A call Yandex refuses is not an error for the game.
    }
  }
}

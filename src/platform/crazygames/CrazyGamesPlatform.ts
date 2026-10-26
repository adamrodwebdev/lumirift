import { BrowserStorage, type KeyValueStorage } from '@/services/KeyValueStorage';
import { FULL_EDITION } from '../Edition';
import type { AdHooks, Platform } from '../Platform';
import { SAVED_KEYS } from '../savedKeys';

/** The part of the CrazyGames HTML5 SDK (v3) the game uses. */
interface CrazyGamesSdk {
  init(): Promise<void>;
  readonly environment: 'local' | 'crazygames' | 'disabled';
  readonly game: {
    gameplayStart(): void;
    gameplayStop(): void;
    loadingStart(): void;
    loadingStop(): void;
    happytime(): void;
    readonly settings: { readonly muteAudio?: boolean };
    addSettingsChangeListener(listener: (settings: { readonly muteAudio?: boolean }) => void): void;
    removeSettingsChangeListener(
      listener: (settings: { readonly muteAudio?: boolean }) => void,
    ): void;
  };
  readonly user: { readonly systemInfo?: { readonly locale?: string } };
  readonly data: {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
  };
  readonly ad: {
    requestAd(
      type: 'midgame' | 'rewarded',
      callbacks: { adStarted(): void; adFinished(): void; adError(error: unknown): void },
    ): void;
  };
}

declare global {
  interface Window {
    CrazyGames?: { readonly SDK: CrazyGamesSdk };
  }
}

/**
 * The CrazyGames Data module as the game's storage: progress follows the
 * player across devices. A save from before (browser storage) is copied in
 * once; when the module is off, the browser's storage is used instead.
 */
class CrazyGamesStorage implements KeyValueStorage {
  private readonly fallback = BrowserStorage.local();

  constructor(private readonly data: CrazyGamesSdk['data']) {
    for (const key of SAVED_KEYS) {
      const local = this.fallback.get(key);
      if (local !== null && this.read(key) === null) this.set(key, local);
    }
  }

  get(key: string): string | null {
    return this.read(key) ?? this.fallback.get(key);
  }

  set(key: string, value: string): void {
    this.fallback.set(key, value);
    try {
      this.data.setItem(key, value);
    } catch {
      // Module off or over its limit: the browser keeps the save.
    }
  }

  private read(key: string): string | null {
    try {
      return this.data.getItem(key);
    } catch {
      return null;
    }
  }
}

/**
 * The game on CrazyGames: gameplay and loading events, the portal's mute
 * button, its language, its cross-device save and its ads, through the
 * official SDK (loaded by the CrazyGames build only). Off the portal (the
 * SDK says `disabled`), every call is a no-op.
 */
export class CrazyGamesPlatform implements Platform {
  readonly id = 'crazygames';
  readonly edition = FULL_EDITION;
  /** A new player plays the training before any menu (the user's rule for portals). */
  readonly firstRun = 'training';
  readonly allowsExternalLinks = false;
  readonly reservesEscape = true;
  /** CrazyGames tracks the focus itself, and forbids a gameplayStop for a lost focus. */
  readonly stopsOnAutoPause = false;
  readonly showsVersion = true;
  readonly russianForNeighbours = false;
  readonly locale: string | null;
  readonly storage: KeyValueStorage | null;
  private playing = false;

  private constructor(private readonly sdk: CrazyGamesSdk | null) {
    this.locale = sdk?.user.systemInfo?.locale ?? null;
    this.storage = sdk ? new CrazyGamesStorage(sdk.data) : null;
  }

  static async create(): Promise<CrazyGamesPlatform> {
    const sdk = window.CrazyGames?.SDK ?? null;
    if (!sdk) return new CrazyGamesPlatform(null);
    try {
      await sdk.init();
    } catch {
      return new CrazyGamesPlatform(null);
    }
    return new CrazyGamesPlatform(sdk.environment === 'disabled' ? null : sdk);
  }

  get muted(): boolean {
    return this.sdk?.game.settings.muteAudio === true;
  }

  onMuteChange(listener: (muted: boolean) => void): () => void {
    const game = this.sdk?.game;
    if (!game) return () => undefined;
    const onChange = (settings: { readonly muteAudio?: boolean }) =>
      listener(settings.muteAudio === true);
    game.addSettingsChangeListener(onChange);
    return () => game.removeSettingsChangeListener(onChange);
  }

  /** CrazyGames pauses through its own ad callbacks (see midgameAd). */
  onPauseChange(): () => void {
    return () => undefined;
  }

  ready(): void {}

  loadingStart(): void {
    this.sdk?.game.loadingStart();
  }

  loadingStop(): void {
    this.sdk?.game.loadingStop();
  }

  gameplayStart(): void {
    if (this.playing) return;
    this.playing = true;
    this.sdk?.game.gameplayStart();
  }

  gameplayStop(): void {
    if (!this.playing) return;
    this.playing = false;
    this.sdk?.game.gameplayStop();
  }

  gameOver(): void {
    this.gameplayStop();
  }

  happyTime(): void {
    this.sdk?.game.happytime();
  }

  /**
   * A midgame ad between two games, when the ad policy allows it (never on
   * the way to a menu here: the portal forbids ads on navigation buttons).
   * The sound stops only when the ad really starts; an unfilled ad (or ads
   * off, as in Basic Launch) lets the game go on at once. The SDK itself
   * spaces ads (3 minutes at least).
   */
  midgameAd(hooks: AdHooks): Promise<void> {
    return this.requestAd('midgame', hooks).then(() => undefined);
  }

  /**
   * No rewarded ad on CrazyGames: ads are off during the Basic Launch (the
   * button would do nothing), and at Full Launch the reward must also be
   * earnable without an ad.
   */
  readonly supportsRewarded = false;

  /** Rewarded only on `adFinished`: an error or an unfilled ad gives nothing. */
  rewardedAd(hooks: AdHooks): Promise<boolean> {
    return this.requestAd('rewarded', hooks);
  }

  /** Resolves true when the ad played to its end. */
  private requestAd(type: 'midgame' | 'rewarded', hooks: AdHooks): Promise<boolean> {
    const sdk = this.sdk;
    if (!sdk) return Promise.resolve(false);
    return new Promise((resolve) => {
      let started = false;
      const done = (watched: boolean) => {
        if (started) hooks.onEnd();
        resolve(watched);
      };
      try {
        sdk.ad.requestAd(type, {
          adStarted: () => {
            started = true;
            hooks.onStart();
          },
          adFinished: () => done(true),
          adError: () => done(false),
        });
      } catch {
        resolve(false);
      }
    });
  }
}

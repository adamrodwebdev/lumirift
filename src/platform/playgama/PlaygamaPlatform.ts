import type { KeyValueStorage } from '@/services/KeyValueStorage';
import { FULL_EDITION } from '../Edition';
import type { AdHooks, Platform } from '../Platform';
import { SAVED_KEYS } from '../savedKeys';

type InterstitialState = 'loading' | 'opened' | 'closed' | 'failed';
type RewardedState = InterstitialState | 'rewarded';

/** The part of the Playgama Bridge SDK (v2) the game uses. */
export interface PlaygamaBridge {
  initialize(): Promise<void>;
  readonly EVENT_NAME: {
    readonly AUDIO_STATE_CHANGED: string;
    readonly PAUSE_STATE_CHANGED: string;
    readonly INTERSTITIAL_STATE_CHANGED: string;
    readonly REWARDED_STATE_CHANGED: string;
  };
  readonly platform: {
    readonly language: string;
    readonly isAudioEnabled: boolean;
    sendMessage(message: string): void;
    on(event: string, listener: (value: boolean) => void): void;
  };
  readonly storage: {
    get(keys: readonly string[], tryParseJson: boolean): Promise<readonly unknown[]>;
    set(keys: readonly string[], values: readonly string[]): Promise<void>;
  };
  readonly advertisement: {
    readonly isInterstitialSupported: boolean;
    readonly isRewardedSupported: boolean;
    on(event: string, listener: (state: RewardedState) => void): void;
    showInterstitial(placement?: string): void;
    showRewarded(placement?: string): void;
    /** An ad blocker stops the portal's ads: Bridge would wait on them forever (absent before 2.x). */
    checkAdBlock?(): Promise<boolean>;
  };
}

declare global {
  interface Window {
    bridge?: PlaygamaBridge;
  }
}

/** Writes are grouped: one SDK call for a burst of changes (a slider, a game end). */
const SAVE_DELAY_MS = 300;
/** An ad that never even starts loading was refused (too early, too soon after the last). */
const AD_START_TIMEOUT_MS = 1500;
/** An ad that loads but never opens: the game goes on. */
const AD_LOAD_TIMEOUT_MS = 8000;
/** The one rewarded ad: double the experience of the game just played. */
export const REWARDED_PLACEMENT = 'double_xp';

/**
 * The Bridge storage as the game's storage. Playgama asks for one read of
 * every key at start and saves through the SDK only (never the browser's
 * storage): the save follows the player, in the cloud when available. Reads
 * come from memory, writes are grouped and sent in one call.
 */
export class BridgeStorage implements KeyValueStorage {
  private readonly pending = new Map<string, string>();
  private timer: ReturnType<typeof setTimeout> | undefined;

  private constructor(
    private readonly bridge: PlaygamaBridge | null,
    private readonly values: Map<string, string>,
  ) {}

  /** Reads every saved key at once (an empty save when the SDK refuses). */
  static async load(bridge: PlaygamaBridge | null): Promise<BridgeStorage> {
    const values = new Map<string, string>();
    if (bridge) {
      try {
        const saved = await bridge.storage.get(SAVED_KEYS, false);
        SAVED_KEYS.forEach((key, index) => {
          const value = saved[index];
          if (typeof value === 'string') values.set(key, value);
        });
      } catch {
        // No save yet, or the platform keeps none: the game starts fresh.
      }
    }
    return new BridgeStorage(bridge, values);
  }

  get(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  set(key: string, value: string): void {
    this.values.set(key, value);
    this.pending.set(key, value);
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), SAVE_DELAY_MS);
  }

  /** Sends what is waiting (also when the page is hidden: it may never come back). */
  flush(): void {
    clearTimeout(this.timer);
    if (!this.bridge || this.pending.size === 0) return;
    const keys = [...this.pending.keys()];
    const values = [...this.pending.values()];
    this.pending.clear();
    this.bridge.storage.set(keys, values).catch(() => {
      // Kept in memory for this session; the next save tries again.
      keys.forEach((key, index) => {
        if (!this.pending.has(key)) this.pending.set(key, values[index] ?? '');
      });
    });
  }
}

/**
 * The game on Playgama (and the partners it distributes to): language, sound
 * and pause from the platform, the save through the Bridge, `game_ready` and
 * level messages, interstitials between games. The SDK is loaded by the
 * Playgama build only; when it is missing or fails, every call is a no-op and
 * the save lives in memory.
 */
export class PlaygamaPlatform implements Platform {
  readonly id = 'playgama';
  readonly edition = FULL_EDITION;
  /** A new player plays the training before any menu (the user's rule for portals). */
  readonly firstRun = 'training';
  // Playgama forbids links to other sites (and returns false for them).
  readonly allowsExternalLinks = false;
  readonly reservesEscape = true;
  readonly stopsOnAutoPause = false;
  readonly showsVersion = true;
  // Playgama's checklist: English is the fallback of every language the game lacks.
  readonly russianForNeighbours = false;
  readonly locale: string | null;
  private audioEnabled: boolean;
  private readonly muteListeners = new Set<(muted: boolean) => void>();
  private readonly pauseListeners = new Set<(paused: boolean) => void>();
  private adListener: ((state: InterstitialState) => void) | null = null;
  private rewardedListener: ((state: RewardedState) => void) | null = null;
  private level: 'none' | 'playing' | 'paused' = 'none';
  private isReady = false;
  /**
   * The player's browser blocks the portal's ads: no ad is ever asked for,
   * no ad button offered (with a blocker, Bridge stays `loading` for good).
   */
  private adsBlocked = false;
  /** Level messages said before `game_ready` (a first run plays at once): sent right after it. */
  private readonly early: string[] = [];

  private constructor(
    private readonly bridge: PlaygamaBridge | null,
    readonly storage: BridgeStorage,
  ) {
    this.locale = bridge?.platform.language || null;
    this.audioEnabled = bridge?.platform.isAudioEnabled ?? true;
    if (!bridge) return;
    // The SDK has no documented way to unsubscribe: one listener each, fanned out.
    const { EVENT_NAME } = bridge;
    bridge.platform.on(EVENT_NAME.AUDIO_STATE_CHANGED, (enabled) => {
      this.audioEnabled = enabled;
      this.muteListeners.forEach((listener) => listener(!enabled));
    });
    bridge.platform.on(EVENT_NAME.PAUSE_STATE_CHANGED, (paused) => {
      if (paused) storage.flush();
      this.pauseListeners.forEach((listener) => listener(paused));
    });
    bridge.advertisement.on(EVENT_NAME.INTERSTITIAL_STATE_CHANGED, (state) => {
      if (state !== 'rewarded') this.adListener?.(state);
    });
    bridge.advertisement.on(EVENT_NAME.REWARDED_STATE_CHANGED, (state) =>
      this.rewardedListener?.(state),
    );
    // Asked once, the answer stable for the visit: ads come minutes later, never at start.
    bridge.advertisement
      .checkAdBlock?.()
      .then((blocked) => (this.adsBlocked = blocked))
      .catch(() => undefined);
    // Hidden page: the save leaves now, the player may never come back.
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) storage.flush();
      });
    }
  }

  static async create(
    bridge: PlaygamaBridge | null = typeof window === 'undefined' ? null : (window.bridge ?? null),
  ): Promise<PlaygamaPlatform> {
    let sdk = bridge;
    if (sdk) {
      try {
        await sdk.initialize();
      } catch {
        sdk = null;
      }
    }
    return new PlaygamaPlatform(sdk, await BridgeStorage.load(sdk));
  }

  get muted(): boolean {
    return !this.audioEnabled;
  }

  onMuteChange(listener: (muted: boolean) => void): () => void {
    this.muteListeners.add(listener);
    return () => this.muteListeners.delete(listener);
  }

  onPauseChange(listener: (paused: boolean) => void): () => void {
    this.pauseListeners.add(listener);
    return () => this.pauseListeners.delete(listener);
  }

  /** Sent once, when the first screen is interactive (never during loading). */
  ready(): void {
    if (this.isReady) return;
    this.isReady = true;
    this.send('game_ready');
    this.early.splice(0).forEach((message) => this.send(message));
  }

  // Modes load in a fraction of a second: no in-game loading message.
  loadingStart(): void {}
  loadingStop(): void {}

  gameplayStart(): void {
    if (this.level === 'playing') return;
    this.tell(this.level === 'paused' ? 'level_resumed' : 'level_started');
    this.level = 'playing';
  }

  gameplayStop(): void {
    if (this.level !== 'playing') return;
    this.level = 'paused';
    this.tell('level_paused');
  }

  gameOver(won: boolean): void {
    if (this.level === 'none') return;
    this.level = 'none';
    this.tell(won ? 'level_completed' : 'level_failed');
  }

  happyTime(): void {}

  /**
   * An interstitial between two games. Bridge spaces them (60 s by default)
   * and refuses the first ones after launch: a refused or failed ad lets the
   * game go on at once. Gameplay is already stopped (game-over screen); the
   * platform's pause and sound events cover the ad itself too.
   */
  /** An interstitial at every break, towards a game or a menu: Playgama allows both. */
  midgameAd(hooks: AdHooks): Promise<void> {
    const bridge = this.bridge;
    if (!bridge?.advertisement.isInterstitialSupported || this.adsBlocked) return Promise.resolve();
    return new Promise((resolve) => {
      let opened = false;
      let timer = setTimeout(() => done(), AD_START_TIMEOUT_MS);
      const done = () => {
        clearTimeout(timer);
        this.adListener = null;
        if (opened) hooks.onEnd();
        resolve();
      };
      this.adListener = (state) => {
        if (state === 'loading') {
          clearTimeout(timer);
          timer = setTimeout(() => done(), AD_LOAD_TIMEOUT_MS);
        } else if (state === 'opened') {
          clearTimeout(timer);
          opened = true;
          hooks.onStart();
        } else {
          done();
        }
      };
      try {
        bridge.advertisement.showInterstitial('game_over');
      } catch {
        done();
      }
    });
  }

  /** A rewarded ad can play: supported, and not stopped by an ad blocker. */
  get supportsRewarded(): boolean {
    return this.bridge?.advertisement.isRewardedSupported === true && !this.adsBlocked;
  }

  /**
   * A rewarded ad the player asked for. The reward is due only on the
   * `rewarded` state (never on `closed`: closing early gives nothing); the
   * promise settles when the ad is closed or failed.
   */
  rewardedAd(hooks: AdHooks): Promise<boolean> {
    const bridge = this.bridge;
    if (!this.supportsRewarded || !bridge) return Promise.resolve(false);
    return new Promise((resolve) => {
      let opened = false;
      let rewarded = false;
      let timer = setTimeout(() => done(), AD_START_TIMEOUT_MS);
      const done = () => {
        clearTimeout(timer);
        this.rewardedListener = null;
        if (opened) hooks.onEnd();
        resolve(rewarded);
      };
      this.rewardedListener = (state) => {
        if (state === 'loading') {
          clearTimeout(timer);
          timer = setTimeout(() => done(), AD_LOAD_TIMEOUT_MS);
        } else if (state === 'opened') {
          clearTimeout(timer);
          opened = true;
          hooks.onStart();
        } else if (state === 'rewarded') {
          rewarded = true;
        } else {
          done();
        }
      };
      try {
        bridge.advertisement.showRewarded(REWARDED_PLACEMENT);
      } catch {
        done();
      }
    });
  }

  /** A level message: never before `game_ready`. */
  private tell(message: string): void {
    if (this.isReady) this.send(message);
    else this.early.push(message);
  }

  private send(message: string): void {
    try {
      this.bridge?.platform.sendMessage(message);
    } catch {
      // A message the platform does not relay is not an error for the game.
    }
  }
}

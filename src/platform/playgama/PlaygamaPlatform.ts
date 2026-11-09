import { orElse, readBoolean, readChoice } from '@/core/input';
import { readLanguageTag } from '@/i18n/locales';
import type { KeyValueStorage } from '@/services/KeyValueStorage';
import { FULL_EDITION, type Edition } from '../Edition';
import type { AdHooks, Platform } from '../Platform';
import { SAVED_KEYS } from '../savedKeys';
import { PlainSaves, TelegramCloudSaves, type SaveLayout } from './SaveLayout';
import { TelegramShell, type TelegramWebApp } from './TelegramShell';

type InterstitialState = 'loading' | 'opened' | 'closed' | 'failed';
type RewardedState = InterstitialState | 'rewarded';

const AD_STATES: readonly RewardedState[] = ['loading', 'opened', 'closed', 'failed', 'rewarded'];

/** An ad's state as the Bridge tells it: a word the game does not know ends the wait, as a failure. */
const adState = (value: unknown): RewardedState =>
  orElse(() => readChoice(value, AD_STATES, 'adState'), 'failed');

/** A yes or no the Bridge tells, or null when it is neither. */
const flag = (value: unknown, field: string): boolean | null =>
  orElse(() => readBoolean(value, field), null);

/**
 * The part of the Playgama Bridge SDK (v2) the game uses. What it tells is
 * typed `unknown`: read at the door (a language tag, a boolean, an ad state).
 */
export interface PlaygamaBridge {
  initialize(): Promise<void>;
  readonly EVENT_NAME: {
    readonly AUDIO_STATE_CHANGED: string;
    readonly PAUSE_STATE_CHANGED: string;
    readonly INTERSTITIAL_STATE_CHANGED: string;
    readonly REWARDED_STATE_CHANGED: string;
  };
  readonly platform: {
    /** Where the game runs (`playgama`, `telegram`…): Playgama distributes to its partners (1.46.5). */
    readonly id?: unknown;
    readonly language: unknown;
    readonly isAudioEnabled: unknown;
    sendMessage(message: string): void;
    on(event: string, listener: (value: unknown) => void): void;
  };
  readonly storage: {
    get(keys: readonly string[], tryParseJson: boolean): Promise<readonly unknown[]>;
    set(keys: readonly string[], values: readonly string[]): Promise<void>;
  };
  readonly advertisement: {
    readonly isInterstitialSupported: unknown;
    readonly isRewardedSupported: unknown;
    on(event: string, listener: (state: unknown) => void): void;
    showInterstitial(placement?: string): void;
    showRewarded(placement?: string): void;
    /** An ad blocker stops the portal's ads: Bridge would wait on them forever (absent before 2.x). */
    checkAdBlock?(): Promise<unknown>;
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
/**
 * A Bridge still starting after this long never will (1.46.5): in Telegram, a
 * launch without a user (a keyboard button, inline mode) leaves the SDK waiting
 * for good. The game then starts without it rather than stay on its loading.
 */
const INIT_TIMEOUT_MS = 15_000;

/** The promise, or a rejection once `ms` have passed without it. */
function within<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Not settled within ${ms} ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}
/** The one rewarded ad: double the experience of the game just played. */
export const REWARDED_PLACEMENT = 'double_xp';

/**
 * The Bridge storage as the game's storage. Playgama asks for one read of
 * every key at start and saves through the SDK only (never the browser's
 * storage): the save follows the player, in the cloud when available. Reads
 * come from memory, writes are grouped and sent in one call. A layout says
 * how the values sit in the storage (Telegram's cloud takes neither ":" in a
 * key nor a value over 4,096 characters, 1.46.5).
 */
export class BridgeStorage implements KeyValueStorage {
  private readonly pending = new Map<string, string>();
  private timer: ReturnType<typeof setTimeout> | undefined;

  private constructor(
    private readonly bridge: PlaygamaBridge | null,
    private readonly values: Map<string, string>,
    private readonly layout: SaveLayout,
  ) {}

  /**
   * Reads every saved key at once, then the parts a long value announced, in
   * a second call (an empty save when the SDK refuses). A value whose parts
   * are missing stays as its head: a value the game cannot read, which it
   * keeps rather than start that save over (see SaveSlot).
   */
  static async load(
    bridge: PlaygamaBridge | null,
    layout: SaveLayout = new PlainSaves(),
  ): Promise<BridgeStorage> {
    const values = new Map<string, string>();
    if (bridge) {
      try {
        const saved = await bridge.storage.get(
          SAVED_KEYS.map((key) => layout.storedKey(key)),
          false,
        );
        const heads = new Map<string, string>();
        SAVED_KEYS.forEach((key, index) => {
          const value = saved[index];
          if (typeof value === 'string') heads.set(key, value);
        });
        const partKeys = [...heads].flatMap(([key, head]) => layout.partKeys(key, head));
        const partValues = partKeys.length ? await bridge.storage.get(partKeys, false) : [];
        const parts = new Map(partKeys.map((key, index) => [key, partValues[index]]));
        heads.forEach((head, key) => {
          const pieces = layout.partKeys(key, head).map((part) => parts.get(part));
          if (pieces.every((piece) => typeof piece === 'string')) {
            values.set(key, layout.decode(head, pieces));
          } else {
            values.set(key, head);
          }
        });
      } catch {
        // No save yet, or the platform keeps none: the game starts fresh.
      }
    }
    return new BridgeStorage(bridge, values, layout);
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
    const stored = keys.map((key, index) => this.layout.encode(key, values[index] ?? ''));
    const storedKeys = stored.flatMap((entry) => entry.keys);
    const storedValues = stored.flatMap((entry) => entry.values);
    this.bridge.storage.set(storedKeys, storedValues).catch(() => {
      // Kept in memory for this session; the next save tries again.
      keys.forEach((key, index) => {
        if (!this.pending.has(key)) this.pending.set(key, values[index] ?? '');
      });
    });
  }
}

/** What the Playgama platform is made of, once the SDK is up. */
interface PlaygamaParts {
  readonly bridge: PlaygamaBridge | null;
  readonly storage: BridgeStorage;
  /** The whole game, or one mode alone (a sandbox test build, 1.37). */
  readonly edition: Edition;
  /** Telegram's Mini App object when the game runs in Telegram (1.46.5), else null. */
  readonly telegram: TelegramWebApp | null;
}

/**
 * The game on Playgama (and the partners it distributes to): language, sound
 * and pause from the platform, the save through the Bridge, `game_ready` and
 * level messages, interstitials between games. The SDK is loaded by the
 * Playgama build only; when it is missing or fails, every call is a no-op and
 * the save lives in memory. In Telegram (a partner's copy, 1.46.5), the save
 * fits Telegram's cloud and the game behaves as Telegram asks (TelegramShell).
 */
export class PlaygamaPlatform implements Platform {
  readonly id = 'playgama';
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
  private readonly bridge: PlaygamaBridge | null;
  readonly storage: BridgeStorage;
  readonly edition: Edition;
  /** Telegram's asks (full height, no swipe-close while playing, pause when minimised), in Telegram only. */
  private readonly shell: TelegramShell | null;

  private constructor({ bridge, storage, edition, telegram }: PlaygamaParts) {
    this.bridge = bridge;
    this.storage = storage;
    this.edition = edition;
    this.locale = readLanguageTag(bridge?.platform.language);
    this.audioEnabled = flag(bridge?.platform.isAudioEnabled, 'isAudioEnabled') ?? true;
    this.shell = telegram ? new TelegramShell(telegram, (paused) => this.autoPause(paused)) : null;
    this.shell?.start();
    if (!bridge) return;
    // The SDK has no documented way to unsubscribe: one listener each, fanned out. An event
    // whose value is not a boolean changes nothing.
    const { EVENT_NAME } = bridge;
    bridge.platform.on(EVENT_NAME.AUDIO_STATE_CHANGED, (value) => {
      const enabled = flag(value, 'audioState');
      if (enabled === null) return;
      this.audioEnabled = enabled;
      this.muteListeners.forEach((listener) => listener(!enabled));
    });
    bridge.platform.on(EVENT_NAME.PAUSE_STATE_CHANGED, (value) => {
      const paused = flag(value, 'pauseState');
      if (paused !== null) this.autoPause(paused);
    });
    bridge.advertisement.on(EVENT_NAME.INTERSTITIAL_STATE_CHANGED, (value) => {
      const state = adState(value);
      if (state !== 'rewarded') this.adListener?.(state);
    });
    bridge.advertisement.on(EVENT_NAME.REWARDED_STATE_CHANGED, (value) =>
      this.rewardedListener?.(adState(value)),
    );
    // Asked once, the answer stable for the visit: ads come minutes later, never at start.
    bridge.advertisement
      .checkAdBlock?.()
      .then((blocked) => (this.adsBlocked = flag(blocked, 'adBlock') ?? false))
      .catch(() => undefined);
    // Hidden page: the save leaves now, the player may never come back.
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) storage.flush();
      });
    }
  }

  /**
   * Starts the SDK, then reads the save. In Telegram (the SDK says where the
   * game runs), the save fits Telegram's cloud, and Telegram's Mini App object,
   * which the SDK loads as it starts, is used when the page has it; `telegram`
   * stands in for it in tests.
   */
  static async create(
    bridge: PlaygamaBridge | null = typeof window === 'undefined' ? null : (window.bridge ?? null),
    edition: Edition = FULL_EDITION,
    telegram?: TelegramWebApp | null,
  ): Promise<PlaygamaPlatform> {
    let sdk = bridge;
    if (sdk) {
      try {
        await within(sdk.initialize(), INIT_TIMEOUT_MS);
      } catch {
        sdk = null;
      }
    }
    const inTelegram = sdk?.platform.id === 'telegram';
    const storage = await BridgeStorage.load(
      sdk,
      inTelegram ? new TelegramCloudSaves() : new PlainSaves(),
    );
    const webApp =
      telegram !== undefined
        ? telegram
        : typeof window === 'undefined'
          ? null
          : (window.Telegram?.WebApp ?? null);
    return new PlaygamaPlatform({
      bridge: sdk,
      storage,
      edition,
      telegram: inTelegram ? webApp : null,
    });
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
    this.shell?.playing(true);
    if (this.level === 'playing') return;
    this.tell(this.level === 'paused' ? 'level_resumed' : 'level_started');
    this.level = 'playing';
  }

  gameplayStop(): void {
    this.shell?.playing(false);
    if (this.level !== 'playing') return;
    this.level = 'paused';
    this.tell('level_paused');
  }

  gameOver(won: boolean): void {
    this.shell?.playing(false);
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
    if (bridge?.advertisement.isInterstitialSupported !== true || this.adsBlocked) {
      return Promise.resolve();
    }
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

  /** A pause the player did not ask for (the platform's, or Telegram minimised): the save leaves first. */
  private autoPause(paused: boolean): void {
    if (paused) this.storage.flush();
    this.pauseListeners.forEach((listener) => listener(paused));
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

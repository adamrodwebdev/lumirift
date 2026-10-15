import type { KeyValueStorage } from '@/services/KeyValueStorage';
import { DEMO_EDITION, FULL_EDITION, type Edition } from './Edition';

export type PlatformId = 'web' | 'crazygames' | 'playgama' | 'demo';

/** Called around a video ad: the game pauses its sound only once the ad really plays. */
export interface AdHooks {
  readonly onStart: () => void;
  readonly onEnd: () => void;
}

/**
 * Where the game is published: our own site, or a game portal. The game
 * never talks to a portal SDK directly, only to this contract; each build
 * ships one implementation (see `createPlatform`).
 */
export interface Platform {
  readonly id: PlatformId;
  /** The whole game, or the demo. */
  readonly edition: Edition;
  /** Links out of the game (sharing a URL) are allowed. Portals forbid them. */
  readonly allowsExternalLinks: boolean;
  /** The player's language as the portal knows it (`en-US`…), or null. */
  readonly locale: string | null;
  /** The portal's save, synced with the player's account, or null for the browser's. */
  readonly storage: KeyValueStorage | null;
  /** The portal asks for silence (its own mute button). */
  readonly muted: boolean;
  onMuteChange(listener: (muted: boolean) => void): () => void;
  /** The portal pauses the game (an ad it shows, the player switching away), then resumes it. */
  onPauseChange(listener: (paused: boolean) => void): () => void;

  /** The first screen is drawn and the player can interact. */
  ready(): void;

  loadingStart(): void;
  loadingStop(): void;
  /** The player is playing (not in a menu, a pause or a game-over screen). */
  gameplayStart(): void;
  gameplayStop(): void;
  /** A game ended (won: a level or a duel): gameplay stops. */
  gameOver(won: boolean): void;
  /** A moment worth celebrating (a record, a level won): use sparingly. */
  happyTime(): void;
  /** A natural break between two games; resolves when the game may go on. */
  midgameAd(hooks: AdHooks): Promise<void>;
  /** The portal can show an ad the player chooses to watch for a bonus. */
  readonly supportsRewarded: boolean;
  /** An ad the player asked for; true only once the portal confirms it was watched. */
  rewardedAd(hooks: AdHooks): Promise<boolean>;
}

/** Our own site: no portal, nothing to report, no ads. */
export class WebPlatform implements Platform {
  readonly id: PlatformId = 'web';
  readonly edition: Edition = FULL_EDITION;
  readonly allowsExternalLinks = true;
  readonly locale = null;
  readonly storage = null;
  readonly muted = false;

  onMuteChange(): () => void {
    return () => undefined;
  }

  onPauseChange(): () => void {
    return () => undefined;
  }

  ready(): void {}
  loadingStart(): void {}
  loadingStop(): void {}
  gameplayStart(): void {}
  gameplayStop(): void {}
  gameOver(): void {}
  happyTime(): void {}

  midgameAd(): Promise<void> {
    return Promise.resolve();
  }

  readonly supportsRewarded: boolean = false;

  rewardedAd(): Promise<boolean> {
    return Promise.resolve(false);
  }
}

/**
 * The demo embedded in the portfolio (adamrodwebdev.com): our site's
 * behaviour, the demo's edition.
 */
export class DemoPlatform extends WebPlatform {
  override readonly id: PlatformId = 'demo';
  override readonly edition: Edition = DEMO_EDITION;
}

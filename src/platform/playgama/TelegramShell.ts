/**
 * The part of Telegram's Mini App object (`window.Telegram.WebApp`) the game
 * uses. The Playgama SDK loads Telegram's script itself when it runs there:
 * the game never loads it a second time.
 */
export interface TelegramWebApp {
  /** Telegram's answer, trusted only when it is a real `true`. */
  isVersionAtLeast(version: string): unknown;
  expand(): void;
  disableVerticalSwipes(): void;
  enableVerticalSwipes(): void;
  onEvent(event: 'activated' | 'deactivated', handler: () => void): void;
}

declare global {
  interface Window {
    Telegram?: { readonly WebApp?: TelegramWebApp };
  }
}

/** The first Telegram client with `disableVerticalSwipes` (Bot API 7.7). */
const SWIPES_FROM = '7.7';

/**
 * What Telegram asks of a game in a Mini App (1.46.5, CAHIER § 9 duodecies):
 * the full height, no swipe that closes the app while the player drags a
 * piece down, a pause when the app is minimised. Every call is guarded: an
 * old client that refuses one leaves the game as it is.
 */
export class TelegramShell {
  constructor(
    private readonly webApp: TelegramWebApp,
    /** Tells the game it is paused (minimised) or back. */
    private readonly onPause: (paused: boolean) => void,
  ) {}

  /** At start: the app at its full height, the game following Telegram's minimising. */
  start(): void {
    this.attempt(() => this.webApp.expand());
    this.attempt(() => {
      this.webApp.onEvent('deactivated', () => this.onPause(true));
      this.webApp.onEvent('activated', () => this.onPause(false));
    });
  }

  /** While the player plays, a downward drag moves a piece and never closes the app; menus get it back. */
  playing(playing: boolean): void {
    this.attempt(() => {
      if (this.webApp.isVersionAtLeast(SWIPES_FROM) !== true) return;
      if (playing) this.webApp.disableVerticalSwipes();
      else this.webApp.enableVerticalSwipes();
    });
  }

  private attempt(call: () => void): void {
    try {
      call();
    } catch {
      // A client that refuses the call: Telegram's own behaviour stays.
    }
  }
}

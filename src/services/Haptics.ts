interface VibratingNavigator {
  vibrate?: (pattern: number | number[]) => boolean;
  /** Whether the page has had a gesture yet (absent from older browsers). */
  userActivation?: { readonly hasBeenActive: boolean };
}

/** Short vibrations on phones that support them (not iOS Safari); silently absent elsewhere. */
export class Haptics {
  constructor(
    private readonly navigator: VibratingNavigator,
    private readonly wanted: () => boolean,
  ) {}

  get supported(): boolean {
    return typeof this.navigator.vibrate === 'function';
  }

  /** The player asked for them (where the phone cannot vibrate, the moves glow instead). */
  get enabled(): boolean {
    return this.wanted();
  }

  pulse(pattern: number | number[]): void {
    if (!this.wanted() || !this.navigator.vibrate) return;
    // Before the player's first gesture the browser refuses it, and says so in the
    // console: a portal's first run plays at once, before any tap.
    if (this.navigator.userActivation?.hasBeenActive === false) return;
    try {
      this.navigator.vibrate(pattern);
    } catch {
      // Some browsers throw before the first user gesture: ignore.
    }
  }
}

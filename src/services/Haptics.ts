interface VibratingNavigator {
  vibrate?: (pattern: number | number[]) => boolean;
}

/** Short vibrations on phones that support them (not iOS Safari); silently absent elsewhere. */
export class Haptics {
  constructor(
    private readonly navigator: VibratingNavigator,
    private readonly enabled: () => boolean,
  ) {}

  get supported(): boolean {
    return typeof this.navigator.vibrate === 'function';
  }

  pulse(pattern: number | number[]): void {
    if (!this.enabled() || !this.navigator.vibrate) return;
    try {
      this.navigator.vibrate(pattern);
    } catch {
      // Some browsers throw before the first user gesture: ignore.
    }
  }
}

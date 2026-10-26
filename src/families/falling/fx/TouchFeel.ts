import type { Haptics } from '@/services/Haptics';
import { HAPTIC_BUDGET } from '../input/phone/GestureTuning';

/**
 * What a move feels like under the thumb (1.32), for the players who ask
 * (Vibrations, off at first): on a phone that vibrates, a light tick a cell
 * and a firmer one a turn, never two closer than 50 ms; where the browser
 * cannot vibrate (Safari on the iPhone), a soft glow of the well instead,
 * over the sound each move already makes.
 */
export class TouchFeel {
  private last = -Infinity;

  constructor(
    private readonly haptics: Haptics,
    /** Lights the well for a moment (where the phone cannot vibrate). */
    private readonly glow: () => void,
    private readonly now: () => number,
  ) {}

  moved(): void {
    this.feel(HAPTIC_BUDGET.cellMs);
  }

  turned(): void {
    this.feel(HAPTIC_BUDGET.turnMs);
  }

  private feel(ms: number): void {
    if (!this.haptics.enabled) return;
    const now = this.now();
    if (now - this.last < HAPTIC_BUDGET.gapMs) return;
    this.last = now;
    if (this.haptics.supported) this.haptics.pulse(ms);
    else this.glow();
  }
}

import type { Indicator } from '@/session/GameSession';
import type { Game } from '../game/Game';
import { AbstractMode } from './AbstractMode';
import type { AbilityId } from './GameMode';

export const FLIP_LINES_PER_CHARGE = 10;
export const FLIP_MAX_CHARGES = 2;
export const FLIP_START_CHARGES = 1;

/**
 * The player turns the well upside down on demand: every column settles,
 * holes vanish and full rows clear in cascade. Charges are earned by lines.
 */
export class FlipMode extends AbstractMode {
  readonly id = 'flip';
  override readonly ability: AbilityId = 'flip';

  private charges = FLIP_START_CHARGES;
  private progress = 0;

  override attach(game: Game): void {
    game.events.on('clear', ({ lines, cascade }) => {
      // Cascade lines do not refill charges: a flip must not pay for the next one.
      if (cascade) return;
      this.progress += lines;
      while (this.progress >= FLIP_LINES_PER_CHARGE) {
        this.progress -= FLIP_LINES_PER_CHARGE;
        if (this.charges < FLIP_MAX_CHARGES) {
          this.charges++;
          game.notify('chargeGained', this.charges);
        }
      }
    });
  }

  override useAbility(game: Game): boolean {
    if (this.charges === 0) return false;
    this.charges--;
    game.flipWell();
    return true;
  }

  protected override ownIndicators(): Indicator[] {
    return [
      { id: 'charges', value: this.charges, format: 'count' },
      { id: 'nextCharge', value: FLIP_LINES_PER_CHARGE - this.progress, format: 'count' },
    ];
  }
}

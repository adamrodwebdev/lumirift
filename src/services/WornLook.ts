import { computed, shallowRef, type ComputedRef } from 'vue';
import type { Cosmetic, Equipment } from '@/progression/Cosmetics';
import type { ProfileService } from './ProfileService';

/** A locked look won for one game, and the games it has been worn in so far. */
interface Trial {
  readonly cosmetic: Cosmetic;
  readonly games: number;
}

/**
 * What the player wears now (1.31): their equipment, or for one game a
 * locked material or ambiance tried for a rewarded ad. The trial shows at
 * once (an ambiance around the menus), is worn by the next game, and ends
 * with it: at the game after, or back in the menus.
 */
export class WornLook {
  private readonly trial = shallowRef<Trial | null>(null);
  readonly current: ComputedRef<Equipment>;

  constructor(private readonly profile: Pick<ProfileService, 'current'>) {
    this.current = computed(() => {
      const trial = this.trial.value;
      const own = this.profile.current.equipment;
      // The tried look replaces the worn one of its kind.
      return trial ? { ...own, [trial.cosmetic.kind]: trial.cosmetic.id } : own;
    });
  }

  /** The look tried for the next game, or null. */
  get trying(): Cosmetic | null {
    return this.trial.value?.cosmetic ?? null;
  }

  /** A locked look, won for one game by a rewarded ad. */
  tryOn(cosmetic: Cosmetic): void {
    this.trial.value = { cosmetic, games: 0 };
  }

  /** A game starts: it wears the trial, or the trial ends if the last game wore it. */
  gameStarted(): void {
    const trial = this.trial.value;
    if (trial) this.trial.value = trial.games > 0 ? null : { ...trial, games: 1 };
  }

  /** The game screen is left: a trial that was worn ends there. */
  gameLeft(): void {
    if ((this.trial.value?.games ?? 0) > 0) this.trial.value = null;
  }
}

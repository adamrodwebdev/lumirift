import { watch } from 'vue';
import type { SettingsService } from './SettingsService';
import type { WornLook } from './WornLook';

/**
 * Applies the ambiance the player wears to <html> (see ambiances.css), a
 * trial one included, and stills its animation when the effects are calmer
 * than full.
 */
export class AmbianceController {
  constructor(
    private readonly look: Pick<WornLook, 'current'>,
    private readonly settings: SettingsService,
    private readonly root: HTMLElement,
  ) {
    watch(
      () => [this.look.current.value.ambiance, this.settings.current.effects] as const,
      () => this.apply(),
      { immediate: true },
    );
  }

  private apply(): void {
    this.root.dataset.ambiance = this.look.current.value.ambiance;
    this.root.dataset.motion = this.settings.current.effects === 'full' ? 'moving' : 'still';
  }
}

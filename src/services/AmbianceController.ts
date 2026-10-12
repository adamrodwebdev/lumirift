import { watch } from 'vue';
import type { ProfileService } from './ProfileService';
import type { SettingsService } from './SettingsService';

/**
 * Applies the ambiance the player wears to <html> (see ambiances.css), and
 * stills its animation when the effects are calmer than full.
 */
export class AmbianceController {
  constructor(
    private readonly profile: ProfileService,
    private readonly settings: SettingsService,
    private readonly root: HTMLElement,
  ) {
    watch(
      () => [this.profile.current.equipment.ambiance, this.settings.current.effects] as const,
      () => this.apply(),
      { immediate: true },
    );
  }

  private apply(): void {
    this.root.dataset.ambiance = this.profile.current.equipment.ambiance;
    this.root.dataset.motion = this.settings.current.effects === 'full' ? 'moving' : 'still';
  }
}

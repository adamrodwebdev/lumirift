import { ref, watch, type Ref } from 'vue';
import type { SettingsService } from './SettingsService';

/** How the interface changes from one display to the next: it moves, or it only fades. */
export type TransitionStyle = 'move' | 'fade';

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

/**
 * How the interface's transitions run (1.42): they move, or they only fade,
 * where the system asks for less motion or the player turned the effects off
 * (calm effects keep the moving transitions, the player's choice). Writes
 * `data-transitions` on <html>, which the motion tokens read (tokens.css);
 * scripts ask `fades`.
 */
export class MotionController {
  private readonly systemCalm: Ref<boolean>;

  constructor(
    private readonly settings: Pick<SettingsService, 'current'>,
    private readonly root: HTMLElement,
    media: (query: string) => Pick<MediaQueryList, 'matches' | 'addEventListener'>,
  ) {
    const query = media(REDUCED_MOTION);
    this.systemCalm = ref(query.matches);
    query.addEventListener('change', (event) => (this.systemCalm.value = event.matches));
    watch(
      () => this.style,
      (style) => (this.root.dataset.transitions = style),
      { immediate: true },
    );
  }

  get style(): TransitionStyle {
    return this.systemCalm.value || this.settings.current.effects === 'off' ? 'fade' : 'move';
  }

  /** True where every transition is a plain fade. */
  get fades(): boolean {
    return this.style === 'fade';
  }
}

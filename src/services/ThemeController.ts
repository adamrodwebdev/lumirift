import { ref, type Ref } from 'vue';

export type Theme = 'light' | 'dark';

/**
 * The theme shown. Stackrift has one look, the dark "Rift" identity; the
 * stages still read `resolved` so that a future theme only changes here.
 */
export class ThemeController {
  readonly resolved: Ref<Theme> = ref<Theme>('dark');

  constructor(root: HTMLElement) {
    root.dataset.theme = this.resolved.value;
  }
}

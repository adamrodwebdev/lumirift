import { readonly, ref, type Ref } from 'vue';

export type Theme = 'light' | 'dark';

/**
 * The theme shown. Lumirift has one look, the dark "Rift" identity; the
 * stages still read `resolved` so that a future theme only changes here.
 */
export class ThemeController {
  private readonly shown = ref<Theme>('dark');
  /** Read-only: only the controller changes the theme. */
  readonly resolved: Readonly<Ref<Theme>> = readonly(this.shown);

  constructor(root: HTMLElement) {
    root.dataset.theme = this.resolved.value;
  }
}

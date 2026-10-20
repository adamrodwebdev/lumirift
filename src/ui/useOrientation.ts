import { onBeforeUnmount, ref, type Ref } from 'vue';

/**
 * True while the screen is wider than tall: phones turned sideways, tablets,
 * desktops. Layouts read it where CSS alone cannot decide (canvas sizes).
 */
export function useLandscape(): Readonly<Ref<boolean>> {
  const query = window.matchMedia('(orientation: landscape)');
  const landscape = ref(query.matches);
  const onChange = (event: MediaQueryListEvent) => (landscape.value = event.matches);
  query.addEventListener('change', onChange);
  onBeforeUnmount(() => query.removeEventListener('change', onChange));
  return landscape;
}

/** True on touch screens (phones, tablets): no hover, a coarse pointer. */
export function isTouchScreen(): boolean {
  return window.matchMedia('(hover: none) and (pointer: coarse)').matches;
}

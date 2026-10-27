<script setup lang="ts">
import type { ElementName } from '@/session/Elements';

/**
 * An element of the Sand as a glyph (1.36): the week's event shows it. Drawn
 * in `currentColor`; the parent tints it with the element's tone.
 */
defineProps<{ element: ElementName; size?: number }>();

const PATHS: Readonly<Record<ElementName, readonly string[]>> = {
  water: ['M12 3c3 4.4 6 7.7 6 11a6 6 0 0 1-12 0c0-3.3 3-6.6 6-11z'],
  fire: [
    'M12 2.5c1.5 3.5 5.5 5 5.5 9.5a5.5 5.5 0 0 1-11 0c0-3 1.5-4 3-5.5 0 2 1 3.5 2 3.5-.5-3 0-5.5.5-7.5z',
  ],
  oil: ['M12 3c3 4.4 6 7.7 6 11a6 6 0 0 1-12 0c0-3.3 3-6.6 6-11z', 'M9 14.5a3 3 0 0 0 3 3'],
  ice: ['M12 3v18', 'M4.2 7.5l15.6 9', 'M4.2 16.5l15.6-9', 'M10 4.5l2 2 2-2', 'M10 19.5l2-2 2 2'],
  lightning: ['M13.5 2.5L6 13.5h5l-1.5 8 8-11.5h-5z'],
  seed: [
    'M12 21v-9',
    'M12 13c-4 0-6-2.5-6-6 3.5 0 6 2 6 6z',
    'M12 11c0-3.5 2.5-6 6-6 0 3.5-2 6-6 6z',
  ],
  acid: [
    'M9.5 3h5',
    'M10.5 3v5.5L6 17a3 3 0 0 0 2.7 4.5h6.6A3 3 0 0 0 18 17l-4.5-8.5V3',
    'M8.5 15h7',
  ],
};
/** The glyphs filled rather than drawn. */
const FILLED: ReadonlySet<ElementName> = new Set(['water', 'fire', 'lightning']);
</script>

<template>
  <svg
    class="element-icon"
    :width="size ?? 24"
    :height="size ?? 24"
    viewBox="0 0 24 24"
    aria-hidden="true"
    focusable="false"
  >
    <path
      v-for="(d, index) in PATHS[element]"
      :key="index"
      :d="d"
      :fill="FILLED.has(element) && index === 0 ? 'currentColor' : 'none'"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
</template>

<style scoped>
.element-icon {
  flex: none;
}
</style>

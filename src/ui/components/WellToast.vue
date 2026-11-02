<script setup lang="ts">
import { ref } from 'vue';
import { useWellBox } from './useWellBox';

/**
 * The game's words over the well (a clear, an element, a Guardian's move):
 * centred on the well's canvas, never wider than it, in a size that follows
 * the well (1.45.1: over a narrow well, the words spilled past its sides and
 * hid its middle). Without a canvas, they centre on the well's area.
 */
const props = defineProps<{
  toast: { readonly text: string; readonly key: number } | null;
  /** The well's canvas, which the words sit on. */
  well: HTMLElement | null;
}>();

const layer = ref<HTMLElement | null>(null);
const { boxStyle } = useWellBox(() => props.well, layer);
</script>

<template>
  <div ref="layer" class="well-toast" aria-hidden="true">
    <div class="well-toast__box" :style="boxStyle">
      <Transition name="toast">
        <p v-if="toast" :key="toast.key" class="toast">{{ toast.text }}</p>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.well-toast {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

/* The well's own box: the words measure themselves against it. */
.well-toast__box {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  container-type: inline-size;
}

/* A message takes the place of the last one, in the same cell: nothing jumps (1.42). */
.toast {
  grid-area: 1 / 1;
  max-inline-size: calc(100% - 2 * var(--space-2));
  padding: var(--space-2) var(--space-3);
  border-radius: 1em;
  background: color-mix(in srgb, var(--surface) 88%, transparent);
  box-shadow: var(--shadow);
  font-family: var(--font-display);
  font-size: clamp(0.95rem, 0.6rem + 3.5cqi, 1.6rem);
  font-weight: 800;
  line-height: 1.2;
  text-align: center;
  text-wrap: balance;
}

.toast-enter-active {
  animation: toast-in var(--motion-in) cubic-bezier(0.2, 1.4, 0.4, 1);
}

.toast-leave-active {
  transition: opacity var(--motion-out) var(--ease-in);
}

.toast-leave-to {
  opacity: 0;
}

@keyframes toast-in {
  from {
    opacity: 0;
    transform: scale(calc(1 - var(--move) * 0.4));
  }
}
</style>

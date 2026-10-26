<script setup lang="ts">
import { ref } from 'vue';
import { useWellBox } from '@/ui/components/useWellBox';

/**
 * Where the phone cannot vibrate (Safari on the iPhone), each move lights the
 * well's rim for a moment instead, for the players who asked to feel them
 * (1.32). It lies over the well's canvas and never takes a touch.
 */
const props = defineProps<{ beat: number; canvas: HTMLCanvasElement | null }>();

const layer = ref<HTMLElement | null>(null);
const { boxStyle } = useWellBox(() => props.canvas, layer);
</script>

<template>
  <span ref="layer" class="notch" aria-hidden="true">
    <span v-if="beat > 0" :key="beat" class="notch__glow" :style="boxStyle" />
  </span>
</template>

<style scoped>
/* The well's cell: the canvas sits in its middle, the glow on it. */
.notch {
  grid-area: 1 / 1;
  place-self: stretch;
  position: relative;
  pointer-events: none;
}

.notch__glow {
  position: absolute;
  border-radius: var(--radius-sm);
  box-shadow:
    inset 0 0 0 2px var(--accent-strong),
    0 0 1.25rem var(--rift-glow);
  opacity: 0;
  animation: notch-glow 180ms ease-out;
}

@keyframes notch-glow {
  from {
    opacity: 0.75;
  }
}
</style>

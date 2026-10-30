<script setup lang="ts">
import AppIcon from './AppIcon.vue';

/**
 * The two halves of the screen while a guide asks to turn the piece (1.32):
 * a tap on the left one turns it left, on the right one right. Drawn over the
 * game, they never take a touch.
 */
</script>

<template>
  <div class="zones" aria-hidden="true">
    <div class="zones__half zones__half--left"><AppIcon name="rotateCcw" :size="40" /></div>
    <div class="zones__half zones__half--right"><AppIcon name="rotateCw" :size="40" /></div>
  </div>
</template>

<style scoped>
.zones {
  position: absolute;
  inset: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  pointer-events: none;
  /* Soft bands over the well: they fade out over the dashboard and the screen's bottom. */
  mask-image: linear-gradient(transparent 28%, #000 44% 80%, transparent);
  animation: zones-in var(--motion-in) var(--ease-out) both;
}

.zones__half {
  display: flex;
  align-items: center;
  padding-inline: max(var(--space-3), env(safe-area-inset-left, 0px));
}

.zones__half--left {
  border-right: 2px dashed color-mix(in srgb, var(--text) 30%, transparent);
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--jewel-violet) 24%, transparent),
    transparent 75%
  );
  color: var(--jewel-violet);
}

.zones__half--right {
  justify-content: flex-end;
  padding-inline: max(var(--space-3), env(safe-area-inset-right, 0px));
  background: linear-gradient(
    270deg,
    color-mix(in srgb, var(--accent) 20%, transparent),
    transparent 75%
  );
  color: var(--accent-strong);
}

/* The arrows beat softly, as a tap would. */
.zones__half :deep(.icon) {
  animation: zones-beat 1.2s ease-in-out infinite;
}

@keyframes zones-in {
  from {
    opacity: 0;
  }
}

@keyframes zones-beat {
  50% {
    opacity: 0.45;
  }
}

@media (prefers-reduced-motion: reduce) {
  .zones__half :deep(.icon) {
    animation: none;
  }
}
</style>

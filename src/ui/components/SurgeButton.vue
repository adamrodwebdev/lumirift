<script setup lang="ts">
import { computed, inject } from 'vue';
import { useI18n } from 'vue-i18n';
import { SURGE } from '../surgeControl';
import { useKeyBindings } from '../useKeyBindings';
import { useKeyLabels } from '../useKeyLabels';
import { isTouchScreen } from '../useOrientation';
import AppIcon from './AppIcon.vue';

/**
 * The rift surge's button, beside the hold box (1.25): its ring fills with
 * the clears; full, it glows and calls (its key shown on a keyboard); during
 * the surge, the ring empties with the time left. A tap triggers it.
 */
const surge = inject(SURGE, null);
const { t } = useI18n();
const bindings = useKeyBindings();
const labels = useKeyLabels();
const touch = isTouchScreen();

const RADIUS = 20;
const LENGTH = 2 * Math.PI * RADIUS;

/** The surge's main key, as the player's keyboard prints it. */
const key = computed(() => {
  const code = bindings.value.codes('surge')[0];
  return code ? labels.label(code) : null;
});
const offset = computed(() => LENGTH * (1 - (surge?.fill.value ?? 0)));
const label = computed(() => {
  if (!surge) return '';
  if (surge.active.value) return t('surge.running');
  if (surge.ready.value) {
    return key.value && !touch ? t('surge.readyKey', { key: key.value }) : t('surge.ready');
  }
  return t('surge.charging', { n: Math.round(surge.fill.value * 100) });
});
</script>

<template>
  <button
    v-if="surge?.enabled.value"
    type="button"
    class="surge-button"
    :class="{
      'surge-button--ready': surge.ready.value,
      'surge-button--active': surge.active.value,
    }"
    :aria-label="label"
    :aria-disabled="!surge.ready.value"
    @click="surge.trigger()"
  >
    <svg class="surge-button__ring" viewBox="0 0 48 48" aria-hidden="true">
      <circle class="surge-button__track" cx="24" cy="24" :r="RADIUS" />
      <circle
        class="surge-button__fill"
        cx="24"
        cy="24"
        :r="RADIUS"
        :stroke-dasharray="LENGTH"
        :stroke-dashoffset="offset"
      />
    </svg>
    <AppIcon name="hourglass" :size="18" class="surge-button__icon" />
    <kbd v-if="key && !touch && surge.ready.value" class="surge-button__key" aria-hidden="true">
      {{ key }}
    </kbd>
  </button>
</template>

<style scoped>
.surge-button {
  position: relative;
  display: grid;
  flex: none;
  place-items: center;
  width: var(--touch);
  height: var(--touch);
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: color-mix(in srgb, var(--surface-2) 85%, transparent);
  color: color-mix(in srgb, var(--surge) 55%, var(--text-muted));
  transition:
    transform 120ms ease,
    box-shadow 200ms ease;
}

.surge-button__ring {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.surge-button__ring circle {
  fill: none;
  stroke-width: 3.5;
}

.surge-button__track {
  stroke: var(--border);
}

.surge-button__fill {
  stroke: var(--surge);
  stroke-linecap: round;
  transition: stroke-dashoffset 160ms linear;
}

.surge-button__icon {
  position: relative;
}

/* Full: it calls, cold and bright. */
.surge-button--ready {
  color: var(--surge);
  box-shadow: 0 0 1.1rem color-mix(in srgb, var(--surge) 55%, transparent);
}

.surge-button--ready:active {
  transform: scale(0.94);
}

@media (prefers-reduced-motion: no-preference) {
  .surge-button--ready {
    animation: surge-call 1.2s ease-in-out infinite;
  }
}

@keyframes surge-call {
  50% {
    box-shadow: 0 0 1.8rem color-mix(in srgb, var(--surge) 75%, transparent);
  }
}

/* Running: the ring empties with the time left. */
.surge-button--active {
  color: var(--text);
  background: color-mix(in srgb, var(--surge) 28%, var(--surface-2));
}

.surge-button__key {
  position: absolute;
  right: -0.35rem;
  bottom: -0.3rem;
  min-width: 1.2rem;
  padding: 0.05rem 0.25rem;
  border: 1px solid var(--border);
  border-bottom-width: 2px;
  border-radius: 0.35rem;
  background: var(--surface-2);
  color: var(--text);
  font-family: var(--font-display);
  font-size: 0.6rem;
  font-weight: 800;
  line-height: 1.2;
}
</style>

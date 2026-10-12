<script setup lang="ts">
import { useI18n } from 'vue-i18n';

/** The wordmark: the name, split by the rift. */
const { t } = useI18n();
</script>

<template>
  <span class="brand">
    <svg class="brand__rift" viewBox="0 0 12 32" aria-hidden="true" focusable="false">
      <path d="M7 1 L4 9 L8 15 L3 22 L7 27 L5 31" />
    </svg>
    <span class="brand__name">{{ t('app.name') }}</span>
  </span>
</template>

<style scoped>
.brand {
  display: inline-flex;
  align-items: center;
  gap: 0.15em;
  font-family: var(--font-display);
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1;
}

.brand__rift {
  width: 0.5em;
  height: 1.3em;
  fill: none;
  stroke: var(--accent);
  stroke-width: 2.4;
  stroke-linecap: round;
  stroke-linejoin: round;
}
</style>

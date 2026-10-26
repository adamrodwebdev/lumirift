<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { GestureRow } from '../gestureGuide';
import AppIcon from './AppIcon.vue';

/**
 * The gestures of a game, drawn and named (the pause, the gesture guide):
 * numbered rather than drawn beside the guide's drawing, which shows them.
 */
defineProps<{ rows: readonly GestureRow[]; numbered?: boolean }>();

const { t } = useI18n();
</script>

<template>
  <ol class="gestures" :aria-label="t('gestures.label')">
    <li v-for="(row, index) in rows" :key="row.mark" class="gesture">
      <span v-if="numbered" class="gesture__number" aria-hidden="true">{{ index + 1 }}</span>
      <AppIcon v-else :name="row.icon" :size="26" />
      <span class="gesture__text">
        <strong>{{ t(row.gesture) }}</strong>
        <small>{{ t(row.action) }}</small>
      </span>
    </li>
  </ol>
</template>

<style scoped>
.gestures {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 9.5rem), 1fr));
  gap: 0.375rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.gesture {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
  min-height: 2.9rem;
  padding: 0.375rem var(--space-2);
  border-radius: 0.875rem;
  background: var(--highlight);
  color: var(--accent);
}

/* The number of the gesture on the guide's drawing. */
.gesture__number {
  display: grid;
  flex: none;
  place-items: center;
  width: 1.35rem;
  height: 1.35rem;
  border-radius: 50%;
  background: var(--accent-fill);
  color: var(--on-accent-fill);
  font-family: var(--font-display);
  font-size: 0.72rem;
  font-weight: 800;
}

.gesture__text {
  display: grid;
  min-width: 0;
  color: var(--text);
  line-height: 1.2;
}

.gesture strong {
  font-size: 0.78rem;
}

.gesture small {
  color: var(--text-muted);
  font-size: 0.72rem;
}
</style>

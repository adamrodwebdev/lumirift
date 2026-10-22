<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { FamilyId, ModeId } from '@/session/ModeId';
import { keyLegendFor } from '../keyLegend';
import { useKeyBindings } from '../useKeyBindings';
import { useKeyLabels } from '../useKeyLabels';

/**
 * The keyboard controls of a mode, drawn as keys beside what they do: read
 * at a glance, in the keyboard layout of the player, with the keys they chose.
 */
const props = defineProps<{ family: FamilyId; modeId: ModeId }>();

const { t } = useI18n();
const keys = useKeyLabels();
const bindings = useKeyBindings();
const rows = computed(() => keyLegendFor(props.family, props.modeId, bindings.value));
</script>

<template>
  <ul class="legend" :aria-label="t('keys.legend')">
    <li
      v-for="row in rows"
      :key="row.action"
      class="legend__row"
      :class="{ 'legend__row--minor': row.minor }"
    >
      <span class="legend__keys">
        <kbd
          v-for="code in row.codes"
          :key="code"
          class="legend__key"
          :class="{ 'legend__key--wide': keys.label(code).length > 2 }"
        >
          <span aria-hidden="true">{{ keys.label(code) }}</span>
          <span class="sr-only">{{ keys.spoken(code) }}</span>
        </kbd>
      </span>
      <span class="legend__action">{{ t(row.action) }}</span>
    </li>
  </ul>
</template>

<style scoped>
.legend {
  display: grid;
  gap: 0.35rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.legend__row {
  display: grid;
  grid-template-columns: minmax(4.6rem, auto) minmax(0, 1fr);
  align-items: center;
  gap: var(--space-2);
}

.legend__keys {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.2rem;
}

/* A key: a raised cap, its label in the display face. */
.legend__key {
  display: grid;
  place-items: center;
  min-width: 1.55rem;
  height: 1.55rem;
  padding: 0 0.3rem;
  border: 1px solid var(--border);
  border-bottom-width: 3px;
  border-radius: 0.4rem;
  background: var(--surface-2);
  color: var(--text);
  font-family: var(--font-display);
  font-size: 0.68rem;
  font-weight: 800;
  line-height: 1;
}

.legend__key--wide {
  padding: 0 0.45rem;
  font-family: var(--font-ui);
  font-size: 0.62rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.legend__action {
  color: var(--text-muted);
  font-size: 0.78rem;
  line-height: 1.2;
}
</style>

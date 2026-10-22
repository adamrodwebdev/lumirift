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
/*
 * Sizes in `em`: the legend takes the size of where it stands (the HUD's,
 * larger on large screens, or a window's). What a key does reads at 14 px at
 * least; a key's letters at 12 px, in bold capitals.
 */
.legend {
  display: grid;
  gap: 0.35em;
  margin: 0;
  padding: 0;
  list-style: none;
}

.legend__row {
  display: grid;
  grid-template-columns: minmax(4.6em, auto) minmax(0, 1fr);
  align-items: center;
  gap: 0.5em;
}

.legend__keys {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.2em;
}

/* A key: a raised cap, its label in the display face. */
.legend__key {
  display: grid;
  place-items: center;
  min-width: 2.2em;
  height: 2.2em;
  padding: 0 0.4em;
  border: 1px solid var(--border);
  border-bottom-width: 3px;
  border-radius: 0.55em;
  background: var(--surface-2);
  color: var(--text);
  font-family: var(--font-display);
  font-size: 0.75em;
  font-weight: 800;
  line-height: 1;
}

.legend__key--wide {
  padding: 0 0.6em;
  font-family: var(--font-ui);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.legend__action {
  color: var(--text-muted);
  font-size: 0.875em;
  line-height: 1.2;
}
</style>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useServices } from '@/app/AppServices';
import { useFormat } from '@/app/useFormat';
import { dayKey } from '@/core/Day';
import { OBJECTIVE_XP } from '@/progression/Objectives';
import { useProgressText } from '../useProgressText';
import AppIcon from '../components/AppIcon.vue';
import ModalDialog from '../components/ModalDialog.vue';

/** The three objectives of the day, with their progress and reward (from the title screen). */
defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();
const { t } = useI18n();
const format = useFormat();
const { profile, clock } = useServices();
const text = useProgressText();

// A new day brings new objectives.
profile.objectivesFor(dayKey(clock()));
const objectives = computed(() => profile.current.objectives);
</script>

<template>
  <ModalDialog :open="open" :title="t('profile.objectives')" closable @dismiss="emit('close')">
    <ul class="list">
      <li
        v-for="entry in objectives"
        :key="entry.objective.kind"
        class="objective"
        :class="{ 'objective--done': entry.done }"
      >
        <span class="objective__mark" aria-hidden="true">
          <AppIcon v-if="entry.done" name="check" :size="16" />
        </span>
        <span class="objective__text">{{ text.objective(entry.objective) }}</span>
        <span class="objective__progress">
          {{
            entry.done
              ? t('profile.done')
              : `${format.number(entry.progress)} / ${format.number(entry.objective.target)}`
          }}
        </span>
        <span class="objective__reward">
          {{ t('profile.reward', { n: OBJECTIVE_XP[entry.objective.tier] }) }}
        </span>
        <span
          class="objective__bar"
          :style="{
            inlineSize: `${Math.round((entry.progress / entry.objective.target) * 100)}%`,
          }"
          aria-hidden="true"
        />
      </li>
    </ul>
    <p class="sheet-note">{{ t('profile.objectivesNote') }}</p>
  </ModalDialog>
</template>

<style scoped>
.list {
  display: grid;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.objective {
  position: relative;
  display: grid;
  grid-template-columns: 1.75rem 1fr auto;
  align-items: center;
  gap: 0.1rem var(--space-3);
  min-height: 3.4rem;
  padding: var(--space-2) var(--space-3);
  border-radius: 1rem;
  background: var(--highlight);
  overflow: hidden;
}

.objective__mark {
  grid-row: 1 / span 2;
  display: grid;
  place-items: center;
  inline-size: 1.75rem;
  block-size: 1.75rem;
  border: 2px solid var(--well-frame);
  border-radius: 50%;
}

.objective--done .objective__mark {
  border-color: transparent;
  background: var(--accent-fill);
  color: var(--on-accent-fill);
}

.objective--done .objective__text {
  color: var(--text-muted);
}

.objective__text {
  font-size: 0.88rem;
  font-weight: 700;
}

.objective__progress {
  grid-row: 1 / span 2;
  grid-column: 3;
  color: var(--text-muted);
  font-family: var(--font-display);
  font-size: 0.82rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

.objective__reward {
  grid-column: 2;
  font-size: 0.75rem;
  color: var(--text-muted);
}

.objective__bar {
  position: absolute;
  inset: auto auto 0 0;
  block-size: 3px;
  background: var(--accent-gradient);
}
</style>

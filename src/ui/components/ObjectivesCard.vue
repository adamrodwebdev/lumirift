<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useServices } from '@/app/AppServices';
import { useFormat } from '@/app/useFormat';
import { dayKey } from '@/core/Day';
import { OBJECTIVE_XP } from '@/progression/Objectives';
import { useProgressText } from '../useProgressText';
import AppIcon from './AppIcon.vue';

/** The three objectives of the day, with their progress and reward. */
const { t } = useI18n();
const format = useFormat();
const { profile, clock } = useServices();
const text = useProgressText();

// A new day brings new objectives.
profile.objectivesFor(dayKey(clock()));
const objectives = computed(() => profile.current.objectives);
</script>

<template>
  <section class="objectives card" aria-labelledby="objectives-title">
    <h2 id="objectives-title" class="section-title">{{ t('profile.objectives') }}</h2>
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
  </section>
</template>

<style scoped>
.objectives {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-4);
}

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
  grid-template-columns: 1.25rem 1fr auto;
  align-items: center;
  gap: var(--space-1) var(--space-2);
  padding: var(--space-3);
  border-radius: var(--radius);
  background: var(--surface-2);
  overflow: hidden;
}

.objective__mark {
  display: grid;
  place-items: center;
  inline-size: 1.25rem;
  block-size: 1.25rem;
  border: 2px solid var(--border);
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

.objective__progress {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.objective__reward {
  grid-column: 2 / -1;
  font-size: 0.78rem;
  color: var(--text-muted);
}

.objective__bar {
  position: absolute;
  inset: auto auto 0 0;
  block-size: 3px;
  background: var(--accent-gradient);
}
</style>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useFormat } from '@/app/useFormat';
import type { CampaignLevel } from '@/campaign/Levels';
import { useCampaignText } from '../useCampaignText';

/** The goal of a campaign level, over the game, and how far along it is. */
const props = defineProps<{ level: CampaignLevel; value: number }>();

const { t } = useI18n();
const format = useFormat();
const text = useCampaignText();

const target = computed(() => props.level.goal.target);
/** Win and shape goals are judged at the end: no gauge for them. */
const measured = computed(
  () => props.level.goal.kind !== 'win' && props.level.goal.kind !== 'shape',
);
const shown = (n: number) =>
  props.level.goal.kind === 'survive' ? format.duration(n) : format.number(n);
</script>

<template>
  <div class="goal" role="group" :aria-label="t('campaign.goalLabel')">
    <p class="goal__level">{{ t('campaign.levelShort', { level: level.id }) }}</p>
    <p class="goal__text">{{ text.goal(level) }}</p>
    <template v-if="measured">
      <div
        class="goal__bar"
        role="progressbar"
        aria-valuemin="0"
        :aria-valuemax="target"
        :aria-valuenow="value"
        :aria-valuetext="`${shown(value)} / ${shown(target)}`"
        :aria-label="text.goal(level)"
      >
        <span class="goal__fill" :style="{ inlineSize: `${(value / target) * 100}%` }" />
      </div>
      <p class="goal__count">{{ shown(value) }} / {{ shown(target) }}</p>
    </template>
  </div>
</template>

<style scoped>
.goal {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 0.15rem var(--space-2);
  flex: 1 1 12rem;
  min-width: 0;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius);
  background: var(--surface-2);
}

.goal__level {
  font-size: 0.75rem;
  font-weight: 800;
  color: var(--accent);
}

.goal__text {
  font-size: 0.85rem;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.goal__count {
  font-size: 0.8rem;
  font-variant-numeric: tabular-nums;
  color: var(--text-muted);
}

.goal__bar {
  grid-column: 1 / -1;
  block-size: 0.35rem;
  border-radius: 999px;
  background: var(--surface);
  overflow: hidden;
}

.goal__fill {
  display: block;
  block-size: 100%;
  border-radius: inherit;
  background: var(--accent-gradient);
  transition: inline-size 200ms ease;
}

@media (min-width: 1024px) {
  .goal {
    flex: none;
    inline-size: 100%;
    grid-template-columns: 1fr auto;
  }

  .goal__level {
    grid-column: 1 / -1;
  }

  .goal__text {
    white-space: normal;
  }
}
</style>

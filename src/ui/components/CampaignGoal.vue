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
/* Sizes in `em`, like the rest of the HUD: 14 px at least. */
.goal {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 0.15em 0.5em;
  flex: 1 1 12em;
  min-width: 0;
  padding: 0.5em 0.75em;
  border-radius: var(--radius);
  background: var(--surface-2);
}

.goal__level {
  font-size: 0.875em;
  font-weight: 800;
  color: var(--accent);
}

/* Two lines at most, never cut in the middle of a word. */
.goal__text {
  display: -webkit-box;
  overflow: hidden;
  font-size: 0.875em;
  font-weight: 700;
  line-height: 1.2;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.goal__count {
  font-size: 0.875em;
  font-variant-numeric: tabular-nums;
  color: var(--text-muted);
}

.goal__bar {
  grid-column: 1 / -1;
  block-size: 0.35em;
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

/* A desktop (the dashboard's column beside the well): the level above the goal. */
@media (width >= 64rem) {
  .goal {
    flex: none;
    inline-size: 100%;
    grid-template-columns: 1fr auto;
  }

  .goal__level {
    grid-column: 1 / -1;
  }
}
</style>

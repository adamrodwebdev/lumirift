<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useFormat } from '@/app/useFormat';
import type { Goal } from '@/campaign/Goals';

/**
 * The goal of a campaign level or of a training step, over the game, and how
 * far along it is: its name (`label`, the level or the step), what to do
 * (`text`), the gauge.
 */
const props = defineProps<{ label: string; text: string; goal: Goal; value: number }>();

const { t } = useI18n();
const format = useFormat();

const target = computed(() => props.goal.target);
/** Win and shape goals are judged at the end: no gauge for them. */
const measured = computed(() => props.goal.kind !== 'win' && props.goal.kind !== 'shape');
const shown = (n: number) =>
  props.goal.kind === 'survive' ? format.duration(n) : format.number(n);
</script>

<template>
  <div class="goal" role="group" :aria-label="t('campaign.goalLabel')">
    <p class="goal__level">{{ label }}</p>
    <p class="goal__text">{{ text }}</p>
    <template v-if="measured">
      <div
        class="goal__bar"
        role="progressbar"
        aria-valuemin="0"
        :aria-valuemax="target"
        :aria-valuenow="value"
        :aria-valuetext="`${shown(value)} / ${shown(target)}`"
        :aria-label="text"
      >
        <span class="goal__fill" :style="{ inlineSize: `${(value / target) * 100}%` }" />
      </div>
      <p class="goal__count">{{ shown(value) }} / {{ shown(target) }}</p>
    </template>
  </div>
</template>

<style scoped>
/*
 * Sizes in `em`, like the rest of the HUD: 14 px at least. The level (or the
 * step) and the count share the first line; what to do has the card's whole
 * width, so that no word of any language is cut. The card adapts to its own
 * width (its slot gives it, never its words): three columns, which the parts
 * span or share.
 */
.goal {
  container: goal / inline-size;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.15em 0.5em;
  flex: 1 1 12em;
  min-width: 0;
  padding: 0.5em 0.75em;
  border-radius: var(--radius);
  background: var(--surface-2);
}

.goal__level {
  grid-row: 1;
  grid-column: 1 / 3;
  font-size: 0.875em;
  font-weight: 800;
  color: var(--accent);
}

/* Two lines at most, never cut in the middle of a word. */
.goal__text {
  grid-row: 2;
  grid-column: 1 / -1;
  display: -webkit-box;
  overflow: hidden;
  font-size: 0.875em;
  font-weight: 700;
  line-height: 1.2;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.goal__count {
  grid-row: 1;
  grid-column: 3;
  font-size: 0.875em;
  font-variant-numeric: tabular-nums;
  color: var(--text-muted);
}

.goal__bar {
  grid-row: 3;
  grid-column: 1 / -1;
  block-size: 0.35em;
  margin-block-start: 0.2em;
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

/*
 * As wide as a large phone's band (portrait, the goal under the hold box, from
 * 390 px): the level, what to do and the count on one line, the gauge under
 * them, a line of height given back to the well. What to do may take a second
 * line, never a third (a Guardian's name in Russian): a narrower card, up to a
 * 360-px phone, keeps its three lines.
 */
@container goal (width >= 21em) {
  .goal__level {
    grid-column: 1;
  }

  .goal__text {
    grid-row: 1;
    grid-column: 2;
  }

  .goal__bar {
    grid-row: 2;
  }
}

/* A desktop (the dashboard's column beside the well): the card takes the column. */
@media (width >= 64rem) {
  .goal {
    flex: none;
    inline-size: 100%;
  }
}
</style>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useFormat } from '@/app/useFormat';
import AppIcon from '@/ui/components/AppIcon.vue';
import { RACE_WORLDS, type RaceWorld } from '../rules/ShiftSchedule';

/**
 * The worlds of the run (1.34): the three the Rift turns through, the one
 * played lit in its colour, the next one with the time before the shift, and
 * the phase's bar under them. Each change is seen coming.
 */
const props = defineProps<{
  world: RaceWorld;
  /** Whole seconds before the shift. */
  shiftInS: number;
  /** The share of the phase played (0 to 1). */
  phaseShare: number;
}>();

const { t } = useI18n();
const format = useFormat();

const next = computed(
  () => RACE_WORLDS[(RACE_WORLDS.indexOf(props.world) + 1) % RACE_WORLDS.length]!,
);
const shiftIn = computed(() => format.duration(props.shiftInS * 1000));
</script>

<template>
  <div class="worlds" :data-world="world">
    <ul class="worlds__list" :aria-label="t('race.worlds')">
      <li
        v-for="each in RACE_WORLDS"
        :key="each"
        class="world"
        :data-world="each"
        :aria-current="each === world ? 'step' : undefined"
      >
        <AppIcon :name="each" :size="16" />
        <span class="world__name">{{ t(`race.world.${each}`) }}</span>
        <span v-if="each === world" class="world__when">{{ t('race.now') }}</span>
        <span v-else-if="each === next" class="world__when">
          {{ t('race.in', { time: shiftIn }) }}
        </span>
      </li>
    </ul>
    <p class="worlds__next">
      {{ t('race.nextIn', { world: t(`race.world.${next}`), time: shiftIn }) }}
    </p>
    <div class="worlds__bar" aria-hidden="true">
      <i :style="{ transform: `scaleX(${phaseShare})` }" />
    </div>
  </div>
</template>

<style scoped>
/*
 * Portrait: one row, the three worlds then the next shift at the end, the bar
 * under them. Landscape: in the left column, the row, the next shift under
 * it, and on a tall screen a list with the times.
 */
.worlds {
  --world: var(--jewel-violet);
  container-type: inline-size;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.35em 0.5em;
  min-width: 0;
  font-size: var(--hud-size);
}

.worlds__list {
  display: flex;
  align-items: center;
  gap: 0.3em;
  min-width: 0;
  margin: 0;
  padding: 0;
  list-style: none;
}

.world {
  --world: var(--jewel-violet);
  display: flex;
  align-items: center;
  gap: 0.3em;
  min-width: 0;
  height: 2em;
  padding: 0 0.5em;
  border: 1px solid var(--border);
  border-radius: 0.7em;
  background: var(--glass);
  color: var(--text-muted);
  font-size: 0.875em;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.world[data-world='sand'],
.worlds[data-world='sand'] {
  --world: var(--jewel-amber);
}

.world[data-world='tower'],
.worlds[data-world='tower'] {
  --world: var(--jewel-cyan);
}

.world[aria-current] {
  border: 2px solid var(--world);
  background: color-mix(in srgb, var(--world) 22%, var(--surface));
  color: var(--text);
}

.world :deep(.icon) {
  color: var(--world);
}

.world__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* The times by the worlds are for a tall column; the row says the next shift once. */
.world__when {
  display: none;
}

.worlds__next {
  margin: 0;
  color: var(--accent-strong);
  font-size: 0.875em;
  font-weight: 700;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.worlds__bar {
  grid-column: 1 / -1;
  height: 0.3em;
  overflow: hidden;
  border-radius: 999px;
  background: var(--surface);
}

.worlds__bar i {
  display: block;
  height: 100%;
  background: var(--accent-gradient);
  transform-origin: left;
}

/* A narrow row (a small phone, a short landscape column): the world's icon alone, but for the one played. */
@media (orientation: portrait), (orientation: landscape) and (height < 40rem) {
  @container (width < 20em) {
    .world:not([aria-current]) .world__name {
      display: none;
    }
  }
}

/* Landscape: in the narrow column, the next shift under the worlds, not beside them. */
@media (orientation: landscape) {
  .worlds {
    grid-template-columns: minmax(0, 1fr);
  }
}

/* A tall landscape screen: the list in a column, each world with its name and time (the shift's). */
@media (orientation: landscape) and (height >= 40rem) {
  .worlds__list {
    flex-direction: column;
    align-items: stretch;
  }

  .world {
    height: 2.4em;
    font-size: 0.875em;
  }

  .world__when {
    display: block;
    margin-left: auto;
    color: var(--text-muted);
    letter-spacing: 0;
    text-transform: none;
    font-variant-numeric: tabular-nums;
  }

  .world[aria-current] .world__when {
    color: var(--accent-strong);
  }

  .worlds__next {
    display: none;
  }
}
</style>

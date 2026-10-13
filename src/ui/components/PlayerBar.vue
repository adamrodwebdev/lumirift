<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useServices } from '@/app/AppServices';
import { useFormat } from '@/app/useFormat';
import { dayKey, previousDay } from '@/core/Day';
import { levelProgress } from '@/progression/Experience';
import AppIcon from './AppIcon.vue';

/** The player at a glance: level ring, experience, streak, and the Atelier. */
const emit = defineEmits<{ atelier: [] }>();

const { t } = useI18n();
const format = useFormat();
const { profile, clock } = useServices();

const day = dayKey(clock());
const level = computed(() => levelProgress(profile.current.xp));
const share = computed(() =>
  level.value.needed === 0 ? 1 : level.value.into / level.value.needed,
);
const xpText = computed(() =>
  level.value.needed === 0
    ? t('profile.maxLevel')
    : t('profile.xp', {
        into: format.number(level.value.into),
        needed: format.number(level.value.needed),
      }),
);
const streak = computed(() => {
  const { count, lastDay } = profile.current.streak;
  // A streak still counts if the daily challenge was played today or yesterday.
  return lastDay === day || lastDay === previousDay(day) ? count : 0;
});

/** The ring: a circle whose stroke shows the share of the level done. */
const RADIUS = 22;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
</script>

<template>
  <section class="player card" aria-labelledby="player-level">
    <div
      class="ring"
      role="progressbar"
      :aria-label="t('profile.xpLabel')"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-valuenow="Math.round(share * 100)"
      :aria-valuetext="xpText"
    >
      <svg viewBox="0 0 56 56" aria-hidden="true">
        <circle class="ring__track" cx="28" cy="28" :r="RADIUS" />
        <circle
          class="ring__fill"
          cx="28"
          cy="28"
          :r="RADIUS"
          :stroke-dasharray="CIRCUMFERENCE"
          :stroke-dashoffset="CIRCUMFERENCE * (1 - share)"
        />
      </svg>
      <span class="ring__level" aria-hidden="true">{{ level.level }}</span>
    </div>
    <div class="player__text">
      <h2 id="player-level" class="player__level">{{ t('profile.level', { n: level.level }) }}</h2>
      <p class="player__xp">{{ xpText }}</p>
    </div>
    <p v-if="streak > 0" class="player__streak">
      <AppIcon name="flame" :size="18" />{{ t('profile.streak', { n: streak }, streak) }}
    </p>
    <button type="button" class="btn player__atelier" @click="emit('atelier')">
      <AppIcon name="atelier" :size="20" />{{ t('cosmetics.title') }}
    </button>
  </section>
</template>

<style scoped>
.player {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: var(--space-2) var(--space-3);
  padding: var(--space-3) var(--space-4);
}

.ring {
  position: relative;
  inline-size: 3.5rem;
  block-size: 3.5rem;
}

.ring svg {
  inline-size: 100%;
  block-size: 100%;
  transform: rotate(-90deg);
}

.ring circle {
  fill: none;
  stroke-width: 5;
}

.ring__track {
  stroke: var(--surface-2);
}

.ring__fill {
  stroke: var(--accent-fill);
  stroke-linecap: round;
  transition: stroke-dashoffset 500ms ease;
}

.ring__level {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 1.15rem;
}

.player__level {
  font-size: 1.1rem;
}

.player__xp {
  font-size: 0.85rem;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}

.player__streak {
  grid-column: 1 / -1;
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-weight: 700;
  color: var(--accent);
}

@media (min-width: 640px) {
  .player {
    grid-template-columns: auto 1fr auto auto;
  }

  .player__streak {
    grid-column: auto;
  }
}
</style>

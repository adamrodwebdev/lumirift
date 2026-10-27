<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useFormat } from '@/app/useFormat';
import AppIcon from '@/ui/components/AppIcon.vue';
import { GAINS } from '../rules/RaceTuning';
import type { GuardianView } from './useRace';

/**
 * A Guardian in the race (1.34): who joined, its time left, its health, what
 * its blows are worth and how to strike it. Gone when its time is up, at no
 * cost: the card says so.
 */
const props = defineProps<{ guardian: GuardianView }>();

const { t } = useI18n();
const format = useFormat();

const worth = computed(() => ({
  hit: format.number(GAINS.hitMs / 1000),
  beaten: format.number(GAINS.defeatMs / 1000),
  s: format.number(props.guardian.leftS),
}));
</script>

<template>
  <section class="guardian" role="status" :aria-label="t(`race.guardian.joins.${guardian.boss}`)">
    <span class="guardian__icon" aria-hidden="true"><AppIcon name="guardian" :size="20" /></span>
    <div class="guardian__body">
      <p class="guardian__kicker">{{ t('race.guardian.kicker', { s: worth.s }) }}</p>
      <p class="guardian__title">
        <strong>{{ t(`race.guardian.joins.${guardian.boss}`) }}</strong>
        <span class="guardian__left">{{ t('race.guardian.left', { s: worth.s }) }}</span>
      </p>
      <div class="guardian__row">
        <span class="guardian__bar" aria-hidden="true">
          <i :style="{ transform: `scaleX(${guardian.health})` }" />
        </span>
        <span class="guardian__worth">{{ t('race.guardian.worth', worth) }}</span>
      </div>
      <p class="guardian__how">
        {{ t(`race.guardian.how.${guardian.boss}`) }}
        {{ t('race.guardian.detail', worth) }}
      </p>
    </div>
  </section>
</template>

<style scoped>
/*
 * In the counters' row (portrait, a short landscape window), on two lines:
 * who and its time; the bar and its worth. With room, a card that tells more.
 */
.guardian {
  container: guardian / inline-size;
  display: flex;
  align-items: center;
  gap: 0.5em;
  min-width: 0;
  padding: 0.35em 0.6em;
  border: 1px solid var(--danger);
  border-radius: 0.9em;
  background: linear-gradient(
    110deg,
    color-mix(in srgb, var(--danger) 18%, var(--surface)),
    var(--surface-2) 70%
  );
  font-size: var(--hud-size);
  animation: guardian-in 420ms var(--ease-spring) both;
}

@keyframes guardian-in {
  from {
    opacity: 0;
    transform: scale(0.92);
  }
}

.guardian__icon {
  flex: none;
  display: grid;
  place-items: center;
  color: var(--danger);
}

.guardian__body {
  flex: 1;
  min-width: 0;
  display: grid;
  gap: 0.2em;
}

.guardian__body p {
  margin: 0;
}

.guardian__kicker,
.guardian__how {
  display: none;
}

.guardian__title {
  display: flex;
  align-items: baseline;
  gap: 0.4em;
  min-width: 0;
  font-size: 0.875em;
}

.guardian__title strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.guardian__left {
  flex: none;
  color: var(--accent-strong);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.guardian__row {
  display: flex;
  align-items: center;
  gap: 0.5em;
}

.guardian__bar {
  flex: 1;
  height: 0.45em;
  overflow: hidden;
  border-radius: 999px;
  background: var(--surface-edge);
}

.guardian__bar i {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, var(--danger), var(--defeat-glow));
  transform-origin: left;
  transition: transform 240ms var(--ease-out);
}

.guardian__worth {
  flex: none;
  color: var(--accent-strong);
  font-size: 0.875em;
  font-weight: 700;
  white-space: nowrap;
}

/* A landscape screen with room: a card atop the right column that tells more. */
@media (orientation: landscape) and (height >= 30rem) {
  .guardian {
    align-items: flex-start;
    padding: 0.8em;
  }

  .guardian__kicker {
    display: block;
    color: var(--danger);
    font-size: 0.875em;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .guardian__title {
    font-size: 0.95em;
  }

  .guardian__title strong {
    white-space: normal;
    text-wrap: balance;
  }

  .guardian__left,
  .guardian__worth {
    display: none;
  }

  .guardian__how {
    display: block;
    color: var(--text-muted);
    font-size: 0.875em;
    line-height: 1.45;
  }
}

/* A narrow card (a short landscape column): the bar alone, its worth said in its label. */
@container guardian (width < 22em) {
  .guardian__worth {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .guardian {
    animation: none;
  }
}
</style>

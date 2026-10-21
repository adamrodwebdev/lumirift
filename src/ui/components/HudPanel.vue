<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { useFormat } from '@/app/useFormat';
import type { Indicator } from '@/session/GameSession';
import type { BestLine } from '../BestLine';
import AppIcon from './AppIcon.vue';

/** `mainFirst`: the first indicator is the main one (the score), drawn large. */
withDefaults(
  defineProps<{ indicators: readonly Indicator[]; mainFirst?: boolean; best?: BestLine | null }>(),
  { mainFirst: true, best: null },
);

const { t } = useI18n();
const format = useFormat();
</script>

<template>
  <dl
    v-if="indicators.length > 0"
    class="hud"
    :class="{ 'hud--best': best }"
    :aria-label="t('game.stats')"
  >
    <div
      v-for="(item, index) in indicators"
      :key="item.id"
      class="hud__item"
      :class="{ 'hud__item--main': mainFirst && index === 0 }"
    >
      <dt class="hud__label">{{ t(`hud.${item.id}`) }}</dt>
      <dd class="hud__value">{{ format.indicator(item) }}</dd>
    </div>
    <div v-if="best" class="hud__best" :class="{ 'hud__best--beaten': best.beaten }">
      <dt class="hud__label">{{ best.beaten ? t('hud.newBest') : t('hud.best') }}</dt>
      <dd class="hud__best-value">
        <AppIcon name="star" :size="14" />
        {{ best.value === null ? '—' : format.number(best.value) }}
      </dd>
    </div>
  </dl>
</template>

<style scoped>
/* Portrait: a compact row in the band above the well. */
.hud {
  display: flex;
  justify-content: center;
  gap: 0.15rem var(--space-4);
  margin: 0;
}

.hud__item {
  display: grid;
  align-content: end;
  justify-items: center;
  min-width: 2.75rem;
  max-width: 6.5rem;
}

.hud__label {
  font-size: 0.6rem;
  font-weight: 800;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  text-align: center;
}

.hud__value {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.05rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

.hud__item--main .hud__value {
  font-size: clamp(1.5rem, 1.2rem + 1.5vw, 2rem);
  font-weight: 900;
  line-height: 1.05;
  color: var(--accent-strong);
  text-shadow: 0 0 1.5rem rgb(255 160 60 / 0.45);
}

/* The record under the score: small, gold once beaten. */
.hud--best {
  flex-direction: column;
  align-items: center;
  gap: 0.1rem;
}

.hud__best {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
  padding: 0.1rem 0.6rem;
  border-radius: 999px;
}

.hud__best-value {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  margin: 0;
  font-family: var(--font-display);
  font-size: 0.85rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  color: var(--text-muted);
}

.hud__best--beaten {
  background: color-mix(in srgb, var(--accent-fill) 22%, transparent);
  animation: best-beaten 900ms var(--ease-spring);
}

.hud__best--beaten .hud__label,
.hud__best--beaten .hud__best-value {
  color: var(--accent-strong);
}

@keyframes best-beaten {
  0% {
    transform: scale(0.6);
    box-shadow: 0 0 0 0 rgb(255 190 80 / 0.7);
  }
  35% {
    transform: scale(1.25);
  }
  60% {
    transform: scale(0.96);
    box-shadow: 0 0 0 1rem rgb(255 190 80 / 0);
  }
  100% {
    transform: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .hud__best--beaten {
    animation: none;
  }
}

/* Landscape: a column beside the well, the score large. */
@media (orientation: landscape) {
  .hud {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, auto));
    justify-content: start;
    gap: var(--space-2) var(--space-4);
  }

  .hud__item--main,
  .hud__best {
    grid-column: 1 / -1;
  }

  .hud--best {
    align-items: start;
  }

  .hud__best {
    margin-inline-start: -0.6rem;
  }

  .hud__item {
    justify-items: start;
  }

  .hud__label {
    text-align: start;
    letter-spacing: 0.16em;
  }

  .hud__value {
    font-size: 1.15rem;
  }

  .hud__item--main .hud__value {
    font-size: clamp(1.6rem, 1rem + 2.5vh, 3rem);
  }
}

@media (orientation: landscape) and (max-height: 430px) {
  .hud {
    gap: var(--space-1) var(--space-3);
  }

  .hud__label {
    font-size: 0.55rem;
    letter-spacing: 0.1em;
  }

  .hud__value {
    font-size: 0.95rem;
  }

  .hud__item--main .hud__value {
    font-size: 1.5rem;
  }
}
</style>

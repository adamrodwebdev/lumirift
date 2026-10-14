<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { useFormat } from '@/app/useFormat';
import type { Indicator } from '@/session/GameSession';

defineProps<{ indicators: readonly Indicator[] }>();

const { t } = useI18n();
const format = useFormat();
</script>

<template>
  <dl class="hud" :aria-label="t('game.stats')">
    <div
      v-for="(item, index) in indicators"
      :key="item.id"
      class="hud__item"
      :class="{ 'hud__item--main': index === 0 }"
    >
      <dt class="hud__label">{{ t(`hud.${item.id}`) }}</dt>
      <dd class="hud__value">{{ format.indicator(item) }}</dd>
    </div>
  </dl>
</template>

<style scoped>
.hud {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2) var(--space-4);
  margin: 0;
}

.hud__item {
  display: grid;
  min-width: 4.5rem;
}

.hud__label {
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.18em;
}

.hud__value {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.15rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

.hud__item--main .hud__value {
  font-size: clamp(1.5rem, 1.1rem + 2vw, 3rem);
  font-weight: 900;
  color: var(--accent-strong);
  text-shadow: 0 0 1.5rem rgb(255 160 60 / 0.45);
}

/* Small phones: a denser dashboard leaves more height to the well. */
@media (max-width: 479px) {
  .hud {
    gap: var(--space-1) var(--space-3);
  }

  .hud__item {
    min-width: 3.25rem;
  }

  .hud__label {
    font-size: 0.65rem;
  }

  .hud__value {
    font-size: 1rem;
  }

  .hud__item--main .hud__value {
    font-size: 1.5rem;
  }
}

@media (min-width: 1024px) {
  .hud {
    flex-direction: column;
    align-items: var(--hud-align, flex-start);
    gap: var(--space-4);
  }
}
</style>

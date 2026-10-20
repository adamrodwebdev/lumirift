<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { useFormat } from '@/app/useFormat';
import type { Indicator } from '@/session/GameSession';

/** `mainFirst`: the first indicator is the main one (the score), drawn large. */
withDefaults(defineProps<{ indicators: readonly Indicator[]; mainFirst?: boolean }>(), {
  mainFirst: true,
});

const { t } = useI18n();
const format = useFormat();
</script>

<template>
  <dl v-if="indicators.length > 0" class="hud" :aria-label="t('game.stats')">
    <div
      v-for="(item, index) in indicators"
      :key="item.id"
      class="hud__item"
      :class="{ 'hud__item--main': mainFirst && index === 0 }"
    >
      <dt class="hud__label">{{ t(`hud.${item.id}`) }}</dt>
      <dd class="hud__value">{{ format.indicator(item) }}</dd>
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

/* Landscape: a column beside the well, the score large. */
@media (orientation: landscape) {
  .hud {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, auto));
    justify-content: start;
    gap: var(--space-2) var(--space-4);
  }

  .hud__item--main {
    grid-column: 1 / -1;
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

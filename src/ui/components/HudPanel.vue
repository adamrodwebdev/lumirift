<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { useFormat } from '@/app/useFormat';
import type { Indicator } from '@/session/GameSession';
import type { BestLine } from '@/progression/BestLine';
import AppIcon from './AppIcon.vue';

/**
 * `mainFirst`: the first indicator is the main one (the score), drawn large.
 * `urgent`: indicators to show in red (the final seconds of the clock).
 */
withDefaults(
  defineProps<{
    indicators: readonly Indicator[];
    mainFirst?: boolean;
    best?: BestLine | null;
    urgent?: readonly string[];
  }>(),
  { mainFirst: true, best: null, urgent: () => [] },
);

const { t } = useI18n();
const format = useFormat();
</script>

<template>
  <!-- The panel's box: the game screen places it, and may query its width (a container). -->
  <div v-if="indicators.length > 0" class="hud-box">
    <dl class="hud" :class="{ 'hud--best': best }" :aria-label="t('game.stats')">
      <div
        v-for="(item, index) in indicators"
        :key="item.id"
        class="hud__item"
        :class="{
          'hud__item--main': mainFirst && index === 0,
          'hud__item--urgent': urgent.includes(item.id),
        }"
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
  </div>
</template>

<style scoped>
/*
 * Portrait: a compact row in the band above the well. Its gap narrows with
 * the screen (longer words, in Russian, fit at 320 px), and the counters of a
 * busy mode (the Duel's five) take a second row rather than run off the
 * screen. Sizes in `em`: the game screen sets the HUD's size (larger on large
 * screens). Labels never under 14 px, numbers never under 16 px.
 */
.hud {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.35em clamp(0.5em, 5.5vw - 0.5rem, 1em);
  margin: 0;
}

/* A column never narrower than its longest word: a label never spills on the next one. */
.hud__item {
  display: grid;
  align-content: end;
  justify-items: center;
  min-width: max(2.75em, min-content);
  max-width: 7em;
}

.hud__label {
  font-size: 0.875em;
  font-weight: 800;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  text-align: center;
}

/* The narrowest phones: tighter letters, so that five labels still fit side by side. */
@media (max-width: 22.4rem) {
  .hud__label {
    letter-spacing: 0.04em;
  }
}

.hud__value {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.25em;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

.hud__item--main .hud__value {
  font-size: clamp(1.5em, 1.2em + 1.5vw, 2em);
  font-weight: 900;
  line-height: 1.05;
  color: var(--accent-strong);
  text-shadow: 0 0 1.5em rgb(255 160 60 / 0.45);
}

/* The final seconds: the clock in red, beating once a second. */
.hud__item--urgent .hud__value {
  color: var(--danger);
  animation: hud-urgent 1s ease-out infinite;
}

@keyframes hud-urgent {
  from {
    transform: scale(1.25);
  }
  40% {
    transform: none;
  }
}

:global(:root[data-motion='still']) .hud__item--urgent .hud__value {
  animation: none;
}

/* The record under the score: small, gold once beaten. */
.hud--best {
  flex-direction: column;
  align-items: center;
  gap: 0.1em;
}

.hud__best {
  display: flex;
  align-items: baseline;
  gap: 0.5em;
  padding: 0.1em 0.6em;
  border-radius: 999px;
}

.hud__best-value {
  display: inline-flex;
  align-items: center;
  gap: 0.3em;
  margin: 0;
  font-family: var(--font-display);
  font-size: 1em;
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
    gap: 0.5em 1em;
  }

  .hud__item--main,
  .hud__best {
    grid-column: 1 / -1;
  }

  .hud--best {
    align-items: start;
  }

  .hud__best {
    margin-inline-start: -0.6em;
  }

  .hud__item {
    justify-items: start;
  }

  .hud__label {
    text-align: start;
    letter-spacing: 0.1em;
  }

  .hud__value {
    font-size: 1.3em;
  }

  .hud__item--main .hud__value {
    font-size: clamp(1.6em, 1em + 2.5vh, 3em);
  }
}

/* A phone on its side (844 × 390): tighter, the sizes at their floor. */
@media (orientation: landscape) and (height <= 26.875rem) {
  .hud {
    gap: 0.25em 0.75em;
  }

  .hud__label {
    letter-spacing: 0.06em;
  }

  .hud__value {
    font-size: 1.125em;
  }

  .hud__item--main .hud__value {
    font-size: 1.5em;
  }
}

/*
 * A busy mode (three counters or more: the Sand's, the Duel's five) in a
 * narrow panel: each counter on one line, its label before its number, so
 * that long names (« Prochain coup de vent ») share two rows at most on the
 * smallest phone and leave the well its room; beside the well, a list.
 */
@container hud (inline-size < 26em) {
  .hud:has(> .hud__item:nth-child(3)) {
    grid-template-columns: minmax(0, 1fr);
    gap: 0.25em 0.9em;
  }

  .hud:has(> .hud__item:nth-child(3)) .hud__item {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    column-gap: 0.35em;
    max-width: none;
  }

  .hud:has(> .hud__item:nth-child(3)) .hud__value {
    font-size: 1.125em;
  }
}

/* A narrow column beside the well (a small window): one counter under the other. */
@container hud (inline-size < 8.5em) {
  .hud {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>

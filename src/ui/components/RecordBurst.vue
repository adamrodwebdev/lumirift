<script setup lang="ts">
import { useI18n } from 'vue-i18n';

/**
 * The player's record just fell, during the game: a gold banner bursts over
 * the board with a ring of sparks, then flies up and fades. Decorative (the
 * news is also announced to screen readers by the game screen) and never in
 * the way of a tap.
 */
const { t } = useI18n();
const SPARKS = 12;
</script>

<template>
  <div class="record-burst" aria-hidden="true">
    <span
      v-for="index in SPARKS"
      :key="index"
      class="record-burst__spark"
      :style="{ '--angle': `${(index * 360) / SPARKS}deg` }"
    />
    <p class="record-burst__text">{{ t('hud.newBest') }}</p>
  </div>
</template>

<style scoped>
.record-burst {
  position: absolute;
  inset: 0;
  z-index: 4;
  display: grid;
  place-items: center;
  pointer-events: none;
}

.record-burst__text {
  grid-area: 1 / 1;
  margin: 0;
  padding: 0.5rem 1.4rem;
  border-radius: 999px;
  background: var(--accent-gradient);
  color: var(--on-accent-fill);
  font-family: var(--font-display);
  font-size: clamp(1.2rem, 0.9rem + 2vw, 2rem);
  font-weight: 900;
  letter-spacing: 0.02em;
  white-space: nowrap;
  box-shadow:
    0 0.6rem 2rem rgb(255 160 60 / 0.45),
    0 0 0 0.3rem rgb(255 220 150 / 0.25);
  animation: record-banner 1700ms var(--ease-spring) forwards;
}

.record-burst__spark {
  grid-area: 1 / 1;
  width: 0.5rem;
  height: 1.4rem;
  border-radius: 999px;
  background: linear-gradient(var(--accent-strong), transparent);
  transform: rotate(var(--angle)) translateY(0);
  opacity: 0;
  animation: record-spark 750ms ease-out 80ms forwards;
}

@keyframes record-banner {
  0% {
    transform: scale(0.3);
    opacity: 0;
  }
  18% {
    transform: scale(1.15);
    opacity: 1;
  }
  28% {
    transform: scale(1);
  }
  78% {
    transform: translateY(0) scale(1);
    opacity: 1;
  }
  100% {
    transform: translateY(-3rem) scale(0.9);
    opacity: 0;
  }
}

@keyframes record-spark {
  0% {
    transform: rotate(var(--angle)) translateY(-1rem) scaleY(0.4);
    opacity: 1;
  }
  100% {
    transform: rotate(var(--angle)) translateY(-7rem) scaleY(1);
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .record-burst__text {
    animation: record-banner-calm 1700ms linear forwards;
  }

  .record-burst__spark {
    display: none;
  }

  @keyframes record-banner-calm {
    0%,
    85% {
      opacity: 1;
    }
    100% {
      opacity: 0;
    }
  }
}
</style>

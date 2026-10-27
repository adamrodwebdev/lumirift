<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useFormat } from '@/app/useFormat';
import type { TimeReason } from '../RaceSession';
import { URGENT_MS, type TimeGain } from './useRace';

/**
 * The race's clock (1.34): a ring that empties, the time left in its middle,
 * red in the final seconds; the gains float beside it, and the cap is said
 * where there is room (landscape).
 */
const props = defineProps<{
  leftMs: number;
  capMs: number;
  gains: readonly TimeGain[];
}>();

const { t } = useI18n();
const format = useFormat();

/** The ring's length (r = 43 in a 100 box). */
const RING = 2 * Math.PI * 43;

/** The words of each gain; a clear in a combo names it. */
const GAIN_KEYS: Readonly<Record<TimeReason, string>> = {
  clear: 'race.gain.clear',
  hit: 'race.gain.hit',
  defeat: 'race.gain.defeat',
  shift: 'race.gain.shift',
  overflow: 'race.gain.overflow',
};

/** A countdown shows the second it is in: 0:00 only when the time is out. */
const shown = computed(() => format.duration(Math.ceil(props.leftMs / 1000) * 1000));
const urgent = computed(() => props.leftMs > 0 && props.leftMs <= URGENT_MS);
const arc = computed(
  () => `${(RING * Math.min(1, props.leftMs / props.capMs)).toFixed(1)} ${RING}`,
);
const label = computed(() =>
  t('race.clock', { time: shown.value, cap: format.number(props.capMs / 1000) }),
);

const words = (gain: TimeGain): string => {
  const s = format.number(Math.abs(gain.ms) / 1000);
  return gain.reason === 'clear' && gain.combo > 0
    ? t('race.gain.combo', { s, n: gain.combo + 1 })
    : t(GAIN_KEYS[gain.reason], { s });
};
</script>

<template>
  <div class="clock" :class="{ 'clock--urgent': urgent }">
    <div class="clock__ring" role="timer" :aria-label="label">
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle class="clock__track" cx="50" cy="50" r="43" />
        <circle
          v-if="leftMs > 0"
          class="clock__arc"
          cx="50"
          cy="50"
          r="43"
          :stroke-dasharray="arc"
          transform="rotate(-90 50 50)"
        />
      </svg>
      <span class="clock__time" aria-hidden="true">{{ shown }}</span>
    </div>
    <div class="clock__side" aria-hidden="true">
      <ul class="clock__gains">
        <li
          v-for="gain in gains"
          :key="gain.id"
          class="gain"
          :class="{ 'gain--loss': gain.ms < 0, 'gain--big': gain.reason === 'defeat' }"
        >
          {{ words(gain) }}
          <span v-if="gain.points > 0" class="gain__points">
            {{ t('race.gain.points', { n: format.number(gain.points) }) }}
          </span>
        </li>
      </ul>
      <p class="clock__cap">{{ t('race.cap', { n: format.number(capMs / 1000) }) }}</p>
    </div>
  </div>
</template>

<style scoped>
/* In the game screen's top band (portrait) or atop its left column (landscape). */
.clock {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.6em;
  font-size: var(--hud-size);
}

.clock__ring {
  position: relative;
  flex: none;
  width: 4.6em;
  aspect-ratio: 1;
  max-width: 100%;
}

.clock__ring svg {
  display: block;
  width: 100%;
  height: 100%;
}

.clock__track {
  fill: var(--surface);
  stroke: var(--surface-2);
  stroke-width: 8;
}

.clock__arc {
  fill: none;
  stroke: var(--accent);
  stroke-width: 8;
  stroke-linecap: round;
  filter: drop-shadow(0 0 0.25em color-mix(in srgb, var(--rift-glow) 60%, transparent));
}

.clock__time {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-family: var(--font-display);
  font-size: 1.2em;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

/* The final seconds: the ring and the time turn red and beat. */
.clock--urgent .clock__arc {
  stroke: var(--danger);
}

.clock--urgent .clock__time {
  color: var(--danger);
  animation: clock-beat 1s ease-in-out infinite;
}

@keyframes clock-beat {
  50% {
    transform: scale(1.12);
  }
}

/* Portrait: the gains float to the right of the ring, over the band; the cap is in its label. */
.clock__side {
  position: absolute;
  left: 100%;
  top: 0;
  width: max-content;
  /* Between the ring and the sound button of a phone. */
  max-width: 6.5em;
  pointer-events: none;
}

.clock__gains {
  display: grid;
  gap: 0.1em;
  margin: 0;
  padding: 0;
  list-style: none;
}

.gain {
  font-family: var(--font-display);
  font-size: 0.875em;
  font-weight: 800;
  color: var(--accent-strong);
  text-shadow: 0 0 0.8em color-mix(in srgb, var(--rift-glow) 70%, transparent);
  animation: gain-rise 1.6s var(--ease-out) both;
}

.gain--big {
  font-size: 1em;
}

.gain--loss {
  color: var(--danger);
  text-shadow: none;
}

.gain__points {
  margin-left: 0.3em;
  color: var(--text);
  font-size: 1em;
}

@keyframes gain-rise {
  from {
    opacity: 0;
    transform: translateY(0.6em);
  }

  20% {
    opacity: 1;
  }

  70% {
    opacity: 1;
  }

  to {
    opacity: 0;
    transform: translateY(-0.6em);
  }
}

.clock__cap {
  display: none;
  margin: 0.2em 0 0;
  color: var(--text-muted);
  font-size: 0.875em;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

/* Landscape: a larger ring, the gains and the cap beside it in the column. */
@media (orientation: landscape) {
  .clock__ring {
    width: 5.6em;
  }

  .clock__side {
    position: static;
    min-width: 0;
    max-width: 9em;
  }

  .clock__cap {
    display: block;
  }
}

@media (orientation: landscape) and (height < 30rem) {
  .clock__ring {
    width: 4em;
  }
}

@media (prefers-reduced-motion: reduce) {
  .clock--urgent .clock__time,
  .gain {
    animation: none;
  }
}

:global(:root[data-motion='still']) .clock--urgent .clock__time,
:global(:root[data-motion='still']) .gain {
  animation: none;
}
</style>

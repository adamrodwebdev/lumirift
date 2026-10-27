<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useFormat } from '@/app/useFormat';
import type { RaceEventMap, RaceStage, RaceWarning } from '../RaceSession';

/**
 * The race's moments over the well (1.34): the shift announced (the next
 * world, its rule, a speed-up, a Guardian, the lines that count double, the
 * count), the Rift's tear across the board while it is wiped, and the last
 * hurrah at 0:00. Never in the way of the player's input.
 */
const props = defineProps<{
  stage: RaceStage;
  warning: RaceWarning | null;
  /** Whole seconds before the shift: the warning's count. */
  shiftInS: number;
  /** Counts the wipes: each one tears the board again. */
  wipes: number;
  hurrah: RaceEventMap['hurrah'] | null;
}>();

const { t } = useI18n();
const format = useFormat();

const announced = computed(() => (props.stage === 'play' ? props.warning : null));
const count = computed(() => Math.max(1, props.shiftInS));
</script>

<template>
  <div class="moments" aria-hidden="true">
    <Transition name="shift">
      <div v-if="announced" class="shift" :data-world="announced.next">
        <p class="shift__kicker">{{ t('race.shifts') }}</p>
        <p class="shift__world">{{ t(`race.world.${announced.next}`) }}</p>
        <p class="shift__rule">{{ t(`race.rule.${announced.next}`) }}</p>
        <p class="shift__chips">
          <span v-if="announced.speedUp" class="chip chip--hot">{{ t('race.speedUp') }}</span>
          <span v-if="announced.guardian" class="chip chip--guardian">
            {{ t(`race.guardian.joins.${announced.guardian}`) }}
          </span>
          <span class="chip">{{ t('race.double') }}</span>
        </p>
        <span :key="count" class="shift__count">{{ format.number(count) }}</span>
      </div>
    </Transition>

    <div v-if="stage === 'wipe'" :key="wipes" class="tear">
      <svg viewBox="0 0 40 200" preserveAspectRatio="none">
        <path class="tear__glow" d="M20 0L28 30 18 58 30 90 22 120 33 152 24 176 30 200" />
        <path class="tear__core" d="M20 0L28 30 18 58 30 90 22 120 33 152 24 176 30 200" />
      </svg>
    </div>

    <div v-if="stage === 'hurrah' && hurrah" class="hurrah">
      <p class="hurrah__time">{{ t('race.hurrah') }}</p>
      <p v-if="hurrah.points > 0" class="hurrah__points">
        {{ t('race.hurrahPoints', { n: format.number(hurrah.points) }) }}
      </p>
    </div>
  </div>
</template>

<style scoped>
/* Over the well, never taking its input. */
.moments {
  grid-area: well;
  position: relative;
  z-index: 1;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  pointer-events: none;
  font-size: var(--hud-size);
}

/* The shift announced: a card in the upper part of the well, the board still in play under it. */
.shift {
  --world: var(--jewel-violet);
  position: absolute;
  inset: 12% 0.5em auto;
  display: grid;
  justify-items: center;
  gap: 0.25em;
  margin-inline: auto;
  max-width: 20em;
  padding: 0.8em 0.7em;
  border: 1px solid var(--world);
  border-radius: 1.1em;
  background: color-mix(in srgb, var(--bg) 84%, transparent);
  box-shadow: 0 0 2.5em color-mix(in srgb, var(--world) 35%, transparent);
  text-align: center;
}

.shift[data-world='sand'] {
  --world: var(--jewel-amber);
}

.shift[data-world='tower'] {
  --world: var(--jewel-cyan);
}

.shift p {
  margin: 0;
}

.shift__kicker {
  color: var(--world);
  font-size: 0.875em;
  font-weight: 800;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.shift__world {
  font-family: var(--font-display);
  font-size: 2.2em;
  font-weight: 800;
  line-height: 1.05;
  text-transform: uppercase;
  background: linear-gradient(
    90deg,
    var(--jewel-rose),
    var(--tone-9),
    var(--world),
    var(--jewel-violet)
  );
  background-clip: text;
  -webkit-background-clip: text;
  color: transparent;
}

.shift__rule {
  color: var(--text-muted);
  font-size: 0.875em;
  text-wrap: balance;
}

.shift__chips {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.35em;
  margin-top: 0.2em;
}

.chip {
  padding: 0.15em 0.6em;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface-2);
  font-size: 0.875em;
  font-weight: 700;
}

.chip--hot {
  border-color: var(--accent-fill);
  background: color-mix(in srgb, var(--accent-fill) 22%, var(--surface));
  color: var(--accent-strong);
}

.chip--guardian {
  border-color: var(--danger);
  background: color-mix(in srgb, var(--danger) 18%, var(--surface));
}

.shift__count {
  display: grid;
  place-items: center;
  width: 2.4em;
  aspect-ratio: 1;
  margin-top: 0.25em;
  border: 3px solid var(--world);
  border-radius: 50%;
  font-family: var(--font-display);
  font-size: 1.1em;
  font-weight: 800;
  animation: count-pop 1s var(--ease-out);
}

@keyframes count-pop {
  from {
    transform: scale(1.35);
  }
}

.shift-enter-active {
  animation: shift-in 320ms var(--ease-spring);
}

.shift-leave-active {
  transition: opacity 200ms ease;
}

.shift-leave-to {
  opacity: 0;
}

@keyframes shift-in {
  from {
    opacity: 0;
    transform: translateY(-1em) scale(0.9);
  }
}

/* The wipe: the Rift tears across the board, from one wall to the other, in a second. */
.tear {
  position: absolute;
  inset: 0;
  width: 12%;
  animation: tear-across 1s cubic-bezier(0.5, 0, 0.3, 1) both;
}

.tear svg {
  width: 100%;
  height: 100%;
  overflow: visible;
}

.tear path {
  fill: none;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
}

.tear__glow {
  stroke: var(--rift-glow);
  stroke-width: 18;
  stroke-opacity: 0.4;
}

.tear__core {
  stroke: var(--rift-core);
  stroke-width: 3;
}

@keyframes tear-across {
  from {
    transform: translateX(-100%);
  }

  to {
    transform: translateX(830%);
  }
}

/* 0:00: the last hurrah scores the board. */
.hurrah {
  position: absolute;
  inset: 0;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 0.3em;
  text-align: center;
}

.hurrah p {
  margin: 0;
}

.hurrah__time {
  font-family: var(--font-display);
  font-size: 3em;
  font-weight: 800;
  color: var(--accent-strong);
  text-shadow: 0 0 1em var(--rift-glow);
  text-transform: uppercase;
  animation: hurrah-in 520ms var(--ease-spring) both;
}

.hurrah__points {
  padding: 0.2em 0.8em;
  border-radius: 999px;
  background: color-mix(in srgb, var(--bg) 80%, transparent);
  font-weight: 800;
  animation: hurrah-in 520ms var(--ease-spring) 200ms both;
}

@keyframes hurrah-in {
  from {
    opacity: 0;
    transform: scale(0.5);
  }
}

@media (prefers-reduced-motion: reduce) {
  .shift__count,
  .shift-enter-active,
  .hurrah__time,
  .hurrah__points {
    animation: none;
  }

  /* The tear stays in the middle of the board instead of crossing it. */
  .tear {
    left: 44%;
    animation: none;
  }
}
</style>

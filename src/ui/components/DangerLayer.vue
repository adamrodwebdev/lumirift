<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import type { EffectsLevel } from '@/fx/EffectsProfile';
import { useWellBox } from './useWellBox';
import { REVEAL, splitCrack, wellCracks } from './wellCracks';

/**
 * The danger of a game, over its screen (1.19): as the stack rises, the rift
 * splits the well's glass with golden cracks and a violet-red vignette closes
 * in from the edges; a close call flashes the cracks gold, the relief heals
 * them, a defeat breaks the well. The effect level sets how much of it shows:
 * a calmer version without motion, or, with no effects, a still red frame.
 */
const props = defineProps<{
  /** How much danger to show, 0 to 1. */
  amount: number;
  level: EffectsLevel;
  /** The well's canvas, which the cracks cover. */
  well: HTMLElement | null;
  /** Bumped on each close call: a golden flash. */
  flash: number;
  /** Bumped on each relief: the cracks heal. */
  relief: number;
  /** The game is lost to the stack: the rift breaks the well. */
  broken: boolean;
}>();

const layer = ref<HTMLElement | null>(null);
const { box, boxStyle } = useWellBox(() => props.well, layer);
const cracks = computed(() => (box.value ? wellCracks(box.value.width, box.value.height) : []));
const split = computed(() => (box.value ? splitCrack(box.value.width, box.value.height) : null));
/** How much of a crack shows: it grows with the danger; a broken well shows them all. */
const reveal = (from: number) =>
  props.broken ? 1 : Math.min(1, Math.max(0, (props.amount - from) / REVEAL));
const visible = computed(() =>
  cracks.value
    .map((crack) => ({ ...crack, shown: reveal(crack.from) }))
    .filter((crack) => crack.shown > 0),
);

/** The wide vignette comes first, the close one when the danger is high. */
const calm = computed(() => (props.level === 'full' ? 1 : 0.7));
const wide = computed(() => (props.broken ? 1 : Math.min(1, props.amount * 1.6)) * calm.value);
const close = computed(
  () => (props.broken ? 1 : Math.min(1, Math.max(0, (props.amount - 0.45) / 0.55))) * calm.value,
);

/** A moment that plays its animation again each time (only with every effect on). */
const moment = (source: () => number, ms: number) => {
  const on = ref(false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  watch(source, () => {
    if (props.level !== 'full') return;
    on.value = false;
    clearTimeout(timer);
    requestAnimationFrame(() => {
      on.value = true;
      timer = setTimeout(() => (on.value = false), ms);
    });
  });
  onBeforeUnmount(() => clearTimeout(timer));
  return on;
};
const flashing = moment(() => props.flash, 480);
const healing = moment(() => props.relief, 800);
</script>

<template>
  <div
    ref="layer"
    class="danger"
    :class="[
      `danger--${level}`,
      { 'danger--broken': broken, 'danger--flash': flashing, 'danger--heal': healing },
    ]"
    aria-hidden="true"
  >
    <template v-if="level !== 'off'">
      <div class="danger__vignette danger__vignette--wide" :style="{ opacity: wide }" />
      <div class="danger__vignette danger__vignette--close" :style="{ opacity: close }" />
      <svg
        v-if="box"
        class="danger__cracks"
        :style="boxStyle"
        :viewBox="`0 0 ${box.width} ${box.height}`"
      >
        <g class="danger__glow">
          <path
            v-for="(crack, i) in visible"
            :key="`g${i}`"
            :d="crack.d"
            :stroke-dasharray="crack.length"
            :stroke-dashoffset="crack.length * (1 - crack.shown)"
          />
        </g>
        <g class="danger__core">
          <path
            v-for="(crack, i) in visible"
            :key="`c${i}`"
            :d="crack.d"
            :stroke-dasharray="crack.length"
            :stroke-dashoffset="crack.length * (1 - crack.shown)"
          />
        </g>
        <g v-if="broken && split" class="danger__split">
          <path class="danger__split-glow" :d="split.d" />
          <path class="danger__split-core" :d="split.d" />
        </g>
        <rect v-if="flashing" class="danger__flash" width="100%" height="100%" />
      </svg>
    </template>
    <div v-else-if="box && (amount > 0.05 || broken)" class="danger__frame" :style="boxStyle" />
  </div>
</template>

<style scoped>
/* Over the stage and its well, under the words of a clear and the windows. */
.danger {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.danger__vignette {
  position: absolute;
  inset: 0;
  transition: opacity 220ms linear;
}

.danger__vignette--wide {
  background: radial-gradient(
    ellipse 78% 72% at 50% 50%,
    transparent 58%,
    var(--danger-vignette) 100%
  );
}

.danger__vignette--close {
  background: radial-gradient(
    ellipse 62% 58% at 50% 50%,
    transparent 38%,
    var(--danger-vignette-deep) 100%
  );
}

/* With every effect on, the close vignette throbs like a pulse. */
.danger--full .danger__vignette--close {
  animation: danger-throb 620ms ease-in-out infinite alternate;
}

.danger__cracks {
  position: absolute;
  overflow: visible;
}

.danger__cracks path {
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
  transition: stroke-dashoffset 260ms ease-out;
}

/* Golden light leaking through the glass, around a white-hot core. */
.danger__glow path {
  stroke: var(--rift-glow);
  stroke-width: 7;
  stroke-opacity: 0.3;
}

.danger__core path {
  stroke: var(--rift-core);
  stroke-width: 1.6;
}

.danger--full .danger__glow {
  animation: danger-leak 1.4s ease-in-out infinite alternate;
}

/* A close call: the cracks blaze with light, the well flashes (light added, never a veil). */
.danger--flash .danger__glow path {
  stroke: var(--fx-gold-light);
  stroke-width: 9;
  stroke-opacity: 0.7;
}

.danger--flash .danger__core path {
  stroke-width: 2.4;
}

.danger__flash {
  fill: var(--fx-gold-light);
  mix-blend-mode: screen;
  animation: danger-flash 420ms ease-out both;
}

/* The relief: a last golden glow while the cracks close. */
.danger--heal .danger__glow {
  animation: danger-heal 800ms ease-out both;
}

/* The defeat: a crack splits the well from rim to floor. */
.danger__split-glow {
  stroke: var(--rift-glow);
  stroke-width: 16;
  stroke-opacity: 0.45;
}

.danger__split-core {
  stroke: var(--rift-core);
  stroke-width: 3;
}

.danger--full .danger__split path {
  stroke-dasharray: 2000;
  animation: danger-split 300ms ease-out both;
}

/* No effects: a still red frame tells the danger. */
.danger__frame {
  position: absolute;
  border: 2px solid var(--danger);
  border-radius: var(--radius-sm);
  opacity: 0.85;
}

@keyframes danger-throb {
  from {
    opacity: 0.75;
  }
}

@keyframes danger-leak {
  to {
    opacity: 0.55;
  }
}

@keyframes danger-flash {
  from {
    opacity: 0.32;
  }
  to {
    opacity: 0;
  }
}

@keyframes danger-heal {
  30% {
    opacity: 1;
    filter: brightness(1.8);
  }
  to {
    opacity: 0;
  }
}

@keyframes danger-split {
  from {
    stroke-dashoffset: 2000;
  }
  to {
    stroke-dashoffset: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .danger__vignette,
  .danger__cracks path {
    transition: none;
  }

  .danger--full .danger__vignette--close,
  .danger--full .danger__glow,
  .danger--full .danger__split path {
    animation: none;
  }
}
</style>

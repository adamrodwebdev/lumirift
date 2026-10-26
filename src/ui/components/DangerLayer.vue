<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import type { EffectsLevel } from '@/fx/EffectsProfile';
import { useWellBox } from './useWellBox';
import { REVEAL, wellCracks } from './wellCracks';
import type { AmbianceId } from '@/progression/Cosmetics';
import DefeatMatter from './DefeatMatter.vue';
import WellShatter from './WellShatter.vue';

/**
 * The danger of a game, over its screen (1.19): as the stack rises, the rift
 * splits the well's glass with golden cracks and a violet-red vignette closes
 * in from the edges; a close call flashes the cracks gold, the relief heals
 * them, a defeat shatters the glass while the vignette, crimson, beats the
 * game's last heartbeats (1.31). The effect level sets how much of it shows:
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
  /** The ambiance worn: a defeat breaks the stack into its matter. */
  ambiance: AmbianceId;
}>();

const layer = ref<HTMLElement | null>(null);
const { box, boxStyle } = useWellBox(() => props.well, layer);
const cracks = computed(() => (box.value ? wellCracks(box.value.width, box.value.height) : []));
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
      {
        'danger--deep': close > 0,
        'danger--broken': broken,
        'danger--flash': flashing,
        'danger--heal': healing,
      },
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
        <rect v-if="flashing" class="danger__flash" width="100%" height="100%" />
      </svg>
      <WellShatter v-if="broken && box" :box="box" :level="level" />
      <DefeatMatter v-if="broken && box" :box="box" :level="level" :ambiance="ambiance" />
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

.danger__vignette--close::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(
    ellipse 62% 58% at 50% 50%,
    transparent 38%,
    var(--danger-vignette-deep) 100%
  );
}

/*
 * With every effect on, the close vignette throbs like a pulse while the
 * danger shows it, and stops with the game. The beat is on its inner layer,
 * from 75 % to all of it: the vignette's own opacity, the danger, scales it.
 * (On the vignette itself, the beat would replace the danger: from 0.75 to
 * 0, a red pulse in a calm game.)
 */
.danger--full.danger--deep:not(.danger--broken) .danger__vignette--close::before {
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

/*
 * The defeat (1.31): the golden cracks give way to the broken glass
 * (WellShatter); the close vignette turns crimson and beats the game's last
 * heartbeats, a slam then slower and slower, fading, so that only Play
 * again keeps beating.
 */
.danger--broken .danger__cracks {
  opacity: 0;
  transition: opacity 200ms ease-out;
}

.danger--broken .danger__vignette--close::before {
  background: radial-gradient(
    ellipse 74% 62% at 50% 40%,
    transparent 32%,
    var(--defeat-vignette-mid) 70%,
    var(--defeat-vignette) 100%
  );
}

.danger--full.danger--broken .danger__vignette--close::before {
  animation: danger-last-beats 3s ease-in-out both;
}

.danger--reduced.danger--broken .danger__vignette--close::before {
  animation: danger-last-beat 1.2s ease-out both;
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
  to {
    opacity: 1;
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

/* A slam, then lub-dub beats that slow and fade (the same as the broken glass's light). */
@keyframes danger-last-beats {
  0% {
    opacity: 0.55;
  }
  3% {
    opacity: 1;
  }
  10% {
    opacity: 0.62;
  }
  13% {
    opacity: 0.8;
  }
  23% {
    opacity: 0.5;
  }
  29% {
    opacity: 0.92;
  }
  34% {
    opacity: 0.6;
  }
  37% {
    opacity: 0.74;
  }
  48% {
    opacity: 0.46;
  }
  55% {
    opacity: 0.76;
  }
  61% {
    opacity: 0.5;
  }
  64% {
    opacity: 0.58;
  }
  77% {
    opacity: 0.4;
  }
  85% {
    opacity: 0.52;
  }
  92% {
    opacity: 0.4;
  }
  to {
    opacity: 0.34;
  }
}

/* Calmer effects: one beat, then a steady glow. */
@keyframes danger-last-beat {
  0% {
    opacity: 0.4;
  }
  25% {
    opacity: 0.85;
  }
  to {
    opacity: 0.45;
  }
}

@media (prefers-reduced-motion: reduce) {
  .danger__vignette,
  .danger__cracks path {
    transition: none;
  }

  .danger--full .danger__vignette--close::before,
  .danger--full .danger__glow,
  .danger--full.danger--broken .danger__vignette--close::before {
    animation: none;
  }
}
</style>

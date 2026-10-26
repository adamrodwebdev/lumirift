<script setup lang="ts">
import { computed } from 'vue';
import type { EffectsLevel } from '@/fx/EffectsProfile';
import type { Box } from './useWellBox';
import { SHATTER_FALL_MS, wellShatter, type ShatterCrack, type ShatterPane } from './wellShatter';

/**
 * The well's glass breaking at a defeat (1.31): a white-hot flash where the
 * last piece hit, red-hot cracks running out from it, and with every effect
 * on, the panes near the impact bursting out and falling while the rest of
 * the glass stays cracked, its light beating with the game's last
 * heartbeats. Calmer effects keep the cracks, still.
 */
const props = defineProps<{ box: Box; level: EffectsLevel }>();

const shatter = computed(() => wellShatter(props.box.width, props.box.height));
const inner = computed(() => shatter.value.cracks.filter((crack) => crack.inner));
const edge = computed(() => shatter.value.cracks.filter((crack) => !crack.inner));
/** Only every effect on lets the glass fall. */
const falls = computed(() => props.level === 'full');

const place = computed(() => ({
  left: `${props.box.left}px`,
  top: `${props.box.top}px`,
  width: `${props.box.width}px`,
  height: `${props.box.height}px`,
  '--fall-at': `${SHATTER_FALL_MS}ms`,
}));

const crackStyle = (crack: ShatterCrack) => ({
  '--length': crack.length,
  '--delay': `${crack.delayMs}ms`,
  '--run': `${crack.runMs}ms`,
});

const paneStyle = (pane: ShatterPane) => ({
  left: `${pane.left}px`,
  top: `${pane.top}px`,
  width: `${pane.width}px`,
  height: `${pane.height}px`,
  clipPath: `polygon(${pane.outline})`,
  transformOrigin: `${pane.originX}px ${pane.originY}px`,
  '--burst-x': `${pane.burstX}px`,
  '--burst-y': `${pane.burstY}px`,
  '--drift-x': `${pane.driftX}px`,
  '--fall': `${pane.fall}px`,
  '--spin': `${pane.spin}deg`,
  '--delay': `${pane.delayMs}ms`,
  '--fall-ms': `${pane.fallMs}ms`,
  '--sheen': `${pane.sheen}deg`,
});
</script>

<template>
  <div class="shatter" :class="`shatter--${level}`" :style="place">
    <div
      v-if="falls"
      class="shatter__impact"
      :style="{ left: `${shatter.impact.x}px`, top: `${shatter.impact.y}px` }"
    />
    <svg class="shatter__cracks" :viewBox="`0 0 ${box.width} ${box.height}`">
      <g class="shatter__glass shatter__glass--inner">
        <g v-for="(crack, i) in inner" :key="i" class="shatter__crack" :style="crackStyle(crack)">
          <path class="shatter__glow" :d="crack.d" />
          <path class="shatter__core" :d="crack.d" />
        </g>
      </g>
      <g class="shatter__glass shatter__glass--edge">
        <g v-for="(crack, i) in edge" :key="i" class="shatter__crack" :style="crackStyle(crack)">
          <path class="shatter__glow" :d="crack.d" />
          <path class="shatter__core" :d="crack.d" />
        </g>
      </g>
    </svg>
    <template v-if="falls">
      <span
        v-for="(pane, i) in shatter.panes"
        :key="i"
        class="shatter__pane"
        :style="paneStyle(pane)"
      >
        <span class="shatter__pane-glass" :style="{ clipPath: `polygon(${pane.glass})` }" />
      </span>
    </template>
  </div>
</template>

<style scoped>
.shatter {
  position: absolute;
  pointer-events: none;
}

/* The flash where the last piece hit: light added, gone in a third of a second. */
.shatter__impact {
  position: absolute;
  width: 20rem;
  height: 20rem;
  border-radius: 50%;
  background: radial-gradient(
    closest-side,
    color-mix(in srgb, var(--rift-core) 95%, transparent),
    color-mix(in srgb, var(--rift-glow) 50%, transparent) 45%,
    transparent
  );
  mix-blend-mode: screen;
  opacity: 0;
  translate: -50% -50%;
  animation: shatter-impact 320ms ease-out both;
}

.shatter__cracks {
  position: absolute;
  inset: 0;
  overflow: visible;
}

.shatter__crack path {
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-dasharray: var(--length);
  stroke-dashoffset: var(--length);
  animation: shatter-run var(--run) linear var(--delay) forwards;
}

/* Red-hot: a white core in a crimson glow, the danger's red turned to fire. */
.shatter__glow {
  stroke: var(--defeat-glow);
  stroke-width: 8;
  stroke-opacity: 0.45;
}

.shatter__core {
  stroke: var(--rift-core);
  stroke-width: 1.8;
}

/* The glass near the impact goes with its panes; the rest beats its last. */
.shatter--full .shatter__glass--inner {
  animation: shatter-gone 100ms linear var(--fall-at) forwards;
}

.shatter--full .shatter__glass--edge {
  animation: shatter-beats 3s ease-in-out both;
}

/* A pane: its rim of light, its glass, a glint as it turns; out, spun, then down. */
.shatter__pane {
  position: absolute;
  background: color-mix(in srgb, var(--rift-core) 90%, transparent);
  opacity: 0;
  animation: shatter-fall var(--fall-ms) linear var(--delay) both;
}

.shatter__pane-glass {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    var(--sheen),
    rgb(255 226 232 / 0.36),
    rgb(255 255 255 / 0.05) 46%,
    color-mix(in srgb, var(--defeat-glow) 26%, transparent)
  );
}

.shatter__pane-glass::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(115deg, transparent 30%, rgb(255 255 255 / 0.9) 48%, transparent 66%);
  opacity: 0;
  animation: shatter-glint 500ms ease-out calc(var(--delay) + 140ms) both;
}

/* Calmer effects: the cracks are there at once, still; nothing falls. */
.shatter--reduced .shatter__crack path {
  stroke-dashoffset: 0;
  animation: none;
}

.shatter--reduced .shatter__cracks {
  animation: shatter-show 200ms ease-out both;
}

@keyframes shatter-impact {
  12% {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
}

@keyframes shatter-run {
  to {
    stroke-dashoffset: 0;
  }
}

@keyframes shatter-gone {
  to {
    opacity: 0;
  }
}

@keyframes shatter-show {
  from {
    opacity: 0;
  }
}

/* The last heartbeats: a slam, then lub-dub beats that slow and fade (3 s). */
@keyframes shatter-beats {
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

/* Out of the impact, then spun down past the floor; it fades at the very end. */
@keyframes shatter-fall {
  0% {
    opacity: 0;
    transform: translate(0, 0) rotate(0deg);
  }
  1% {
    opacity: 1;
    transform: translate(0, 0) rotate(0deg);
    animation-timing-function: cubic-bezier(0.2, 0.8, 0.4, 1);
  }
  9% {
    transform: translate(var(--burst-x), var(--burst-y)) rotate(calc(var(--spin) * 0.08));
    animation-timing-function: cubic-bezier(0.5, 0, 0.9, 0.55);
  }
  82% {
    opacity: 1;
  }
  to {
    opacity: 0;
    transform: translate(calc(var(--burst-x) + var(--drift-x)), var(--fall)) rotate(var(--spin));
  }
}

@keyframes shatter-glint {
  40% {
    opacity: 0.9;
  }
  to {
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .shatter__impact,
  .shatter__pane {
    display: none;
  }

  .shatter__crack path {
    stroke-dashoffset: 0;
    animation: none;
  }

  .shatter--full .shatter__glass--inner,
  .shatter--full .shatter__glass--edge {
    animation: none;
  }
}
</style>

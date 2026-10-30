<script setup lang="ts" generic="Spec">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

/**
 * The coming pieces in the rift (1.43, lot 29): above the well, the next one
 * large at the middle, over the place where it will appear, the others smaller
 * and dimmer on its right, each coming out of the rift in turn. Lumirift's own
 * way to show what comes, in place of a box beside the well. The band is as
 * wide as the well (`--well-width`, set by the stage), never narrower than its
 * pieces need; each stage draws its pieces (its own preview, `wide`) in the
 * slot, at the size given.
 */
const props = defineProps<{
  queue: readonly Spec[];
  /** The width of the next piece's box, in CSS pixels; the others are smaller. */
  size: number;
}>();
defineSlots<{ default(props: { spec: Spec; size: number }): unknown }>();

/** Each coming piece's size, as a share of the next one's, in their order. */
const SHARES = [1, 0.72, 0.62, 0.55, 0.5, 0.46] as const;
const sizeOf = (index: number) =>
  Math.round(props.size * (SHARES[Math.min(index, SHARES.length - 1)] ?? 1));
/**
 * The band's least width (CSS px): the next piece in the middle, the two after it at their
 * full size on its right, as much room on its left, and the gaps. Over a narrow well (the
 * Tower lying down, a small phone with a goal), the crack reaches past its sides rather
 * than shrink the pieces.
 */
const leastWidth = computed(() => props.size + 2 * (sizeOf(1) + sizeOf(2)) + 8);

const { t } = useI18n();
/** A piece came out: the next one rises from the rift (two equal animations take turns). */
const shift = ref(0);
watch(
  () => props.queue[0],
  () => shift.value++,
);
</script>

<template>
  <section
    class="stage__next rift"
    :aria-label="t('hud.next')"
    :style="{ '--rift-least': `${leastWidth}px` }"
  >
    <svg class="rift__crack" viewBox="0 0 340 12" preserveAspectRatio="none" aria-hidden="true">
      <path class="rift__glow" d="M0 6L32 3L58 8L95 2L128 7L160 1L188 7L222 3L262 8L300 3L340 6" />
      <path class="rift__core" d="M0 6L32 3L58 8L95 2L128 7L160 1L188 7L222 3L262 8L300 3L340 6" />
    </svg>
    <div class="rift__first" :class="`rift__first--${shift % 2 ? 'odd' : 'even'}`">
      <slot v-if="queue[0] !== undefined" :spec="queue[0]" :size="sizeOf(0)" />
    </div>
    <div class="rift__rest">
      <template v-for="(spec, index) in queue.slice(1)" :key="index">
        <slot :spec="spec" :size="sizeOf(index + 1)" />
      </template>
    </div>
  </section>
</template>

<style scoped>
/*
 * The band: the next piece in the middle column, the others in the right one,
 * the left one as wide, so that the next piece stays over the well's middle.
 * The pieces stand on the crack, which runs the well's width under them, or
 * the band's least width over a narrow well.
 */
.rift {
  position: relative;
  isolation: isolate;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: end;
  justify-self: center;
  width: min(100%, max(var(--well-width, 100%), var(--rift-least, 0px)));
  min-width: 0;
  padding-bottom: 0.375rem;
}

/* The rift's light, behind the pieces: warm at the crack, gone at the band's ends. */
.rift::before {
  content: '';
  position: absolute;
  z-index: -1;
  inset: 20% 0 -35%;
  background: radial-gradient(
    closest-side,
    color-mix(in srgb, var(--rift-glow) 38%, transparent),
    transparent
  );
  pointer-events: none;
  animation: rift-breathe 6s ease-in-out infinite;
}

@keyframes rift-breathe {
  50% {
    opacity: 0.6;
  }
}

.rift__crack {
  position: absolute;
  z-index: -1;
  inset: auto 0 0;
  width: 100%;
  height: 0.75rem;
  overflow: visible;
}

.rift__crack path {
  fill: none;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
}

.rift__glow {
  stroke: var(--rift-glow);
  stroke-opacity: 0.55;
  stroke-width: 6;
}

.rift__core {
  stroke: var(--rift-core);
  stroke-width: 2;
}

.rift__first {
  grid-column: 2;
}

/* A piece came out: the next one rises from the crack (a fade alone under the fade, 1.42). */
.rift__first--even {
  animation: rift-rise-even var(--motion-in) var(--ease-out) backwards;
}

.rift__first--odd {
  animation: rift-rise-odd var(--motion-in) var(--ease-out) backwards;
}

@keyframes rift-rise-even {
  from {
    opacity: 0;
    transform: translateY(calc(45% * var(--move))) scale(calc(1 - 0.15 * var(--move)));
  }
}

@keyframes rift-rise-odd {
  from {
    opacity: 0;
    transform: translateY(calc(45% * var(--move))) scale(calc(1 - 0.15 * var(--move)));
  }
}

/* The others wait in line on its right, smaller and dimmer as they come later. */
.rift__rest {
  grid-column: 3;
  display: flex;
  align-items: end;
  justify-content: space-evenly;
  gap: 0.125rem;
  min-width: 0;
}

/* A long line (the spyglass) narrows its pieces rather than leave the band. */
.rift__rest > :deep(*) {
  flex: 0 1 auto;
  min-width: 0;
  max-width: 100%;
}

.rift__rest > :deep(:nth-child(1)) {
  opacity: 0.85;
}

.rift__rest > :deep(:nth-child(2)) {
  opacity: 0.65;
}

.rift__rest > :deep(:nth-child(n + 3)) {
  opacity: 0.45;
}

:global(:root[data-motion='still']) .rift::before,
:global(:root[data-motion='still']) .rift__first--even,
:global(:root[data-motion='still']) .rift__first--odd {
  animation: none;
}
</style>

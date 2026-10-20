<script setup lang="ts">
import { ref } from 'vue';

/**
 * The change of screen: the rift tears open from the button that was
 * pressed and floods the screen with its light; the next screen is put in
 * place behind it, then the light fades. With reduced motion: a plain cut.
 */
type Phase = 'idle' | 'cover' | 'reveal';
const COVER_MS = 320;
const REVEAL_MS = 380;

const phase = ref<Phase>('idle');
/** Each change of screen; a new one takes over the light of the last. */
let generation = 0;
const origin = ref({ x: '50%', y: '50%' });
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Covers the screen from `from` (its centre; the screen's without one) and
 * runs `swap` behind the light; done once the new screen is in place, while
 * the light still fades (another change may start during the fade).
 */
async function run(from: Element | null, swap: () => Promise<void> | void): Promise<void> {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    await swap();
    return;
  }
  const box = from?.getBoundingClientRect();
  origin.value = box
    ? {
        x: `${(((box.left + box.width / 2) / window.innerWidth) * 100).toFixed(1)}%`,
        y: `${(((box.top + box.height / 2) / window.innerHeight) * 100).toFixed(1)}%`,
      }
    : { x: '50%', y: '50%' };
  const mine = ++generation;
  phase.value = 'cover';
  await wait(COVER_MS);
  await swap();
  phase.value = 'reveal';
  void wait(REVEAL_MS).then(() => {
    if (generation === mine) phase.value = 'idle';
  });
}

defineExpose({ run });
</script>

<template>
  <div
    class="wipe"
    :class="`wipe--${phase}`"
    :style="{ '--x': origin.x, '--y': origin.y }"
    aria-hidden="true"
  />
</template>

<style scoped>
.wipe {
  position: fixed;
  inset: 0;
  z-index: 60;
  visibility: hidden;
  pointer-events: none;
  background: radial-gradient(
    70% 120% at var(--x) var(--y),
    var(--rift-core) 0%,
    var(--accent) 16%,
    color-mix(in srgb, var(--rift-glow) 75%, var(--bg)) 34%,
    var(--bg) 72%
  );
}

/* A slit at the button grows into a seam down the screen, then the light floods out. */
.wipe--cover {
  visibility: visible;
  pointer-events: auto;
  animation: rift-cover 320ms var(--ease-out) forwards;
}

.wipe--reveal {
  visibility: visible;
  animation: rift-reveal 380ms ease-out forwards;
}

@keyframes rift-cover {
  0% {
    clip-path: inset(calc(var(--y) - 4%) calc(100% - var(--x)) calc(100% - var(--y) - 4%) var(--x));
  }

  45% {
    clip-path: inset(0 calc(100% - var(--x) - 1%) 0 calc(var(--x) - 1%));
  }

  100% {
    clip-path: inset(0);
  }
}

@keyframes rift-reveal {
  to {
    opacity: 0;
  }
}
</style>

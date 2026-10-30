<script setup lang="ts">
import { ref } from 'vue';
import { useServices } from '@/app/AppServices';
import { MOTION, transitionMs } from '../motion';

/**
 * The change of screen (§ 3.2 ter, 1.42): a slit of light opens from the
 * button that was pressed and covers the screen; the next screen is put in
 * place behind it, then the light fades, the next screen taking taps as soon
 * as it starts to fade. Drawn with transformations and opacity alone, in the
 * top layer (a popover): it covers an open window too. Under the fade, the
 * light comes and goes as a fade.
 */
type Phase = 'idle' | 'cover' | 'reveal';
const COVER_MS = MOTION.screenMs;
const REVEAL_MS = 240;

const { motion } = useServices();
const light = ref<HTMLElement | null>(null);
const phase = ref<Phase>('idle');
/** Each change of screen; a new one takes over the light of the last. */
let generation = 0;
const origin = ref({ x: '50%', y: '50%' });

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
/** The light in the top layer, over any window (where the browser has popovers). */
const shown = (open: boolean) => {
  const element = light.value;
  if (!element || typeof element.showPopover !== 'function') return;
  if (open === element.matches(':popover-open')) return;
  if (open) element.showPopover();
  else element.hidePopover();
};

/**
 * Covers the screen from `from` (its centre; the screen's without one) and
 * runs `swap` behind the light; done once the new screen is in place, while
 * the light still fades (another change may start during the fade).
 */
async function run(from: Element | null, swap: () => Promise<void> | void): Promise<void> {
  const fades = motion.fades;
  const box = from?.getBoundingClientRect();
  origin.value = box
    ? {
        x: `${(((box.left + box.width / 2) / window.innerWidth) * 100).toFixed(1)}%`,
        y: `${(((box.top + box.height / 2) / window.innerHeight) * 100).toFixed(1)}%`,
      }
    : { x: '50%', y: '50%' };
  const mine = ++generation;
  shown(true);
  phase.value = 'cover';
  await wait(transitionMs(COVER_MS, fades));
  await swap();
  phase.value = 'reveal';
  void wait(transitionMs(REVEAL_MS, fades)).then(() => {
    if (generation !== mine) return;
    phase.value = 'idle';
    shown(false);
  });
}

defineExpose({ run });
</script>

<template>
  <div
    ref="light"
    popover="manual"
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
  width: auto;
  height: auto;
  max-width: none;
  max-height: none;
  margin: 0;
  padding: 0;
  border: 0;
  overflow: visible;
  pointer-events: none;
  transform-origin: var(--x) var(--y);
  background: radial-gradient(
    70% 120% at var(--x) var(--y),
    var(--rift-core) 0%,
    var(--accent) 16%,
    color-mix(in srgb, var(--rift-glow) 75%, var(--bg)) 34%,
    var(--bg) 72%
  );
}

/* Without popovers (older browsers), the light is simply not there between two changes. */
.wipe--idle {
  display: none;
}

/* A slit at the button grows into a seam down the screen, then the light floods out. */
.wipe--cover {
  pointer-events: auto;
  animation: rift-cover var(--motion-screen) var(--ease-out) forwards;
}

.wipe--reveal {
  animation: rift-reveal 240ms ease-out forwards;
}

@keyframes rift-cover {
  0% {
    transform: scale(0.02, 0.08);
  }

  45% {
    transform: scale(0.02, 1);
  }

  100% {
    transform: none;
  }
}

@keyframes rift-reveal {
  to {
    opacity: 0;
  }
}

/* The fade: the light comes and goes, nothing opens. */
:root[data-transitions='fade'] .wipe--cover {
  animation-name: rift-fade-in;
}

:root[data-transitions='fade'] .wipe--reveal {
  animation-duration: var(--motion-out);
}

@keyframes rift-fade-in {
  from {
    opacity: 0;
  }
}
</style>

<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';
import type { EffectsLevel } from '@/fx/EffectsProfile';
import { useWellBox } from './useWellBox';

/**
 * The rift surge over the well (1.25): while time is slowed, a cold light
 * floods the glass and slow rings rise from its heart; when time snaps back,
 * a shock wave crosses it. Calm effects keep the light without the rings;
 * no effects, a still blue frame.
 */
const props = defineProps<{
  active: boolean;
  /** Bumped at each surge's end: the shock wave. */
  shock: number;
  level: EffectsLevel;
  /** The well's canvas, which the light covers. */
  well: HTMLElement | null;
}>();

const layer = ref<HTMLElement | null>(null);
const { box, boxStyle } = useWellBox(() => props.well, layer);

/** The shock wave plays again at each surge's end (with every effect on). */
const shocking = ref(false);
let timer: ReturnType<typeof setTimeout> | undefined;
watch(
  () => props.shock,
  () => {
    if (props.level !== 'full') return;
    shocking.value = false;
    clearTimeout(timer);
    requestAnimationFrame(() => {
      shocking.value = true;
      timer = setTimeout(() => (shocking.value = false), 700);
    });
  },
);
onBeforeUnmount(() => clearTimeout(timer));
</script>

<template>
  <div ref="layer" class="surge" :class="`surge--${level}`" aria-hidden="true">
    <div
      v-if="box"
      class="surge__well"
      :class="{ 'surge__well--on': active, 'surge__well--shock': shocking }"
      :style="boxStyle"
    >
      <template v-if="level !== 'off'">
        <div class="surge__light" />
        <template v-if="level === 'full' && active">
          <i class="surge__ring" />
          <i class="surge__ring surge__ring--late" />
        </template>
      </template>
      <i v-if="shocking" class="surge__shock" />
    </div>
  </div>
</template>

<style scoped>
/* Over the stage and its well, like the danger, under the words and the windows. */
.surge {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.surge__well {
  position: absolute;
  border-radius: 0.6rem;
  opacity: 0;
  transition:
    opacity 320ms ease,
    box-shadow 320ms ease;
}

.surge__well--on {
  opacity: 1;
  box-shadow:
    0 0 0 2px color-mix(in srgb, var(--surge) 70%, transparent),
    0 0 2.2rem color-mix(in srgb, var(--surge) 45%, transparent);
}

/* Shown for the wave alone, after the surge. */
.surge__well--shock {
  opacity: 1;
}

.surge__light {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background:
    radial-gradient(ellipse 70% 60% at 50% 55%, transparent 35%, var(--surge-veil) 100%),
    linear-gradient(180deg, color-mix(in srgb, var(--surge) 10%, transparent), transparent 40%);
  opacity: 0;
  transition: opacity 320ms ease;
}

.surge__well--on .surge__light {
  opacity: 1;
}

/* Slow rings from the heart of the well: time thickening. */
.surge__ring {
  position: absolute;
  left: 50%;
  top: 55%;
  width: 40%;
  aspect-ratio: 1;
  border: 2px solid color-mix(in srgb, var(--surge) 55%, transparent);
  border-radius: 50%;
  transform: translate(-50%, -50%) scale(0.2);
  opacity: 0;
  animation: surge-ring 2.6s ease-out infinite;
}

.surge__ring--late {
  animation-delay: 1.3s;
}

@keyframes surge-ring {
  15% {
    opacity: 0.8;
  }

  100% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(2.6);
  }
}

/* Time snaps back: one bright wave across the glass. */
.surge__shock {
  position: absolute;
  left: 50%;
  top: 55%;
  width: 60%;
  aspect-ratio: 1;
  border: 4px solid var(--surge);
  border-radius: 50%;
  box-shadow: 0 0 1.5rem var(--surge);
  transform: translate(-50%, -50%) scale(0.2);
  animation: surge-shock 650ms cubic-bezier(0.2, 0.7, 0.3, 1) forwards;
}

@keyframes surge-shock {
  from {
    opacity: 1;
  }

  to {
    opacity: 0;
    transform: translate(-50%, -50%) scale(2.4);
  }
}

/* No effects: a still frame says the time is slowed. */
.surge--off .surge__well--on {
  box-shadow: 0 0 0 3px var(--surge);
}

@media (prefers-reduced-motion: reduce) {
  .surge__ring,
  .surge__shock {
    display: none;
  }
}
</style>

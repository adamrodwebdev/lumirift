<script setup lang="ts">
import { computed } from 'vue';
import { SeededRandom } from '@/core/Random';
import type { EffectsLevel } from '@/fx/EffectsProfile';
import { DEFEAT_BURST, DEFEAT_DRIFT, DEFEAT_STYLES } from '@/fx/DefeatStyles';
import type { AmbianceId } from '@/progression/Cosmetics';
import type { Box } from './useWellBox';

/**
 * A defeat in the ambiance the player wears (1.31): its two lights flare,
 * and with every effect on, the stack breaks into the ambiance's matter
 * (DEFEAT_STYLES), which bursts out of the well, then keeps drifting behind
 * the end window until the next game. Calmer effects keep the lights alone.
 */
const props = defineProps<{ box: Box; level: EffectsLevel; ambiance: AmbianceId }>();

const style = computed(() => DEFEAT_STYLES[props.ambiance]);
const moves = computed(() => props.level === 'full');

/** One grain of matter: where it starts and how far it goes, as CSS variables. */
const grain = (random: SeededRandom, x: string, y: string, toCentre: [number, number]) => {
  const between = (a: number, b: number) => a + (b - a) * random.next();
  return {
    left: x,
    top: y,
    '--s': `${between(6, 13).toFixed(1)}px`,
    '--dx': `${between(-90, 90).toFixed(0)}px`,
    '--dy': `${between(-140, 140).toFixed(0)}px`,
    '--up': `${between(140, 330).toFixed(0)}px`,
    '--down': `${between(200, 420).toFixed(0)}px`,
    '--r': `${between(-200, 200).toFixed(0)}deg`,
    '--cx': `${toCentre[0].toFixed(0)}px`,
    '--cy': `${toCentre[1].toFixed(0)}px`,
    '--d': `${between(0, 260).toFixed(0)}ms`,
  };
};

/** The grains bursting out of the well, then those drifting over the whole screen. */
const grains = computed(() => {
  const { left, top, width, height } = props.box;
  const random = new SeededRandom(Math.round(width) * 13 + Math.round(height));
  const centre = [left + width / 2, top + height * 0.45] as const;
  const burst = Array.from({ length: DEFEAT_BURST }, () => {
    const x = left + width * (0.06 + 0.88 * random.next());
    const y = top + height * (0.05 + 0.9 * random.next());
    return grain(random, `${x}px`, `${y}px`, [centre[0] - x, centre[1] - y]);
  });
  const drift = Array.from({ length: DEFEAT_DRIFT }, () =>
    grain(random, `${3 + 94 * random.next()}%`, `${2 + 53 * random.next()}%`, [0, 0]),
  );
  return { burst, drift };
});

const voidAt = computed(() => ({
  left: `${props.box.left + props.box.width / 2}px`,
  top: `${props.box.top + props.box.height * 0.45}px`,
}));
</script>

<template>
  <div class="matter" :class="[`matter--${style.matter}`, { 'matter--moves': moves }]">
    <div class="matter__flare" />
    <template v-if="moves">
      <div v-if="style.opensVoid" class="matter__void" :style="voidAt" />
      <span
        v-for="(at, i) in grains.burst"
        :key="`b${i}`"
        class="matter__grain matter__grain--burst"
        :class="`move--${style.burst}`"
        :style="at"
      />
      <span
        v-for="(at, i) in grains.drift"
        :key="`d${i}`"
        class="matter__grain matter__grain--drift"
        :class="`move--${style.drift}`"
        :style="at"
      />
    </template>
  </div>
</template>

<style scoped>
.matter {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

/* The ambiance's two lights flare as the glass gives way, then stay half lit. */
.matter__flare {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(55% 35% at 35% 30%, var(--defeat-light-1), transparent 70%),
    radial-gradient(55% 40% at 70% 65%, var(--defeat-light-2), transparent 70%);
  opacity: 0;
  animation: matter-flare 1.6s ease-out 440ms both;
}

.matter__void {
  position: absolute;
  width: 4rem;
  height: 4rem;
  border-radius: 50%;
  background: radial-gradient(
    circle,
    rgb(5 3 15) 45%,
    color-mix(in srgb, var(--defeat-matter-2) 70%, transparent) 60%,
    transparent 72%
  );
  opacity: 0;
  translate: -50% -50%;
  animation: matter-void 1.6s ease-out 500ms both;
}

.matter__grain {
  position: absolute;
  width: var(--s);
  height: var(--s);
  opacity: 0;
  animation-duration: 1.9s;
  animation-timing-function: cubic-bezier(0.2, 0.7, 0.3, 1);
  animation-fill-mode: both;
  animation-delay: calc(460ms + var(--d));
}

/* Behind the end window, the matter keeps drifting until the next game. */
.matter__grain--drift {
  animation-duration: 5.5s;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
  animation-delay: calc(1200ms + var(--d) * 4);
}

/* The matter of each ambiance, in its two colours. */
.matter--dust .matter__grain {
  border-radius: 50%;
  background: var(--defeat-matter-1);
  box-shadow: 0 0 8px var(--defeat-matter-2);
}

.matter--ribbon .matter__grain {
  width: 3px;
  height: calc(var(--s) * 3);
  border-radius: 2px;
  background: linear-gradient(var(--defeat-matter-1), var(--defeat-matter-2));
}

.matter--bubble .matter__grain {
  border: 1.5px solid var(--defeat-matter-1);
  border-radius: 50%;
}

.matter--ember .matter__grain {
  width: calc(var(--s) * 0.7);
  height: calc(var(--s) * 0.7);
  border-radius: 2px;
  background: var(--defeat-matter-1);
  box-shadow: 0 0 10px var(--defeat-matter-2);
}

.matter--mote .matter__grain {
  width: calc(var(--s) * 0.6);
  height: calc(var(--s) * 0.6);
  border-radius: 50%;
  background: var(--defeat-matter-1);
  box-shadow: 0 0 10px var(--defeat-matter-2);
}

.matter--petal .matter__grain {
  height: calc(var(--s) * 0.7);
  border-radius: 60% 0;
  background: linear-gradient(135deg, var(--defeat-matter-1), var(--defeat-matter-2));
}

.matter--shard .matter__grain {
  clip-path: polygon(50% 0, 100% 70%, 20% 100%);
  background: linear-gradient(var(--defeat-matter-1), var(--defeat-matter-2));
}

/* How it moves: transform and opacity only. */
.move--rise {
  animation-name: matter-rise;
}

.move--sweep {
  animation-name: matter-sweep;
}

.move--bubble {
  animation-name: matter-bubble;
}

.move--ember {
  animation-name: matter-ember;
}

.move--spiral {
  animation-name: matter-spiral;
}

.move--petal {
  animation-name: matter-petal;
}

.move--burst {
  animation-name: matter-burst;
}

.move--drift {
  animation-name: matter-drift;
}

@keyframes matter-flare {
  12% {
    opacity: 1;
  }
  to {
    opacity: 0.55;
  }
}

@keyframes matter-void {
  from {
    opacity: 0;
    transform: scale(0.2);
  }
  35% {
    opacity: 1;
    transform: scale(1.3);
  }
  to {
    opacity: 0.85;
    transform: scale(1) rotate(180deg);
  }
}

@keyframes matter-rise {
  from {
    opacity: 0;
    transform: translate(0, 0) scale(0.3);
  }
  12% {
    opacity: 1;
  }
  to {
    opacity: 0;
    transform: translate(var(--dx), calc(-1 * var(--up))) scale(1);
  }
}

@keyframes matter-sweep {
  from {
    opacity: 0;
    transform: translate(0, 0) rotate(var(--r));
  }
  15% {
    opacity: 1;
  }
  to {
    opacity: 0;
    transform: translate(calc(var(--dx) * 3), calc(-0.4 * var(--up))) rotate(calc(var(--r) + 40deg));
  }
}

@keyframes matter-bubble {
  from {
    opacity: 0;
    transform: translate(0, 0) scale(0.4);
  }
  15% {
    opacity: 1;
  }
  50% {
    transform: translate(calc(var(--dx) * 0.3), calc(-0.5 * var(--up))) scale(0.9);
  }
  to {
    opacity: 0;
    transform: translate(calc(var(--dx) * -0.2), calc(-1.4 * var(--up))) scale(1.1);
  }
}

@keyframes matter-ember {
  from {
    opacity: 0;
    transform: translate(0, 0);
  }
  10% {
    opacity: 1;
  }
  60% {
    opacity: 0.9;
  }
  to {
    opacity: 0;
    transform: translate(calc(var(--dx) * 0.5), calc(-1.3 * var(--up))) rotate(var(--r));
  }
}

@keyframes matter-spiral {
  from {
    opacity: 0;
    transform: translate(0, 0) scale(1);
  }
  15% {
    opacity: 1;
  }
  to {
    opacity: 0;
    transform: translate(var(--cx), var(--cy)) rotate(540deg) scale(0.1);
  }
}

@keyframes matter-petal {
  from {
    opacity: 0;
    transform: translate(0, 0) rotate(0);
  }
  12% {
    opacity: 1;
  }
  to {
    opacity: 0;
    transform: translate(var(--dx), var(--down)) rotate(calc(var(--r) * 2));
  }
}

@keyframes matter-burst {
  from {
    opacity: 0;
    transform: translate(0, 0) rotate(0) scale(0.6);
  }
  10% {
    opacity: 1;
  }
  to {
    opacity: 0;
    transform: translate(calc(var(--dx) * 2.2), calc(var(--dy) * 2.2)) rotate(var(--r)) scale(1);
  }
}

@keyframes matter-drift {
  from {
    opacity: 0;
    transform: translate(0, 0);
  }
  20% {
    opacity: 0.8;
  }
  to {
    opacity: 0;
    transform: translate(calc(var(--dx) * 0.6), calc(-0.6 * var(--up)));
  }
}

@media (prefers-reduced-motion: reduce) {
  .matter__grain,
  .matter__void {
    display: none;
  }
}
</style>

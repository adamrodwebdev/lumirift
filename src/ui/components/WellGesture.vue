<script setup lang="ts">
import { computed, ref } from 'vue';
import type { GuideAction, WellPoint } from '@/session/GameSession';
import { useWellBox } from './useWellBox';

/**
 * The guide's gesture, drawn big over the well beside the piece it speaks of
 * (1.46): a fingertip flicking down to drop, swaying to move, tapping to
 * turn. Touch screens only: a keyboard's keys stand under the guide's words.
 * The words say what to do; the drawing, how.
 */
const props = defineProps<{
  action: GuideAction | null;
  /** The piece's centre, as shares of the well; null when none is in play. */
  at: WellPoint | null;
  /** The well's canvas, which the drawing sits on. */
  well: HTMLElement | null;
}>();

const layer = ref<HTMLElement | null>(null);
const { box, boxStyle } = useWellBox(() => props.well, layer);

/** How far beside the piece's centre the finger stands (a share of the well's width). */
const BESIDE = 0.26;
const within = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

/**
 * Beside the piece, on the side with room, never off the well; moved as the
 * piece moves by a translation alone (no layout).
 */
const spot = computed(() => {
  const at = props.at;
  const size = box.value;
  if (!at || !size) return null;
  const x = within(at.x < 0.5 ? at.x + BESIDE : at.x - BESIDE, 0.14, 0.86) * size.width;
  const y = within(at.y, 0.12, 0.78) * size.height;
  return { translate: `calc(${x}px - 50%) calc(${y}px - 50%)` };
});
</script>

<template>
  <div ref="layer" class="well-gesture" aria-hidden="true">
    <div class="well-gesture__box" :style="boxStyle">
      <Transition name="gesture">
        <span
          v-if="action && spot"
          :key="action"
          class="gesture"
          :data-action="action"
          :style="spot"
        >
          <svg class="gesture__trail" viewBox="0 0 48 120">
            <template v-if="action === 'drop'">
              <line x1="24" y1="34" x2="24" y2="100" />
              <path d="M13 94l11 14 11-14" />
            </template>
            <path v-else-if="action === 'move'" d="M7 60l9-9M7 60l9 9M41 60l-9-9M41 60l-9 9" />
            <circle v-else cx="24" cy="60" r="20" />
          </svg>
          <i class="gesture__finger" />
        </span>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.well-gesture {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.well-gesture__box {
  position: absolute;
  inset: 0;
}

/* Centred on its spot (`translate`, set as the piece moves); its own motion moves only the fingertip. */
.gesture {
  position: absolute;
  left: 0;
  top: 0;
  display: block;
  inline-size: 3rem;
  block-size: 7.5rem;
}

/* The hand's path: a dotted fall and its arrow, two chevrons, or a ring for a tap. */
.gesture__trail {
  position: absolute;
  inset: 0;
  inline-size: 100%;
  block-size: 100%;
  fill: none;
  stroke: var(--accent);
  stroke-width: 3.5;
  stroke-linecap: round;
  stroke-linejoin: round;
  filter: drop-shadow(0 0 0.35rem rgb(0 0 0 / 0.6));
}

.gesture[data-action='drop'] line {
  stroke-dasharray: 2 7;
  stroke-width: 3;
}

.gesture[data-action='rotate'] circle {
  stroke-width: 2.5;
  opacity: 0.7;
}

/* The fingertip: a pale disc ringed in light, as a fingertip pressed on the glass. */
.gesture__finger {
  position: absolute;
  left: 50%;
  top: 50%;
  inline-size: 2.1rem;
  block-size: 2.1rem;
  margin: -1.05rem 0 0 -1.05rem;
  border: 3px solid var(--accent-strong);
  border-radius: 50%;
  background: rgb(255 255 255 / 0.28);
  box-shadow:
    0 0 0 4px color-mix(in srgb, var(--accent) 30%, transparent),
    0 0 1.1rem var(--rift-glow);
}

/* Down the trail, fading in at its top and out past its arrow. */
.gesture[data-action='drop'] .gesture__finger {
  top: 22%;
  animation: flick 1.6s cubic-bezier(0.3, 0, 0.2, 1) infinite;
}

@keyframes flick {
  0% {
    opacity: 0;
    transform: translateY(-1rem);
  }

  18% {
    opacity: 1;
  }

  78% {
    opacity: 1;
    transform: translateY(3.6rem);
  }

  100% {
    opacity: 0;
    transform: translateY(4.4rem);
  }
}

.gesture[data-action='move'] .gesture__finger {
  animation: sway 1.8s ease-in-out infinite;
}

@keyframes sway {
  0%,
  100% {
    transform: translateX(-1.6rem);
  }

  50% {
    transform: translateX(1.6rem);
  }
}

.gesture[data-action='rotate'] .gesture__finger {
  animation: tap 1.1s ease-out infinite;
}

@keyframes tap {
  0%,
  60%,
  100% {
    transform: scale(1);
  }

  20% {
    transform: scale(0.72);
  }
}

/* Calm motion: the drawing stays, the fingertip rests where the gesture starts. */
:global(:root[data-motion='still']) .gesture__finger {
  animation: none;
}

.gesture-enter-active {
  transition: opacity var(--motion-in) var(--ease-out);
}

.gesture-leave-active {
  transition: opacity var(--motion-out) var(--ease-in);
}

.gesture-enter-from,
.gesture-leave-to {
  opacity: 0;
}
</style>

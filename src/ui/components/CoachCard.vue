<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { KeyAction } from '@/families/falling/input/KeyBindings';
import type { CoachStep } from '@/session/Coach';
import { useKeyBindings } from '../useKeyBindings';
import { useKeyLabels } from '../useKeyLabels';

/**
 * One step of the first game's guide, over the upper part of the well: the
 * keys on a keyboard device (the player's own, main ones), the gesture on a
 * touch screen, a short sentence. It never takes the input (only its Skip
 * button does).
 */
const props = defineProps<{ step: CoachStep; goal: 'sand' | 'lines' }>();
const emit = defineEmits<{ skip: [] }>();

const { t } = useI18n();
const bindings = useKeyBindings();
const labels = useKeyLabels();

/** The actions each step teaches. */
const STEP_ACTIONS: Readonly<Record<Exclude<CoachStep, 'goal'>, readonly KeyAction[]>> = {
  move: ['left', 'right'],
  rotate: ['rotateCw'],
  drop: ['hardDrop'],
};

const text = computed(() =>
  props.step === 'goal'
    ? t(props.goal === 'sand' ? 'coach.goalSand' : 'coach.goalLines')
    : t(`coach.${props.step}`),
);
const keys = computed(() =>
  props.step === 'goal'
    ? null
    : STEP_ACTIONS[props.step]
        .flatMap((action) => bindings.value.codes(action).slice(0, 1))
        .map((code) => labels.label(code))
        .join(' ') || null,
);
const gesture = computed(() => (props.step === 'goal' ? null : t(`coach.${props.step}Touch`)));
</script>

<template>
  <div class="coach" role="status">
    <Transition name="coach" mode="out-in">
      <div :key="step" class="coach__card">
        <span v-if="keys" class="coach__input">
          <kbd class="coach__keys">{{ keys }}</kbd>
          <span class="coach__gesture">
            <span class="coach__finger" :data-step="step" aria-hidden="true"><i /></span>
            {{ gesture }}
          </span>
        </span>
        <p class="coach__text">{{ text }}</p>
      </div>
    </Transition>
    <button type="button" class="coach__skip" @click="emit('skip')">{{ t('coach.skip') }}</button>
  </div>
</template>

<style scoped>
.coach {
  /* A third of the way down: under the piece coming in, above the stack,
     where the show happens (the elements, the clears). */
  position: absolute;
  inset: 22% var(--space-3) auto;
  z-index: 5;
  display: grid;
  justify-items: center;
  gap: var(--space-2);
  pointer-events: none;
}

.coach__card {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  max-width: 24rem;
  padding: var(--space-3) var(--space-4);
  border: 1px solid color-mix(in srgb, var(--accent) 55%, transparent);
  border-radius: var(--radius-lg);
  background: color-mix(in srgb, var(--surface) 92%, transparent);
  box-shadow:
    var(--shadow),
    0 0 2rem rgb(255 160 60 / 0.25);
}

.coach__input {
  display: grid;
  justify-items: center;
}

.coach__keys {
  padding: var(--space-1) var(--space-3);
  border: 1px solid var(--border);
  border-bottom-width: 3px;
  border-radius: var(--radius-sm);
  background: var(--surface-2);
  color: var(--accent-strong);
  font-family: var(--font-display);
  font-weight: 800;
  white-space: nowrap;
}

/* A touch screen shows the gesture, a keyboard device the keys. */
.coach__gesture {
  display: none;
  color: var(--accent-strong);
  font-family: var(--font-display);
  font-weight: 800;
}

@media (hover: none) and (pointer: coarse) {
  .coach__keys {
    display: none;
  }

  .coach__gesture {
    display: grid;
    justify-items: center;
    gap: var(--space-1);
  }
}

/* A fingertip that shows the gesture: sideways, a tap, a flick down. */
.coach__finger {
  position: relative;
  display: block;
  width: 3.25rem;
  height: 2.5rem;
}

.coach__finger i {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 1.1rem;
  height: 1.1rem;
  margin: -0.55rem 0 0 -0.55rem;
  border-radius: 50%;
  background: var(--crack);
  box-shadow:
    0 0 0 4px color-mix(in srgb, var(--accent) 35%, transparent),
    0 0 0.9rem var(--rift-glow);
}

.coach__finger[data-step='move'] i {
  animation: finger-move 1.4s ease-in-out infinite;
}

.coach__finger[data-step='rotate'] i {
  animation: finger-tap 1.1s ease-out infinite;
}

.coach__finger[data-step='drop'] i {
  animation: finger-flick 1.2s cubic-bezier(0.5, 0, 0.9, 0.4) infinite;
}

@keyframes finger-move {
  0%,
  100% {
    transform: translateX(-1rem);
  }

  50% {
    transform: translateX(1rem);
  }
}

@keyframes finger-tap {
  0%,
  60%,
  100% {
    transform: scale(1);
  }

  20% {
    transform: scale(0.7);
  }
}

@keyframes finger-flick {
  0% {
    opacity: 0;
    transform: translateY(-0.9rem);
  }

  15% {
    opacity: 1;
  }

  70% {
    opacity: 1;
    transform: translateY(0.9rem);
  }

  100% {
    opacity: 0;
    transform: translateY(0.9rem);
  }
}

.coach__text {
  font-weight: 700;
  text-align: start;
}

.coach__skip {
  min-height: var(--touch);
  padding: 0 var(--space-4);
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--text-muted);
  font-weight: 600;
  text-decoration: underline;
  pointer-events: auto;
}

.coach-enter-active {
  animation: coach-in 260ms cubic-bezier(0.2, 1.3, 0.4, 1);
}

.coach-leave-active {
  transition: opacity 150ms ease;
}

.coach-leave-to {
  opacity: 0;
}

@keyframes coach-in {
  from {
    opacity: 0;
    transform: translateY(-0.5rem) scale(0.92);
  }
}
</style>

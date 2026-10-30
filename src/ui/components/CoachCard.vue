<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { CoachStep } from '@/session/Coach';
import InputHint from './InputHint.vue';

/**
 * One step of the first game's guide, over the upper part of the well: the
 * keys on a keyboard device (the player's own, main ones), the gesture on a
 * touch screen, a short sentence. It never takes the input (only its Skip
 * button does).
 */
const props = defineProps<{ step: CoachStep; goal: 'sand' | 'lines' }>();
const emit = defineEmits<{ skip: [] }>();

const { t } = useI18n();

const text = computed(() =>
  props.step === 'goal'
    ? t(props.goal === 'sand' ? 'coach.goalSand' : 'coach.goalLines')
    : t(`coach.${props.step}`),
);
</script>

<template>
  <div class="coach" role="status">
    <Transition name="coach" mode="out-in">
      <div :key="step" class="coach__card">
        <InputHint v-if="step !== 'goal'" :action="step" />
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
  animation: coach-in var(--motion-in) cubic-bezier(0.2, 1.3, 0.4, 1);
}

.coach-leave-active {
  transition: opacity var(--motion-out) var(--ease-in);
}

.coach-leave-to {
  opacity: 0;
}

@keyframes coach-in {
  from {
    opacity: 0;
    transform: translateY(calc(var(--move) * -0.5rem)) scale(calc(1 - var(--move) * 0.08));
  }
}
</style>

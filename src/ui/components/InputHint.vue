<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { KeyAction } from '@/families/falling/input/KeyBindings';
import type { GuideAction } from '@/session/GameSession';
import { useKeyBindings } from '../useKeyBindings';
import { useKeyLabels } from '../useKeyLabels';

/**
 * How to do an action, for the guides: the player's own keys (the main one of
 * each) on a keyboard device; on a touch screen, a fingertip that shows the
 * gesture, and its name.
 */
const props = defineProps<{ action: GuideAction }>();

const { t } = useI18n();
const bindings = useKeyBindings();
const labels = useKeyLabels();

/** The commands each action stands for. */
const ACTION_KEYS: Readonly<Record<GuideAction, readonly KeyAction[]>> = {
  move: ['left', 'right'],
  rotate: ['rotateCw'],
  drop: ['hardDrop'],
};

const keys = computed(() =>
  ACTION_KEYS[props.action]
    .flatMap((action) => bindings.value.codes(action).slice(0, 1))
    .map((code) => labels.label(code))
    .join(' '),
);
</script>

<template>
  <span class="hint">
    <kbd v-if="keys" class="hint__keys">{{ keys }}</kbd>
    <span class="hint__gesture">
      <span class="hint__finger" :data-action="action" aria-hidden="true"><i /></span>
      {{ t(`coach.${action}Touch`) }}
    </span>
  </span>
</template>

<style scoped>
.hint {
  display: grid;
  justify-items: center;
}

.hint__keys {
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
.hint__gesture {
  display: none;
  color: var(--accent-strong);
  font-family: var(--font-display);
  font-weight: 800;
}

@media (hover: none) and (pointer: coarse) {
  .hint__keys {
    display: none;
  }

  /* Its name on two short lines at most, under the fingertip. */
  .hint__gesture {
    display: grid;
    justify-items: center;
    gap: var(--space-1);
    max-inline-size: 9em;
    font-size: 0.875em;
    line-height: 1.15;
    text-align: center;
  }
}

/* A fingertip that shows the gesture: sideways, a tap, a flick down. */
.hint__finger {
  position: relative;
  display: block;
  width: 3.25rem;
  height: 2.5rem;
}

.hint__finger i {
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

.hint__finger[data-action='move'] i {
  animation: finger-move 1.4s ease-in-out infinite;
}

.hint__finger[data-action='rotate'] i {
  animation: finger-tap 1.1s ease-out infinite;
}

.hint__finger[data-action='drop'] i {
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
</style>

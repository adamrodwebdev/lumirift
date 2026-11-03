<script setup lang="ts">
import { computed } from 'vue';
import type { KeyAction } from '@/families/falling/input/KeyBindings';
import type { GuideAction } from '@/session/GameSession';
import { useKeyBindings } from '../useKeyBindings';
import { useKeyLabels } from '../useKeyLabels';

/**
 * The keys of the guide's line (1.46), drawn big under its words: the
 * player's own main key for each command, the drop's pressed again and
 * again. Keyboard devices only: a touch screen draws the gesture over the
 * well instead (`WellGesture`).
 */
const props = defineProps<{ action: GuideAction }>();

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
    .map((code) => ({ code, label: labels.label(code), spoken: labels.spoken(code) })),
);
</script>

<template>
  <span class="keys" :data-action="action">
    <kbd
      v-for="key in keys"
      :key="key.code"
      class="keys__key"
      :class="{ 'keys__key--wide': key.label.length > 2 }"
    >
      <span aria-hidden="true">{{ key.label }}</span>
      <span class="sr-only">{{ key.spoken }}</span>
    </kbd>
  </span>
</template>

<style scoped>
/* Sizes in `em`: the keys follow the words of the line they stand under. */
.keys {
  display: flex;
  justify-content: center;
  gap: 0.45em;
}

.keys__key {
  display: inline-grid;
  place-items: center;
  min-inline-size: 2.2em;
  block-size: 2.2em;
  padding-inline: 0.5em;
  border-radius: 0.55em;
  background: var(--accent-gradient);
  box-shadow: 0 0.3em 0 color-mix(in srgb, var(--rift-glow) 45%, black);
  color: var(--on-accent);
  font-family: var(--font-display);
  font-size: 0.85em;
  font-weight: 800;
  letter-spacing: 0.04em;
  white-space: nowrap;
}

/* A word on the key (Space, Пробел): the width of a space bar. */
.keys__key--wide {
  min-inline-size: 7.5em;
  text-transform: uppercase;
}

/* The drop's key goes down and comes back up, as a finger presses it. */
.keys[data-action='drop'] .keys__key {
  animation: key-press 1.3s ease-in-out infinite;
}

@keyframes key-press {
  0%,
  55%,
  100% {
    transform: translateY(0);
    box-shadow: 0 0.3em 0 color-mix(in srgb, var(--rift-glow) 45%, black);
  }

  70%,
  85% {
    transform: translateY(calc(var(--move) * 0.25em));
    box-shadow: 0 0.05em 0 color-mix(in srgb, var(--rift-glow) 45%, black);
  }
}

:global(:root[data-motion='still']) .keys__key {
  animation: none;
}

/* A touch screen: the gesture over the well says it. */
@media (hover: none) and (pointer: coarse) {
  .keys {
    display: none;
  }
}
</style>

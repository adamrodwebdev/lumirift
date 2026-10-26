<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import AppIcon, { type IconName } from '@/ui/components/AppIcon.vue';
import type { FallingAction } from '../input/FallingInput';
import type { PadMode } from './useTouchPlay';

/**
 * The on-screen buttons, for the players who choose them over gestures, or
 * with them (Settings, Touch controls). Two groups, one per thumb: the moves
 * on the left, the rotations and the drop on the right (mirrored for the
 * left-handed); with the gestures, which move, only the second. The game
 * screen places them, under the well in portrait and on each side of it in
 * landscape. The hold and the ability have their own buttons next to the
 * well; the pause is at the top.
 */
const props = defineProps<{ pad: Exclude<PadMode, 'none'> }>();
const emit = defineEmits<{ press: [action: FallingAction]; release: [action: FallingAction] }>();

const { t } = useI18n();

interface Control {
  readonly action: FallingAction;
  readonly icon: IconName;
  readonly label: string;
}

const moves = (): Control[] => [
  { action: 'left', icon: 'left', label: t('controls.left') },
  { action: 'softDrop', icon: 'down', label: t('controls.softDrop') },
  { action: 'right', icon: 'right', label: t('controls.right') },
];
const acts = (): Control[] => [
  { action: 'rotateCcw', icon: 'rotateCcw', label: t('controls.rotateCcw') },
  { action: 'rotateCw', icon: 'rotateCw', label: t('controls.rotateCw') },
  { action: 'hardDrop', icon: 'drop', label: t('controls.hardDrop') },
];

interface Group {
  readonly kind: 'move' | 'act';
  readonly label: string;
  readonly controls: readonly Control[];
}

const groups = computed<readonly Group[]>(() => {
  const act: Group = { kind: 'act', label: t('controls.groupAct'), controls: acts() };
  if (props.pad === 'act') return [act];
  return [{ kind: 'move', label: t('controls.groupMove'), controls: moves() }, act];
});

const press = (event: PointerEvent, action: FallingAction) => {
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  emit('press', action);
};
</script>

<template>
  <div class="controls">
    <div
      v-for="group in groups"
      :key="group.kind"
      class="controls__group"
      :class="`controls__${group.kind}`"
      role="group"
      :aria-label="group.label"
    >
      <button
        v-for="control in group.controls"
        :key="control.action"
        type="button"
        class="control"
        :class="`control--${control.action}`"
        :aria-label="control.label"
        @pointerdown.prevent="press($event, control.action)"
        @pointerup="emit('release', control.action)"
        @pointercancel="emit('release', control.action)"
        @contextmenu.prevent
      >
        <AppIcon :name="control.icon" />
      </button>
    </div>
  </div>
</template>

<style scoped>
/* The game screen's grid places each group. */
.controls {
  display: contents;
}

.controls__group {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-2);
  user-select: none;
  -webkit-user-select: none;
  touch-action: none;
}

.control {
  display: grid;
  place-items: center;
  min-height: 3.25rem;
  border: 0;
  border-radius: 1rem;
  background: rgb(255 255 255 / 0.08);
  box-shadow:
    inset 0 0 0 1px rgb(255 255 255 / 0.14),
    0 4px 0 rgb(0 0 0 / 0.45);
  color: var(--text);
  touch-action: none;
  -webkit-tap-highlight-color: transparent;
  transition:
    transform 80ms ease,
    box-shadow 80ms ease;
}

.control:active {
  transform: translateY(3px);
  box-shadow:
    inset 0 0 0 1px rgb(255 255 255 / 0.14),
    0 1px 0 rgb(0 0 0 / 0.45);
}

.control--hardDrop {
  background: var(--accent-gradient);
  color: var(--on-accent-fill);
  box-shadow:
    0 4px 0 var(--accent-edge),
    inset 0 2px 0 rgb(255 255 255 / 0.6);
}

.control--hardDrop:active {
  box-shadow:
    0 1px 0 var(--accent-edge),
    inset 0 2px 0 rgb(255 255 255 / 0.6);
}
</style>

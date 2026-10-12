<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import AppIcon, { type IconName } from '@/ui/components/AppIcon.vue';
import type { FallingAction } from '../input/FallingInput';
import type { AbilityId } from '../modes/GameMode';

/** `canHold`: false for families without a hold slot (Sand). */
const props = withDefaults(defineProps<{ ability: AbilityId | null; canHold?: boolean }>(), {
  canHold: true,
});
const emit = defineEmits<{ press: [action: FallingAction]; release: [action: FallingAction] }>();

const { t } = useI18n();

interface Control {
  readonly action: FallingAction;
  readonly icon: IconName;
  readonly label: string;
}

const ABILITY_ICONS: Readonly<Record<AbilityId, IconName>> = { flip: 'flip' };

const rows = (): Control[][] => [
  [
    ...(props.canHold
      ? [{ action: 'hold', icon: 'hold', label: t('controls.hold') } as const]
      : []),
    { action: 'rotateCcw', icon: 'rotateCcw', label: t('controls.rotateCcw') },
    { action: 'rotateCw', icon: 'rotateCw', label: t('controls.rotateCw') },
    ...(props.ability
      ? [
          {
            action: 'ability',
            icon: ABILITY_ICONS[props.ability],
            label: t(`controls.ability.${props.ability}`),
          } as const,
        ]
      : []),
    { action: 'pause', icon: 'pause', label: t('controls.pause') },
  ],
  [
    { action: 'left', icon: 'left', label: t('controls.left') },
    { action: 'softDrop', icon: 'down', label: t('controls.softDrop') },
    { action: 'hardDrop', icon: 'drop', label: t('controls.hardDrop') },
    { action: 'right', icon: 'right', label: t('controls.right') },
  ],
];

const press = (event: PointerEvent, action: FallingAction) => {
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  emit('press', action);
};
</script>

<template>
  <div class="controls" role="group" :aria-label="t('controls.label')">
    <div v-for="(row, index) in rows()" :key="index" class="controls__row">
      <button
        v-for="control in row"
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
.controls {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3) calc(var(--space-2) + env(safe-area-inset-bottom));
  user-select: none;
  -webkit-user-select: none;
  touch-action: none;
}

.controls__row {
  display: flex;
  gap: var(--space-2);
}

.control {
  flex: 1;
  display: grid;
  place-items: center;
  min-height: 3.25rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  touch-action: none;
  -webkit-tap-highlight-color: transparent;
}

.control:active {
  background: var(--surface-2);
  transform: scale(0.96);
}

.control--hardDrop,
.control--ability {
  background: var(--accent-fill);
  border-color: var(--accent-fill);
  color: var(--on-accent-fill);
}
</style>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import AppIcon, { type IconName } from './AppIcon.vue';
import ModalDialog from './ModalDialog.vue';

/**
 * The pause: resume, restart, the settings (no page header during a game),
 * quit. On a touch screen, the gestures of the family, drawn; with a
 * keyboard, the keys (`help`: translation keys of the family's help).
 */
const props = defineProps<{
  open: boolean;
  help: readonly string[];
  touch: boolean;
  family: string;
}>();
const emit = defineEmits<{ resume: []; restart: []; settings: []; quit: [] }>();

const { t } = useI18n();

interface Gesture {
  readonly icon: IconName;
  readonly gesture: string;
  readonly action: string;
}

/** The falling families (falling, sand, volume) play with the same gestures. */
const gestures = computed<readonly Gesture[]>(() => {
  if (props.family === 'placement') return [];
  const list: Gesture[] = [
    { icon: 'gestureDrag', gesture: 'gestures.drag', action: 'controls.move' },
    { icon: 'gestureTap', gesture: 'gestures.tap', action: 'controls.rotateCw' },
    { icon: 'gestureTwo', gesture: 'gestures.twoFingers', action: 'controls.rotateCcw' },
    { icon: 'gestureSlow', gesture: 'gestures.dragDown', action: 'controls.softDrop' },
    { icon: 'gestureDown', gesture: 'gestures.flickDown', action: 'controls.hardDrop' },
  ];
  if (props.family !== 'sand')
    list.splice(3, 0, { icon: 'gestureUp', gesture: 'gestures.flickUp', action: 'controls.hold' });
  if (props.family === 'volume')
    list.push({ icon: 'gestureTurn', gesture: 'gestures.twoFingerDrag', action: 'tower.turn' });
  return list;
});
/** Words for the keyboard, or for what the drawings cannot say (the Mosaic). */
const texts = computed(() => {
  if (!props.touch) return props.help.filter((key) => /keyboard/i.test(key));
  return gestures.value.length > 0 ? [] : props.help.filter((key) => /touch/i.test(key));
});
</script>

<template>
  <ModalDialog :open="open" :title="t('pause.title')" @dismiss="emit('resume')">
    <div class="actions">
      <button type="button" class="btn btn--primary" autofocus @click="emit('resume')">
        <AppIcon name="play" :size="20" />{{ t('pause.resume') }}
      </button>
      <div class="actions__row">
        <button type="button" class="btn" @click="emit('restart')">
          <AppIcon name="restart" :size="20" />{{ t('pause.restart') }}
        </button>
        <button type="button" class="btn" @click="emit('settings')">
          <AppIcon name="settings" :size="20" />{{ t('pause.settings') }}
        </button>
        <button type="button" class="btn" @click="emit('quit')">
          <AppIcon name="back" :size="20" />{{ t('pause.quit') }}
        </button>
      </div>
    </div>
    <ul v-if="touch && gestures.length > 0" class="gestures" :aria-label="t('gestures.label')">
      <li v-for="item in gestures" :key="item.icon" class="gesture">
        <AppIcon :name="item.icon" :size="26" />
        <span>
          <strong>{{ t(item.gesture) }}</strong>
          <small>{{ t(item.action) }}</small>
        </span>
      </li>
    </ul>
    <p v-for="key in texts" :key="key" class="help">{{ t(key) }}</p>
  </ModalDialog>
</template>

<style scoped>
.actions {
  display: grid;
  gap: var(--space-2);
  margin-bottom: var(--space-4);
}

.actions__row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-2);
}

.actions__row .btn {
  flex-direction: column;
  gap: 0.15rem;
  padding: var(--space-2) var(--space-1);
  font-size: 0.85rem;
}

.gestures {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.gesture {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-height: 2.75rem;
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  background: var(--surface-2);
  color: var(--accent);
}

.gesture span {
  display: grid;
  color: var(--text);
}

.gesture strong {
  font-size: 0.8rem;
}

.gesture small {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.help {
  font-size: 0.875rem;
  color: var(--text-muted);
}

.help + .help {
  margin-top: var(--space-2);
}
</style>

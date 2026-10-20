<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { FamilyId, ModeId } from '@/session/ModeId';
import AppIcon, { type IconName } from './AppIcon.vue';
import KeyLegend from './KeyLegend.vue';
import ModalDialog from './ModalDialog.vue';

/**
 * The pause: resume, restart, the settings (no page header during a game),
 * quit. On a touch screen, the gestures of the family, drawn (`help`: words
 * where no drawing says it, the Mosaic); with a keyboard, the keys, drawn.
 */
const props = defineProps<{
  open: boolean;
  help: readonly string[];
  touch: boolean;
  family: FamilyId;
  modeId: ModeId;
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
  if (!props.touch || props.family === 'placement') return [];
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
/** Words for what the drawings cannot say (the Mosaic's touch controls). */
const texts = computed(() => (props.touch && gestures.value.length === 0 ? props.help : []));
</script>

<template>
  <ModalDialog
    class="pause"
    :class="{ 'pause--legend': gestures.length > 0 || !touch }"
    :open="open"
    :title="t('pause.title')"
    :wide="gestures.length > 0 || !touch"
    @dismiss="emit('resume')"
  >
    <button
      type="button"
      class="btn btn--primary btn--raised btn--block pause__resume"
      autofocus
      @click="emit('resume')"
    >
      <AppIcon name="play" :size="20" />{{ t('pause.resume') }}
    </button>
    <div class="sheet-buttons pause__more">
      <button type="button" class="btn btn--raised" @click="emit('restart')">
        <AppIcon name="restart" :size="20" /><span>{{ t('pause.restart') }}</span>
      </button>
      <button type="button" class="btn btn--raised" @click="emit('settings')">
        <AppIcon name="settings" :size="20" /><span>{{ t('pause.settings') }}</span>
      </button>
      <button type="button" class="btn btn--raised" @click="emit('quit')">
        <AppIcon name="back" :size="20" /><span>{{ t('pause.quit') }}</span>
      </button>
    </div>
    <ul v-if="gestures.length > 0" class="gestures" :aria-label="t('gestures.label')">
      <li v-for="item in gestures" :key="item.icon" class="gesture">
        <AppIcon :name="item.icon" :size="26" />
        <span>
          <strong>{{ t(item.gesture) }}</strong>
          <small>{{ t(item.action) }}</small>
        </span>
      </li>
    </ul>
    <KeyLegend v-if="!touch" class="pause__legend" :family="family" :mode-id="modeId" />
    <div v-if="texts.length > 0" class="pause__keys">
      <p v-for="key in texts" :key="key" class="sheet-note">{{ t(key) }}</p>
    </div>
  </ModalDialog>
</template>

<style scoped>
.pause__more .btn {
  flex-direction: column;
  gap: 0.15rem;
  min-height: 3.5rem;
  padding-block: var(--space-2);
  font-size: 0.82rem;
}

.pause__keys {
  display: grid;
  gap: var(--space-2);
}

.gestures {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.375rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

/* An odd last gesture takes the whole row. */
.gesture:last-child:nth-child(odd) {
  grid-column: 1 / -1;
}

.gesture {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-height: 2.9rem;
  padding: 0.375rem var(--space-2);
  border-radius: 0.875rem;
  background: var(--highlight);
  color: var(--accent);
}

.gesture span {
  display: grid;
  min-width: 0;
  color: var(--text);
  line-height: 1.2;
}

.gesture strong {
  font-size: 0.78rem;
}

.gesture small {
  color: var(--text-muted);
  font-size: 0.72rem;
}

/* Landscape: the actions on the left, the gestures on the right. */
@media (orientation: landscape) {
  .pause--legend[open] {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }

  .pause--legend .pause__resume,
  .pause--legend .pause__more {
    grid-column: 1;
  }

  .pause--legend .pause__legend {
    grid-column: 2;
    grid-row: 2 / span 3;
    align-self: center;
  }

  .pause--legend .gestures {
    grid-column: 2;
    grid-row: 2 / span 3;
    grid-template-columns: minmax(0, 1fr);
    gap: 0.25rem;
  }

  .pause--legend .gesture {
    min-height: 2.4rem;
    padding-block: 0.2rem;
  }

  .gesture:last-child:nth-child(odd) {
    grid-column: auto;
  }
}
</style>

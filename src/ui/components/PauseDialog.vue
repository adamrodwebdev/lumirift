<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useServices } from '@/app/AppServices';
import type { FamilyId, ModeId } from '@/session/ModeId';
import AppIcon from './AppIcon.vue';
import { gestureRows } from '../gestureGuide';
import { useKeyBindings } from '../useKeyBindings';
import GestureGuide from './GestureGuide.vue';
import GestureList from './GestureList.vue';
import KeyLegend from './KeyLegend.vue';
import KeysDialog from './KeysDialog.vue';
import ModalDialog from './ModalDialog.vue';

/**
 * The pause: resume, restart, the settings (no page header during a game),
 * quit. On a touch screen, the gestures of the family as the player set them,
 * drawn, and the gesture guide a tap away (`help`: words where no drawing
 * says it, the Mosaic); with a keyboard, the keys, drawn.
 */
const props = defineProps<{
  open: boolean;
  help: readonly string[];
  touch: boolean;
  family: FamilyId;
  modeId: ModeId;
  /** A step of the portals' training: no menu yet, the training may be passed. */
  training?: boolean;
}>();
const emit = defineEmits<{ resume: []; restart: []; settings: []; quit: []; skip: [] }>();

const { t } = useI18n();
const { settings } = useServices();

/** The falling families (falling, sand, volume) play with the gestures the player set. */
const gestures = computed(() => (props.touch ? gestureRows(props.family, settings.current) : []));
/** Words for what the drawings cannot say (the Mosaic's touch controls). */
const texts = computed(() => (props.touch && gestures.value.length === 0 ? props.help : []));
/** The gesture guide, over the pause. */
const guideOpen = ref(false);

const bindings = useKeyBindings();
/** The keys window, over the pause, for the families that take the player's keys. */
const keysOpen = ref(false);
const ownKeys = computed(() => !props.touch && props.family !== 'placement');

/**
 * The pause key pauses and resumes: it works both ways (the game's own keys
 * sleep under a window). The Mosaic keeps its P. The key stops here: the
 * window closes at once (1.42), and the game, finding no window open, would
 * take the same key as a new pause.
 */
const onKey = (event: KeyboardEvent) => {
  if (event.repeat || keysOpen.value || guideOpen.value) return;
  const pause =
    props.family === 'placement'
      ? event.code === 'KeyP'
      : bindings.value.actionFor(event.code) === 'pause';
  if (!pause) return;
  event.preventDefault();
  event.stopPropagation();
  emit('resume');
};
</script>

<template>
  <ModalDialog
    class="pause"
    :class="{ 'pause--legend': gestures.length > 0 || !touch }"
    :open="open"
    :title="t('pause.title')"
    :wide="gestures.length > 0 || !touch"
    @dismiss="emit('resume')"
    @keydown="onKey"
  >
    <button
      type="button"
      class="btn btn--primary btn--raised btn--block pause__resume"
      autofocus
      @click="emit('resume')"
    >
      <AppIcon name="play" :size="20" />{{ t('pause.resume') }}
    </button>
    <button
      v-if="training"
      type="button"
      class="btn btn--raised btn--block pause__skip"
      @click="emit('skip')"
    >
      <AppIcon name="right" :size="20" />{{ t('training.skip') }}
    </button>
    <div v-else class="sheet-buttons pause__more">
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
    <div v-if="gestures.length > 0" class="pause__gestures">
      <GestureList :rows="gestures" />
      <button type="button" class="pause__change" @click="guideOpen = true">
        {{ t('touch.guide') }}
      </button>
    </div>
    <GestureGuide
      v-if="gestures.length > 0"
      :open="guideOpen"
      :family="family"
      @close="guideOpen = false"
    />
    <div v-if="!touch" class="pause__legend">
      <KeyLegend :family="family" :mode-id="modeId" :surge="!training" />
      <button v-if="ownKeys" type="button" class="pause__change" @click="keysOpen = true">
        {{ t('keymap.change') }}
      </button>
    </div>
    <KeysDialog v-if="ownKeys" :open="keysOpen" @close="keysOpen = false" />
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

.pause__legend {
  display: grid;
  gap: var(--space-1);
}

/* Under the keys: a quiet link to change them. */
.pause__change {
  justify-self: center;
  min-height: var(--touch);
  padding: 0 var(--space-4);
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--accent-strong);
  font-size: 0.82rem;
  font-weight: 700;
  text-decoration: underline;
  text-underline-offset: 0.2em;
}

.pause__gestures {
  display: grid;
  gap: var(--space-1);
}

/* Two gestures a row; an odd last one takes the whole row. */
.pause__gestures :deep(.gestures) {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.pause__gestures :deep(.gesture:last-child:nth-child(odd)) {
  grid-column: 1 / -1;
}

/*
 * Short landscape screens (640 × 360): the essential keys only, as beside the
 * game (the pause has its button; the soft drop needs no reminder).
 */
@media (orientation: landscape) and (max-height: 32rem) {
  .pause__legend :deep(.legend) {
    gap: 0.2rem;
  }

  .pause__legend :deep(.legend__row--minor) {
    display: none;
  }
}

/* Landscape: the actions on the left, the gestures on the right. */
@media (orientation: landscape) {
  .pause--legend[open] {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }

  .pause--legend .pause__resume,
  .pause--legend .pause__skip,
  .pause--legend .pause__more {
    grid-column: 1;
  }

  .pause--legend .pause__legend {
    grid-column: 2;
    grid-row: 2 / span 3;
    align-self: center;
  }

  .pause--legend .pause__gestures {
    grid-column: 2;
    grid-row: 2 / span 3;
    align-self: center;
  }

  .pause--legend .pause__gestures :deep(.gestures) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.25rem;
  }

  .pause--legend .pause__gestures :deep(.gesture) {
    min-height: 2.4rem;
    padding-block: 0.2rem;
  }
}
</style>

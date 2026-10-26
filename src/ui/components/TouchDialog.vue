<script setup lang="ts">
import { computed, ref, useId } from 'vue';
import { useI18n } from 'vue-i18n';
import { useServices } from '@/app/AppServices';
import { useFormat } from '@/app/useFormat';
import { DRAG_SPEED } from '@/families/falling/input/phone/GestureTuning';
import { CONTROL_SCHEMES, type ControlScheme } from '@/services/SettingsService';
import GestureGuide from './GestureGuide.vue';
import ModalDialog from './ModalDialog.vue';

/**
 * The touch controls (1.32), in their own window as the keyboard's keys are:
 * play with gestures, buttons or both; the drag speed; turning by the side
 * tapped; the left-handed mirror; vibrations (a glow on a phone that cannot
 * vibrate). The gesture guide is a tap away.
 */
defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();

const { t } = useI18n();
const format = useFormat();
const { settings, haptics } = useServices();
const ids = { scheme: useId() };
const guideOpen = ref(false);

/** Each way of playing, and what it does. */
const SCHEMES: Readonly<Record<ControlScheme, { readonly label: string; readonly note: string }>> =
  {
    gestures: { label: 'touch.gestures', note: 'touch.gesturesNote' },
    buttons: { label: 'touch.buttons', note: 'touch.buttonsNote' },
    both: { label: 'touch.both', note: 'touch.bothNote' },
  };
/** The buttons alone: nothing is dragged or tapped. */
const buttonsOnly = computed(() => settings.current.controls === 'buttons');

const speedName = (speed: number) =>
  speed < DRAG_SPEED.standard ? 'calm' : speed > DRAG_SPEED.standard ? 'quick' : 'standard';
const speedText = computed(() =>
  t('touch.speed', {
    speed: format.factor(settings.current.dragSpeed),
    name: t(`touch.speedNames.${speedName(settings.current.dragSpeed)}`),
  }),
);

/** A phone that vibrates ticks; one that cannot (an iPhone) glows instead. */
const feel = haptics.supported
  ? { label: 'touch.vibrations', note: 'touch.vibrationsNote' }
  : { label: 'touch.glow', note: 'touch.glowNote' };

const checked = (event: Event) => (event.target as HTMLInputElement).checked;
const onSpeed = (event: Event) =>
  settings.setDragSpeed(Number((event.target as HTMLInputElement).value));
</script>

<template>
  <ModalDialog
    class="touch"
    :open="open"
    :title="t('touch.title')"
    closable
    wide
    @dismiss="emit('close')"
  >
    <div class="rows">
      <div class="row row--wrap" role="radiogroup" :aria-labelledby="ids.scheme">
        <span :id="ids.scheme" class="row__label">
          {{ t('touch.playWith') }}
          <small>{{ t(SCHEMES[settings.current.controls].note) }}</small>
        </span>
        <span class="segmented">
          <label v-for="scheme in CONTROL_SCHEMES" :key="scheme" class="segmented__option">
            <input
              type="radio"
              name="touch-scheme"
              :value="scheme"
              :checked="settings.current.controls === scheme"
              @change="settings.chooseControls(scheme)"
            />
            <span>{{ t(SCHEMES[scheme].label) }}</span>
          </label>
        </span>
      </div>

      <label class="row" :class="{ 'row--off': buttonsOnly }">
        <span class="row__label">
          {{ t('touch.dragSpeed') }}
          <small>{{ speedText }}</small>
        </span>
        <input
          class="range"
          type="range"
          :min="DRAG_SPEED.min"
          :max="DRAG_SPEED.max"
          :step="DRAG_SPEED.step"
          :value="settings.current.dragSpeed"
          :aria-valuetext="speedText"
          :disabled="buttonsOnly"
          @input="onSpeed"
        />
      </label>

      <label class="row" :class="{ 'row--off': buttonsOnly }">
        <span class="row__label">
          {{ t('touch.tapSides') }}
          <small>{{ t('touch.tapSidesNote') }}</small>
        </span>
        <input
          class="switch"
          type="checkbox"
          role="switch"
          :checked="settings.current.tapSides"
          :disabled="buttonsOnly"
          @change="settings.turnBySides(checked($event))"
        />
      </label>

      <label class="row">
        <span class="row__label">
          {{ t('touch.leftHanded') }}
          <small>{{ t('touch.leftHandedNote') }}</small>
        </span>
        <input
          class="switch"
          type="checkbox"
          role="switch"
          :checked="settings.current.leftHanded"
          @change="settings.playLeftHanded(checked($event))"
        />
      </label>

      <label class="row">
        <span class="row__label">
          {{ t(feel.label) }}
          <small>{{ t(feel.note) }}</small>
        </span>
        <input
          class="switch"
          type="checkbox"
          role="switch"
          :checked="settings.current.haptics"
          @change="settings.allowHaptics(checked($event))"
        />
      </label>
    </div>

    <div class="sheet-buttons">
      <button
        type="button"
        class="btn btn--raised"
        :disabled="buttonsOnly"
        @click="guideOpen = true"
      >
        {{ t('touch.guide') }}
      </button>
      <button type="button" class="btn btn--primary btn--raised" @click="emit('close')">
        {{ t('settings.close') }}
      </button>
    </div>
    <GestureGuide :open="guideOpen" :family="null" @close="guideOpen = false" />
  </ModalDialog>
</template>

<style scoped src="./settingsRows.css"></style>

<script setup lang="ts">
import { ref, useId } from 'vue';
import { useI18n } from 'vue-i18n';
import { useServices } from '@/app/AppServices';
import { EFFECT_LEVELS, type EffectsLevel } from '@/fx/EffectsProfile';
import { isLocale, LOCALES } from '@/i18n/locales';
import { isTouchScreen } from '../useOrientation';
import KeysDialog from './KeysDialog.vue';
import ModalDialog from './ModalDialog.vue';
import TouchDialog from './TouchDialog.vue';

/**
 * The settings, one row each: language, the touch controls or the
 * keyboard's keys (each in its own window), ghost piece, effects, shake,
 * the two volumes. Two columns on a wide screen; nothing to scroll.
 */
defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();

const { t } = useI18n();
const { settings, platform } = useServices();
const appVersion = __APP_VERSION__;
const ids = { effects: useId() };

const EFFECT_LABELS: Readonly<Record<EffectsLevel, string>> = {
  full: 'settings.effectsFull',
  reduced: 'settings.effectsReduced',
  off: 'settings.effectsOff',
};

/** A touch screen sets its touch controls; a keyboard device, its keys. */
const touch = isTouchScreen();
const keysOpen = ref(false);
const touchOpen = ref(false);

const onLocale = (event: Event) => {
  const value = (event.target as HTMLSelectElement).value;
  if (isLocale(value)) settings.chooseLocale(value);
};
const checked = (event: Event) => (event.target as HTMLInputElement).checked;
const percent = (event: Event) => Number((event.target as HTMLInputElement).value) / 100;
const onGhost = (event: Event) => settings.showGhost(checked(event));
const onEffects = (value: EffectsLevel) => settings.chooseEffects(value);
const onShake = (event: Event) => settings.allowShake(checked(event));
const onVolume = (event: Event) => settings.setVolume(percent(event));
const onMusic = (event: Event) => settings.setMusicVolume(percent(event));
</script>

<template>
  <ModalDialog
    class="settings"
    :open="open"
    :title="t('settings.title')"
    closable
    wide
    @dismiss="emit('close')"
  >
    <div class="rows">
      <label class="row">
        <span class="row__label">{{ t('settings.language') }}</span>
        <select class="select" :value="settings.current.locale" @change="onLocale">
          <option v-for="code in LOCALES" :key="code" :value="code" :lang="code">
            {{ t(`languages.${code}`) }}
          </option>
        </select>
      </label>

      <div v-if="touch" class="row row--static">
        <span class="row__label">{{ t('touch.title') }}</span>
        <button type="button" class="btn btn--raised row__button" @click="touchOpen = true">
          {{ t('touch.open') }}
        </button>
      </div>

      <div v-else class="row row--static">
        <span class="row__label">{{ t('keymap.row') }}</span>
        <button type="button" class="btn btn--raised row__button" @click="keysOpen = true">
          {{ t('keymap.open') }}
        </button>
      </div>

      <label class="row">
        <span class="row__label">{{ t('settings.ghost') }}</span>
        <input
          class="switch"
          type="checkbox"
          role="switch"
          :checked="settings.current.ghost"
          @change="onGhost"
        />
      </label>

      <div class="row row--wrap" role="radiogroup" :aria-labelledby="ids.effects">
        <span :id="ids.effects" class="row__label">{{ t('settings.effects') }}</span>
        <span class="segmented">
          <label v-for="level in EFFECT_LEVELS" :key="level" class="segmented__option">
            <input
              type="radio"
              name="effects"
              :value="level"
              :checked="settings.current.effects === level"
              @change="onEffects(level)"
            />
            <span>{{ t(EFFECT_LABELS[level]) }}</span>
          </label>
        </span>
      </div>

      <label class="row" :class="{ 'row--off': settings.current.effects !== 'full' }">
        <span class="row__label">{{ t('settings.shake') }}</span>
        <input
          class="switch"
          type="checkbox"
          role="switch"
          :checked="settings.current.shake"
          :disabled="settings.current.effects !== 'full'"
          @change="onShake"
        />
      </label>

      <label class="row">
        <span class="row__label">{{ t('settings.volume') }}</span>
        <input
          class="range"
          type="range"
          min="0"
          max="100"
          step="5"
          :value="Math.round(settings.current.volume * 100)"
          @input="onVolume"
        />
      </label>

      <label class="row">
        <span class="row__label">{{ t('settings.music') }}</span>
        <input
          class="range"
          type="range"
          min="0"
          max="100"
          step="5"
          :value="Math.round(settings.current.musicVolume * 100)"
          @input="onMusic"
        />
      </label>
    </div>

    <button
      type="button"
      class="btn btn--primary btn--raised btn--block settings__done"
      @click="emit('close')"
    >
      {{ t('settings.close') }}
    </button>

    <!-- On a portal, the save goes through the platform (sometimes its cloud). Yandex
         counts a version number as developer information: none there. -->
    <p class="sheet-note settings__about">
      {{ t(platform.storage ? 'app.privacyPortal' : 'app.privacy') }}
      <template v-if="platform.showsVersion">{{
        t('app.version', { version: appVersion })
      }}</template>
    </p>
    <TouchDialog v-if="touch" :open="touchOpen" @close="touchOpen = false" />
    <KeysDialog v-else :open="keysOpen" @close="keysOpen = false" />
  </ModalDialog>
</template>

<style scoped src="./settingsRows.css"></style>

<style scoped>
/* Short phones: the corner button closes, the room goes to the rows. */
@media (max-height: 44rem) {
  .settings__done {
    display: none;
  }
}

/* Landscape: the corner button closes. */
@media (orientation: landscape) {
  .settings__done {
    display: none;
  }

  .settings__about {
    font-size: 0.72rem;
  }
}

/* The smallest landscape screens: only the settings. */
@media (orientation: landscape) and (max-height: 23.75rem) {
  .settings__about {
    display: none;
  }
}
</style>

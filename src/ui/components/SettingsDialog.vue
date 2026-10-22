<script setup lang="ts">
import { ref, useId } from 'vue';
import { useI18n } from 'vue-i18n';
import { useServices } from '@/app/AppServices';
import { EFFECT_LEVELS, type EffectsLevel } from '@/fx/EffectsProfile';
import { isLocale, LOCALES } from '@/i18n/locales';
import { CONTROL_SCHEMES, type ControlScheme } from '@/services/SettingsService';
import { isTouchScreen } from '../useOrientation';
import KeysDialog from './KeysDialog.vue';
import ModalDialog from './ModalDialog.vue';

/**
 * The settings, one row each: language, controls (touch screens) or the
 * keyboard's keys (their own window), ghost piece, effects, shake,
 * vibration, the two volumes. Two columns on a wide screen; nothing to scroll.
 */
defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();

const { t } = useI18n();
const { settings, haptics, platform } = useServices();
const appVersion = __APP_VERSION__;
const ids = { controls: useId(), effects: useId() };

const EFFECT_LABELS: Readonly<Record<EffectsLevel, string>> = {
  full: 'settings.effectsFull',
  reduced: 'settings.effectsReduced',
  off: 'settings.effectsOff',
};

const CONTROL_LABELS: Readonly<Record<ControlScheme, string>> = {
  gestures: 'settings.controlsGestures',
  buttons: 'settings.controlsButtons',
};
/** The choice of controls only means something on a touch screen. */
const touch = isTouchScreen();
const onControls = (value: ControlScheme) => settings.update({ controls: value });
const keysOpen = ref(false);

const onLocale = (event: Event) => {
  const value = (event.target as HTMLSelectElement).value;
  if (isLocale(value)) settings.update({ locale: value });
};
const checked = (event: Event) => (event.target as HTMLInputElement).checked;
const onGhost = (event: Event) => settings.update({ ghost: checked(event) });
const onEffects = (value: EffectsLevel) => settings.update({ effects: value });
const onShake = (event: Event) => settings.update({ shake: checked(event) });
const onHaptics = (event: Event) => settings.update({ haptics: checked(event) });
const onVolume = (event: Event) =>
  settings.update({ volume: Number((event.target as HTMLInputElement).value) / 100, muted: false });
const onMusic = (event: Event) =>
  settings.update({
    musicVolume: Number((event.target as HTMLInputElement).value) / 100,
    muted: false,
  });
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

      <div v-if="touch" class="row row--wrap" role="radiogroup" :aria-labelledby="ids.controls">
        <span :id="ids.controls" class="row__label">
          {{ t('settings.controls') }}
          <small>{{ t('settings.controlsHint') }}</small>
        </span>
        <span class="segmented">
          <label v-for="scheme in CONTROL_SCHEMES" :key="scheme" class="segmented__option">
            <input
              type="radio"
              name="controls"
              :value="scheme"
              :checked="settings.current.controls === scheme"
              @change="onControls(scheme)"
            />
            <span>{{ t(CONTROL_LABELS[scheme]) }}</span>
          </label>
        </span>
      </div>

      <div v-if="!touch" class="row row--static">
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

      <label v-if="haptics.supported" class="row">
        <span class="row__label">{{ t('settings.haptics') }}</span>
        <input
          class="switch"
          type="checkbox"
          role="switch"
          :checked="settings.current.haptics"
          @change="onHaptics"
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

    <!-- On a portal, the save goes through the platform (sometimes its cloud). -->
    <p class="sheet-note settings__about">
      {{ t(platform.storage ? 'app.privacyPortal' : 'app.privacy') }}
      {{ t('app.version', { version: appVersion }) }}
    </p>
    <KeysDialog v-if="!touch" :open="keysOpen" @close="keysOpen = false" />
  </ModalDialog>
</template>

<style scoped>
.rows {
  display: grid;
  gap: 0.375rem;
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  min-height: 2.85rem;
  padding: 0.2rem 0.375rem 0.2rem var(--space-3);
  border-radius: 1rem;
  background: var(--highlight);
  font-size: 0.85rem;
  font-weight: 700;
  cursor: pointer;
}

/* A label and a long control: the control goes under the label when it lacks room. */
.row--wrap {
  flex-wrap: wrap;
  cursor: default;
}

.row--off {
  color: var(--text-muted);
  cursor: default;
}

/* A row whose control is a button: the row itself is not one. */
.row--static {
  cursor: default;
}

.row__button {
  min-height: var(--touch);
  padding-block: 0;
  font-size: 0.8rem;
}

.row__label {
  display: grid;
  min-width: 0;
}

.row--wrap .row__label {
  flex: 1 1 6rem;
}

.row__label small {
  color: var(--text-muted);
  font-size: 0.72rem;
  font-weight: 600;
}

.select {
  min-height: 2.5rem;
  padding: 0 var(--space-3);
  border: 1px solid var(--border);
  border-radius: 0.75rem;
  background: var(--surface);
  font-weight: 700;
}

/* Two or three choices in a pill; the chosen one is gold. */
.segmented {
  display: grid;
  grid-auto-columns: auto;
  grid-auto-flow: column;
  gap: 0.2rem;
  margin-left: auto;
  padding: 0.2rem;
  border-radius: 0.75rem;
  background: var(--well-bg);
}

.segmented__option {
  position: relative;
  display: grid;
}

.segmented__option input {
  position: absolute;
  inset: 0;
  margin: 0;
  opacity: 0;
  cursor: pointer;
}

.segmented__option span {
  display: grid;
  place-items: center;
  min-height: var(--touch);
  padding: 0 0.55rem;
  border-radius: 0.6rem;
  color: var(--text-muted);
  font-size: 0.78rem;
  font-weight: 800;
}

.segmented__option input:checked + span {
  background: var(--accent-fill);
  color: var(--on-accent-fill);
}

.segmented__option input:focus-visible + span {
  outline: 3px solid var(--focus);
  outline-offset: 1px;
}

/* A switch: a checkbox drawn as a sliding knob. */
.switch {
  appearance: none;
  position: relative;
  flex: none;
  width: 3.25rem;
  height: 2rem;
  margin: 0;
  border-radius: 999px;
  background: var(--border);
  cursor: pointer;
  transition: background-color 200ms ease;
}

.switch::after {
  content: '';
  position: absolute;
  top: 0.25rem;
  left: 0.25rem;
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 50%;
  background: var(--text);
  box-shadow: 0 2px 6px var(--shade);
  transition: transform 240ms var(--ease-spring);
}

.switch:checked {
  background: var(--accent-fill);
}

.switch:checked::after {
  transform: translateX(1.25rem);
}

.switch:disabled {
  opacity: 0.45;
  cursor: default;
}

.range {
  width: min(48%, 12rem);
  min-height: 2.5rem;
  margin: 0;
  accent-color: var(--accent-fill);
}

/* Short phones: the corner button closes, the room goes to the rows. */
@media (max-height: 44rem) {
  .settings__done {
    display: none;
  }
}

/* Landscape: the rows in two columns; the corner button closes. */
@media (orientation: landscape) {
  .rows {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    grid-auto-flow: row dense;
    column-gap: var(--space-2);
  }

  .row {
    min-height: 2.75rem;
  }

  /* The choices in a pill take a whole line, so that they never wrap. */
  .row--wrap {
    grid-column: 1 / -1;
  }

  .row__label small {
    display: none;
  }

  .settings__done {
    display: none;
  }

  .settings__about {
    font-size: 0.72rem;
  }
}

/* A phone on its side (844 × 390): the rows closer together (their targets keep 44 px). */
@media (orientation: landscape) and (max-height: 26rem) {
  .rows {
    gap: 0.25rem;
  }

  .row {
    padding-block: 0;
  }

  .segmented {
    padding: 0.1rem;
  }
}

/* The smallest landscape screens: only the settings. */
@media (orientation: landscape) and (max-height: 23.75rem) {
  .settings__about {
    display: none;
  }
}
</style>

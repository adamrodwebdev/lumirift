<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { useServices } from '@/app/AppServices';
import { EFFECT_LEVELS, type EffectsLevel } from '@/fx/EffectsProfile';
import { isLocale, LOCALES } from '@/i18n/locales';
import { CONTROL_SCHEMES, type ControlScheme } from '@/services/SettingsService';
import { isTouchScreen } from '../useOrientation';
import ModalDialog from './ModalDialog.vue';

defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();

const { t } = useI18n();
const { settings, haptics, platform } = useServices();
const appVersion = __APP_VERSION__;

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
  <ModalDialog :open="open" :title="t('settings.title')" @dismiss="emit('close')">
    <div class="settings">
      <label class="field">
        <span class="field__label">{{ t('settings.language') }}</span>
        <select class="field__control" :value="settings.current.locale" @change="onLocale">
          <option v-for="code in LOCALES" :key="code" :value="code" :lang="code">
            {{ t(`languages.${code}`) }}
          </option>
        </select>
      </label>

      <fieldset v-if="touch" class="field">
        <legend class="field__label">{{ t('settings.controls') }}</legend>
        <div class="segmented">
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
        </div>
        <p class="field__hint">{{ t('settings.controlsHint') }}</p>
      </fieldset>

      <label class="toggle">
        <input type="checkbox" :checked="settings.current.ghost" @change="onGhost" />
        <span>{{ t('settings.ghost') }}</span>
      </label>

      <fieldset class="field">
        <legend class="field__label">{{ t('settings.effects') }}</legend>
        <div class="segmented">
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
        </div>
      </fieldset>

      <label class="toggle">
        <input
          type="checkbox"
          :checked="settings.current.shake"
          :disabled="settings.current.effects !== 'full'"
          @change="onShake"
        />
        <span>{{ t('settings.shake') }}</span>
      </label>

      <label v-if="haptics.supported" class="toggle">
        <input type="checkbox" :checked="settings.current.haptics" @change="onHaptics" />
        <span>{{ t('settings.haptics') }}</span>
      </label>

      <label class="field">
        <span class="field__label">{{ t('settings.volume') }}</span>
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

      <label class="field">
        <span class="field__label">{{ t('settings.music') }}</span>
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

      <button type="button" class="btn btn--primary" @click="emit('close')">
        {{ t('settings.close') }}
      </button>

      <footer class="about">
        <!-- On a portal, the save goes through the platform (sometimes its cloud). -->
        <p>{{ t(platform.storage ? 'app.privacyPortal' : 'app.privacy') }}</p>
        <p>{{ t('app.version', { version: appVersion }) }}</p>
      </footer>
    </div>
  </ModalDialog>
</template>

<style scoped>
.settings {
  display: grid;
  gap: var(--space-4);
}

.about {
  display: grid;
  gap: var(--space-1);
  padding-top: var(--space-3);
  border-top: 1px solid var(--border);
  color: var(--text-muted);
  font-size: 0.8rem;
}

.field {
  display: grid;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  border: 0;
}

.field__label {
  font-weight: 600;
  padding: 0;
}

.field__hint {
  font-size: 0.8rem;
  color: var(--text-muted);
}

.field__control {
  min-height: var(--touch);
  padding: 0 var(--space-3);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface-2);
}

.segmented {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(0, 1fr);
  gap: var(--space-1);
  padding: var(--space-1);
  border-radius: var(--radius-sm);
  background: var(--surface-2);
}

.segmented__option {
  position: relative;
  display: grid;
}

.segmented__option input {
  position: absolute;
  inset: 0;
  opacity: 0;
  margin: 0;
  cursor: pointer;
}

.segmented__option span {
  display: grid;
  place-items: center;
  min-height: var(--touch);
  border-radius: calc(var(--radius-sm) - 2px);
  font-weight: 600;
}

.segmented__option input:checked + span {
  background: var(--surface);
  box-shadow: 0 1px 3px rgb(0 0 0 / 0.15);
}

.segmented__option input:focus-visible + span {
  outline: 3px solid var(--focus);
  outline-offset: 1px;
}

.toggle {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-height: var(--touch);
  cursor: pointer;
}

.range {
  width: 100%;
  min-height: var(--touch);
  accent-color: var(--accent-fill);
}

.toggle input:disabled + span {
  color: var(--text-muted);
}

.toggle input {
  width: 1.25rem;
  height: 1.25rem;
  accent-color: var(--accent-fill);
}
</style>

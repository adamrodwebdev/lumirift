<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { useServices } from '@/app/AppServices';
import { isLocale, LOCALES } from '@/i18n/locales';
import { THEME_PREFERENCES, type ThemePreference } from '@/services/SettingsService';
import ModalDialog from './ModalDialog.vue';

defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();

const { t } = useI18n();
const { settings } = useServices();

const onLocale = (event: Event) => {
  const value = (event.target as HTMLSelectElement).value;
  if (isLocale(value)) settings.update({ locale: value });
};
const onTheme = (value: ThemePreference) => settings.update({ theme: value });
const onGhost = (event: Event) =>
  settings.update({ ghost: (event.target as HTMLInputElement).checked });
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

      <fieldset class="field">
        <legend class="field__label">{{ t('settings.theme') }}</legend>
        <div class="segmented">
          <label v-for="option in THEME_PREFERENCES" :key="option" class="segmented__option">
            <input
              type="radio"
              name="theme"
              :value="option"
              :checked="settings.current.theme === option"
              @change="onTheme(option)"
            />
            <span>{{ t(`settings.${option}`) }}</span>
          </label>
        </div>
      </fieldset>

      <label class="toggle">
        <input type="checkbox" :checked="settings.current.ghost" @change="onGhost" />
        <span>{{ t('settings.ghost') }}</span>
      </label>

      <button type="button" class="btn btn--primary" @click="emit('close')">
        {{ t('settings.close') }}
      </button>
    </div>
  </ModalDialog>
</template>

<style scoped>
.settings {
  display: grid;
  gap: var(--space-4);
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

.field__control {
  min-height: var(--touch);
  padding: 0 var(--space-3);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface-2);
}

.segmented {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
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

.toggle input {
  width: 1.25rem;
  height: 1.25rem;
  accent-color: var(--accent-fill);
}
</style>

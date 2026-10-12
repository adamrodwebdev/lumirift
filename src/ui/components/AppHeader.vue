<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useServices } from '@/app/AppServices';
import AppIcon from './AppIcon.vue';
import BrandMark from './BrandMark.vue';

defineProps<{ inGame: boolean }>();
const emit = defineEmits<{ home: []; settings: [] }>();

const { t } = useI18n();
const { theme, settings } = useServices();
const muted = computed(() => settings.current.muted);
const isDark = computed(() => theme.resolved.value === 'dark');
</script>

<template>
  <header class="header">
    <button
      v-if="inGame"
      type="button"
      class="btn btn--ghost btn--icon"
      :aria-label="t('nav.home')"
      @click="emit('home')"
    >
      <AppIcon name="back" />
    </button>
    <BrandMark class="header__brand" />
    <div class="header__actions">
      <button
        type="button"
        class="btn btn--ghost btn--icon"
        :aria-label="muted ? t('nav.unmute') : t('nav.mute')"
        :aria-pressed="muted"
        @click="settings.update({ muted: !muted })"
      >
        <AppIcon :name="muted ? 'mute' : 'sound'" />
      </button>
      <button
        type="button"
        class="btn btn--ghost btn--icon"
        :aria-label="isDark ? t('nav.toLight') : t('nav.toDark')"
        @click="theme.toggle()"
      >
        <AppIcon :name="isDark ? 'sun' : 'moon'" />
      </button>
      <button
        type="button"
        class="btn btn--ghost btn--icon"
        :aria-label="t('nav.settings')"
        @click="emit('settings')"
      >
        <AppIcon name="settings" />
      </button>
    </div>
  </header>
</template>

<style scoped>
.header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  height: var(--header-h);
  padding: 0 var(--space-2);
  border-bottom: 1px solid var(--border);
  background: var(--bg);
}

.header__brand {
  font-size: 1.25rem;
}

.header__actions {
  display: flex;
  gap: var(--space-1);
  margin-left: auto;
}

@media (min-width: 768px) {
  .header {
    padding: 0 var(--space-4);
  }
}
</style>

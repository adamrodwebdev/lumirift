<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import AppIcon from './AppIcon.vue';
import ModalDialog from './ModalDialog.vue';

defineProps<{ open: boolean }>();
const emit = defineEmits<{ resume: []; restart: []; quit: [] }>();

const { t } = useI18n();
</script>

<template>
  <ModalDialog :open="open" :title="t('pause.title')" @dismiss="emit('resume')">
    <div class="actions">
      <button type="button" class="btn btn--primary" autofocus @click="emit('resume')">
        <AppIcon name="play" :size="20" />{{ t('pause.resume') }}
      </button>
      <button type="button" class="btn" @click="emit('restart')">
        <AppIcon name="restart" :size="20" />{{ t('pause.restart') }}
      </button>
      <button type="button" class="btn" @click="emit('quit')">
        <AppIcon name="back" :size="20" />{{ t('pause.quit') }}
      </button>
    </div>
    <p class="help">{{ t('controls.keyboard') }}</p>
    <p class="help">{{ t('controls.touch') }}</p>
  </ModalDialog>
</template>

<style scoped>
.actions {
  display: grid;
  gap: var(--space-2);
  margin-bottom: var(--space-4);
}

.help {
  font-size: 0.875rem;
  color: var(--text-muted);
}

.help + .help {
  margin-top: var(--space-2);
}
</style>

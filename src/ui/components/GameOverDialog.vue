<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { GameOutcome } from '../GameOutcome';
import AppIcon from './AppIcon.vue';
import ModalDialog from './ModalDialog.vue';

defineProps<{ open: boolean; outcome: GameOutcome | null; shareStatus: string }>();
const emit = defineEmits<{ again: []; home: []; share: [] }>();

const { t } = useI18n();
</script>

<template>
  <ModalDialog :open="open" :title="t('over.title')" @dismiss="emit('home')">
    <template v-if="outcome">
      <p class="reason">{{ t(`over.reason.${outcome.reason}`) }}</p>
      <div class="result">
        <span class="result__label">{{ t('over.result') }}</span>
        <span class="result__value">{{ outcome.value }}</span>
        <span v-if="outcome.isNewBest" class="result__badge">{{ t('over.newBest') }}</span>
        <span v-else class="result__best">{{ t('over.best', { value: outcome.best }) }}</span>
      </div>
    </template>
    <div class="actions">
      <button type="button" class="btn btn--primary" autofocus @click="emit('again')">
        <AppIcon name="restart" :size="20" />{{ t('over.again') }}
      </button>
      <button type="button" class="btn" @click="emit('share')">
        <AppIcon name="share" :size="20" />{{ t('over.share') }}
      </button>
      <button type="button" class="btn" @click="emit('home')">
        <AppIcon name="back" :size="20" />{{ t('over.home') }}
      </button>
    </div>
    <p class="status" role="status">{{ shareStatus }}</p>
  </ModalDialog>
</template>

<style scoped>
.reason {
  color: var(--text-muted);
}

.result {
  display: grid;
  justify-items: center;
  gap: var(--space-1);
  margin: var(--space-4) 0 var(--space-6);
  padding: var(--space-4);
  border-radius: var(--radius-sm);
  background: var(--surface-2);
}

.result__label {
  font-size: 0.8rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.result__value {
  font-family: var(--font-display);
  font-size: clamp(2.2rem, 1.6rem + 3vw, 3rem);
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

.result__badge {
  padding: var(--space-1) var(--space-3);
  border-radius: 999px;
  background: var(--accent-fill);
  color: var(--on-accent-fill);
  font-weight: 700;
}

.result__best {
  color: var(--text-muted);
}

.actions {
  display: grid;
  gap: var(--space-2);
}

.status {
  min-height: 1.5em;
  margin-top: var(--space-3);
  font-size: 0.875rem;
  color: var(--text-muted);
  text-align: center;
}
</style>

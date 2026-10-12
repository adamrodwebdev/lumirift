<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { GameOutcome } from '../GameOutcome';
import { useProgressText } from '../useProgressText';
import AppIcon from './AppIcon.vue';
import ModalDialog from './ModalDialog.vue';

defineProps<{ open: boolean; outcome: GameOutcome | null; shareStatus: string }>();
const emit = defineEmits<{ again: []; home: []; share: [] }>();

const { t } = useI18n();
const text = useProgressText();
</script>

<template>
  <ModalDialog
    :open="open"
    :title="outcome?.reason === 'victory' ? t('over.victory') : t('over.title')"
    @dismiss="emit('home')"
  >
    <template v-if="outcome">
      <p class="reason">{{ t(`over.reason.${outcome.reason}`) }}</p>
      <div class="result">
        <span class="result__label">{{ t('over.result') }}</span>
        <span class="result__value">{{ outcome.value }}</span>
        <span v-if="outcome.isNewBest" class="result__badge">{{ t('over.newBest') }}</span>
        <span v-else class="result__best">{{ t('over.best', { value: outcome.best }) }}</span>
      </div>
      <section v-if="outcome.progress.total > 0" class="progress" :aria-label="t('progress.title')">
        <p class="progress__total">{{ t('progress.gained', { n: outcome.progress.total }) }}</p>
        <ul class="progress__lines">
          <li v-for="line in outcome.progress.xp" :key="line.source + line.amount">
            <span>{{ t(`progress.source.${line.source}`) }}</span>
            <span>+{{ line.amount }}</span>
          </li>
        </ul>
        <p v-if="outcome.progress.levelAfter > outcome.progress.levelBefore" class="progress__news">
          {{ t('progress.levelUp', { n: outcome.progress.levelAfter }) }}
        </p>
        <p
          v-for="objective in outcome.progress.completed"
          :key="objective.kind"
          class="progress__news"
        >
          <AppIcon name="check" :size="16" />
          {{ t('progress.objectiveDone', { text: text.objective(objective) }) }}
        </p>
        <p
          v-for="cosmetic in outcome.progress.unlocked"
          :key="cosmetic.kind + cosmetic.id"
          class="progress__news"
        >
          {{
            t('progress.unlocked', {
              name: text.cosmeticName(cosmetic),
              kind: t(`cosmetics.one.${cosmetic.kind}`),
            })
          }}
        </p>
      </section>
      <p v-else class="progress__hint">{{ t('progress.tooShort') }}</p>
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

.progress {
  display: grid;
  gap: var(--space-2);
  margin-block-end: var(--space-6);
}

.progress__total {
  font-weight: 800;
  color: var(--accent);
}

.progress__lines {
  display: grid;
  gap: var(--space-1);
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 0.875rem;
  color: var(--text-muted);
}

.progress__lines li {
  display: flex;
  justify-content: space-between;
  font-variant-numeric: tabular-nums;
}

.progress__hint {
  margin-block-end: var(--space-6);
  font-size: 0.875rem;
  color: var(--text-muted);
}

.progress__news {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-weight: 700;
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

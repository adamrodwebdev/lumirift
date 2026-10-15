<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { CampaignLevel } from '@/campaign/Levels';
import type { GameOutcome } from '../GameOutcome';
import { useProgressText } from '../useProgressText';
import AppIcon from './AppIcon.vue';
import ModalDialog from './ModalDialog.vue';
import StarRow from './StarRow.vue';

const props = defineProps<{
  open: boolean;
  outcome: GameOutcome | null;
  /** A message for the player: link copied, experience doubled… */
  status: string;
  /** False on portals, which forbid links out of the game. */
  canShare?: boolean;
  /** The rewarded ad offered (double the experience), or waiting for it. */
  reward?: 'offer' | 'busy' | 'none';
}>();
const emit = defineEmits<{
  again: [];
  home: [];
  share: [];
  campaign: [];
  next: [level: CampaignLevel];
  /** The player chooses to watch an ad for the bonus. */
  double: [];
}>();

const { t } = useI18n();
const text = useProgressText();

const title = computed(() => {
  const outcome = props.outcome;
  if (outcome?.campaign) return t(outcome.campaign.won ? 'campaign.won' : 'campaign.lost');
  return outcome?.reason === 'victory' ? t('over.victory') : t('over.title');
});
</script>

<template>
  <ModalDialog
    :open="open"
    :title="title"
    @dismiss="outcome?.campaign ? emit('campaign') : emit('home')"
  >
    <template v-if="outcome">
      <p class="reason">{{ t(`over.reason.${outcome.reason}`) }}</p>
      <div v-if="outcome.campaign" class="level">
        <StarRow
          :count="outcome.campaign.stars"
          :label="t('campaign.starsWon', { n: outcome.campaign.stars }, outcome.campaign.stars)"
          :size="36"
        />
        <p v-if="outcome.campaign.gained > 0" class="level__gained">
          {{ t('campaign.gained', { n: outcome.campaign.gained }, outcome.campaign.gained) }}
        </p>
        <p v-else-if="outcome.campaign.won" class="level__gained">{{ t('campaign.noBetter') }}</p>
      </div>
      <div class="result">
        <span class="result__label">{{ t('over.result') }}</span>
        <span class="result__value">{{ outcome.value }}</span>
        <template v-if="!outcome.campaign">
          <span v-if="outcome.isNewBest" class="result__badge">{{ t('over.newBest') }}</span>
          <span v-else class="result__best">{{ t('over.best', { value: outcome.best }) }}</span>
        </template>
      </div>
      <section v-if="outcome.progress.total > 0" class="progress" :aria-label="t('progress.title')">
        <p class="progress__total">{{ t('progress.gained', { n: outcome.progress.total }) }}</p>
        <button
          v-if="reward === 'offer' || reward === 'busy'"
          type="button"
          class="btn reward"
          :disabled="reward === 'busy'"
          :aria-label="t('over.doubleXpLabel', { n: outcome.progress.total })"
          @click="emit('double')"
        >
          <span class="reward__badge" aria-hidden="true">
            <AppIcon name="play" :size="14" />{{ t('over.adBadge') }}
          </span>
          <span aria-hidden="true">{{ t('over.doubleXp', { n: outcome.progress.total }) }}</span>
        </button>
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
    <div v-if="outcome?.campaign" class="actions">
      <button
        v-if="outcome.campaign.next"
        type="button"
        class="btn btn--primary"
        autofocus
        @click="outcome.campaign.next && emit('next', outcome.campaign.next)"
      >
        <AppIcon name="play" :size="20" />
        {{ t('campaign.nextLevel', { level: outcome.campaign.next.id }) }}
      </button>
      <button
        type="button"
        class="btn"
        :class="{ 'btn--primary': !outcome.campaign.next }"
        @click="emit('again')"
      >
        <AppIcon name="restart" :size="20" />{{ t('campaign.retry') }}
      </button>
      <button type="button" class="btn" @click="emit('campaign')">
        <AppIcon name="back" :size="20" />{{ t('campaign.map') }}
      </button>
    </div>
    <div v-else class="actions">
      <button type="button" class="btn btn--primary" autofocus @click="emit('again')">
        <AppIcon name="restart" :size="20" />{{ t('over.again') }}
      </button>
      <button v-if="canShare !== false" type="button" class="btn" @click="emit('share')">
        <AppIcon name="share" :size="20" />{{ t('over.share') }}
      </button>
      <button type="button" class="btn" @click="emit('home')">
        <AppIcon name="back" :size="20" />{{ t('over.home') }}
      </button>
    </div>
    <p class="status" role="status">{{ status }}</p>
  </ModalDialog>
</template>

<style scoped>
.level {
  display: grid;
  justify-items: center;
  gap: var(--space-1);
  margin-block-start: var(--space-4);
}

.level__gained {
  font-weight: 800;
  color: var(--accent);
}

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

/* The rewarded ad: an option, labelled as an ad, never the main action. */
.reward {
  justify-self: center;
  gap: var(--space-2);
}

.reward__badge {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px var(--space-2);
  border-radius: 999px;
  background: var(--accent-fill);
  color: var(--on-accent-fill);
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.06em;
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

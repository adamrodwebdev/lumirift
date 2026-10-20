<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useServices } from '@/app/AppServices';
import { LEVELS, type CampaignLevel } from '@/campaign/Levels';
import { timeBonusMs, UPGRADES } from '@/campaign/Upgrades';
import { allowsLevel } from '@/platform/Edition';
import AppIcon from '../components/AppIcon.vue';
import ModalDialog from '../components/ModalDialog.vue';
import StarRow from '../components/StarRow.vue';
import { upgradeHelps, useCampaignText } from '../useCampaignText';
import GemCanvas from './GemCanvas.vue';

/**
 * A level of the campaign before it starts: its goal, its clock, how stars
 * are won, the best result and the upgrades that help. A level still closed
 * says what opens it.
 */
const props = defineProps<{ level: CampaignLevel | null }>();
const emit = defineEmits<{ play: [level: CampaignLevel]; close: [] }>();

const { t } = useI18n();
const { campaign, catalog, platform } = useServices();
const text = useCampaignText();

const detail = computed(() => {
  const level = props.level;
  if (!level) return null;
  const model = campaign.model;
  const family = catalog.get(level.modeId).family;
  const bonus = timeBonusMs(model.snapshot.ranks);
  const inEdition = allowsLevel(platform.edition, level);
  const previous = LEVELS[LEVELS.indexOf(level) - 1];
  return {
    level,
    best: model.starsOf(level.id),
    time: level.timeLimitMs === null ? null : text.duration(level.timeLimitMs + bonus),
    bonus: level.timeLimitMs === null || bonus === 0 ? null : text.duration(bonus),
    helping: UPGRADES.filter(
      (upgrade) => model.rankOf(upgrade.id) > 0 && upgradeHelps(upgrade, level.modeId, family),
    ),
    /** Why it cannot be played yet; null when it can. */
    closed: !inEdition
      ? t('demo.fullGame')
      : !model.isUnlocked(level) && previous
        ? t('campaign.lockedNote', { level: previous.id })
        : null,
  };
});
</script>

<template>
  <ModalDialog
    :open="detail !== null"
    :title="
      detail
        ? t('campaign.levelTitle', {
            level: detail.level.id,
            mode: t(`modes.${detail.level.modeId}.name`),
          })
        : ''
    "
    @dismiss="emit('close')"
  >
    <template v-if="detail">
      <GemCanvas class="art" :mode="detail.level.modeId" />
      <dl class="facts">
        <dt>{{ t('campaign.goalLabel') }}</dt>
        <dd>{{ text.goal(detail.level) }}</dd>
        <template v-if="detail.time">
          <dt>{{ t('campaign.timeLabel') }}</dt>
          <dd>
            {{ detail.time }}
            <span v-if="detail.bonus" class="facts__bonus">
              {{ t('campaign.timeBonus', { time: detail.bonus }) }}
            </span>
          </dd>
        </template>
        <dt>{{ t('campaign.starsLabel') }}</dt>
        <dd>{{ text.stars(detail.level) }}</dd>
        <dt>{{ t('campaign.bestLabel') }}</dt>
        <dd>
          <StarRow
            :count="detail.best"
            :label="t('campaign.starsWon', { n: detail.best }, detail.best)"
            :size="20"
          />
        </dd>
        <template v-if="detail.helping.length > 0">
          <dt>{{ t('campaign.helpingLabel') }}</dt>
          <dd>{{ detail.helping.map((upgrade) => text.upgradeName(upgrade.id)).join(', ') }}</dd>
        </template>
      </dl>
      <p v-if="detail.closed" class="closed" role="note">
        <AppIcon name="lock" :size="16" />{{ detail.closed }}
      </p>
      <div class="actions">
        <button type="button" class="btn" @click="emit('close')">
          {{ t('campaign.back') }}
        </button>
        <button
          type="button"
          class="btn btn--primary btn--raised"
          :disabled="detail.closed !== null"
          :autofocus="detail.closed === null"
          @click="emit('play', detail.level)"
        >
          <AppIcon name="play" :size="20" />{{ t('campaign.play') }}
        </button>
      </div>
    </template>
  </ModalDialog>
</template>

<style scoped>
.art {
  height: 6rem;
  margin-block-end: var(--space-2);
  border-radius: var(--radius);
  background: var(--well-bg);
}

.facts {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: var(--space-2) var(--space-4);
  margin: var(--space-2) 0 0;
}

.facts dt {
  font-weight: 700;
  color: var(--text-muted);
}

.facts dd {
  margin: 0;
}

.facts__bonus {
  color: var(--accent);
  font-weight: 700;
}

.closed {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-block-start: var(--space-4);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-sm);
  background: var(--surface-2);
  color: var(--text-muted);
  font-size: 0.9rem;
  font-weight: 600;
}

.actions {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-block-start: var(--space-6);
}
</style>

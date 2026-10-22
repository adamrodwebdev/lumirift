<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useServices } from '@/app/AppServices';
import { LEVELS, type CampaignLevel } from '@/campaign/Levels';
import { levelTimeMs, timeBonusMs, upgradeHelps, UPGRADES } from '@/campaign/Upgrades';
import { allowsLevel } from '@/platform/Edition';
import AppIcon from '../components/AppIcon.vue';
import ModalDialog from '../components/ModalDialog.vue';
import StarRow from '../components/StarRow.vue';
import { useCampaignText } from '../useCampaignText';
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

/** The level shown, kept while the window slides away. */
const shown = shallowRef<CampaignLevel | null>(props.level);
watch(
  () => props.level,
  (level) => {
    if (level) shown.value = level;
  },
);

const detail = computed(() => {
  const level = shown.value;
  if (!level) return null;
  const model = campaign.model;
  const family = catalog.get(level.modeId).family;
  const bonus = timeBonusMs(model.snapshot.ranks);
  const time = levelTimeMs(level, model.snapshot.ranks);
  const inEdition = allowsLevel(platform.edition, level);
  const previous = LEVELS[LEVELS.indexOf(level) - 1];
  return {
    level,
    best: model.starsOf(level.id),
    time: time === null ? null : text.duration(time),
    bonus: time === null || bonus === 0 ? null : text.duration(bonus),
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
    class="level-sheet"
    :open="level !== null"
    :title="
      detail
        ? t('campaign.levelTitle', {
            level: detail.level.id,
            mode: t(`modes.${detail.level.modeId}.name`),
          })
        : ''
    "
    closable
    wide
    @dismiss="emit('close')"
  >
    <template v-if="detail">
      <GemCanvas class="art" :mode="detail.level.modeId" />
      <dl class="sheet-facts facts">
        <div>
          <dt>{{ t('campaign.goalLabel') }}</dt>
          <dd>{{ text.goal(detail.level) }}</dd>
        </div>
        <div v-if="detail.time">
          <dt>{{ t('campaign.timeLabel') }}</dt>
          <dd>
            {{ detail.time }}
            <span v-if="detail.bonus" class="facts__bonus">
              {{ t('campaign.timeBonus', { time: detail.bonus }) }}
            </span>
          </dd>
        </div>
        <div>
          <dt>{{ t('campaign.bestLabel') }}</dt>
          <dd>
            <StarRow
              class="facts__stars"
              :count="detail.best"
              :label="t('campaign.starsWon', { n: detail.best }, detail.best)"
              :size="18"
            />
          </dd>
        </div>
        <div v-if="detail.helping.length > 0">
          <dt>{{ t('campaign.helpingLabel') }}</dt>
          <dd>{{ detail.helping.map((upgrade) => text.upgradeName(upgrade.id)).join(', ') }}</dd>
        </div>
      </dl>
      <p class="sheet-note rule">{{ text.stars(detail.level) }}</p>
      <p v-if="detail.closed" class="closed" role="note">
        <AppIcon name="lock" :size="16" />{{ detail.closed }}
      </p>
      <button
        type="button"
        class="btn btn--primary btn--raised btn--block play"
        :disabled="detail.closed !== null"
        :autofocus="detail.closed === null"
        @click="emit('play', detail.level)"
      >
        <AppIcon name="play" :size="20" />{{ t('campaign.play') }}
      </button>
    </template>
  </ModalDialog>
</template>

<style scoped>
.art {
  height: 5rem;
  border-radius: var(--radius);
  background: var(--well-bg);
}

.facts__bonus {
  display: block;
  color: var(--accent);
  font-size: 0.75rem;
}

.facts__stars {
  vertical-align: middle;
}

.facts__stars :deep(.star--on svg) {
  fill: currentColor;
}

.closed {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border-radius: 0.875rem;
  background: var(--surface-2);
  color: var(--text-muted);
  font-size: 0.85rem;
  font-weight: 700;
}

.play:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Wide screens: the picture and the facts on the left; the stars' rule and Play on the right. */
@media (orientation: landscape) {
  .level-sheet[open] {
    grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
    grid-auto-flow: row dense;
  }

  .art,
  .facts {
    grid-column: 1;
  }

  .rule,
  .closed,
  .play {
    grid-column: 2;
  }

  .art {
    height: 4rem;
  }

  .play {
    align-self: end;
  }
}
</style>

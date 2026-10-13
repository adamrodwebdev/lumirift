<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue';
import { useI18n } from 'vue-i18n';
import { useServices } from '@/app/AppServices';
import { CHAPTERS, LEVELS, MAX_STARS, type CampaignLevel } from '@/campaign/Levels';
import { timeBonusMs, UPGRADES } from '@/campaign/Upgrades';
import { allowsLevel } from '@/platform/Edition';
import AppIcon from '../components/AppIcon.vue';
import ModalDialog from '../components/ModalDialog.vue';
import ModeArt from '../components/ModeArt.vue';
import StarRow from '../components/StarRow.vue';
import UpgradesDialog from '../components/UpgradesDialog.vue';
import { upgradeHelps, useCampaignText } from '../useCampaignText';

/**
 * The campaign map: five chapters of six levels, played in order, each with
 * its stars; the upgrades shop. Choosing a level shows its goal first.
 */
const emit = defineEmits<{ play: [level: CampaignLevel] }>();

const { t } = useI18n();
const { campaign, catalog, platform } = useServices();
const text = useCampaignText();

const chapters = computed(() => {
  const model = campaign.model;
  return CHAPTERS.map((chapter) => {
    const levels = LEVELS.filter((level) => level.chapter === chapter).map((level) => ({
      level,
      stars: model.starsOf(level.id),
      unlocked: model.isUnlocked(level) && allowsLevel(platform.edition, level),
      inDemo: allowsLevel(platform.edition, level),
      current: model.nextLevel === level,
    }));
    return { chapter, levels, stars: levels.reduce((sum, entry) => sum + entry.stars, 0) };
  });
});
const totals = computed(() => {
  const model = campaign.model;
  return { stars: model.totalStars, spare: model.availableStars };
});

const selected = shallowRef<CampaignLevel | null>(null);
const shopOpen = ref(false);

/** What the chosen level is about: goal, clock, stars, the upgrades that help. */
const detail = computed(() => {
  const level = selected.value;
  if (!level) return null;
  const model = campaign.model;
  const family = catalog.get(level.modeId).family;
  const bonus = timeBonusMs(model.snapshot.ranks);
  return {
    level,
    best: model.starsOf(level.id),
    time: level.timeLimitMs === null ? null : text.duration(level.timeLimitMs + bonus),
    bonus: level.timeLimitMs === null || bonus === 0 ? null : text.duration(bonus),
    helping: UPGRADES.filter(
      (upgrade) => model.rankOf(upgrade.id) > 0 && upgradeHelps(upgrade, level.modeId, family),
    ),
  };
});

const play = () => {
  const level = selected.value;
  selected.value = null;
  if (level) emit('play', level);
};
</script>

<template>
  <div class="campaign">
    <header class="head">
      <h1 class="head__title">{{ t('campaign.title') }}</h1>
      <p class="head__stars">
        <AppIcon name="star" :size="20" />
        {{ t('campaign.stars', { n: totals.stars, max: MAX_STARS }) }}
      </p>
      <button type="button" class="btn btn--primary head__shop" @click="shopOpen = true">
        {{ t('upgrades.title') }}
        <span v-if="totals.spare > 0" class="badge">{{ totals.spare }}</span>
      </button>
    </header>

    <section
      v-for="entry in chapters"
      :key="entry.chapter"
      class="chapter card"
      :aria-labelledby="`chapter-${entry.chapter}`"
    >
      <div class="chapter__head">
        <h2 :id="`chapter-${entry.chapter}`" class="chapter__title">
          <span class="chapter__number">{{ t('campaign.chapter', { n: entry.chapter }) }}</span>
          {{ t(`campaign.chapters.${entry.chapter}`) }}
        </h2>
        <p class="chapter__stars">{{ t('campaign.chapterStars', { n: entry.stars, max: 18 }) }}</p>
      </div>
      <ol class="levels">
        <li v-for="item in entry.levels" :key="item.level.id">
          <button
            type="button"
            class="level"
            :class="{
              'level--current': item.current && item.unlocked,
              'level--locked': !item.unlocked,
            }"
            :aria-disabled="!item.unlocked"
            @click="item.unlocked && (selected = item.level)"
          >
            <span class="level__id">{{ item.level.id }}</span>
            <span class="level__art"><ModeArt :mode="item.level.modeId" /></span>
            <span class="level__mode">{{ t(`modes.${item.level.modeId}.name`) }}</span>
            <span v-if="!item.inDemo" class="level__full">
              <AppIcon name="lock" :size="14" />{{ t('demo.fullGame') }}
            </span>
            <AppIcon v-else-if="!item.unlocked" name="lock" :size="16" />
            <StarRow
              v-else
              :count="item.stars"
              :label="t('campaign.starsWon', { n: item.stars }, item.stars)"
            />
          </button>
        </li>
      </ol>
    </section>

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
      @dismiss="selected = null"
    >
      <template v-if="detail">
        <div class="detail__art"><ModeArt :mode="detail.level.modeId" /></div>
        <dl class="detail">
          <dt>{{ t('campaign.goalLabel') }}</dt>
          <dd>{{ text.goal(detail.level) }}</dd>
          <template v-if="detail.time">
            <dt>{{ t('campaign.timeLabel') }}</dt>
            <dd>
              {{ detail.time }}
              <span v-if="detail.bonus" class="detail__bonus">
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
        <div class="detail__actions">
          <button type="button" class="btn" @click="selected = null">
            {{ t('campaign.back') }}
          </button>
          <button type="button" class="btn btn--primary" autofocus @click="play">
            <AppIcon name="play" :size="20" />{{ t('campaign.play') }}
          </button>
        </div>
      </template>
    </ModalDialog>

    <UpgradesDialog :open="shopOpen" @close="shopOpen = false" />
  </div>
</template>

<style scoped>
.campaign {
  display: grid;
  gap: var(--space-4);
  width: min(100%, 72rem);
  margin: 0 auto;
  padding: var(--space-4) var(--space-4) var(--space-8);
}

.head {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: var(--space-2) var(--space-4);
}

.head__title {
  font-family: var(--font-display);
  font-size: clamp(1.8rem, 1.4rem + 2vw, 2.6rem);
  font-weight: 800;
}

.head__stars {
  grid-row: 2;
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-weight: 800;
  color: var(--accent);
}

.head__shop {
  grid-row: 1 / 3;
  grid-column: 2;
}

.badge {
  padding: 0 var(--space-2);
  border-radius: 999px;
  background: var(--on-accent-fill);
  color: var(--accent-fill);
  font-size: 0.78rem;
}

.chapter {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-4);
}

.chapter__head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--space-1) var(--space-3);
}

.chapter__title {
  display: grid;
  font-size: 1.15rem;
}

.chapter__number {
  font-size: 0.75rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--accent);
}

.chapter__stars {
  font-size: 0.85rem;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}

.levels {
  display: grid;
  /* Six levels: 2 × 3, then 3 × 2, then one row. */
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.level {
  display: grid;
  justify-items: center;
  gap: var(--space-1);
  width: 100%;
  min-height: var(--touch);
  padding: var(--space-2) var(--space-2) var(--space-3);
  border: 2px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface-2);
  text-align: center;
  transition:
    transform 160ms ease,
    border-color 160ms ease;
}

.level:hover:not(.level--locked) {
  transform: translateY(-2px);
  border-color: var(--accent-fill);
}

.level--current {
  border-color: var(--accent-fill);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent-fill) 25%, transparent);
}

.level--locked {
  cursor: not-allowed;
  color: var(--text-muted);
}

.level--locked .level__art {
  opacity: 0.35;
}

.level__id {
  font-size: 0.75rem;
  font-weight: 800;
  color: var(--text-muted);
}

.level__art {
  inline-size: 100%;
  padding: var(--space-1);
  border-radius: var(--radius-sm);
  background: var(--well-bg);
}

.level__full {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-size: 0.75rem;
  font-weight: 700;
}

.level__mode {
  font-weight: 750;
  font-size: 0.9rem;
}

.detail__art {
  max-inline-size: 12rem;
  margin-inline: auto;
  padding: var(--space-2);
  border-radius: var(--radius);
  background: var(--well-bg);
}

.detail {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: var(--space-2) var(--space-4);
  margin: var(--space-4) 0 0;
}

.detail dt {
  font-weight: 700;
  color: var(--text-muted);
}

.detail dd {
  margin: 0;
}

.detail__bonus {
  color: var(--accent);
  font-weight: 700;
}

.detail__actions {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-block-start: var(--space-6);
}

@media (min-width: 560px) {
  .levels {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (min-width: 1024px) {
  .levels {
    grid-template-columns: repeat(6, minmax(0, 1fr));
  }
}
</style>

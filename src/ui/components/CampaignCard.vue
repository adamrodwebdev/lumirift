<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useServices } from '@/app/AppServices';
import { MAX_STARS, type CampaignLevel } from '@/campaign/Levels';
import { allowsLevel } from '@/platform/Edition';
import AppIcon from './AppIcon.vue';

/** The campaign on the home page: where the player is, and the way back in. */
const emit = defineEmits<{ open: []; play: [level: CampaignLevel] }>();

const { t } = useI18n();
const { campaign, platform } = useServices();

const progress = computed(() => {
  const model = campaign.model;
  return {
    next: model.nextLevel,
    // Every level of the demo is won: the rest is in the full game.
    open: allowsLevel(platform.edition, model.nextLevel),
    stars: model.totalStars,
    spare: model.availableStars,
  };
});
</script>

<template>
  <section class="campaign" aria-labelledby="campaign-title">
    <p class="campaign__kicker">{{ t('campaign.chapter', { n: progress.next.chapter }) }}</p>
    <h2 id="campaign-title" class="campaign__title">{{ t('campaign.title') }}</h2>
    <p class="campaign__chapter">{{ t(`campaign.chapters.${progress.next.chapter}`) }}</p>
    <div class="campaign__stars">
      <span class="campaign__count">
        <AppIcon name="star" :size="18" />
        {{ t('campaign.stars', { n: progress.stars, max: MAX_STARS }) }}
      </span>
      <span class="bar" aria-hidden="true">
        <span class="bar__fill" :style="{ inlineSize: `${(progress.stars / MAX_STARS) * 100}%` }" />
      </span>
    </div>
    <div class="campaign__actions">
      <button
        v-if="progress.open"
        type="button"
        class="btn campaign__play"
        @click="emit('play', progress.next)"
      >
        <AppIcon name="play" :size="20" />
        {{
          t('campaign.continue', {
            level: progress.next.id,
            mode: t(`modes.${progress.next.modeId}.name`),
          })
        }}
      </button>
      <p v-else class="campaign__end">{{ t('demo.campaignDone') }}</p>
      <button type="button" class="btn campaign__open" @click="emit('open')">
        {{ t('campaign.open') }}
        <span v-if="progress.spare > 0" class="badge">
          <AppIcon name="star" :size="12" />
          <span aria-hidden="true">{{ progress.spare }}</span>
          <span class="sr-only">{{
            t('campaign.spare', { n: progress.spare }, progress.spare)
          }}</span>
        </span>
      </button>
    </div>
  </section>
</template>

<style scoped>
.campaign {
  position: relative;
  display: grid;
  gap: var(--space-2);
  padding: var(--space-6) var(--space-4) var(--space-4);
  border-radius: var(--radius-lg);
  background:
    radial-gradient(90% 120% at 100% 0%, rgb(255 255 255 / 0.28), transparent 60%),
    var(--accent-gradient);
  color: var(--on-accent-fill);
  box-shadow: var(--shadow);
  overflow: hidden;
}

.campaign__kicker {
  font-size: 0.8rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.campaign__title {
  font-family: var(--font-display);
  font-size: clamp(1.9rem, 1.4rem + 2.5vw, 2.8rem);
  font-weight: 800;
  line-height: 1;
}

.campaign__chapter {
  font-weight: 650;
}

.campaign__stars {
  display: grid;
  gap: var(--space-1);
  margin-block: var(--space-2);
}

.campaign__count {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

.bar {
  block-size: 0.4rem;
  border-radius: 999px;
  background: rgb(0 0 0 / 0.15);
  overflow: hidden;
}

.bar__fill {
  display: block;
  block-size: 100%;
  border-radius: inherit;
  background: var(--on-accent-fill);
}

.campaign__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.campaign__actions > .btn {
  flex: 1 1 14rem;
}

.campaign__play {
  border-color: transparent;
  background: var(--on-accent-fill);
  color: var(--accent-fill);
}

.campaign__end {
  flex: 1 1 14rem;
  align-self: center;
  font-weight: 800;
}

.campaign__open {
  border-color: color-mix(in srgb, var(--on-accent-fill) 35%, transparent);
  background: transparent;
  color: var(--on-accent-fill);
}

.campaign__open:hover {
  background: rgb(0 0 0 / 0.08);
}

.badge {
  display: inline-flex;
  align-items: center;
  gap: 0.15rem;
  flex: none;
  white-space: nowrap;
  padding: 0 var(--space-2);
  border-radius: 999px;
  background: var(--on-accent-fill);
  color: var(--accent-fill);
  font-size: 0.78rem;
}
</style>

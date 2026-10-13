<script setup lang="ts">
import { computed, defineAsyncComponent, ref, shallowRef } from 'vue';
import { useI18n } from 'vue-i18n';
import { useServices } from '@/app/AppServices';
import { useFormat } from '@/app/useFormat';
import type { CampaignLevel } from '@/campaign/Levels';
import { DailyChallenge } from '@/session/DailyChallenge';
import type { ModeDescriptor } from '@/session/ModeCatalog';
import type { ModeId } from '@/session/ModeId';
import { ScoreBoard } from '@/services/ScoreBoard';
import AppIcon from '../components/AppIcon.vue';
import CampaignCard from '../components/CampaignCard.vue';
import ModeArt from '../components/ModeArt.vue';
import ModeCarousel from '../components/ModeCarousel.vue';
import ObjectivesCard from '../components/ObjectivesCard.vue';
import PlayerBar from '../components/PlayerBar.vue';
import VariantDialog from '../components/VariantDialog.vue';

/**
 * The home page: the player at a glance, the campaign first, the daily
 * challenge and a quick game, then every mode in a swiper, and the
 * objectives of the day.
 */
const emit = defineEmits<{
  play: [modeId: ModeId, variant?: string];
  daily: [challenge: DailyChallenge];
  campaign: [];
  level: [level: CampaignLevel];
}>();

const { t } = useI18n();
const format = useFormat();
const { catalog, scores, clock } = useServices();

const today = clock();
const daily = new DailyChallenge(today, catalog.dailyEligible());
const appVersion = __APP_VERSION__;
const dailyResult = catalog.get(daily.modeId).result;
const dailyBest = computed(() => scores.best(ScoreBoard.dailyKey(daily.key)));

/** A mode with variants (the duel) asks which one before starting. */
const choosing = shallowRef<ModeDescriptor | null>(null);
const choose = (mode: ModeDescriptor) => {
  if (mode.variants) choosing.value = mode;
  else emit('play', mode.id);
};
const onVariant = (variant: string) => {
  const mode = choosing.value;
  choosing.value = null;
  if (mode) emit('play', mode.id, variant);
};

/** The Atelier is loaded the first time it opens. */
const AtelierDialog = defineAsyncComponent(() => import('../components/AtelierDialog.vue'));
const atelierOpen = ref(false);

const modes = computed(() =>
  catalog.list().map((mode) => ({ ...mode, best: scores.best(mode.id) })),
);
</script>

<template>
  <div class="home">
    <h1 class="sr-only">{{ t('meta.title') }}</h1>
    <p class="tagline">{{ t('app.tagline') }}</p>

    <PlayerBar class="home__player" @atelier="atelierOpen = true" />

    <div class="home__lead">
      <CampaignCard @open="emit('campaign')" @play="(level) => emit('level', level)" />

      <div class="home__side">
        <section class="daily card" aria-labelledby="daily-title">
          <div class="daily__art"><ModeArt :mode="daily.modeId" /></div>
          <div class="daily__text">
            <h2 id="daily-title" class="daily__title">{{ t('daily.title') }}</h2>
            <p class="daily__mode">
              {{ t('daily.mode', { mode: t(`modes.${daily.modeId}.name`) }) }}
            </p>
            <p class="daily__rules">{{ format.date(today) }} · {{ t('daily.rules') }}</p>
            <p v-if="dailyBest !== null" class="daily__best">
              {{ t('daily.best', { value: format.result(dailyResult, dailyBest) }) }}
            </p>
          </div>
          <button type="button" class="btn btn--primary" @click="emit('daily', daily)">
            {{ t('daily.start') }}
          </button>
        </section>

        <button type="button" class="quick card" @click="emit('play', 'classic')">
          <AppIcon name="play" :size="22" />
          <span class="quick__text">
            <span class="quick__title">{{ t('home.play') }}</span>
            <span class="quick__hint">{{ t('home.quick') }}</span>
          </span>
        </button>
      </div>
    </div>

    <ModeCarousel :modes="modes" @choose="choose" />

    <ObjectivesCard />

    <VariantDialog :mode="choosing" @choose="onVariant" @close="choosing = null" />
    <AtelierDialog v-if="atelierOpen" :open="atelierOpen" @close="atelierOpen = false" />

    <footer class="footer">
      <p>{{ t('app.privacy') }}</p>
      <p>{{ t('app.version', { version: appVersion }) }}</p>
    </footer>
  </div>
</template>

<style scoped>
.home {
  display: grid;
  gap: var(--space-6);
  width: min(100%, 72rem);
  margin: 0 auto;
  padding: var(--space-4) var(--space-4) var(--space-8);
}

.home > * {
  min-width: 0;
}

.tagline {
  font-family: var(--font-display);
  font-size: clamp(1.05rem, 0.95rem + 0.6vw, 1.35rem);
  font-weight: 700;
  color: var(--text-muted);
}

.home__lead {
  display: grid;
  gap: var(--space-4);
}

.home__side {
  display: grid;
  gap: var(--space-4);
  align-content: start;
}

.daily {
  display: grid;
  grid-template-columns: 5.5rem 1fr;
  align-items: center;
  gap: var(--space-3) var(--space-4);
  padding: var(--space-4);
}

.daily .btn {
  grid-column: 1 / -1;
}

.daily__art {
  padding: var(--space-1);
  border-radius: var(--radius);
  background: var(--well-bg);
}

.daily__text {
  display: grid;
  gap: var(--space-1);
}

.daily__title {
  font-size: 1.15rem;
}

.daily__mode {
  font-weight: 700;
}

.daily__rules,
.daily__best {
  font-size: 0.85rem;
  color: var(--text-muted);
}

.quick {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  min-height: var(--touch);
  padding: var(--space-4);
  text-align: left;
  transition: transform 160ms ease;
}

.quick:hover {
  transform: translateY(-2px);
}

.quick__text {
  display: grid;
}

.quick__title {
  font-weight: 800;
}

.quick__hint {
  font-size: 0.85rem;
  color: var(--text-muted);
}

.footer {
  display: grid;
  gap: var(--space-1);
  padding-top: var(--space-6);
  border-top: 1px solid var(--border);
  color: var(--text-muted);
  font-size: 0.875rem;
}

@media (min-width: 1024px) {
  .home__lead {
    grid-template-columns: 1.4fr 1fr;
  }
}
</style>

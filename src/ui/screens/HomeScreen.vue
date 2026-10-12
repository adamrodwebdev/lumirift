<script setup lang="ts">
import { computed, defineAsyncComponent, ref, shallowRef } from 'vue';
import type { ModeDescriptor } from '@/session/ModeCatalog';
import { useI18n } from 'vue-i18n';
import { useServices } from '@/app/AppServices';
import { useFormat } from '@/app/useFormat';
import { DailyChallenge } from '@/session/DailyChallenge';
import type { ModeId } from '@/session/ModeId';
import { ScoreBoard } from '@/services/ScoreBoard';
import AppIcon from '../components/AppIcon.vue';
import BrandMark from '../components/BrandMark.vue';
import ProfileCard from '../components/ProfileCard.vue';
import VariantDialog from '../components/VariantDialog.vue';

const emit = defineEmits<{
  play: [modeId: ModeId, variant?: string];
  daily: [challenge: DailyChallenge];
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
    <section class="hero" aria-labelledby="hero-title">
      <h1 id="hero-title" class="hero__title"><BrandMark /></h1>
      <p class="hero__tagline">{{ t('app.tagline') }}</p>
      <button type="button" class="btn btn--primary hero__play" @click="emit('play', 'classic')">
        <AppIcon name="play" :size="20" />
        {{ t('home.play') }}
      </button>
    </section>

    <section class="daily" aria-labelledby="daily-title">
      <div class="daily__text">
        <h2 id="daily-title" class="daily__title">{{ t('daily.title') }}</h2>
        <p class="daily__date">{{ format.date(today) }}</p>
        <p class="daily__mode">{{ t('daily.mode', { mode: t(`modes.${daily.modeId}.name`) }) }}</p>
        <p class="daily__rules">{{ t('daily.rules') }}</p>
        <p v-if="dailyBest !== null" class="daily__best">
          {{ t('daily.best', { value: format.result(dailyResult, dailyBest) }) }}
        </p>
      </div>
      <button type="button" class="btn btn--primary" @click="emit('daily', daily)">
        {{ t('daily.start') }}
      </button>
    </section>

    <ProfileCard @atelier="atelierOpen = true" />

    <section class="modes" aria-labelledby="modes-title">
      <h2 id="modes-title" class="modes__title">{{ t('home.modes') }}</h2>
      <ul class="modes__grid">
        <li v-for="mode in modes" :key="mode.id">
          <button type="button" class="mode" :class="`mode--${mode.id}`" @click="choose(mode)">
            <span class="mode__name">{{ t(`modes.${mode.id}.name`) }}</span>
            <span class="mode__pitch">{{ t(`modes.${mode.id}.pitch`) }}</span>
            <span class="mode__meta">
              <span>{{ t(`result.${mode.result}`) }}</span>
              <span v-if="mode.best !== null" class="mode__best">
                {{ t('home.best', { value: format.result(mode.result, mode.best) }) }}
              </span>
              <span v-else>{{ t('home.noBest') }}</span>
            </span>
          </button>
        </li>
      </ul>
    </section>

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
  gap: var(--space-8);
  width: min(100%, 72rem);
  margin: 0 auto;
  padding: var(--space-6) var(--space-4) var(--space-8);
}

.hero {
  display: grid;
  justify-items: center;
  gap: var(--space-4);
  text-align: center;
  padding: var(--space-6) 0 var(--space-2);
}

.hero__title {
  font-size: clamp(2.75rem, 1.8rem + 6vw, 5.5rem);
}

.hero__tagline {
  max-width: 34ch;
  font-size: clamp(1.05rem, 0.95rem + 0.6vw, 1.35rem);
  color: var(--text-muted);
}

.hero__play {
  min-width: 12rem;
  min-height: 3.25rem;
  font-size: 1.15rem;
}

.daily {
  display: grid;
  gap: var(--space-4);
  padding: var(--space-6);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background:
    linear-gradient(
      135deg,
      color-mix(in srgb, var(--accent-fill) 18%, transparent),
      transparent 60%
    ),
    var(--surface);
}

.daily__text {
  display: grid;
  gap: var(--space-1);
}

.daily__title {
  font-size: clamp(1.3rem, 1.1rem + 1vw, 1.7rem);
}

.daily__date,
.daily__rules,
.daily__best {
  color: var(--text-muted);
}

.daily__mode {
  font-weight: 700;
}

.modes {
  display: grid;
  gap: var(--space-4);
}

.modes__title {
  font-size: clamp(1.3rem, 1.1rem + 1vw, 1.7rem);
}

.modes__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 16rem), 1fr));
  gap: var(--space-3);
  margin: 0;
  padding: 0;
  list-style: none;
}

.mode {
  display: grid;
  align-content: start;
  gap: var(--space-2);
  width: 100%;
  height: 100%;
  padding: var(--space-4);
  border: 1px solid var(--border);
  border-left: 0.35rem solid var(--mode-color, var(--accent-fill));
  border-radius: var(--radius);
  background: var(--surface);
  text-align: left;
  transition:
    transform 120ms ease,
    border-color 120ms ease;
}

.mode:hover {
  transform: translateY(-2px);
  border-color: var(--mode-color, var(--accent-fill));
}

.mode--classic {
  --mode-color: var(--tone-2);
}
.mode--tide {
  --mode-color: var(--tone-7);
}
.mode--flip {
  --mode-color: var(--tone-1);
}
.mode--chroma {
  --mode-color: var(--tone-6);
}
.mode--mirror {
  --mode-color: var(--tone-3);
}
.mode--fusion {
  --mode-color: var(--tone-11);
}
.mode--tilt {
  --mode-color: var(--tone-5);
}
.mode--silhouette {
  --mode-color: var(--tone-4);
}
.mode--rhythm {
  --mode-color: var(--tone-8);
}
.mode--duel {
  --mode-color: var(--tone-1);
}
.mode--mosaic {
  --mode-color: var(--tone-7);
}
.mode--sand {
  --mode-color: var(--tone-9);
}
.mode--tower {
  --mode-color: var(--tone-13);
}

.mode__name {
  font-family: var(--font-display);
  font-size: 1.25rem;
  font-weight: 800;
}

.mode__pitch {
  color: var(--text-muted);
}

.mode__meta {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: var(--space-2);
  margin-top: auto;
  font-size: 0.875rem;
  color: var(--text-muted);
}

.mode__best {
  color: var(--text);
  font-weight: 600;
}

.footer {
  display: grid;
  gap: var(--space-1);
  padding-top: var(--space-6);
  border-top: 1px solid var(--border);
  color: var(--text-muted);
  font-size: 0.875rem;
}

@media (min-width: 768px) {
  .daily {
    grid-template-columns: 1fr auto;
    align-items: center;
  }

  .footer {
    grid-template-columns: 1fr auto;
  }
}
</style>

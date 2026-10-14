<script setup lang="ts">
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import { useI18n } from 'vue-i18n';
import { useServices } from '@/app/AppServices';
import type { CampaignLevel } from '@/campaign/Levels';
import { MAX_STARS } from '@/campaign/Levels';
import { DailyChallenge } from '@/session/DailyChallenge';
import type { ModeDescriptor } from '@/session/ModeCatalog';
import type { ModeId } from '@/session/ModeId';
import { allowsLevel, allowsMode } from '@/platform/Edition';
import AppIcon from '../components/AppIcon.vue';
import ModeArt from '../components/ModeArt.vue';
import ModeCarousel from '../components/ModeCarousel.vue';
import ObjectivesCard from '../components/ObjectivesCard.vue';
import PlayerChip from '../components/PlayerChip.vue';
import TitleScene from '../components/TitleScene.vue';
import VariantDialog from '../components/VariantDialog.vue';

/**
 * The title screen: the logo, one big Play (the campaign goes on), the
 * modes no other game has, the daily challenge; then every mode and the
 * objectives of the day further down.
 */
const emit = defineEmits<{
  play: [modeId: ModeId, variant?: string];
  daily: [challenge: DailyChallenge];
  campaign: [];
  level: [level: CampaignLevel];
}>();

const { t } = useI18n();
/** The brand name, split by the rift (never translated). */
const LOGO = ['Lumi', 'rift'] as const;
const { catalog, scores, clock, platform, campaign } = useServices();
const { edition } = platform;

const today = clock();
// The daily challenge only draws among the modes this edition opens.
const daily = new DailyChallenge(
  today,
  catalog.dailyEligible().filter((id) => allowsMode(edition, id)),
);
const appVersion = __APP_VERSION__;

/** Time left before the next daily challenge (local midnight). */
const dailyLeft = (() => {
  const midnight = new Date(today);
  midnight.setHours(24, 0, 0, 0);
  const minutes = Math.max(0, Math.floor((midnight.getTime() - today.getTime()) / 60_000));
  return { h: Math.floor(minutes / 60), m: minutes % 60 };
})();

/** Play goes on with the campaign; past the demo's levels, a game of Sand. */
const next = computed(() => {
  const level = campaign.model.nextLevel;
  return allowsLevel(edition, level) ? level : null;
});
const play = () => {
  if (next.value) emit('level', next.value);
  else emit('play', 'sand');
};

/** The modes no other game has come first, as tiles. */
const FEATURED: readonly ModeId[] = ['sand', 'tower', 'mosaic', 'duel'];
const featured = computed(() =>
  FEATURED.filter((id) => allowsMode(edition, id)).map((id) => catalog.get(id)),
);
const others = computed(() => catalog.list().length - featured.value.length);

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

const allModes = ref<HTMLElement | null>(null);
const showAllModes = () => {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  allModes.value?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
};

/** The Atelier is loaded the first time it opens. */
const AtelierDialog = defineAsyncComponent(() => import('../components/AtelierDialog.vue'));
const atelierOpen = ref(false);

/** Space starts playing when nothing else has the focus. */
const onKey = (event: KeyboardEvent) => {
  const focus = document.activeElement;
  const idle = !focus || focus === document.body || focus.tagName === 'MAIN';
  if (event.code === 'Space' && idle && !atelierOpen.value && !choosing.value) {
    event.preventDefault();
    play();
  }
};
onMounted(() => window.addEventListener('keydown', onKey));
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));

const modes = computed(() =>
  catalog.list().map((mode) => ({
    ...mode,
    best: scores.best(mode.id),
    locked: !allowsMode(edition, mode.id),
  })),
);
</script>

<template>
  <div class="home">
    <section class="title" aria-labelledby="game-title">
      <div class="title__bar">
        <PlayerChip @atelier="atelierOpen = true" />
        <button type="button" class="daily" @click="emit('daily', daily)">
          <AppIcon name="calendar" :size="18" />
          <span class="daily__long">
            {{
              t('title.daily', {
                mode: t(`modes.${daily.modeId}.name`),
                h: dailyLeft.h,
                m: dailyLeft.m,
              })
            }}
          </span>
          <span class="daily__short">
            {{ t('title.dailyShort', { mode: t(`modes.${daily.modeId}.name`) }) }}
          </span>
        </button>
      </div>

      <div class="title__main">
        <div class="title__copy">
          <h1 id="game-title" class="logo">
            <!-- Read as one word; the split by the rift is for the eyes only. -->
            <span class="sr-only">{{ LOGO.join('') }}</span>
            <span class="logo__stack" aria-hidden="true">{{ LOGO[0] }}</span>
            <span class="logo__rift" aria-hidden="true">
              <svg class="logo__crack" viewBox="0 0 34 84" aria-hidden="true">
                <path d="M22 2 L8 30 L26 44 L10 82" />
              </svg>
              <span>{{ LOGO[1] }}</span>
            </span>
          </h1>
          <p class="tagline">{{ t('title.tagline') }}</p>

          <p v-if="edition.id === 'demo'" class="demo" role="note">
            <strong>{{ t('demo.title') }}</strong> {{ t('demo.banner') }}
          </p>

          <div class="title__actions">
            <button type="button" class="play" @click="play">
              <span class="play__icon" aria-hidden="true"><AppIcon name="play" :size="24" /></span>
              <span class="play__text">
                <span class="play__label">{{ t('title.play') }}</span>
                <span class="play__next">
                  {{
                    next
                      ? t('title.level', {
                          level: next.id,
                          mode: t(`modes.${next.modeId}.name`),
                        })
                      : t('modes.sand.name')
                  }}
                </span>
              </span>
            </button>
            <p class="title__hint">
              <i18n-t keypath="title.space" tag="span">
                <template #key>
                  <kbd>{{ t('title.spaceKey') }}</kbd>
                </template>
              </i18n-t>
            </p>
          </div>

          <button type="button" class="map" @click="emit('campaign')">
            <AppIcon name="star" :size="18" />
            {{ t('campaign.open') }}
            <span class="map__stars">
              {{ t('campaign.stars', { n: campaign.model.totalStars, max: MAX_STARS }) }}
            </span>
          </button>
        </div>

        <div class="title__scene"><TitleScene /></div>
      </div>

      <div class="featured">
        <h2 class="featured__title">{{ t('title.freePlay') }}</h2>
        <ul class="featured__list" role="list">
          <li v-for="mode in featured" :key="mode.id">
            <button
              type="button"
              class="tile"
              :class="`tile--${mode.family}`"
              @click="choose(mode)"
            >
              <span class="tile__art" aria-hidden="true"><ModeArt :mode="mode.id" /></span>
              <span class="tile__name">{{ t(`modes.${mode.id}.name`) }}</span>
            </button>
          </li>
          <li>
            <button type="button" class="tile tile--more" @click="showAllModes">
              <span class="tile__count">+{{ others }}</span>
              <span class="tile__name">{{ t('title.more') }}</span>
            </button>
          </li>
        </ul>
      </div>
    </section>

    <div ref="allModes" class="home__modes">
      <ModeCarousel :modes="modes" @choose="choose" />
    </div>

    <ObjectivesCard />

    <VariantDialog :mode="choosing" @choose="onVariant" @close="choosing = null" />
    <AtelierDialog v-if="atelierOpen" :open="atelierOpen" @close="atelierOpen = false" />

    <footer class="footer">
      <!-- On a portal, the save goes through the platform (sometimes its cloud). -->
      <p>{{ t(platform.storage ? 'app.privacyPortal' : 'app.privacy') }}</p>
      <p>{{ t('app.version', { version: appVersion }) }}</p>
    </footer>
  </div>
</template>

<style scoped>
.home {
  display: grid;
  gap: var(--space-8);
  width: min(100%, 76rem);
  margin: 0 auto;
  padding: var(--space-4) var(--space-4) var(--space-8);
}

.home > * {
  min-width: 0;
}

/* --- Title screen ------------------------------------------------------- */

.title {
  display: grid;
  gap: var(--space-4);
  justify-items: center;
  align-content: space-between;
  min-height: calc(100dvh - var(--header-h) - var(--space-8));
  text-align: center;
}

.title__main,
.title__copy {
  display: contents;
}

.title__bar {
  order: 0;
  justify-self: stretch;
}

.logo {
  order: 1;
}

.tagline {
  order: 2;
}

.demo {
  order: 3;
}

.title__scene {
  order: 4;
}

.featured {
  order: 5;
  justify-self: stretch;
}

.title__actions {
  order: 6;
}

.map {
  order: 7;
}

.title__bar {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.daily {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  min-height: var(--touch);
  padding: var(--space-2) var(--space-4);
  border: 1px solid color-mix(in srgb, var(--accent) 50%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  color: var(--accent-strong);
  font-weight: 600;
  font-size: 0.9rem;
}

/* Phones: the short label (the full one is too long for the row). */
.daily__long {
  display: none;
}

@media (min-width: 640px) {
  .daily__long {
    display: inline;
  }

  .daily__short {
    display: none;
  }
}

.daily:hover {
  background: color-mix(in srgb, var(--accent) 18%, transparent);
}

.logo {
  display: grid;
  font-family: var(--font-display);
  font-weight: 900;
  font-size: clamp(3rem, 2rem + 6vw, 6rem);
  line-height: 0.92;
  letter-spacing: -0.03em;
  text-transform: uppercase;
  color: var(--text);
  text-shadow: 0 0.4rem 2.5rem rgb(120 80 255 / 0.45);
}

.logo__rift {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.12em;
}

.logo__rift > span {
  background: linear-gradient(180deg, var(--accent-strong), var(--rift-glow));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  text-shadow: none;
}

.logo__crack {
  width: 0.36em;
  height: 0.88em;
  filter: drop-shadow(0 0 0.1em var(--rift-glow));
}

.logo__crack path {
  fill: none;
  stroke: var(--accent-strong);
  stroke-width: 7;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.tagline {
  color: var(--text-muted);
  font-weight: 600;
  font-size: clamp(1rem, 0.9rem + 0.5vw, 1.3rem);
}

.demo {
  max-width: 34rem;
  padding: var(--space-3) var(--space-4);
  border: 1px dashed var(--accent-fill);
  border-radius: var(--radius);
  background: color-mix(in srgb, var(--accent-fill) 10%, transparent);
  font-size: 0.9rem;
  text-align: start;
}

.title__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: var(--space-4);
  width: 100%;
}

.play {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  width: min(100%, 22rem);
  min-height: 5.25rem;
  padding: 0 var(--space-8) 0 var(--space-4);
  border: 0;
  border-radius: 1.5rem;
  background: var(--accent-gradient);
  color: var(--on-accent-fill);
  box-shadow:
    var(--glow-accent),
    inset 0 -0.375rem 0 rgb(120 50 0 / 0.25);
  transition:
    transform 150ms ease,
    filter 150ms ease;
}

.play:hover {
  transform: translateY(-2px);
  filter: brightness(1.05);
}

.play:active {
  transform: translateY(1px) scale(0.99);
}

.play__icon {
  display: grid;
  place-items: center;
  width: 3.25rem;
  height: 3.25rem;
  border-radius: 1rem;
  background: var(--on-accent-fill);
  color: var(--accent);
}

.play__text {
  display: grid;
  justify-items: start;
  line-height: 1.15;
}

.play__label {
  font-family: var(--font-display);
  font-weight: 900;
  font-size: 1.85rem;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

.play__next {
  font-weight: 600;
  font-size: 0.9rem;
}

.title__hint {
  display: none;
  color: var(--text-muted);
  font-size: 0.85rem;
}

.title__hint kbd {
  padding: 0.1rem 0.5rem;
  border: 1px solid var(--border);
  border-radius: 0.4rem;
  color: var(--text);
  font: inherit;
  font-weight: 700;
}

@media (hover: hover) and (pointer: fine) {
  .title__hint {
    display: block;
  }
}

.map {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  min-height: var(--touch);
  padding: var(--space-2) var(--space-4);
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--glass);
  color: var(--text);
  font-weight: 600;
}

.map:hover {
  border-color: color-mix(in srgb, var(--accent) 60%, var(--border));
}

.map__stars {
  color: var(--accent);
  font-size: 0.85rem;
}

.title__scene {
  height: clamp(8.5rem, 24dvh, 22rem);
  aspect-ratio: 520 / 600;
}

/* --- Free play tiles ------------------------------------------------------ */

.featured {
  display: grid;
  gap: var(--space-3);
}

.featured__title {
  color: var(--text-muted);
  font-family: var(--font-ui);
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.2em;
  text-transform: uppercase;
}

/* Phones: one row that scrolls inside itself, snapping on each tile. */
.featured__list {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: 7rem;
  gap: var(--space-3);
  margin: 0;
  padding: 0 0 var(--space-2);
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  list-style: none;
}

.featured__list > li {
  scroll-snap-align: start;
}

.tile {
  display: grid;
  align-content: space-between;
  justify-items: start;
  gap: var(--space-2);
  width: 100%;
  min-height: 5.75rem;
  padding: var(--space-3);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: linear-gradient(160deg, var(--tile-tint, transparent), var(--glass) 70%);
  color: var(--text);
  text-align: start;
  transition:
    transform 150ms ease,
    border-color 150ms ease;
}

.tile:hover {
  transform: translateY(-3px);
  border-color: color-mix(in srgb, var(--accent) 60%, var(--border));
}

.tile--sand {
  --tile-tint: color-mix(in srgb, var(--tone-2) 22%, transparent);
}

.tile--volume {
  --tile-tint: color-mix(in srgb, var(--tone-1) 22%, transparent);
}

.tile--placement {
  --tile-tint: color-mix(in srgb, var(--tone-5) 22%, transparent);
}

.tile--falling {
  --tile-tint: color-mix(in srgb, var(--tone-3) 25%, transparent);
}

.tile__art {
  display: block;
  width: 4rem;
  height: 2.75rem;
}

.tile__name {
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 0.95rem;
}

.tile--more {
  align-content: center;
  justify-items: center;
  border-style: dashed;
  background: var(--glass);
  color: var(--text-muted);
}

.tile__count {
  color: var(--text);
  font-family: var(--font-display);
  font-weight: 900;
  font-size: 1.6rem;
}

.home__modes {
  scroll-margin-top: var(--space-4);
}

@media (min-width: 1024px) {
  .title {
    grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
    grid-template-areas:
      'bar bar'
      'logo scene'
      'tagline scene'
      'demo scene'
      'actions scene'
      'map scene'
      'featured scene';
    grid-template-rows: auto auto auto auto auto auto 1fr;
    justify-items: start;
    align-content: start;
    column-gap: var(--space-8);
    text-align: start;
  }

  .title__bar {
    grid-area: bar;
  }

  .logo {
    grid-area: logo;
    margin-top: var(--space-4);
  }

  .tagline {
    grid-area: tagline;
  }

  .demo {
    grid-area: demo;
  }

  .title__actions {
    grid-area: actions;
    justify-content: flex-start;
  }

  .map {
    grid-area: map;
  }

  .featured {
    grid-area: featured;
    align-self: end;
  }

  .title__scene {
    grid-area: scene;
    align-self: center;
    justify-self: center;
    height: auto;
    width: 100%;
    max-height: calc(100dvh - var(--header-h) - 6rem);
  }

  .logo__rift {
    justify-content: flex-start;
  }

  .tile {
    min-height: 7.25rem;
  }

  .featured__list {
    grid-auto-flow: row;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    overflow: visible;
  }
}

.footer {
  display: grid;
  gap: var(--space-1);
  padding-top: var(--space-4);
  border-top: 1px solid var(--border);
  color: var(--text-muted);
  font-size: 0.85rem;
}
</style>

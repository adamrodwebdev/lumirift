<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useServices } from '@/app/AppServices';
import { useFormat } from '@/app/useFormat';
import { dayKey } from '@/core/Day';
import type { CampaignLevel } from '@/campaign/Levels';
import { allowsLevel, allowsMode } from '@/platform/Edition';
import { effectsProfile } from '@/fx/EffectsProfile';
import { TonePalette } from '@/render/TonePalette';
import { DailyChallenge } from '@/session/DailyChallenge';
import { BOSS_IDS } from '@/session/GameSession';
import type { ModeId } from '@/session/ModeId';
import type { SceneId } from '@/showcase/Scene';
import AppIcon from '../components/AppIcon.vue';
import { isTouchScreen } from '../useOrientation';
import type { HubScene } from './HubScene';
import { createHomeReel, createHubScene } from './loadArt';
import type { HomeReel } from './reel/HomeReel';
import ObjectivesDialog from './ObjectivesDialog.vue';

/**
 * The title screen: the living scene, the logo, the reel (real games playing
 * what no other game has: the Sand's elements within seconds, the wells that
 * turn, the four Guardians), one big Play in the thumb's reach (the campaign
 * goes on), the daily challenge, the day's objectives.
 */
const props = defineProps<{
  /** Shown (its tab chosen, the menu on screen): the scene runs only then. */
  active: boolean;
}>();
const emit = defineEmits<{
  play: [modeId: ModeId, origin: Element];
  daily: [challenge: DailyChallenge, origin: Element];
  level: [level: CampaignLevel, origin: Element];
}>();

const { t } = useI18n();
/** The game's name, split by the rift, then its kicker (never translated). */
const LOGO = ['Lumi', 'rift', 'Blocks'] as const;
const { catalog, clock, platform, campaign, profile, settings, theme } = useServices();
const format = useFormat();
const { edition } = platform;
const touch = isTouchScreen();

const today = clock();
// The daily challenge only draws among the modes this edition opens.
const daily = new DailyChallenge(
  today,
  catalog.dailyEligible().filter((id) => allowsMode(edition, id)),
);
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
const play = (origin: Element) => {
  if (next.value) emit('level', next.value, origin);
  else emit('play', 'sand', origin);
};

// A new day brings new objectives.
profile.objectivesFor(dayKey(today));
const objectives = computed(() => profile.current.objectives);
const done = computed(() => objectives.value.filter((entry) => entry.done).length);
const goalsOpen = ref(false);

const playButton = ref<HTMLButtonElement | null>(null);
/** Space starts playing when nothing else has the focus. */
const onKey = (event: KeyboardEvent) => {
  if (!props.active || goalsOpen.value || event.code !== 'Space') return;
  const focus = document.activeElement;
  const idle = !focus || focus === document.body || focus.tagName === 'MAIN';
  if (!idle || !playButton.value || document.querySelector('dialog[open]')) return;
  event.preventDefault();
  play(playButton.value);
};

// --- The living scene -------------------------------------------------------

const sceneCanvas = ref<HTMLCanvasElement | null>(null);
let scene: HubScene | null = null;
const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const observer = new ResizeObserver(() => scene?.resize());

// --- The reel: real games playing the moments no other game has ------------

const liveBox = ref<HTMLElement | null>(null);
const reelStage = ref<HTMLElement | null>(null);
let reel: HomeReel | null = null;
/** Too small a box (a short phone held sideways): no reel, the title alone. */
const MIN_LIVE_HEIGHT = 140;
const liveShown = ref(true);
const liveObserver = new ResizeObserver((entries) => {
  for (const { target, contentRect } of entries) {
    if (target === liveBox.value) liveShown.value = contentRect.height >= MIN_LIVE_HEIGHT;
    else if (contentRect.width > 0 && contentRect.height > 0) {
      reel?.resize(contentRect.width, contentRect.height);
    }
  }
  sync();
});
/** No shake on a title screen; the player's own effect level otherwise. */
const reelProfile = () => ({
  ...effectsProfile(settings.current.effects, settings.current.shake),
  shake: false,
});
watch(theme.resolved, async () => {
  await nextTick();
  reel?.setPalette(TonePalette.fromElement(document.documentElement));
});

/** The moment on screen, and its caption: the mode (or the Guardian), then what it shows. */
const shownScene = ref<SceneId | null>(null);
const isGuardian = (id: SceneId) => (BOSS_IDS as readonly string[]).includes(id);
const caption = computed(() => {
  const id = shownScene.value;
  if (!id) return null;
  const guardian = isGuardian(id);
  const kicker = guardian
    ? t('campaign.chapterGuardian', { name: t(`bosses.${id}.name`) })
    : t(`modes.${id === 'elements' ? 'sand' : id}.name`);
  return { guardian, kicker, line: t(`home.reel.${id}`) };
});

const sync = () => {
  const shown = props.active && !document.hidden;
  if (shown) scene?.start();
  else scene?.stop();
  if (shown && liveShown.value) reel?.start();
  else reel?.stop();
};
watch(() => props.active, sync);

onMounted(async () => {
  window.addEventListener('keydown', onKey);
  document.addEventListener('visibilitychange', sync);
  const canvas = sceneCanvas.value;
  if (!canvas) return;
  // After the first paint: the scene is a backdrop, the title comes first.
  await new Promise((resolve) => requestAnimationFrame(resolve));
  scene = await createHubScene(canvas, still);
  observer.observe(canvas);
  scene.resize();
  sync();
  // Then the reel, whose code is the games': loaded once the title is up.
  const box = liveBox.value;
  const stage = reelStage.value;
  if (!box || !stage) return;
  reel = await createHomeReel(stage, TonePalette.fromElement(document.documentElement), {
    profile: reelProfile,
    dark: () => theme.resolved.value === 'dark',
    formatPoints: (points) => format.number(points),
    still: still || settings.current.effects === 'off',
    onScene: (id) => (shownScene.value = id),
  });
  liveObserver.observe(box);
  liveObserver.observe(stage);
});
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey);
  document.removeEventListener('visibilitychange', sync);
  observer.disconnect();
  liveObserver.disconnect();
  scene?.stop();
  reel?.dispose();
});
</script>

<template>
  <section class="page home">
    <canvas ref="sceneCanvas" class="home__scene" aria-hidden="true" />
    <div class="home__content">
      <button
        type="button"
        class="daily"
        @click="emit('daily', daily, $event.currentTarget as Element)"
      >
        <span class="daily__icon" aria-hidden="true"><AppIcon name="calendar" :size="22" /></span>
        <span class="daily__text">
          <strong>{{ t('title.dailyShort', { mode: t(`modes.${daily.modeId}.name`) }) }}</strong>
          <small>{{ t('hub.timeLeft', { h: dailyLeft.h, m: dailyLeft.m }) }}</small>
        </span>
        <AppIcon name="right" :size="18" class="daily__go" />
      </button>

      <div class="home__title">
        <h1 class="logo">
          <!-- Read as one name; the split by the rift is for the eyes only. -->
          <span class="sr-only">{{ `${LOGO[0]}${LOGO[1]} ${LOGO[2]}` }}</span>
          <span class="logo__lumi" aria-hidden="true">{{ LOGO[0].toUpperCase() }}</span>
          <span class="logo__rift" aria-hidden="true">
            <svg class="logo__crack" viewBox="0 0 34 84" aria-hidden="true">
              <path class="logo__glow" d="M22 2 L8 30 L26 44 L10 82" />
              <path class="logo__core" d="M22 2 L8 30 L26 44 L10 82" />
            </svg>
            <span>{{ LOGO[1].toUpperCase() }}</span>
          </span>
          <span class="logo__kicker" aria-hidden="true">{{ LOGO[2].toUpperCase() }}</span>
        </h1>
        <p class="tagline">{{ t('title.tagline') }}</p>
        <p v-if="edition.id === 'demo'" class="home__demo" role="note">
          <strong>{{ t('demo.title') }}</strong> {{ t('demo.banner') }}
        </p>
      </div>

      <!-- Real games playing their best moments; the title says the rest. -->
      <div ref="liveBox" class="home__live" aria-hidden="true">
        <div v-show="liveShown" class="reel__captions">
          <Transition name="reel-caption" mode="out-in">
            <p
              v-if="caption"
              :key="shownScene ?? ''"
              class="reel__caption"
              :class="{ 'reel__caption--guardian': caption.guardian }"
            >
              <span class="reel__kicker">{{ caption.kicker }}</span>
              <span class="reel__line">{{ caption.line }}</span>
            </p>
          </Transition>
        </div>
        <div v-show="liveShown" ref="reelStage" class="reel__stage" />
      </div>

      <div class="home__cta">
        <button
          ref="playButton"
          type="button"
          class="play"
          @click="play($event.currentTarget as Element)"
        >
          <span class="play__icon" aria-hidden="true"><AppIcon name="play" :size="26" /></span>
          <span class="play__text">
            <span class="play__label">{{ t('title.play') }}</span>
            <span class="play__next">
              {{
                next
                  ? t('title.level', { level: next.id, mode: t(`modes.${next.modeId}.name`) })
                  : t('modes.sand.name')
              }}
            </span>
          </span>
        </button>
        <p v-if="!touch" class="home__hint">
          <i18n-t keypath="title.space" tag="span">
            <template #key>
              <kbd>{{ t('title.spaceKey') }}</kbd>
            </template>
          </i18n-t>
        </p>
        <button type="button" class="goals" @click="goalsOpen = true">
          <span class="goals__dots" aria-hidden="true">
            <i
              v-for="entry in objectives"
              :key="entry.objective.kind"
              :class="{ 'goals__dot--done': entry.done }"
            />
          </span>
          {{ t('profile.objectives') }}
          <strong>{{ t('hub.objectivesDone', { n: done, total: objectives.length }) }}</strong>
        </button>
      </div>
    </div>
    <ObjectivesDialog :open="goalsOpen" @close="goalsOpen = false" />
  </section>
</template>

<style scoped>
.home {
  padding: 0;
}

.home__scene {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

/* Portrait: the challenge on top, the title in the middle, Play in the thumb's reach. */
.home__content {
  /* Room for the live well between the title and Play. */
  --logo: min(17cqw, 10.2cqh);
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-3);
  height: 100%;
  padding: var(--space-1) var(--space-4) var(--space-3);
}

.daily {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  min-height: 3.25rem;
  padding: var(--space-2) var(--space-3) var(--space-2) var(--space-2);
  border: 1px solid color-mix(in srgb, var(--accent) 45%, transparent);
  border-radius: 1.15rem;
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--accent) 17%, transparent),
    color-mix(in srgb, var(--accent) 5%, transparent)
  );
  color: var(--text);
  text-align: start;
  transition: transform 120ms ease;
}

.daily:active {
  transform: scale(0.97);
}

.daily__icon {
  display: grid;
  place-items: center;
  width: 2.4rem;
  height: 2.4rem;
  border-radius: 0.75rem;
  background: color-mix(in srgb, var(--accent) 20%, transparent);
  color: var(--accent);
}

.daily__text {
  display: grid;
}

.daily__text strong {
  font-size: 0.85rem;
}

.daily__text small {
  font-size: 0.78rem;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}

.daily__go {
  color: var(--accent);
}

.home__title {
  flex: none;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: var(--space-3);
  text-align: center;
}

.logo {
  display: grid;
  justify-items: center;
  font-family: var(--font-display);
  font-size: var(--logo);
  font-weight: 900;
  line-height: 0.86;
  letter-spacing: -0.01em;
}

.logo__lumi {
  background: linear-gradient(100deg, var(--text) 0 40%, var(--crack) 50%, var(--text) 60% 100%);
  background-size: 320% 100%;
  background-position: 100% 0;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  animation: sheen 7s ease-in-out infinite;
}

@keyframes sheen {
  0%,
  55% {
    background-position: 100% 0;
  }

  85%,
  100% {
    background-position: 0% 0;
  }
}

.logo__rift {
  display: inline-flex;
  align-items: center;
  gap: 0.06em;
}

.logo__rift > span {
  background: var(--accent-gradient);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  filter: drop-shadow(0 0 0.22em color-mix(in srgb, var(--rift-glow) 35%, transparent));
}

.logo__crack {
  width: 0.34em;
  height: 0.82em;
  overflow: visible;
}

.logo__crack path {
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.logo__glow {
  stroke: var(--rift-glow);
  stroke-width: 12;
  opacity: 0.35;
  animation: pulse 2.6s ease-in-out infinite;
}

.logo__core {
  stroke: var(--crack);
  stroke-width: 4.5;
}

@keyframes pulse {
  50% {
    opacity: 0.75;
  }
}

.logo__kicker {
  margin-top: 0.55em;
  padding-left: 0.6em;
  font-size: 0.26em;
  font-weight: 800;
  letter-spacing: 0.6em;
  color: var(--text-muted);
}

.tagline {
  font-weight: 600;
  color: var(--text-muted);
}

/* The reel takes the room between the title and Play: its caption, then the well. */
.home__live {
  flex: 1;
  min-height: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
}

/* Two lines kept for every caption: the well never jumps when the text changes. */
.reel__captions {
  display: grid;
  align-items: end;
  min-height: 2.6rem;
  max-width: 22rem;
  text-align: center;
}

.reel__caption {
  display: grid;
  gap: 0.15rem;
}

.reel__kicker {
  font-size: 0.66rem;
  font-weight: 800;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--accent);
}

.reel__caption--guardian .reel__kicker {
  color: var(--danger);
}

.reel__line {
  font-size: 0.9rem;
  font-weight: 700;
  line-height: 1.2;
  text-wrap: balance;
}

.reel__stage {
  flex: 1;
  min-height: 0;
  width: 100%;
  display: grid;
  place-items: center;
}

/* Each moment is a fresh canvas, fading in over the last one. */
.reel__stage :deep(.reel__canvas) {
  grid-area: 1 / 1;
  transition: opacity 320ms ease;
}

.reel__stage :deep(.reel__canvas--hidden),
.reel__stage :deep(.reel__canvas--out) {
  opacity: 0;
}

.reel-caption-enter-active,
.reel-caption-leave-active {
  transition:
    opacity 200ms ease,
    transform 200ms ease;
}

.reel-caption-enter-from {
  opacity: 0;
  transform: translateY(0.4rem);
}

.reel-caption-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .reel__stage :deep(.reel__canvas) {
    transition: none;
  }

  .reel-caption-enter-active,
  .reel-caption-leave-active {
    transition: none;
  }
}

.home__demo {
  max-width: 30rem;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius);
  background: var(--glass);
  font-size: 0.85rem;
}

.home__cta {
  display: grid;
  justify-items: center;
  gap: var(--space-3);
  width: 100%;
}

/* The main action: molten gold, raised, it sinks when pressed. */
.play {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: min(100%, 21.5rem);
  min-height: 4.9rem;
  padding: var(--space-2) var(--space-4) var(--space-3) var(--space-3);
  border: 0;
  border-radius: 1.5rem;
  background: var(--accent-gradient);
  color: var(--on-accent-fill);
  text-align: start;
  box-shadow:
    0 6px 0 var(--accent-edge),
    0 1rem 2.2rem color-mix(in srgb, var(--rift-glow) 35%, transparent),
    inset 0 2px 0 var(--highlight-strong);
  transition:
    transform 90ms ease,
    box-shadow 90ms ease;
}

.play::after {
  content: '';
  position: absolute;
  inset: -0.45rem;
  border: 2px solid color-mix(in srgb, var(--accent) 55%, transparent);
  border-radius: 1.9rem;
  opacity: 0;
  pointer-events: none;
  animation: breathe 2.6s ease-in-out infinite;
}

@keyframes breathe {
  0%,
  100% {
    opacity: 0;
    transform: scale(0.97);
  }

  50% {
    opacity: 1;
    transform: scale(1.02);
  }
}

.play:active {
  transform: translateY(5px);
  box-shadow:
    0 1px 0 var(--accent-edge),
    0 0.4rem 1rem color-mix(in srgb, var(--rift-glow) 30%, transparent),
    inset 0 2px 0 var(--highlight-strong);
}

.play__icon {
  display: grid;
  place-items: center;
  width: 3.4rem;
  height: 3.4rem;
  flex: none;
  border-radius: 1.05rem;
  background: var(--on-accent-fill);
  color: var(--accent);
}

.play__text {
  display: grid;
  gap: 0.3rem;
}

.play__label {
  font-family: var(--font-display);
  font-size: 1.9rem;
  font-weight: 900;
  line-height: 1;
  letter-spacing: 0.03em;
  text-transform: uppercase;
}

.play__next {
  font-size: 0.85rem;
  font-weight: 700;
  opacity: 0.82;
}

.home__hint {
  font-size: 0.8rem;
  color: var(--text-muted);
}

.home__hint kbd {
  padding: 0.05rem 0.4rem;
  border: 1px solid var(--border);
  border-bottom-width: 2px;
  border-radius: 0.35rem;
  font-family: inherit;
}

.goals {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  min-height: var(--touch);
  padding: 0 var(--space-4);
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--glass);
  font-size: 0.85rem;
  font-weight: 700;
}

.goals strong {
  color: var(--accent);
}

.goals__dots {
  display: inline-flex;
  gap: 0.25rem;
}

.goals__dots i {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  background: var(--border);
}

.goals__dots .goals__dot--done {
  background: var(--accent);
  box-shadow: 0 0 0.5rem var(--accent);
}

/* Landscape: the title on the left, the challenge and Play on the right. */
@media (orientation: landscape) {
  .home__content {
    --logo: min(9.6cqw, 19.8cqh);
    display: grid;
    grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.6fr) minmax(0, 0.95fr);
    grid-template-rows: minmax(0, 1fr) auto auto minmax(0, 1fr);
    grid-template-areas:
      'title live .'
      'title live daily'
      'title live cta'
      'title live .';
    align-items: center;
    gap: var(--space-4);
    padding: var(--space-3) var(--space-6) var(--space-3) var(--space-2);
  }

  .home__title {
    grid-area: title;
  }

  .home__live {
    grid-area: live;
    height: 100%;
  }

  .daily {
    grid-area: daily;
    justify-self: center;
  }

  .home__cta {
    grid-area: cta;
  }
}
</style>

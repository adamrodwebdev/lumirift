<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { I18nT, useI18n } from 'vue-i18n';
import { useServices } from '@/app/AppServices';
import { useFormat } from '@/app/useFormat';
import { dayKey, timeLeft } from '@/core/Day';
import { GuardianChallenge } from '@/campaign/GuardianChallenge';
import { guardianLevel, type CampaignLevel } from '@/campaign/Levels';
import { allowsLevel, allowsMode, nextPlay, offersDaily } from '@/platform/Edition';
import { effectsProfile } from '@/fx/EffectsProfile';
import { GUARDIAN_XP } from '@/progression/Experience';
import { guardianBonusOpen } from '@/progression/Profile';
import { TonePalette } from '@/render/TonePalette';
import { DailyChallenge } from '@/session/DailyChallenge';
import { BOSS_IDS } from '@/session/GameSession';
import type { ModeId } from '@/session/ModeId';
import type { SceneId } from '@/showcase/Scene';
import AppIcon from '../components/AppIcon.vue';
import EventBanner from './EventBanner.vue';
import { isTouchScreen } from '../useOrientation';
import type { HubScene } from './HubScene';
import { createHomeReel, createHubScene } from './loadArt';
import type { HomeReel } from './reel/HomeReel';
import ObjectivesDialog from './ObjectivesDialog.vue';

/**
 * The title screen: the living scene, the logo, the reel (real games playing
 * what no other game has: the Sand's elements within seconds, the wells that
 * turn, the four Guardians), one big Play in the thumb's reach (the campaign
 * goes on), the two challenges (the day's, the week's Guardian), the day's
 * objectives.
 */
const props = defineProps<{
  /** Shown (its tab chosen, the menu on screen): the scene runs only then. */
  active: boolean;
}>();
const emit = defineEmits<{
  play: [modeId: ModeId, origin: Element];
  daily: [challenge: DailyChallenge, origin: Element];
  guardian: [challenge: GuardianChallenge, origin: Element];
  level: [level: CampaignLevel, origin: Element];
  /** The gift calendar, opened from its pill (1.35). */
  gift: [];
  /** The season's page, opened from the week's event (1.36). */
  season: [origin: Element];
}>();

const { t } = useI18n();
/** The game's name, split by the rift, then its kicker (never translated). */
const LOGO = ['Lumi', 'rift', 'Blocks'] as const;
const { catalog, clock, platform, campaign, profile, settings, theme, gifts } = useServices();
const format = useFormat();
const { edition } = platform;
const touch = isTouchScreen();

const today = clock();
/**
 * The daily challenge, among the modes this edition opens; none in a test
 * build of one mode (1.37: its two builds stay alike).
 */
const daily = offersDaily(edition)
  ? new DailyChallenge(
      today,
      catalog.dailyEligible().filter((id) => allowsMode(edition, id)),
    )
  : null;
/** Time left before the next daily challenge (local midnight). */
const dailyLeft = (() => {
  const left = timeLeft(daily?.endsAt ?? today, today);
  return { h: left.hours, m: left.minutes };
})();
/** A test build of one mode (1.37): no reel of the other modes, its own pitch for a tagline. */
const solo = edition.solo;

/** The week's Guardian, open to every player (but not past what an edition offers: the demo). */
const guardian = new GuardianChallenge(today);
const guardianLevelOf = guardianLevel(guardian.boss);
const guardianOpen =
  guardianLevelOf !== undefined &&
  allowsLevel(edition, guardianLevelOf) &&
  allowsMode(edition, guardian.modeId);
/** Days and hours before the next Guardian. */
const guardianLeft = (() => {
  const left = timeLeft(guardian.endsAt, today);
  return { d: left.days, h: left.hours };
})();
/** The gift calendar (1.35), once the player has played: a gift waits; the daily streak, still alive today. */
const giftStarted = computed(() => gifts.calendar.started);
const giftReady = computed(() => gifts.calendar.ready);
const streak = computed(() => gifts.calendar.streak);

/** The day's first attempt is still to play: it earns its bonus. */
const guardianBonus = computed(() => guardianBonusOpen(profile.current, dayKey(today)));

/** Play goes on with the campaign; past the levels this edition opens, a free game. */
const next = computed(() => nextPlay(edition, campaign.model.nextLevel));
const play = (origin: Element) => {
  const coming = next.value;
  if (coming.kind === 'level') emit('level', coming.level, origin);
  else emit('play', coming.modeId, origin);
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
  // Then the reel, whose code is the games': loaded once the title is up (never
  // in a test build of one mode: it plays the others).
  const box = liveBox.value;
  const stage = reelStage.value;
  if (!box || !stage || solo) return;
  reel = await createHomeReel(stage, TonePalette.fromElement(document.documentElement), {
    profile: reelProfile,
    dark: () => theme.resolved.value === 'dark',
    formatPoints: (points) => format.number(points),
    comboWord: (combo) => t('wellWords.combo', { n: combo }),
    still: still || settings.current.effects === 'off',
    onScene: (id) => (shownScene.value = id),
    // Touch screens: 60 frames a second at most, like the game.
    maxFps: isTouchScreen() ? 60 : null,
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
      <!-- The two challenges side by side: the day's, and the week's Guardian. -->
      <div v-if="daily || guardianOpen" class="challenges">
        <button
          v-if="daily"
          type="button"
          class="challenge"
          @click="emit('daily', daily, $event.currentTarget as Element)"
        >
          <span class="challenge__icon" aria-hidden="true">
            <AppIcon name="calendar" :size="20" />
          </span>
          <span class="challenge__text">
            <small class="challenge__kicker">{{ t('daily.title') }}</small>
            <strong>{{ t(`modes.${daily.modeId}.name`) }}</strong>
            <small>{{ t('hub.timeLeft', { h: dailyLeft.h, m: dailyLeft.m }) }}</small>
          </span>
          <!-- The daily streak (1.35), pinned to its card like the Guardian's bonus. -->
          <span v-if="streak > 0" class="challenge__bonus challenge__bonus--streak">
            <AppIcon name="flame" :size="12" aria-hidden="true" />
            <span aria-hidden="true">{{ format.number(streak) }}</span>
            <span class="sr-only">{{ t('home.streak', { n: streak }, streak) }}</span>
          </span>
        </button>
        <button
          v-if="guardianOpen"
          type="button"
          class="challenge challenge--guardian"
          @click="emit('guardian', guardian, $event.currentTarget as Element)"
        >
          <span class="challenge__icon" aria-hidden="true">
            <AppIcon name="guardian" :size="20" />
          </span>
          <span class="challenge__text">
            <small class="challenge__kicker">{{ t('guardianChallenge.title') }}</small>
            <strong>{{ t(`bosses.${guardian.boss}.name`) }}</strong>
            <small>{{ t('guardianChallenge.timeLeft', guardianLeft) }}</small>
          </span>
          <!-- The day's first attempt still to play: its bonus, pinned to the card. -->
          <span v-if="guardianBonus" class="challenge__bonus">
            <span aria-hidden="true">{{
              t('guardianChallenge.bonusShort', { xp: GUARDIAN_XP })
            }}</span>
            <span class="sr-only">{{ t('guardianChallenge.bonus', { xp: GUARDIAN_XP }) }}</span>
          </span>
        </button>
      </div>

      <!-- The week's event and the season's tier (1.36). -->
      <EventBanner class="home__event" @open="(origin) => emit('season', origin)" />

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
        <p class="tagline">{{ solo ? t(`modes.${solo}.pitch`) : t('title.tagline') }}</p>
        <p v-if="edition.id === 'demo'" class="home__demo" role="note">
          <strong>{{ t('demo.title') }}</strong> {{ t('demo.banner') }}
        </p>
      </div>

      <!-- Real games playing their best moments; the title says the rest. -->
      <div ref="liveBox" class="home__live" aria-hidden="true">
        <div v-show="liveShown && !solo" class="reel__captions">
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
                next.kind === 'level'
                  ? t('title.level', {
                      level: next.level.id,
                      mode: t(`modes.${next.level.modeId}.name`),
                    })
                  : t(`modes.${next.modeId}.name`)
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
        <div class="home__daily">
          <button
            v-if="giftStarted"
            type="button"
            class="gift-pill"
            :class="{ 'gift-pill--ready': giftReady }"
            :aria-label="giftReady ? t('gifts.ready') : t('gifts.title')"
            @click="emit('gift')"
          >
            <AppIcon name="gift" :size="22" />
            <span class="gift-pill__label" aria-hidden="true">{{ t('gifts.title') }}</span>
            <span v-if="giftReady" class="gift-pill__dot" aria-hidden="true" />
          </button>
          <button type="button" class="goals" @click="goalsOpen = true">
            <span class="goals__dots" aria-hidden="true">
              <i
                v-for="entry in objectives"
                :key="entry.objective.kind"
                :class="{ 'goals__dot--done': entry.done }"
              />
            </span>
            <span class="goals__label">{{ t('profile.objectives') }}</span>
            <strong>{{ t('hub.objectivesDone', { n: done, total: objectives.length }) }}</strong>
          </button>
        </div>
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

/* The two challenges, side by side: each says what it is, what it plays, how long it lasts. */
.challenges {
  container: challenges / inline-size;
  display: flex;
  gap: var(--space-2);
  width: min(100%, 27rem);
}

/*
 * The Guardian's bonus sticks out above its card: where the challenges open
 * the page (portrait, a tiny window), room for it under the page's edge, which clips.
 */
.challenges:has(.challenge__bonus) {
  margin-top: 0.6rem;
}

.challenge {
  /* The day's challenge in gold; the Guardian's in the red of the rift. */
  --tint: var(--accent);
  position: relative;
  display: flex;
  flex: 1 1 0;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
  min-height: 3.6rem;
  padding: 0.4rem var(--space-3);
  border: 1px solid color-mix(in srgb, var(--tint) 45%, transparent);
  border-radius: 1.15rem;
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--tint) 17%, transparent),
    color-mix(in srgb, var(--tint) 5%, transparent)
  );
  color: var(--text);
  text-align: start;
  transition: transform 120ms ease;
}

.challenge--guardian {
  --tint: var(--danger);
}

.challenge:active {
  transform: scale(0.97);
}

/* A phone held upright (the base): the cards share its width; their words take the icons' room. */
.challenge__icon {
  display: none;
  flex: none;
  place-items: center;
  width: 2.1rem;
  height: 2.1rem;
  border-radius: 0.7rem;
  background: color-mix(in srgb, var(--tint) 20%, transparent);
  color: var(--tint);
}

.challenge__text {
  display: grid;
  min-width: 0;
  line-height: 1.2;
}

.challenge__text small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/*
 * A long name (Golem de céramique, Керамический голем) takes two lines rather
 * than losing its end, upright or on its side.
 */
.challenge__text strong {
  display: -webkit-box;
  overflow: hidden;
  font-size: 0.85rem;
  line-height: 1.15;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.challenge__text small {
  color: var(--text-muted);
  font-size: 0.72rem;
  font-variant-numeric: tabular-nums;
}

.challenge__text .challenge__kicker {
  color: var(--tint);
  font-size: 0.62rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

/* The day's first attempt still to play: a gold pill on the card's edge. */
.challenge__bonus {
  position: absolute;
  top: -0.6rem;
  right: 0.6rem;
  padding: 0.1rem 0.45rem;
  border-radius: 999px;
  background: var(--accent-fill);
  color: var(--on-accent-fill);
  font-size: 0.64rem;
  font-weight: 800;
  line-height: 1.3;
  box-shadow: 0 0 0.8rem color-mix(in srgb, var(--accent) 55%, transparent);
}

/* The daily streak's flame, in the card's own gold. */
.challenge__bonus--streak {
  display: inline-flex;
  align-items: center;
  gap: 0.15rem;
}

.challenge__bonus--streak :deep(svg) {
  fill: currentColor;
}

/* A narrow column of cards (a small phone on its side): the bonus pins the card's lower edge, clear of its title. */
@container challenges (width < 12rem) {
  .challenge__bonus {
    top: auto;
    bottom: -0.45rem;
  }
}

/* From 30rem (a phone on its side, a tablet, a desktop): each card has room for its icon. */
@media (width >= 30rem) {
  .challenge {
    padding-left: 0.45rem;
  }

  .challenge__icon {
    display: grid;
  }
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

/* Play and the day's objectives adapt to their column (a container query). */
.home__cta {
  container: cta / inline-size;
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

/* The day's gift beside the day's objectives (1.35). */
/* One row, whatever the width: the objectives' words give way first (1.36). */
.home__daily {
  display: flex;
  justify-content: center;
  gap: var(--space-2);
  max-width: 100%;
}

.gift-pill {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  min-width: var(--touch);
  min-height: var(--touch);
  padding: 0 0.6rem;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--glass);
  color: var(--text-muted);
  font-size: 0.85rem;
  font-weight: 700;
}

.gift-pill--ready {
  border-color: color-mix(in srgb, var(--accent) 60%, transparent);
  color: var(--accent);
}

/* Its word only where the column has room; the icon and the dot say it otherwise. */
.gift-pill__label {
  display: none;
}

@container cta (inline-size >= 24rem) {
  .gift-pill {
    padding-inline: var(--space-3) var(--space-4);
  }

  .gift-pill__label {
    display: inline;
  }
}

.gift-pill__dot {
  position: absolute;
  top: 0.3rem;
  right: 0.3rem;
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 50%;
  background: var(--accent-fill);
  box-shadow: 0 0 0.6rem color-mix(in srgb, var(--accent) 70%, transparent);
}

.goals {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
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
  white-space: nowrap;
}

.goals__dots {
  display: inline-flex;
  flex: none;
  gap: 0.25rem;
}

/* A narrow column: the dots and the count say it, a screen reader reads it all (1.36). */
@container cta (inline-size < 18.5rem) {
  .goals__label {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
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
    grid-template-rows: minmax(0, 1fr) auto auto auto minmax(0, 1fr);
    grid-template-areas:
      'title live .'
      'title live daily'
      'title live event'
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

  .challenges {
    grid-area: daily;
    flex-direction: column;
    justify-self: center;
    width: min(100%, 17rem);
  }

  .home__event {
    grid-area: event;
    justify-self: center;
    width: min(100%, 17rem);
  }

  /* In the middle of the screen, the bonus has room: every line counts here. */
  .challenges:has(.challenge__bonus) {
    margin-top: 0;
  }

  /*
   * A narrow column (a small phone on its side): the play button's word and
   * icon scale down to it, so that a longer word (ИГРАТЬ) stays inside.
   */
  .home__cta {
    grid-area: cta;
    container-type: inline-size;
  }

  .play__label {
    font-size: clamp(1.3rem, 12.5cqi, 1.9rem);
  }

  .play__icon {
    width: clamp(2.5rem, 24cqi, 3.4rem);
    height: clamp(2.5rem, 24cqi, 3.4rem);
  }

  .goals {
    max-width: 100%;
  }

  /* Too narrow for its words: the dots and the count say it, a screen reader reads it all. */
  @container (max-width: 12rem) {
    .goals__label {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
  }
}

/*
 * A phone on its side: little height for two challenges, Play and the
 * objectives. Tighter rows, the cards without their icons, the bonus clear of
 * the card's first line.
 */
@media (orientation: landscape) and (max-height: 26.875rem) {
  .home__content {
    row-gap: var(--space-2);
  }

  .home__cta {
    gap: var(--space-2);
  }

  .challenge {
    min-height: 3rem;
    padding: 0.3rem var(--space-3);
  }

  .challenge__icon {
    display: none;
  }
}
/*
 * A narrow column for Play (a 200 % zoom, a small window): a smaller key and
 * word, sized to the column, and the objectives may take two lines.
 */
@container cta (inline-size < 15rem) {
  .play {
    min-width: 0;
    gap: var(--space-2);
    padding: var(--space-2) var(--space-3) var(--space-3) var(--space-2);
  }

  .play__icon {
    width: 2.6rem;
    height: 2.6rem;
    border-radius: 0.8rem;
  }

  .play__text {
    min-width: 0;
  }

  .play__label {
    font-size: clamp(1.2rem, 10cqi, 1.9rem);
  }

  .goals {
    max-width: 100%;
    flex-wrap: wrap;
    justify-content: center;
    padding-inline: var(--space-3);
    text-align: center;
  }
}

/*
 * A tiny window (a 400 % zoom, 320 × 256): one column that scrolls, every
 * word whole; the live reel steps aside.
 */
/* A very short menu (a phone, or a window, on its side): Play speaks for itself, without its key (1.36). */
@container pages (height < 22rem) {
  .home__hint {
    display: none;
  }
}

/*
 * Shorter still (a small phone on its side), when the home does not scroll (a
 * 400 % zoom scrolls, and keeps it all): each challenge without its time left,
 * which it shows when opened.
 */
@container hub (height >= 20rem) {
  @container pages (height < 19.5rem) {
    .home__content {
      row-gap: 0.3rem;
    }

    .challenge {
      min-height: 2.75rem;
    }

    .challenge__text small:last-child {
      display: none;
    }

    /* No room for the pills on the cards' edges: they would sit on the week's event. */
    .challenge__bonus {
      display: none;
    }

    /* Play, still the largest target, a little lower and without its icon: its words keep one line each (Russian). */
    .play {
      min-height: 4.1rem;
      padding-inline-start: var(--space-3);
    }

    .play__icon {
      display: none;
    }
  }
}

@container hub (height < 20rem) {
  .home__content {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    height: auto;
    min-height: 100%;
    padding-inline: var(--space-2);
  }

  .home__live {
    display: none;
  }

  .challenges {
    flex-direction: column;
    width: 100%;
  }

  .challenges:has(.challenge__bonus) {
    margin-top: 0.6rem;
  }

  .challenge__text strong,
  .challenge__text small {
    display: block;
    overflow: visible;
    white-space: normal;
    -webkit-line-clamp: none;
  }
}
</style>

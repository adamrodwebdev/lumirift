<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, provide, ref, shallowRef } from 'vue';
import { useI18n } from 'vue-i18n';
import { useServices } from '@/app/AppServices';
import { FrameClock } from '@/app/FrameClock';
import { useFormat } from '@/app/useFormat';
import { effectsProfile } from '@/fx/EffectsProfile';
import { newRecord } from '@/fx/sounds';
import type { GoalProgress } from '@/campaign/CampaignRun';
import type { GuardianChallenge } from '@/campaign/GuardianChallenge';
import type { CampaignLevel } from '@/campaign/Levels';
import type { BreakMoment } from '@/platform/Platform';
import type { BestLine } from '@/progression/BestLine';
import type { Ending } from '@/run/GameEnding';
import { GameRun, type RunPhase } from '@/run/GameRun';
import { runKindFor, type RunKindId } from '@/run/RunKind';
import { Coach, type CoachStep } from '@/session/Coach';
import type { DailyChallenge } from '@/session/DailyChallenge';
import type { GameSession, Indicator } from '@/session/GameSession';
import type { ModeId } from '@/session/ModeId';
import { observeCommands } from '@/session/observeCommands';
import AppIcon from '../components/AppIcon.vue';
import CampaignGoal from '../components/CampaignGoal.vue';
import CoachCard from '../components/CoachCard.vue';
import DangerLayer from '../components/DangerLayer.vue';
import GameOverDialog from '../components/GameOverDialog.vue';
import type { GameOutcome } from '../GameOutcome';
import HudPanel from '../components/HudPanel.vue';
import RecordBurst from '../components/RecordBurst.vue';
import SurgeLayer from '../components/SurgeLayer.vue';
import KeyLegend from '../components/KeyLegend.vue';
import PauseDialog from '../components/PauseDialog.vue';
import { stageFor } from '../stages';
import { SURGE } from '../surgeControl';
import { GAME_SURFACE } from '../useGameSurface';
import { useKeyBindings } from '../useKeyBindings';
import { useKeyLabels } from '../useKeyLabels';
import { isTouchScreen } from '../useOrientation';
import { useSurge } from './useSurge';
import { useTension } from './useTension';

const props = defineProps<{
  modeId: ModeId;
  daily: DailyChallenge | null;
  /** The week's Guardian challenge, or null. */
  guardian: GuardianChallenge | null;
  /** Variant chosen on the home screen (AI level of a duel), or null. */
  variant: string | null;
  /** The campaign level played, or null outside the campaign. */
  level: CampaignLevel | null;
}>();
const emit = defineEmits<{
  home: [];
  campaign: [];
  next: [level: CampaignLevel];
  /** The player opens the settings from the pause. */
  settings: [];
}>();

const { t } = useI18n();
const format = useFormat();
const {
  catalog,
  scores,
  settings,
  share,
  profile,
  campaign,
  platform,
  audio,
  haptics,
  clock: today,
} = useServices();
const descriptor = catalog.get(props.modeId);

/*
 * The games of this screen (1.27): the kind chosen (a free game, the day's
 * challenge, the week's Guardian, a campaign level) and the run that plays
 * each game and settles its end. The screen draws and plays what it publishes.
 */
const run = new GameRun(runKindFor(props, campaign.current.ranks), descriptor.showsBest === true, {
  catalog,
  scores,
  profile,
  platform,
  today,
  campaign: {
    record: (outcome) => campaign.record(outcome),
    starsOf: (levelId) => campaign.model.starsOf(levelId),
  },
  seed: () => Math.floor(Math.random() * 2 ** 32),
});

const phase = ref<RunPhase>('loading');
const session = shallowRef<GameSession | null>(null);
const indicators = shallowRef<readonly Indicator[]>([]);
const outcome = ref<GameOutcome | null>(null);
const status = ref('');
/** The rewarded ad of this game's end: offered, playing, or not (used, refused, unsupported). */
const reward = ref<'offer' | 'busy' | 'none'>('none');
const announcement = ref('');
/** The record beside the score (modes that show it). */
const best = shallowRef<BestLine | null>(null);
/** Counts the records beaten: each one plays the burst again. */
const recordBurst = ref(0);
let recordTimer: ReturnType<typeof setTimeout> | undefined;
const celebrateRecord = () => {
  audio.play(newRecord);
  haptics.pulse([20, 40, 20, 40, 90]);
  announcement.value = t('hud.newBest');
  recordBurst.value++;
  clearTimeout(recordTimer);
  recordTimer = setTimeout(() => (recordBurst.value = 0), 1800);
};
const toast = ref<{ text: string; key: number } | null>(null);
const stage = stageFor(descriptor);
/** The whole screen takes the gestures of touch players (see useGameSurface). */
const root = ref<HTMLElement | null>(null);
provide(GAME_SURFACE, root);
const touch = isTouchScreen();
/** Where the parts go: one well, a duel (the opponent beside it), or the Mosaic's board and hand. */
const layout =
  descriptor.family === 'placement' ? 'mosaic' : props.modeId === 'duel' ? 'duel' : 'well';
/** A duel names its opponent over the opponent's well already. */
const shownSubtitle = computed(() => (layout === 'duel' ? null : subtitle.value));
const muted = computed(() => settings.current.muted);
const toggleMute = () => settings.update({ muted: !muted.value });
/** Touch help in words, shown in the pause where no drawing says it (by family). */
const HELP: Readonly<Partial<Record<string, readonly string[]>>> = {
  falling: ['controls.touch'],
  sand: ['sand.helpTouch'],
  placement: ['mosaic.helpTouch'],
  volume: ['tower.helpTouch'],
};
const help = HELP[descriptor.family] ?? [];
/** The keys stay drawn beside the game for the first games. */
const FIRST_GAMES = 5;
const showHelp = profile.current.games < FIRST_GAMES;

/**
 * The very first game is guided (modes played with the falling controls):
 * move, rotate, drop, then the goal, each step done by doing it.
 */
const GUIDED: readonly string[] = ['falling', 'sand', 'volume'];
const coach =
  profile.current.games === 0 && GUIDED.includes(descriptor.family) ? new Coach() : null;
const coachStep = ref<CoachStep | null>(coach?.step ?? null);
const coachGoal = descriptor.family === 'sand' ? 'sand' : 'lines';
/** The goal step stays a few seconds when no line comes. */
const COACH_GOAL_MS = 9000;
let coachTimer: ReturnType<typeof setTimeout> | undefined;
const coachUpdate = () => {
  coachStep.value = coach?.step ?? null;
  clearTimeout(coachTimer);
  if (coachStep.value === 'goal') coachTimer = setTimeout(skipCoach, COACH_GOAL_MS);
};
const skipCoach = () => {
  coach?.skip();
  coachUpdate();
};
const modeName = computed(() => t(`modes.${props.modeId}.name`));
/** The game's own subtitle, such as the name of the silhouette of the day. */
const subtitle = computed(() => {
  const key = session.value?.subtitleKey();
  return key ? t(key) : null;
});
const bossName = () => t(`bosses.${run.kind.boss}.name`);
/** The screen's title, read first by screen readers: the kind of game, then its mode. */
const TITLE: Readonly<Record<RunKindId, () => string>> = {
  level: () => t('campaign.levelTitle', { level: run.kind.level?.id, mode: modeName.value }),
  guardian: () => `${t('guardianChallenge.title')} · ${bossName()}`,
  daily: () => `${t('daily.title')} · ${modeName.value}`,
  free: () => modeName.value,
};
const title = computed(() => TITLE[run.kind.id]());

/*
 * The game loop. Touch screens draw 60 frames a second at most (a 120-Hz phone
 * would double the work and the heat); it stops while nothing moves: the
 * pause, and the end's window over a still well.
 */
const clock = FrameClock.capped(touch ? 60 : null);
/** The danger of the game, played: music, cracks, close calls, the final seconds. */
const tension = useTension({
  audio,
  haptics,
  clock,
  level: () => settings.current.effects,
  root,
});
const {
  amount: dangerAmount,
  urgent: timeUrgent,
  flash: closeCallFlash,
  relief: reliefCount,
  broken: wellBroken,
  well: wellCanvas,
} = tension;
const bindings = useKeyBindings();
const keyLabels = useKeyLabels();
/** The rift surge: its gauge, the player's call, time slowed, the exit bonus. */
const surge = useSurge({
  audio,
  haptics,
  clock,
  onReady: () => {
    const code = bindings.value.codes('surge')[0];
    announce(
      code && !touch ? t('surge.readyKey', { key: keyLabels.label(code) }) : t('surge.ready'),
    );
  },
});
provide(SURGE, surge.control);
const { active: surgeActive, shock: surgeShock } = surge;
/** One per game: the stage is rebuilt for each new session. */
const round = ref(0);
/** The game-over dialog waits for the stack to finish collapsing. */
const showOutcome = ref(false);
let outcomeTimer: ReturnType<typeof setTimeout> | undefined;
let unsubscribe: (() => void)[] = [];
const goal = shallowRef<GoalProgress | null>(null);
let toastKey = 0;
let toastTimer: ReturnType<typeof setTimeout> | undefined;

// What the run publishes, drawn and played.
run.events.on('phase', ({ phase: next }) => {
  phase.value = next;
  if (next === 'paused') clock.stop();
  else if (next === 'playing') clock.start();
});
run.events.on('indicators', ({ indicators: next }) => (indicators.value = next));
run.events.on('best', ({ best: line }) => (best.value = line));
run.events.on('record', celebrateRecord);
run.events.on('goal', ({ goal: progress }) => (goal.value = progress));
run.events.on('over', ({ ending, reason, teased }) => showEnding(ending, reason, teased));

clock.subscribe((delta, real) => {
  const current = run.session;
  if (!current) return;
  run.update(delta);
  // The surge counts real time: eight seconds of it, however slow the game runs.
  surge.update(real, current.state === 'running');
  // The danger, played: the music follows it, the well cracks, the clock counts down.
  tension.update(current, delta, run.indicators);
});

/** Announced to screen readers, and shown over the well. */
const announce = (text: string, show = true) => {
  announcement.value = text;
  if (!show) return;
  toast.value = { text, key: ++toastKey };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toast.value = null), 1400);
};

/** The game's moments, told: clears, levels, notices; a close call played. */
const listen = (current: GameSession) => {
  const { events } = current;
  unsubscribe = [
    events.on('clear', ({ lines, combo }) => {
      if (coach?.cleared()) coachUpdate();
      // The Sand clears regions (linking the walls), the other families lines.
      const text = t(descriptor.family === 'sand' ? 'notice.regions' : 'notice.lines', lines);
      announce(
        combo > 0 ? `${text} · ${t('notice.combo', { n: combo + 1 })}` : text,
        lines >= 2 || combo > 0,
      );
    }),
    events.on('levelUp', ({ level }) => announce(t('notice.levelUp', { level }))),
    // The value also picks the plural of the words that count (1 grain, 2 grains).
    events.on('notice', ({ id, value }) =>
      announce(
        t(
          `notice.${id}`,
          { value: value === undefined ? '' : format.number(value) },
          value === undefined ? 1 : value,
        ),
      ),
    ),
    events.on('closeCall', () => tension.closeCall()),
  ];
};

/** How long a teased Guardian passes before the level's end window. */
const TEASER_MS = 2600;

/** The game's end, settled by the run: the effects end, the end window waits for the collapse. */
const showEnding = (ending: Ending, reason: string, teased: boolean) => {
  tension.end(reason);
  surge.end();
  outcome.value = {
    reason: ending.reason,
    amount: ending.amount,
    kind: ending.kind,
    value: format.result(ending.kind, ending.amount),
    best: format.result(ending.kind, ending.best),
    isNewBest: ending.isNewBest,
    progress: ending.progress,
    ...(ending.campaign ? { campaign: ending.campaign } : {}),
    ...(ending.guardian
      ? {
          guardian: {
            points: format.number(ending.guardian.points),
            factor: ending.guardian.factor > 1 ? format.factor(ending.guardian.factor) : null,
          },
        }
      : {}),
  };
  status.value = '';
  reward.value = ending.rewardOffered ? 'offer' : 'none';
  const { gameOverDelayMs } = effectsProfile(settings.current.effects, settings.current.shake);
  outcomeTimer = setTimeout(
    () => {
      showOutcome.value = true;
      clock.stop();
    },
    teased ? Math.max(gameOverDelayMs, TEASER_MS) : gameOverDelayMs,
  );
};

const start = async () => {
  dispose();
  tension.reset();
  recordBurst.value = 0;
  session.value = await run.start((created) => {
    listen(created);
    surge.attach(created, descriptor.family, props.modeId);
    // The guide hears every command that took effect, whatever the input.
    return coach?.step
      ? observeCommands(created, (type) => coach.command(type) && coachUpdate())
      : created;
  });
  showOutcome.value = false;
  round.value++;
};

/**
 * Leaving a game's end (play again, next level, home, campaign map): the
 * portal may show an ad, which it spaces itself. The sound pauses only while
 * an ad really plays; never two ads in a row.
 */
const adBreak = ref(false);
const adHooks = { onStart: () => audio.suspend(), onEnd: () => audio.resume() };
const afterBreak = async (moment: BreakMoment, next: () => void) => {
  // The interface stays blocked until the ad ends (or does not come).
  showOutcome.value = false;
  adBreak.value = true;
  await run.adBreak(adHooks, moment);
  adBreak.value = false;
  next();
};
const again = () => afterBreak('replay', () => void start());
const toHome = () => afterBreak('leave', () => emit('home'));
const toCampaign = () => afterBreak('leave', () => emit('campaign'));

/** The player chose the rewarded ad: the reward comes only if the portal confirms it. */
const doubleExperience = async () => {
  const ended = outcome.value;
  if (!ended || reward.value !== 'offer') return;
  reward.value = 'busy';
  status.value = '';
  const progress = await run.doubleExperience(adHooks);
  reward.value = 'none';
  if (progress === 'refused') status.value = t('over.noAd');
  if (progress === 'refused' || progress === null || outcome.value !== ended) return;
  outcome.value = { ...ended, progress };
  status.value = t('over.doubled', { n: progress.total - ended.progress.total });
};

const dispose = () => {
  clearTimeout(outcomeTimer);
  clearTimeout(recordTimer);
  unsubscribe.forEach((off) => off());
  unsubscribe = [];
  surge.detach();
  run.dispose();
  session.value = null;
};

const pause = () => run.pause(true);
const pauseForFocus = () => run.pause(false);
const resume = () => run.resume();

/** The words shared, by kind of game: the result and the page's address in each. */
const SHARE: Readonly<Record<RunKindId, (value: string, url: string) => string>> = {
  guardian: (value, url) => t('guardianChallenge.share', { boss: bossName(), value, url }),
  daily: (value, url) =>
    t('share.daily', { date: format.date(today()), mode: modeName.value, value, url }),
  free: (value, url) => t('share.mode', { mode: modeName.value, value, url }),
  level: (value, url) => t('share.mode', { mode: modeName.value, value, url }),
};
const onShare = async () => {
  if (!run.session || !outcome.value) return;
  const url = `${location.origin}${location.pathname}`;
  const result = await share.share(SHARE[run.kind.id](outcome.value.value, url));
  status.value = result === 'copied' ? t('over.copied') : '';
};

const onVisibility = () => {
  if (document.hidden) pauseForFocus();
};

// The portal pauses the game (its own ad, the player switching away).
const offPortalPause = platform.onPauseChange((paused) => {
  if (paused) pauseForFocus();
});

onMounted(() => {
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('blur', pauseForFocus);
  void start();
});

onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', onVisibility);
  window.removeEventListener('blur', pauseForFocus);
  clearTimeout(toastTimer);
  clearTimeout(outcomeTimer);
  clearTimeout(recordTimer);
  clearTimeout(coachTimer);
  clock.stop();
  offPortalPause();
  platform.gameplayStop();
  dispose();
});
</script>

<template>
  <div
    ref="root"
    class="game"
    :data-family="descriptor.family"
    :data-layout="layout"
    :style="{ '--danger-amount': settings.current.effects === 'off' ? 0 : dangerAmount }"
  >
    <h1 class="sr-only">{{ title }}</h1>

    <button
      type="button"
      class="btn btn--icon game__pause"
      :aria-label="t('controls.pause')"
      @click="pause"
    >
      <AppIcon name="pause" />
    </button>
    <HudPanel class="game__score" :indicators="indicators.slice(0, 1)" :best="best" />
    <button
      type="button"
      class="btn btn--icon game__sound"
      :aria-label="muted ? t('nav.unmute') : t('nav.mute')"
      :aria-pressed="muted"
      @click="toggleMute"
    >
      <AppIcon :name="muted ? 'mute' : 'sound'" />
    </button>
    <HudPanel
      class="game__stats"
      :indicators="indicators.slice(1)"
      :main-first="false"
      :urgent="timeUrgent ? ['timeLeft'] : []"
    />
    <div v-if="shownSubtitle || (level && goal)" class="game__goal">
      <!-- Part of the game (the shape to fill): shown at every screen size. -->
      <p v-if="shownSubtitle" class="game__subtitle">{{ shownSubtitle }}</p>
      <CampaignGoal v-if="level && goal" :level="level" :value="goal.value" />
    </div>

    <component
      :is="stage"
      v-if="session"
      :key="round"
      :session="session"
      :clock="clock"
      :active="phase === 'playing'"
      :ghost="settings.current.ghost"
      @pause="pause"
    />

    <DangerLayer
      :amount="dangerAmount"
      :level="settings.current.effects"
      :well="wellCanvas"
      :flash="closeCallFlash"
      :relief="reliefCount"
      :broken="wellBroken"
    />
    <SurgeLayer
      :active="surgeActive"
      :shock="surgeShock"
      :level="settings.current.effects"
      :well="wellCanvas"
    />

    <div class="game__overlay">
      <p v-if="phase === 'loading'" class="game__loading">{{ t('game.loading') }}</p>
      <CoachCard
        v-if="coachStep && phase === 'playing'"
        :step="coachStep"
        :goal="coachGoal"
        @skip="skipCoach"
      />
      <div class="game__toasts" aria-hidden="true">
        <Transition name="toast">
          <p v-if="toast" :key="toast.key" class="toast">{{ toast.text }}</p>
        </Transition>
      </div>
    </div>

    <aside v-if="showHelp && !touch" class="game__help" :aria-label="t('game.help')">
      <KeyLegend :family="descriptor.family" :mode-id="modeId" />
    </aside>

    <RecordBurst v-if="recordBurst > 0" :key="recordBurst" />
    <p class="sr-only" aria-live="polite" aria-atomic="true">{{ announcement }}</p>
    <div v-if="adBreak" class="game__break" role="status" aria-busy="true">
      <span class="sr-only">{{ t('game.loading') }}</span>
    </div>

    <PauseDialog
      :mode-id="modeId"
      :help="help"
      :touch="touch"
      :family="descriptor.family"
      :open="phase === 'paused'"
      @resume="resume"
      @restart="start"
      @settings="emit('settings')"
      @quit="level ? emit('campaign') : emit('home')"
    />
    <GameOverDialog
      :open="phase === 'over' && showOutcome"
      :outcome="outcome"
      :status="status"
      :can-share="platform.allowsExternalLinks"
      :reward="reward"
      @again="again"
      @home="toHome"
      @share="onShare"
      @campaign="toCampaign"
      @double="doubleExperience"
      @next="(next) => afterBreak('replay', () => emit('next', next))"
    />
  </div>
</template>

<style scoped>
/*
 * One grid for every family. The game screen names the areas; the stage's
 * parts (hold, well, next, side, pads, hand…) sit in them. Portrait: a band
 * at the top (pause, score, sound; hold, stats, next), then the well as wide
 * as the screen. Landscape: the well in the middle, full height, the band
 * split into the two side columns. No page header during a game.
 */
.game {
  --family-1: rgb(139 108 255 / 0.22);
  --family-2: rgb(61 224 255 / 0.12);
  position: relative;
  isolation: isolate;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  grid-template-rows: auto auto auto minmax(0, 1fr) auto auto;
  grid-template-areas:
    'pause score sound'
    'hold goal next'
    'stats stats stats'
    'well well well'
    'padm padm padm'
    'pada pada pada';
  gap: 0.375rem var(--space-2);
  height: 100dvh;
  /*
   * The HUD's size (its parts are sized in `em`): 16 px on phones and laptops,
   * growing with the screen's short side up to 24 px (1080p ×1.17, 1440p ×1.4).
   */
  --hud-size: clamp(1rem, 0.5rem + 1vmin, 1.5rem);
  /* The notch and the home indicator take their room, never less than the screen's own margin. */
  padding: max(var(--space-2), env(safe-area-inset-top, 0px))
    max(var(--space-2), env(safe-area-inset-right, 0px))
    max(var(--space-2), env(safe-area-inset-bottom, 0px))
    max(var(--space-2), env(safe-area-inset-left, 0px));
  overflow: hidden;
  /* A touch screen plays here: no page panning, zoom, selection or callout. */
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
}

/* The opponent's column: room for its name in 14-px capitals (« IA débutante »). */
.game[data-layout='duel'] {
  grid-template-columns: auto minmax(0, 1fr) auto clamp(5.5rem, 22vw, 6rem);
  grid-template-areas:
    'pause score sound sound'
    'hold goal next next'
    'stats stats stats stats'
    'well well well side'
    'padm padm padm padm'
    'pada pada pada pada';
}

.game[data-layout='mosaic'] {
  grid-template-rows: auto auto auto minmax(0, 1fr) auto auto auto;
  grid-template-areas:
    'pause score sound'
    'goal goal goal'
    'stats stats stats'
    'well well well'
    'prompt prompt prompt'
    'hand hand hand'
    'jokers jokers jokers';
}

/* Each family has its own light behind the game; it drifts slowly. */
.game[data-family='sand'] {
  --family-1: rgb(255 181 71 / 0.2);
  --family-2: rgb(255 122 77 / 0.14);
}

.game[data-family='placement'] {
  --family-1: rgb(255 79 163 / 0.18);
  --family-2: rgb(184 242 92 / 0.1);
}

.game[data-family='volume'] {
  --family-1: rgb(61 224 255 / 0.2);
  --family-2: rgb(91 140 255 / 0.16);
}

.game::before,
.game::after {
  content: '';
  position: absolute;
  z-index: -1;
  pointer-events: none;
  /* In danger, the world behind the well loses its colours. */
  filter: saturate(calc(1 - var(--danger-amount, 0) * 0.85));
}

.game::before {
  inset: -15%;
  background:
    radial-gradient(35% 45% at 25% 30%, var(--family-1), transparent 70%),
    radial-gradient(40% 50% at 78% 72%, var(--family-2), transparent 70%);
  animation: family-drift 32s ease-in-out infinite alternate;
}

/* The rift, far behind: a faint crack of light down the right of the screen. */
.game::after {
  inset: 0 0 0 auto;
  width: min(24%, 18rem);
  background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 720' preserveAspectRatio='none'%3E%3Cpath d='M120 -10 L90 150 L140 290 L95 450 L135 580 L110 730' fill='none' stroke='%23ff9a3c' stroke-width='24' stroke-opacity='.05' stroke-linecap='round' stroke-linejoin='round'/%3E%3Cpath d='M120 -10 L90 150 L140 290 L95 450 L135 580 L110 730' fill='none' stroke='%23ffc35c' stroke-width='2' stroke-opacity='.18' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")
    center / 100% 100% no-repeat;
  animation: rift-breathe 6s ease-in-out infinite;
}

@keyframes family-drift {
  to {
    transform: translate3d(5%, -4%, 0) scale(1.1);
  }
}

@keyframes rift-breathe {
  50% {
    opacity: 0.6;
  }
}

:global(:root[data-motion='still']) .game::before,
:global(:root[data-motion='still']) .game::after {
  animation: none;
}

.game__pause {
  grid-area: pause;
  justify-self: start;
  align-self: center;
}

.game__sound {
  grid-area: sound;
  justify-self: end;
  align-self: center;
}

.game__pause,
.game__sound {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--glass);
}

/* The HUD's parts are sized in `em`: they follow its size, the windows keep theirs. */
.game__score,
.game__stats,
.game__goal,
.game__help,
.game :deep(.stage__hold),
.game :deep(.stage__next),
.game :deep(.stage__side) {
  font-size: var(--hud-size);
}

.game__score {
  grid-area: score;
  justify-self: center;
  align-self: center;
}

/* The counters take the band's width: the panel adapts to it (HudPanel's container queries). */
.game__stats {
  container: hud / inline-size;
  grid-area: stats;
  align-self: center;
}

.game__goal {
  grid-area: goal;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  min-width: 0;
}

.game__subtitle {
  flex: none;
  padding: var(--space-1) var(--space-3);
  border: 1px solid color-mix(in srgb, var(--accent) 45%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  color: var(--accent-strong);
  font-family: var(--font-display);
  font-size: 0.9em;
  font-weight: 800;
}

/* The coach, the words of a clear, the loading line: over the well, never taking its input. */
.game__overlay {
  grid-area: well;
  position: relative;
  min-height: 0;
  pointer-events: none;
}

.game__loading {
  display: grid;
  place-items: center;
  height: 100%;
  color: var(--text-muted);
}

.game__toasts {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
}

.toast {
  padding: var(--space-2) var(--space-4);
  border-radius: 999px;
  background: color-mix(in srgb, var(--surface) 88%, transparent);
  box-shadow: var(--shadow);
  font-family: var(--font-display);
  font-size: clamp(1.1rem, 0.9rem + 1.5vw, 1.6rem);
  font-weight: 800;
}

.toast-enter-active {
  animation: toast-in 280ms cubic-bezier(0.2, 1.4, 0.4, 1);
}

.toast-leave-active {
  transition: opacity 300ms ease;
}

.toast-leave-to {
  opacity: 0;
}

@keyframes toast-in {
  from {
    opacity: 0;
    transform: scale(0.6);
  }
}

.game__help {
  display: none;
}

.game__break {
  position: fixed;
  inset: 0;
  z-index: 50;
}

/* The parts of the stages, aligned in the band (portrait). */
.game :deep(.stage__next) {
  justify-self: end;
}

.game :deep(.controls__move),
.game :deep(.controls__act) {
  width: 100%;
}

.game :deep(.controls__move) {
  grid-area: padm;
}

.game :deep(.controls__act) {
  grid-area: pada;
}

/*
 * Landscape: the well in the middle, the dashboard on its left, the coming
 * pieces on its right. The side columns give way below 9rem only in a tiny
 * window (a 400 % zoom), so that the well always keeps a place.
 */
@media (orientation: landscape) {
  .game {
    grid-template-columns: minmax(min(9rem, 26%), 1fr) minmax(0, 1.3fr) minmax(min(9rem, 26%), 1fr);
    grid-template-rows: repeat(6, minmax(0, auto)) minmax(0, 1fr);
    grid-template-areas:
      'pause well sound'
      'score well next'
      'stats well next'
      'goal well next'
      'hold well next'
      'help well next'
      'padm well pada';
    column-gap: var(--space-4);
    row-gap: var(--space-2);
    padding: max(var(--space-3), env(safe-area-inset-top, 0px))
      max(var(--space-4), env(safe-area-inset-right, 0px))
      max(var(--space-3), env(safe-area-inset-bottom, 0px))
      max(var(--space-4), env(safe-area-inset-left, 0px));
  }

  /* The opponent's well stands beside the coming pieces, not under them. */
  .game[data-layout='duel'] {
    grid-template-columns: minmax(min(9rem, 26%), 1fr) minmax(0, 1.3fr) auto minmax(
        min(4.5rem, 16%),
        0.6fr
      );
    grid-template-areas:
      'pause well sound sound'
      'score well next side'
      'stats well next side'
      'goal well next side'
      'hold well next side'
      'help well next side'
      'padm well pada pada';
  }

  /*
   * The keys of the first games have their own place under the jokers: an
   * area missing from the grid would open an extra column, at the board's
   * expense.
   */
  .game[data-layout='mosaic'] {
    grid-template-columns: minmax(min(9rem, 26%), 1fr) minmax(0, 1.6fr) minmax(min(9rem, 26%), 1fr);
    grid-template-rows: repeat(5, minmax(0, auto)) minmax(0, 1fr) minmax(0, auto);
    grid-template-areas:
      'pause well sound'
      'score well hand'
      'stats well hand'
      'goal well hand'
      'jokers well hand'
      'help well hand'
      'prompt well hand';
  }

  .game__pause {
    justify-self: start;
    align-self: start;
  }

  .game__sound {
    align-self: start;
  }

  /*
   * The dashboard stands against the well in one column, the next pieces on
   * the other side: one console in the middle of the screen.
   */
  .game__score,
  .game__stats,
  .game__goal,
  .game__help,
  .game :deep(.stage__hold) {
    justify-self: end;
    /* In `em`: the column grows with the HUD on a large screen. */
    width: min(100%, 15em);
  }

  .game__goal {
    justify-content: flex-start;
  }

  /* The dashboard adapts to its column (HudPanel's container queries). */
  .game__score {
    container: hud / inline-size;
  }

  .game :deep(.stage__next) {
    justify-self: start;
  }

  .game__help {
    grid-area: help;
    display: grid;
    align-content: end;
  }
}

/*
 * Short landscape screens (821 × 462 on CrazyGames): flatter keys (their
 * letters keep their size), the essential ones only.
 */
@media (orientation: landscape) and (max-height: 32rem) {
  .game__help :deep(.legend) {
    gap: 0.2rem;
  }

  .game__help :deep(.legend__row--minor) {
    display: none;
  }

  .game__help :deep(.legend__key) {
    min-width: 2em;
    height: 2em;
    border-bottom-width: 2px;
  }

  .game :deep(.stage__side) {
    justify-self: end;
    width: min(100%, 10em);
  }

  .game__score,
  .game__stats,
  .game__goal {
    min-height: 0;
    overflow: hidden;
  }

  .game :deep(.controls__move),
  .game :deep(.controls__act) {
    width: min(100%, 15rem);
    align-self: end;
  }

  .game :deep(.controls__act) {
    justify-self: end;
  }
}

/*
 * A tiny window (a 400 % zoom): the keys' help and the counters would cover
 * the dashboard; the score, the hold and the well stay (the pause keeps the rest).
 */
@media (orientation: landscape) and (height < 20rem) {
  .game {
    column-gap: var(--space-2);
  }

  .game__help,
  .game__stats {
    display: none;
  }
}
</style>

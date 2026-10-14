<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import { useI18n } from 'vue-i18n';
import { useServices } from '@/app/AppServices';
import { FrameClock } from '@/app/FrameClock';
import { useFormat } from '@/app/useFormat';
import { effectsProfile } from '@/fx/EffectsProfile';
import { dayKey } from '@/core/Day';
import { SeededRandom } from '@/core/Random';
import { CampaignRun, type CampaignOutcome } from '@/campaign/CampaignRun';
import type { LiveState } from '@/campaign/Goals';
import { LEVELS, type CampaignLevel } from '@/campaign/Levels';
import { boostsFor, timeBonusMs } from '@/campaign/Upgrades';
import { allowsLevel } from '@/platform/Edition';
import { GameTracker } from '@/progression/GameReport';
import { Coach, type CoachStep } from '@/session/Coach';
import type { DailyChallenge } from '@/session/DailyChallenge';
import type { GameSession, Indicator, SessionOptions } from '@/session/GameSession';
import type { ModeId } from '@/session/ModeId';
import { observeCommands } from '@/session/observeCommands';
import { ScoreBoard } from '@/services/ScoreBoard';
import CampaignGoal from '../components/CampaignGoal.vue';
import CoachCard from '../components/CoachCard.vue';
import GameOverDialog from '../components/GameOverDialog.vue';
import type { GameOutcome } from '../GameOutcome';
import HudPanel from '../components/HudPanel.vue';
import PauseDialog from '../components/PauseDialog.vue';
import { stageFor } from '../stages';

const props = defineProps<{
  modeId: ModeId;
  daily: DailyChallenge | null;
  /** Variant chosen on the home screen (AI level of a duel), or null. */
  variant: string | null;
  /** The campaign level played, or null outside the campaign. */
  level: CampaignLevel | null;
}>();
const emit = defineEmits<{ home: []; campaign: []; next: [level: CampaignLevel] }>();

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
  clock: today,
} = useServices();
const descriptor = catalog.get(props.modeId);

type Phase = 'loading' | 'playing' | 'paused' | 'over';
const phase = ref<Phase>('loading');
const session = shallowRef<GameSession | null>(null);
const indicators = shallowRef<readonly Indicator[]>([]);
const outcome = ref<GameOutcome | null>(null);
const shareStatus = ref('');
const announcement = ref('');
const toast = ref<{ text: string; key: number } | null>(null);
const stage = stageFor(descriptor);
/** Controls help shown in the pause dialog, by family. */
const HELP: Readonly<Partial<Record<string, readonly string[]>>> = {
  falling: ['controls.keyboard', 'controls.touch'],
  sand: ['sand.helpKeyboard', 'sand.helpTouch'],
  placement: ['mosaic.helpKeyboard', 'mosaic.helpTouch'],
  volume: ['tower.helpKeyboard', 'tower.helpTouch'],
};
const help = HELP[descriptor.family] ?? [];
/** The keyboard help stays beside the game for the first games. */
const FIRST_GAMES = 5;
const showHelp = profile.current.games < FIRST_GAMES && help.length > 0;

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

const clock = new FrameClock();
/** One per game: the stage is rebuilt for each new session. */
const round = ref(0);
/** The game-over dialog waits for the stack to finish collapsing. */
const showOutcome = ref(false);
let outcomeTimer: ReturnType<typeof setTimeout> | undefined;
let unsubscribe: (() => void)[] = [];
/** Follows the game for the progression (time played, clears). */
let tracker: GameTracker | null = null;
/** Judges a campaign level: its goal, its end, its stars. */
let run: CampaignRun | null = null;
const goal = shallowRef<{ readonly value: number; readonly target: number } | null>(null);
let toastKey = 0;
let toastTimer: ReturnType<typeof setTimeout> | undefined;

/** The clock of a campaign level, hourglass included. */
const levelTime = (level: CampaignLevel): number | null =>
  level.timeLimitMs === null ? null : level.timeLimitMs + timeBonusMs(campaign.current.ranks);

const sessionOptions = (): SessionOptions => {
  const random = new SeededRandom(Math.floor(Math.random() * 2 ** 32));
  const level = props.level;
  if (level) {
    // Campaign: the level's clock and opponent, and the upgrades bought.
    return {
      random,
      timeLimitMs: levelTime(level),
      today: today(),
      boosts: boostsFor(campaign.current.ranks),
      ...(level.variant ? { variant: level.variant } : {}),
    };
  }
  return {
    ...(props.daily?.sessionOptions() ?? { random, timeLimitMs: null }),
    today: today(),
    ...(props.variant ? { variant: props.variant } : {}),
  };
};

/** Where the game stands, for the campaign goal. */
const liveState = (current: GameSession): LiveState => ({
  ...(tracker?.live ?? { durationMs: 0, clears: 0, lines: 0, bestAtOnce: 0 }),
  score: current.result().value,
});

const sameIndicators = (a: readonly Indicator[], b: readonly Indicator[]) =>
  a.length === b.length &&
  a.every((item, i) => {
    const other = b.at(i);
    return other?.id === item.id && other.value === item.value;
  });

clock.subscribe((delta) => {
  const current = session.value;
  if (!current) return;
  if (current.state === 'running') tracker?.tick(delta);
  current.update(delta);
  const next = current.indicators();
  if (!sameIndicators(next, indicators.value)) indicators.value = next;
  if (run && phase.value === 'playing' && current.state === 'running') {
    const state = liveState(current);
    const progress = run.progress(state);
    if (progress.value !== goal.value?.value) goal.value = progress;
    // A goal met during play ends the level at once.
    const won = run.check(state);
    if (won) {
      current.pause();
      finish('goal', won);
    }
  }
});

/** Announced to screen readers, and shown over the well. */
const announce = (text: string, show = true) => {
  announcement.value = text;
  if (!show) return;
  toast.value = { text, key: ++toastKey };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toast.value = null), 1400);
};

const listen = (current: GameSession) => {
  tracker = new GameTracker(current);
  const { events } = current;
  unsubscribe = [
    events.on('clear', ({ lines, combo }) => {
      if (coach?.cleared()) coachUpdate();
      const text = t('notice.lines', lines);
      announce(
        combo > 0 ? `${text} · ${t('notice.combo', { n: combo + 1 })}` : text,
        lines >= 2 || combo > 0,
      );
    }),
    events.on('levelUp', ({ level }) => announce(t('notice.levelUp', { level }))),
    events.on('notice', ({ id, value }) =>
      announce(t(`notice.${id}`, { value: value === undefined ? '' : format.number(value) })),
    ),
    events.on('over', ({ reason }) => finish(reason)),
  ];
};

/** The level after this one, if this edition opens it. */
const nextLevel = (index: number): CampaignLevel | null => {
  const next = LEVELS[index + 1];
  return next && allowsLevel(platform.edition, next) ? next : null;
};

/** The campaign's verdict on this game, recorded; the next level once won. */
const judge = (decided: CampaignOutcome) => {
  const gained = campaign.record(decided);
  const index = LEVELS.findIndex((level) => level.id === decided.levelId);
  return {
    levelId: decided.levelId,
    won: decided.won,
    stars: decided.stars,
    gained,
    next: decided.won ? nextLevel(index) : null,
  };
};

const finish = (reason: string, decided: CampaignOutcome | null = null) => {
  const current = session.value;
  if (!current || phase.value === 'over') return;
  const result = current.result();
  const key = props.daily ? ScoreBoard.dailyKey(props.daily.key) : props.modeId;
  const verdict = run ? (decided ?? run.end(reason, liveState(current))) : null;
  // Whole points or milliseconds: no float noise in the saved records. Campaign
  // games bring upgrades along: they never count as records.
  const record = run
    ? { best: scores.best(key) ?? Math.round(result.value), isNewBest: false }
    : scores.record(key, Math.round(result.value));
  const report = tracker?.report({
    modeId: props.modeId,
    daily: props.daily !== null,
    variant: props.variant,
    reason,
  });
  platform.gameOver(verdict ? verdict.won : reason === 'victory');
  // Read before the verdict is recorded: does this game beat the level's best?
  const improved = verdict?.won ? campaign.model.starsOf(verdict.levelId) < verdict.stars : false;
  // A record or a better level result is worth a celebration on the portal.
  if (record.isNewBest || improved) platform.happyTime();
  outcome.value = {
    reason,
    value: format.result(result.kind, result.value),
    best: format.result(result.kind, record.best),
    isNewBest: record.isNewBest,
    progress: report
      ? profile.recordGame(report, dayKey(today()))
      : { xp: [], total: 0, levelBefore: 1, levelAfter: 1, completed: [], unlocked: [], streak: 0 },
    ...(verdict ? { campaign: judge(verdict) } : {}),
  };
  shareStatus.value = '';
  phase.value = 'over';
  const { gameOverDelayMs } = effectsProfile(settings.current.effects, settings.current.shake);
  outcomeTimer = setTimeout(() => (showOutcome.value = true), gameOverDelayMs);
};

const start = async () => {
  dispose();
  phase.value = 'loading';
  platform.loadingStart();
  const created = await catalog.create(props.modeId, sessionOptions());
  platform.loadingStop();
  run = props.level ? new CampaignRun(props.level, levelTime(props.level)) : null;
  goal.value = run ? { value: 0, target: run.level.goal.target } : null;
  listen(created);
  showOutcome.value = false;
  round.value++;
  // The guide hears every command that took effect, whatever the input.
  session.value = coach?.step
    ? observeCommands(created, (type) => coach.command(type) && coachUpdate())
    : created;
  indicators.value = created.indicators();
  created.start();
  phase.value = 'playing';
  platform.gameplayStart();
  clock.start();
};

/**
 * Between two games (play again, next level): the portal may show an ad.
 * The sound pauses only while an ad really plays.
 */
const adBreak = ref(false);
const afterBreak = async (next: () => void) => {
  // The interface stays blocked until the ad ends (or does not come).
  showOutcome.value = false;
  adBreak.value = true;
  await platform.midgameAd({ onStart: () => audio.suspend(), onEnd: () => audio.resume() });
  adBreak.value = false;
  next();
};
const again = () => afterBreak(() => void start());

const dispose = () => {
  clearTimeout(outcomeTimer);
  unsubscribe.forEach((off) => off());
  unsubscribe = [];
  tracker?.dispose();
  tracker = null;
  session.value?.dispose();
  session.value = null;
};

const pause = () => {
  if (phase.value !== 'playing') return;
  session.value?.pause();
  phase.value = 'paused';
  platform.gameplayStop();
};

const resume = () => {
  if (phase.value !== 'paused') return;
  session.value?.resume();
  phase.value = 'playing';
  platform.gameplayStart();
};

const onShare = async () => {
  const current = session.value;
  if (!current || !outcome.value) return;
  const url = `${location.origin}${location.pathname}`;
  const text = props.daily
    ? t('share.daily', {
        date: format.date(today()),
        mode: modeName.value,
        value: outcome.value.value,
        url,
      })
    : t('share.mode', { mode: modeName.value, value: outcome.value.value, url });
  const result = await share.share(text);
  shareStatus.value = result === 'copied' ? t('over.copied') : '';
};

const onVisibility = () => {
  if (document.hidden) pause();
};

// The portal pauses the game (its own ad, the player switching away).
const offPortalPause = platform.onPauseChange((paused) => {
  if (paused) pause();
});

onMounted(() => {
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('blur', pause);
  void start();
});

onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', onVisibility);
  window.removeEventListener('blur', pause);
  clearTimeout(toastTimer);
  clearTimeout(outcomeTimer);
  clearTimeout(coachTimer);
  clock.stop();
  offPortalPause();
  platform.gameplayStop();
  dispose();
});
</script>

<template>
  <div class="game">
    <h1 class="sr-only">
      {{
        level
          ? t('campaign.levelTitle', { level: level.id, mode: modeName })
          : daily
            ? `${t('daily.title')} · ${modeName}`
            : modeName
      }}
    </h1>
    <aside class="game__hud">
      <p class="game__mode">{{ modeName }}</p>
      <!-- Part of the game (the shape to fill): shown at every screen size. -->
      <p v-if="subtitle" class="game__subtitle">{{ subtitle }}</p>
      <CampaignGoal v-if="level && goal" :level="level" :value="goal.value" />
      <HudPanel :indicators="indicators" />
    </aside>

    <div class="game__stage">
      <p v-if="phase === 'loading'" class="game__loading">{{ t('game.loading') }}</p>
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

    <aside v-if="showHelp" class="game__help" :aria-label="t('game.help')">
      <p>{{ t(help[0] ?? '') }}</p>
    </aside>

    <p class="sr-only" aria-live="polite" aria-atomic="true">{{ announcement }}</p>
    <div v-if="adBreak" class="game__break" role="status" aria-busy="true">
      <span class="sr-only">{{ t('game.loading') }}</span>
    </div>

    <PauseDialog
      :help="help"
      :open="phase === 'paused'"
      @resume="resume"
      @restart="start"
      @quit="level ? emit('campaign') : emit('home')"
    />
    <GameOverDialog
      :open="phase === 'over' && showOutcome"
      :outcome="outcome"
      :share-status="shareStatus"
      :can-share="platform.allowsExternalLinks"
      @again="again"
      @home="emit('home')"
      @share="onShare"
      @campaign="emit('campaign')"
      @next="(next) => afterBreak(() => emit('next', next))"
    />
  </div>
</template>

<style scoped>
.game {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  height: calc(100dvh - var(--header-h));
  overflow: hidden;
}

.game__hud {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-2) var(--space-3);
  overflow: hidden;
}

.game__help {
  display: none;
}

.game__subtitle {
  flex: none;
  padding: var(--space-1) var(--space-3);
  border: 1px solid color-mix(in srgb, var(--accent) 45%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  color: var(--accent-strong);
  font-family: var(--font-display);
  font-size: 0.9rem;
  font-weight: 800;
}

.game__mode {
  display: none;
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 1.3rem;
}

.game__stage {
  position: relative;
  min-height: 0;
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
  pointer-events: none;
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

.game__break {
  position: fixed;
  inset: 0;
  z-index: 50;
}

/* Short landscape frames (a portal's iframe on a phone): the HUD goes to the side. */
@media (orientation: landscape) and (min-width: 640px) and (max-height: 540px) {
  .game {
    grid-template-rows: minmax(0, 1fr);
    grid-template-columns: minmax(11rem, 15rem) minmax(0, 1fr);
  }

  .game__hud {
    flex-direction: column;
    align-items: flex-start;
    padding: var(--space-4);
  }

  .game__mode {
    display: block;
  }
}

/*
 * Wide screens: the game in the middle, the HUD against it on the left (as
 * close to the well as the hold piece), the keyboard help on the right.
 */
@media (min-width: 1024px) and (min-height: 541px) {
  .game {
    grid-template-rows: minmax(0, 1fr);
    grid-template-columns: minmax(12rem, 1fr) minmax(0, 46rem) minmax(0, 1fr);
  }

  .game__hud {
    --hud-align: flex-end;
    flex-direction: column;
    align-items: flex-end;
    justify-content: center;
    padding: var(--space-6) 0 var(--space-6) var(--space-4);
    text-align: end;
  }

  .game__mode {
    display: block;
  }

  .game__help {
    display: grid;
    align-content: end;
    max-width: 16rem;
    padding: var(--space-6) var(--space-4);
    color: var(--text-muted);
    font-size: 0.85rem;
    line-height: 1.6;
  }
}
</style>

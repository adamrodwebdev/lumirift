<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, provide, ref, shallowRef } from 'vue';
import { useI18n } from 'vue-i18n';
import { useServices } from '@/app/AppServices';
import { FrameClock } from '@/app/FrameClock';
import { useFormat } from '@/app/useFormat';
import { effectsProfile } from '@/fx/EffectsProfile';
import { newRecord } from '@/fx/sounds';
import { dayKey } from '@/core/Day';
import { SeededRandom } from '@/core/Random';
import { CampaignRun, type CampaignOutcome } from '@/campaign/CampaignRun';
import type { LiveState } from '@/campaign/Goals';
import type { GuardianChallenge } from '@/campaign/GuardianChallenge';
import { type CampaignLevel, guardianLevel, LEVELS } from '@/campaign/Levels';
import { boostsFor, timeBonusMs } from '@/campaign/Upgrades';
import { allowsLevel } from '@/platform/Edition';
import type { BreakMoment } from '@/platform/Platform';
import { GameTracker } from '@/progression/GameReport';
import { RecordChase } from '@/progression/RecordChase';
import { Coach, type CoachStep } from '@/session/Coach';
import type { DailyChallenge } from '@/session/DailyChallenge';
import type { GameSession, Indicator, SessionOptions } from '@/session/GameSession';
import type { ModeId } from '@/session/ModeId';
import { observeCommands } from '@/session/observeCommands';
import { ScoreBoard } from '@/services/ScoreBoard';
import AppIcon from '../components/AppIcon.vue';
import CampaignGoal from '../components/CampaignGoal.vue';
import CoachCard from '../components/CoachCard.vue';
import DangerLayer from '../components/DangerLayer.vue';
import GameOverDialog from '../components/GameOverDialog.vue';
import type { GameOutcome } from '../GameOutcome';
import type { BestLine } from '../BestLine';
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

type Phase = 'loading' | 'playing' | 'paused' | 'over';
const phase = ref<Phase>('loading');
const session = shallowRef<GameSession | null>(null);
const indicators = shallowRef<readonly Indicator[]>([]);
const outcome = ref<GameOutcome | null>(null);
const status = ref('');
/** The rewarded ad of this game's end: offered, playing, or not (used, refused, unsupported). */
const reward = ref<'offer' | 'busy' | 'none'>('none');
/** A rewarded ad was just watched: no interstitial on top of it at this break. */
let rewardWatched = false;
const announcement = ref('');
/** Modes that show the record beside the score; the chase of this game. */
let chase: RecordChase | null = null;
const best = shallowRef<BestLine | null>(null);
/** Counts the records beaten: each one plays the burst again. */
const recordBurst = ref(0);
let recordTimer: ReturnType<typeof setTimeout> | undefined;
const recordKey = () =>
  props.guardian
    ? ScoreBoard.guardianKey(props.guardian.key)
    : props.daily
      ? ScoreBoard.dailyKey(props.daily.key)
      : props.modeId;
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

const clock = new FrameClock();
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
      ...(level.calm ? { calm: true } : {}),
      ...(level.showcase ? { showcase: true } : {}),
      ...(level.practice ? { practice: true } : {}),
      ...(level.boss ? { boss: level.boss } : {}),
    };
  }
  // The Guardian challenge: the week's Guardian, its clock, everybody's pieces, no upgrades.
  if (props.guardian) return { ...props.guardian.sessionOptions(), today: today() };
  return {
    ...(props.daily?.sessionOptions() ?? { random, timeLimitMs: null }),
    today: today(),
    ...(props.variant ? { variant: props.variant } : {}),
  };
};

/** Where the game stands, for the campaign goal. */
const liveState = (current: GameSession): LiveState => {
  const boss = current.boss?.() ?? null;
  return {
    ...(tracker?.live ?? { durationMs: 0, clears: 0, lines: 0, bestAtOnce: 0 }),
    score: current.result().value,
    bossDamage: boss ? boss.maxHealth - boss.health : 0,
  };
};

const sameIndicators = (a: readonly Indicator[], b: readonly Indicator[]) =>
  a.length === b.length &&
  a.every((item, i) => {
    const other = b.at(i);
    return other?.id === item.id && other.value === item.value;
  });

clock.subscribe((delta, real) => {
  const current = session.value;
  if (!current) return;
  if (current.state === 'running') tracker?.tick(delta);
  current.update(delta);
  // The surge counts real time: eight seconds of it, however slow the game runs.
  surge.update(real, current.state === 'running');
  const next = current.indicators();
  if (!sameIndicators(next, indicators.value)) indicators.value = next;
  // The danger, played: the music follows it, the well cracks, the clock counts down.
  tension.update(current, delta, next);
  if (chase && current.state === 'running') {
    const score = current.result().value;
    if (chase.update(score)) celebrateRecord();
    const shown = chase.shown(score);
    if (best.value?.value !== shown || best.value.beaten !== chase.beaten)
      best.value = { value: shown, beaten: chase.beaten };
  }
  if (run && phase.value === 'playing' && current.state === 'running') {
    const state = liveState(current);
    const progress = run.progress(state);
    if (progress.value !== goal.value?.value) goal.value = progress;
    // A goal met during play ends the level at once; a level that teases a
    // Guardian lets it pass first, its world still moving, before its window.
    const won = run.check(state);
    if (won) {
      const teaser = props.level?.teaser;
      const teased = won.won && teaser !== undefined && (current.tease?.(teaser) ?? false);
      if (!teased) current.pause();
      finish('goal', won, teased);
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
    events.on('over', ({ reason }) => finish(reason)),
  ];
};

/** The level after this one, if this edition opens it. */
const nextLevel = (index: number): CampaignLevel | null => {
  const next = LEVELS[index + 1];
  return next && allowsLevel(platform.edition, next) ? next : null;
};

/** The campaign's verdict on this game, recorded; the next level once won. */
const judge = (decided: CampaignOutcome, teased: boolean) => {
  const gained = campaign.record(decided);
  const index = LEVELS.findIndex((level) => level.id === decided.levelId);
  const teaser = teased ? props.level?.teaser : undefined;
  const lair = teaser ? guardianLevel(teaser) : undefined;
  return {
    levelId: decided.levelId,
    won: decided.won,
    stars: decided.stars,
    gained,
    next: decided.won ? nextLevel(index) : null,
    ...(teaser && lair ? { teaser: { boss: teaser, levelId: lair.id } } : {}),
  };
};

/** How long a teased Guardian passes before the level's end window. */
const TEASER_MS = 2600;

const finish = (reason: string, decided: CampaignOutcome | null = null, teased = false) => {
  const current = session.value;
  if (!current || phase.value === 'over') return;
  tension.end(reason);
  surge.end();
  const result = current.result();
  // The Guardian challenge counts a victory's time left: points × (1 + share of the clock left).
  const timeLeft = current.indicators().find((item) => item.id === 'timeLeft')?.value ?? 0;
  const factor = props.guardian?.factor(reason === 'victory', timeLeft) ?? 1;
  const amount = Math.round(Math.round(result.value) * factor);
  const key = recordKey();
  const verdict = run ? (decided ?? run.end(reason, liveState(current))) : null;
  // The goal bar shows the last blow (a Guardian's last hit ends the game in the same frame).
  if (run) goal.value = run.progress(liveState(current));
  // Read before this game is recorded: the record it may beat.
  const previousBest = run ? null : scores.best(key);
  // Whole points or milliseconds: no float noise in the saved records. Campaign
  // games bring upgrades along: they never count as records.
  const record = run
    ? { best: scores.best(key) ?? Math.round(result.value), isNewBest: false }
    : scores.record(key, amount);
  const report = tracker?.report({
    modeId: props.modeId,
    daily: props.daily !== null,
    guardian: props.guardian !== null,
    variant: props.variant,
    reason,
    // A Guardian defeated is remembered (it earns its cosmetic).
    ...(verdict?.won && props.level?.boss ? { boss: props.level.boss } : {}),
  });
  platform.gameOver(verdict ? verdict.won : reason === 'victory');
  // Only a real feat is worth the portal's celebration (it asks for it sparingly,
  // never for every level): a record beaten, a Guardian defeated for the first
  // time. Read before the verdict is recorded.
  const recordBeaten = record.isNewBest && previousBest !== null;
  const guardianDown =
    verdict?.won === true &&
    props.level?.boss !== undefined &&
    campaign.model.starsOf(verdict.levelId) === 0;
  if (recordBeaten || guardianDown) platform.happyTime();
  outcome.value = {
    // A Guardian's fall is told as such, not as a duel's victory.
    reason: reason === 'victory' && (props.level?.boss ?? props.guardian) ? 'guardian' : reason,
    amount,
    kind: result.kind,
    value: format.result(result.kind, amount),
    best: format.result(result.kind, record.best),
    isNewBest: record.isNewBest,
    progress: report
      ? profile.recordGame(report, dayKey(today()))
      : { xp: [], total: 0, levelBefore: 1, levelAfter: 1, completed: [], unlocked: [], streak: 0 },
    ...(verdict ? { campaign: judge(verdict, teased) } : {}),
    ...(props.guardian
      ? {
          guardian: {
            points: format.number(result.value),
            factor: factor > 1 ? format.factor(factor) : null,
          },
        }
      : {}),
  };
  status.value = '';
  rewardWatched = false;
  reward.value = platform.supportsRewarded && outcome.value.progress.total > 0 ? 'offer' : 'none';
  phase.value = 'over';
  const { gameOverDelayMs } = effectsProfile(settings.current.effects, settings.current.shake);
  outcomeTimer = setTimeout(
    () => (showOutcome.value = true),
    teased ? Math.max(gameOverDelayMs, TEASER_MS) : gameOverDelayMs,
  );
};

const start = async () => {
  dispose();
  tension.reset();
  phase.value = 'loading';
  platform.loadingStart();
  const created = await catalog.create(props.modeId, sessionOptions());
  platform.loadingStop();
  run = props.level ? new CampaignRun(props.level, levelTime(props.level)) : null;
  goal.value = run ? { value: 0, target: run.level.goal.target } : null;
  // Campaign games never count as records: no record to chase there. The
  // Guardian challenge's record counts the victory's factor: not to chase in points.
  chase =
    descriptor.showsBest && !run && !props.guardian
      ? new RecordChase(scores.best(recordKey()))
      : null;
  best.value = chase ? { value: chase.shown(0), beaten: false } : null;
  recordBurst.value = 0;
  listen(created);
  surge.attach(created, descriptor.family, props.modeId);
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
  if (!rewardWatched) await platform.midgameAd(adHooks, moment);
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
  const watched = await platform.rewardedAd(adHooks);
  reward.value = 'none';
  if (!watched || outcome.value !== ended) {
    status.value = watched ? '' : t('over.noAd');
    return;
  }
  rewardWatched = true;
  const progress = profile.doubleExperience(ended.progress);
  outcome.value = { ...ended, progress };
  status.value = t('over.doubled', { n: progress.total - ended.progress.total });
  platform.happyTime();
};

const dispose = () => {
  clearTimeout(outcomeTimer);
  clearTimeout(recordTimer);
  unsubscribe.forEach((off) => off());
  unsubscribe = [];
  tracker?.dispose();
  tracker = null;
  surge.detach();
  session.value?.dispose();
  session.value = null;
};

/** A `gameplayStop` was sent for this pause: its resume sends `gameplayStart`. */
let stopReported = false;

/**
 * Pauses the game. The portal hears of it only when the player asked for it:
 * focus lost, a hidden tab or the portal's own pause are the portal's to
 * track (CrazyGames: no gameplayStop on focus loss).
 */
const pauseGame = (byPlayer: boolean) => {
  if (phase.value !== 'playing') return;
  session.value?.pause();
  phase.value = 'paused';
  if (byPlayer) {
    platform.gameplayStop();
    stopReported = true;
  }
};
const pause = () => pauseGame(true);
const pauseForFocus = () => pauseGame(false);

const resume = () => {
  if (phase.value !== 'paused') return;
  session.value?.resume();
  phase.value = 'playing';
  if (stopReported) platform.gameplayStart();
  stopReported = false;
};

const onShare = async () => {
  const current = session.value;
  if (!current || !outcome.value) return;
  const url = `${location.origin}${location.pathname}`;
  const text = props.guardian
    ? t('guardianChallenge.share', {
        boss: t(`bosses.${props.guardian.boss}.name`),
        value: outcome.value.value,
        url,
      })
    : props.daily
      ? t('share.daily', {
          date: format.date(today()),
          mode: modeName.value,
          value: outcome.value.value,
          url,
        })
      : t('share.mode', { mode: modeName.value, value: outcome.value.value, url });
  const result = await share.share(text);
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
    <h1 class="sr-only">
      {{
        level
          ? t('campaign.levelTitle', { level: level.id, mode: modeName })
          : guardian
            ? `${t('guardianChallenge.title')} · ${t(`bosses.${guardian.boss}.name`)}`
            : daily
              ? `${t('daily.title')} · ${modeName}`
              : modeName
      }}
    </h1>

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
  padding: calc(var(--space-2) + env(safe-area-inset-top))
    calc(var(--space-2) + env(safe-area-inset-right))
    calc(var(--space-2) + env(safe-area-inset-bottom))
    calc(var(--space-2) + env(safe-area-inset-left));
  overflow: hidden;
  /* A touch screen plays here: no page panning, zoom, selection or callout. */
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
}

.game[data-layout='duel'] {
  grid-template-columns: auto minmax(0, 1fr) auto clamp(3.5rem, 18vw, 6rem);
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

.game__score {
  grid-area: score;
  justify-self: center;
  align-self: center;
}

.game__stats {
  grid-area: stats;
  justify-self: center;
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
  font-size: 0.9rem;
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

@media (orientation: landscape) {
  .game {
    grid-template-columns: minmax(9rem, 1fr) minmax(0, 1.3fr) minmax(9rem, 1fr);
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
    padding: calc(var(--space-3) + env(safe-area-inset-top))
      calc(var(--space-4) + env(safe-area-inset-right))
      calc(var(--space-3) + env(safe-area-inset-bottom))
      calc(var(--space-4) + env(safe-area-inset-left));
  }

  /* The opponent's well stands beside the coming pieces, not under them. */
  .game[data-layout='duel'] {
    grid-template-columns: minmax(9rem, 1fr) minmax(0, 1.3fr) auto minmax(4.5rem, 0.6fr);
    grid-template-areas:
      'pause well sound sound'
      'score well next side'
      'stats well next side'
      'goal well next side'
      'hold well next side'
      'help well next side'
      'padm well pada pada';
  }

  .game[data-layout='mosaic'] {
    grid-template-columns: minmax(9rem, 1fr) minmax(0, 1.6fr) minmax(9rem, 1fr);
    grid-template-rows: repeat(4, minmax(0, auto)) minmax(0, 1fr) minmax(0, auto);
    grid-template-areas:
      'pause well sound'
      'score well hand'
      'stats well hand'
      'goal well hand'
      'jokers well hand'
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
    width: min(100%, 15rem);
  }

  .game__goal {
    justify-content: flex-start;
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

/* Short landscape screens (821 × 462 on CrazyGames): smaller keys, the essential ones only. */
@media (orientation: landscape) and (max-height: 32rem) {
  .game__help :deep(.legend) {
    gap: 0.2rem;
  }

  .game__help :deep(.legend__row--minor) {
    display: none;
  }

  .game__help :deep(.legend__key) {
    min-width: 1.3rem;
    height: 1.3rem;
    border-bottom-width: 2px;
    font-size: 0.6rem;
  }

  .game :deep(.stage__side) {
    justify-self: end;
    width: min(100%, 10rem);
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
</style>

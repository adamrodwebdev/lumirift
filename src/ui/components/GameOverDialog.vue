<script setup lang="ts">
import { computed, watch } from 'vue';
import { I18nT, useI18n } from 'vue-i18n';
import { useServices } from '@/app/AppServices';
import { useFormat } from '@/app/useFormat';
import { outcomeOf } from '@/ads/AdPolicy';
import { LEVELS, type CampaignLevel } from '@/campaign/Levels';
import type { TrainingStep } from '@/campaign/Training';
import { levelProgress } from '@/progression/Experience';
import type { ContinueCard, GameOutcome } from '../GameOutcome';
import { useProgressText } from '../useProgressText';
import { useCountUp, useXpReveal, XP_FILL_MS } from '../useReveal';
import AppIcon from './AppIcon.vue';
import ModalDialog from './ModalDialog.vue';
import StarRow from './StarRow.vue';

/**
 * The end of a game, staged: the verdict, the result counting up (a record
 * pops, a close one shows its gap), the experience filling its bar (a new
 * level pops), what the game unlocked, the optional rewarded ad, then the way
 * on, whose main button beats. A lost game may first offer its continue
 * (1.31): two equal buttons in the experience's place, a ring of five
 * seconds, the way on working all along. Two columns on a wide screen;
 * nothing to scroll.
 */
const props = defineProps<{
  open: boolean;
  outcome: GameOutcome | null;
  /** A message for the player: link copied, experience doubled… */
  status: string;
  /** False on portals, which forbid links out of the game. */
  canShare?: boolean;
  /** The rewarded ad offered (double the experience), or waiting for it. */
  reward?: 'offer' | 'busy' | 'none';
  /** The continue offered for a lost game, until the player takes it or lets it go. */
  continueCard?: ContinueCard | null;
}>();
const emit = defineEmits<{
  again: [];
  home: [];
  share: [];
  campaign: [];
  next: [level: CampaignLevel];
  /** The training goes on with its next step. */
  step: [step: TrainingStep];
  /** The player chooses to watch an ad for the bonus. */
  double: [];
  /** The player takes the continue (an ad first). */
  continue: [];
  /** The player lets the continue go. */
  decline: [];
}>();

/** After the training, the campaign starts from its first level. */
const FIRST_LEVEL = LEVELS[0]!;

const { t } = useI18n();
const format = useFormat();
const text = useProgressText();
const { profile } = useServices();

const title = computed(() => {
  const outcome = props.outcome;
  if (outcome?.training) return t(outcome.training.next ? 'training.stepDone' : 'training.done');
  if (outcome?.campaign) return t(outcome.campaign.won ? 'campaign.won' : 'campaign.lost');
  return outcome?.reason === 'victory' ? t('over.victory') : t('over.title');
});

// --- The reveal: the result counts up, then the experience fills ------------

const score = useCountUp();
const xp = useXpReveal();
/** Where the experience stands after this game, and where it stood before. */
const levels = computed(() => {
  const total = props.outcome?.progress.total ?? 0;
  const now = profile.current.xp;
  return { before: levelProgress(Math.max(0, now - total)), after: levelProgress(now) };
});

/** The outcome the window last revealed; null while it is closed. */
let revealed: GameOutcome | null = null;
watch(
  () => [props.open, props.outcome] as const,
  ([open, outcome]) => {
    if (!open || !outcome) {
      if (!open) revealed = null;
      return;
    }
    // The result counts once; the experience fills again when it is doubled.
    if (revealed === null) score.run(outcome.amount, 250);
    if (revealed === null || revealed.progress !== outcome.progress)
      void xp.run(levels.value.before, levels.value.after, revealed === null ? 600 : 0);
    revealed = outcome;
  },
  { immediate: true },
);
const shownScore = computed(() =>
  props.outcome ? format.result(props.outcome.kind, score.value.value) : '',
);

/** A game lost: the window says it in the danger's red. */
const lost = computed(() => {
  const outcome = props.outcome;
  return outcome !== null && outcomeOf(outcome.reason, outcome.campaign?.won ?? null) === 'lost';
});
/** No continue waits: the way on beats, the next game's heartbeat. */
const beats = computed(() => !props.continueCard);
</script>

<template>
  <ModalDialog
    class="results"
    :class="{ 'results--lost': lost }"
    :open="open"
    :title="title"
    hero
    wide
    guarded
    @dismiss="
      outcome?.training?.next
        ? emit('step', outcome.training.next)
        : outcome?.campaign
          ? emit('campaign')
          : emit('home')
    "
  >
    <template v-if="outcome?.training">
      <p class="results__reason results__left results__lesson">
        {{ t(`training.lesson.${outcome.training.step}`) }}
      </p>
    </template>
    <template v-if="outcome && !outcome.training">
      <p class="results__reason results__left">{{ t(`over.reason.${outcome.reason}`) }}</p>

      <div v-if="outcome.campaign" class="results__stars results__left">
        <StarRow
          :count="outcome.campaign.stars"
          :label="t('campaign.starsWon', { n: outcome.campaign.stars }, outcome.campaign.stars)"
          :size="34"
        />
        <p v-if="outcome.campaign.gained > 0" class="results__gained">
          {{ t('campaign.gained', { n: outcome.campaign.gained }, outcome.campaign.gained) }}
        </p>
        <p v-else-if="outcome.campaign.won" class="results__gained">
          {{ t('campaign.noBetter') }}
        </p>
        <i18n-t
          v-if="outcome.campaign.teaser"
          keypath="campaign.teaser"
          tag="p"
          class="results__teaser"
        >
          <template #name>{{ t(`bosses.${outcome.campaign.teaser.boss}.name`) }}</template>
          <template #level>
            <span class="results__level">{{ outcome.campaign.teaser.levelId }}</span>
          </template>
        </i18n-t>
      </div>
    </template>
    <template v-if="outcome">
      <div v-if="!outcome.training" class="score results__left">
        <span v-if="!outcome.campaign && outcome.isNewBest" class="score__badge">
          {{ t('over.newBest') }}
        </span>
        <!-- The race: the week's best, beaten (its own record is not). -->
        <span v-else-if="outcome.week?.isNewBest" class="score__badge">
          {{ t('over.weekBest') }}
        </span>
        <span class="score__label">{{
          outcome.guardian ? t('guardianChallenge.score') : t('over.result')
        }}</span>
        <!-- The final value for screen readers; the count is for the eyes. -->
        <span class="sr-only">{{ outcome.value }}</span>
        <span class="score__value" aria-hidden="true">{{ shownScore }}</span>
        <span v-if="outcome.guardian?.factor" class="score__factor">
          {{
            t('guardianChallenge.breakdown', {
              points: outcome.guardian.points,
              factor: outcome.guardian.factor,
            })
          }}
        </span>
        <template v-if="!outcome.campaign && !outcome.isNewBest">
          <span v-if="outcome.closeTo" class="score__close">
            {{ t('over.soClose', { n: format.number(outcome.closeTo.gap) }, outcome.closeTo.gap) }}
          </span>
          <span v-else class="score__best">
            {{
              t(outcome.guardian ? 'guardianChallenge.best' : 'over.best', { value: outcome.best })
            }}
          </span>
          <span v-if="outcome.week && !outcome.week.isNewBest" class="score__best">
            {{ t('over.week', { value: outcome.week.best }) }}
          </span>
          <span v-if="outcome.closeTo" class="close" aria-hidden="true">
            <i :style="{ transform: `scaleX(${outcome.closeTo.fill})` }" />
          </span>
        </template>
      </div>

      <!-- The continue takes the experience's place, so that nothing moves when it goes; it
           fades out before the experience rises (1.42). -->
      <Transition name="ui-out" mode="out-in">
        <section
          v-if="continueCard"
          key="continue"
          class="cont results__right"
          :aria-label="t('over.continue.title')"
        >
          <p class="cont__title">
            <strong>{{ t('over.continue.title') }}</strong> · {{ continueCard.clears }}
          </p>
          <div class="cont__row">
            <button
              type="button"
              class="btn btn--raised cont__btn"
              :disabled="continueCard.busy"
              :aria-label="t('over.continue.watchLabel')"
              @click="emit('continue')"
            >
              <svg
                v-if="continueCard.ringMs > 0"
                class="cont__ring"
                :style="{ '--ring': `${continueCard.ringMs}ms` }"
                viewBox="0 0 20 20"
                aria-hidden="true"
              >
                <circle cx="10" cy="10" r="8" pathLength="100" />
              </svg>
              <span class="reward__badge" aria-hidden="true">
                <AppIcon name="play" :size="12" />{{ t('over.adBadge') }}
              </span>
              <span aria-hidden="true">{{ t('over.continue.watch') }}</span>
            </button>
            <button
              type="button"
              class="btn btn--raised cont__btn"
              :disabled="continueCard.busy"
              @click="emit('decline')"
            >
              {{ t('over.continue.skip') }}
            </button>
          </div>
          <p class="cont__note">{{ t('over.continue.note') }}</p>
        </section>
        <section
          v-else-if="outcome.progress.total > 0"
          key="experience"
          class="xp results__right"
          :aria-label="t('progress.title')"
        >
          <p class="xp__line">
            <strong>{{
              t('progress.gained', { n: format.number(outcome.progress.total) })
            }}</strong>
            <span>{{ t('profile.level', { n: xp.level.value }) }}</span>
          </p>
          <div
            class="xp__bar"
            role="progressbar"
            :aria-label="t('profile.xpLabel')"
            aria-valuemin="0"
            :aria-valuemax="levels.after.needed"
            :aria-valuenow="levels.after.into"
          >
            <i
              :class="{ 'xp__fill--instant': xp.instant.value }"
              :style="{
                transform: `translateX(${(xp.fill.value - 1) * 100}%)`,
                transitionDuration: `${XP_FILL_MS}ms`,
              }"
            />
          </div>
          <ul class="xp__sources">
            <li v-for="line in outcome.progress.xp" :key="line.source + line.amount">
              {{ t(`progress.source.${line.source}`) }} <b>+{{ format.number(line.amount) }}</b>
            </li>
          </ul>
          <!-- Its room is kept from the start: the window does not jump when it pops. -->
          <p
            v-if="outcome.progress.levelAfter > outcome.progress.levelBefore"
            class="xp__levelup"
            :class="{ 'xp__levelup--on': xp.levelUp.value }"
          >
            {{ t('progress.levelUp', { n: outcome.progress.levelAfter }) }}
          </p>
          <p v-for="objective in outcome.progress.completed" :key="objective.kind" class="xp__news">
            <AppIcon name="check" :size="16" />
            {{ t('progress.objectiveDone', { text: text.objective(objective) }) }}
          </p>
          <!-- The season (1.36): the points this game brought it, a tier, the week's goal. -->
          <p v-if="outcome.season && outcome.season.points > 0" class="xp__news">
            <AppIcon name="star" :size="16" />
            {{
              outcome.season.weekDone
                ? t(
                    'events.goalDone',
                    { n: format.number(outcome.season.points) },
                    outcome.season.points,
                  )
                : outcome.season.tierUp
                  ? t('seasons.tierUp', { n: format.number(outcome.season.tier) })
                  : t(
                      'seasons.gain',
                      { name: outcome.season.title, n: format.number(outcome.season.points) },
                      outcome.season.points,
                    )
            }}
          </p>
          <p
            v-for="cosmetic in outcome.progress.unlocked"
            :key="cosmetic.kind + cosmetic.id"
            class="xp__news"
          >
            <AppIcon name="gem" :size="16" />
            {{
              t('progress.unlocked', {
                name: text.cosmeticName(cosmetic),
                kind: t(`cosmetics.one.${cosmetic.kind}`),
              })
            }}
          </p>
        </section>
        <!-- A training step is never too short: it ends when its lesson is learnt. -->
        <p v-else-if="!outcome.training" key="short" class="sheet-note results__right">
          {{ t('progress.tooShort') }}
        </p>
      </Transition>

      <button
        v-if="
          !continueCard && outcome.progress.total > 0 && (reward === 'offer' || reward === 'busy')
        "
        type="button"
        class="btn btn--raised reward results__right"
        :disabled="reward === 'busy'"
        :aria-label="t('over.doubleXpLabel', { n: outcome.progress.total })"
        @click="emit('double')"
      >
        <span class="reward__badge" aria-hidden="true">
          <AppIcon name="play" :size="12" />{{ t('over.adBadge') }}
        </span>
        <span aria-hidden="true">{{ t('over.doubleXp', { n: outcome.progress.total }) }}</span>
      </button>
    </template>

    <p class="results__status results__right" role="status">{{ status }}</p>

    <div v-if="outcome?.training" class="sheet-buttons sheet-buttons--lead results__right">
      <button
        v-if="outcome.training.next"
        type="button"
        class="btn btn--primary btn--raised"
        :class="{ 'again--beat': beats }"
        autofocus
        @click="outcome.training.next && emit('step', outcome.training.next)"
      >
        <AppIcon name="play" :size="20" />{{ t('training.continue') }}
      </button>
      <template v-else>
        <button
          type="button"
          class="btn btn--primary btn--raised"
          :class="{ 'again--beat': beats }"
          autofocus
          @click="emit('next', FIRST_LEVEL)"
        >
          <AppIcon name="play" :size="20" />
          {{ t('campaign.nextLevel', { level: FIRST_LEVEL.id }) }}
        </button>
        <button type="button" class="btn btn--raised" @click="emit('home')">
          <AppIcon name="home" :size="20" />{{ t('training.menu') }}
        </button>
      </template>
    </div>
    <div v-else-if="outcome?.campaign" class="sheet-buttons sheet-buttons--lead results__right">
      <button
        v-if="outcome.campaign.next"
        type="button"
        class="btn btn--primary btn--raised"
        :class="{ 'again--beat': beats }"
        autofocus
        @click="outcome.campaign.next && emit('next', outcome.campaign.next)"
      >
        <AppIcon name="play" :size="20" />
        {{ t('campaign.nextLevel', { level: outcome.campaign.next.id }) }}
      </button>
      <button
        type="button"
        class="btn btn--raised"
        :class="{
          'btn--primary': !outcome.campaign.next,
          'again--beat': beats && !outcome.campaign.next,
        }"
        :autofocus="!outcome.campaign.next"
        @click="emit('again')"
      >
        <AppIcon name="restart" :size="20" />{{ t('campaign.retry') }}
      </button>
      <button type="button" class="btn btn--raised" @click="emit('campaign')">
        <AppIcon name="map" :size="20" />{{ t('campaign.map') }}
      </button>
    </div>
    <div v-else class="sheet-buttons sheet-buttons--lead results__right">
      <button
        type="button"
        class="btn btn--primary btn--raised"
        :class="{ 'again--beat': beats }"
        autofocus
        @click="emit('again')"
      >
        <AppIcon name="restart" :size="20" />{{ t('over.again') }}
      </button>
      <button
        v-if="canShare !== false"
        type="button"
        class="btn btn--raised"
        @click="emit('share')"
      >
        <AppIcon name="share" :size="20" />{{ t('over.share') }}
      </button>
      <button type="button" class="btn btn--raised" @click="emit('home')">
        <AppIcon name="home" :size="20" />{{ t('over.home') }}
      </button>
    </div>
  </ModalDialog>
</template>

<style scoped>
.results__reason {
  color: var(--text-muted);
  font-size: 0.88rem;
  text-align: center;
}

/* A training step's lesson: the window's main sentence. */
.results__lesson {
  max-width: 26rem;
  justify-self: center;
  color: var(--text);
  font-size: 1rem;
  font-weight: 600;
  text-wrap: balance;
}

.results__stars {
  display: grid;
  justify-items: center;
  gap: var(--space-1);
}

.results__stars :deep(.star--on svg) {
  fill: currentColor;
}

.results__gained {
  color: var(--accent);
  font-weight: 800;
}

/* The result: big, gold, counting up; a record pops above it. */
.score {
  position: relative;
  display: grid;
  justify-items: center;
  gap: 0.1rem;
  margin-top: var(--space-2);
  padding: var(--space-3);
  border: 1px solid var(--border);
  border-radius: 1.25rem;
  background: var(--well-bg);
}

.score__badge {
  position: absolute;
  top: -0.7rem;
  padding: 0.25rem 0.65rem;
  border-radius: 999px;
  background: var(--jewel-rose);
  color: var(--bg);
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  box-shadow: 0 0.4rem 1.1rem color-mix(in srgb, var(--jewel-rose) 50%, transparent);
  animation: pop 520ms var(--ease-spring) 900ms both;
}

.score__label {
  color: var(--text-muted);
  font-size: 0.65rem;
  font-weight: 800;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.score__value {
  background: linear-gradient(180deg, var(--rift-core), var(--accent-fill));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  font-family: var(--font-display);
  font-size: clamp(2.1rem, 1.7rem + 2vw, 2.9rem);
  font-weight: 900;
  line-height: 1.05;
  font-variant-numeric: tabular-nums;
}

/* The Guardian challenge: the points, and the factor a quick victory earned. */
.score__factor {
  color: var(--accent-strong);
  font-size: 0.8rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.score__best {
  color: var(--text-muted);
  font-size: 0.8rem;
}

@keyframes pop {
  from {
    opacity: 0;
    transform: scale(0.4);
  }
}

/* The experience: the gain, the bar that fills, where it came from. */
.xp {
  display: grid;
  gap: 0.4rem;
}

.xp__line {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  color: var(--text-muted);
  font-size: 0.82rem;
}

.xp__line strong {
  color: var(--accent);
  font-family: var(--font-display);
  font-size: 1rem;
}

.xp__bar {
  height: 0.75rem;
  overflow: hidden;
  border-radius: 999px;
  background: var(--well-bg);
  box-shadow: inset 0 0 0 1px var(--border);
}

/* The fill slides in from the left, whole (its round end kept), clipped by the bar (1.42). */
.xp__bar i {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--rift-glow), var(--accent-strong));
  box-shadow: 0 0 0.75rem color-mix(in srgb, var(--rift-glow) 70%, transparent);
  transition-property: transform;
  transition-timing-function: var(--ease-out);
}

.xp__bar i.xp__fill--instant {
  transition: none;
}

.xp__sources {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.xp__sources li {
  padding: 0.2rem 0.5rem;
  border-radius: 999px;
  background: var(--highlight);
  color: var(--text-muted);
  font-size: 0.72rem;
}

.xp__sources b {
  color: var(--text);
}

.xp__levelup {
  justify-self: center;
  padding: 0.35rem 0.8rem;
  border-radius: 999px;
  background: var(--accent-gradient);
  color: var(--on-accent-fill);
  font-family: var(--font-display);
  font-size: 0.78rem;
  font-weight: 800;
  opacity: 0;
}

.xp__levelup--on {
  opacity: 1;
  animation: pop 520ms var(--ease-spring) both;
}

.xp__news {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: 0.8rem;
  font-weight: 700;
}

.xp__news :deep(svg) {
  flex: none;
  color: var(--accent);
}

/* A record within reach: the points missing, and a bar nearly full, in the box's own margin. */
.score__close {
  color: var(--accent-strong);
  font-size: 0.8rem;
  font-weight: 700;
  text-align: center;
  text-wrap: balance;
}

.close {
  position: absolute;
  bottom: 0.3rem;
  left: 50%;
  width: min(60%, 12rem);
  height: 0.3rem;
  overflow: hidden;
  border-radius: 999px;
  background: color-mix(in srgb, var(--danger) 30%, var(--well-bg));
  translate: -50% 0;
}

.close i {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, var(--rift-glow), var(--accent-strong));
  transform-origin: left;
  animation: close-fill 700ms var(--ease-out) 400ms both;
}

@keyframes close-fill {
  from {
    transform: scaleX(0);
  }
}

/*
 * The continue (1.31): watch and decline alike, same size and look (the
 * portals ask for it); a ring of five seconds on the ad's button; a short
 * line that says it comes once in a while.
 */
.cont {
  display: grid;
  gap: 0.6rem;
  padding: var(--space-3);
  border: 1px solid color-mix(in srgb, var(--accent) 55%, transparent);
  border-radius: 1.1rem;
  background: color-mix(in srgb, var(--accent) 8%, transparent);
}

.cont__title {
  font-size: 0.88rem;
  color: var(--text-muted);
}

.cont__title strong {
  color: var(--text);
}

.cont__row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-2);
}

.cont__btn {
  gap: var(--space-1);
  min-height: 3rem;
  font-size: 0.88rem;
  font-weight: 800;
}

.cont__btn:disabled {
  opacity: 0.55;
  cursor: default;
}

.cont__ring {
  flex: none;
  width: 1.25rem;
  height: 1.25rem;
  transform: rotate(-90deg);
}

.cont__ring circle {
  fill: none;
  stroke: var(--accent);
  stroke-width: 3;
  stroke-dasharray: 100;
  animation: cont-ring var(--ring) linear forwards;
}

@keyframes cont-ring {
  to {
    stroke-dashoffset: 100;
  }
}

.cont__note {
  color: var(--text-muted);
  font-size: 0.75rem;
}

/* A game lost: the title glows the danger's red and lands; the reason in red. */
.results--lost :deep(.sheet__title) {
  text-shadow:
    0 0 1.1rem color-mix(in srgb, var(--defeat-glow) 70%, transparent),
    0 0.12rem 0 rgb(90 11 36);
  animation: title-slam 280ms cubic-bezier(0.2, 1.5, 0.4, 1) both;
}

/* The fade (1.42): the title comes with the window, it does not land. */
:root[data-transitions='fade'] .results--lost :deep(.sheet__title) {
  animation: none;
}

.results--lost .results__reason {
  color: var(--danger);
  font-weight: 600;
}

@keyframes title-slam {
  from {
    opacity: 0;
    transform: scale(1.4);
  }
}

/* The way on beats, the next game's heartbeat, once the result is told. */
.again--beat {
  position: relative;
  animation: again-beat 1.2s ease-in-out 1s infinite;
}

.again--beat::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  /* A ring drawn by a shadow: it never adds to the button's size (its label keeps its room). */
  box-shadow: 0 0 0 0.25rem color-mix(in srgb, var(--accent) 75%, transparent);
  opacity: 0;
  pointer-events: none;
  animation: again-ring 1.2s ease-out 1s infinite;
}

@keyframes again-beat {
  0%,
  26%,
  52%,
  to {
    transform: scale(1);
  }
  12% {
    transform: scale(1.06);
  }
  38% {
    transform: scale(1.03);
  }
}

@keyframes again-ring {
  from {
    opacity: 0.85;
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--accent) 75%, transparent);
  }
  60%,
  to {
    opacity: 0;
    box-shadow: 0 0 0 0.6rem color-mix(in srgb, var(--accent) 75%, transparent);
  }
}

@keyframes again-glow {
  0%,
  to {
    opacity: 0.2;
  }
  50% {
    opacity: 0.75;
  }
}

/* Calmer effects or less motion: the way on glows, it does not grow. */
:root[data-motion='still'] .again--beat {
  animation: none;
}

:root[data-motion='still'] .again--beat::after {
  animation: again-glow 2.4s ease-in-out 1s infinite;
}

@media (prefers-reduced-motion: reduce) {
  .again--beat,
  .close i,
  .results--lost :deep(.sheet__title) {
    animation: none;
  }

  .again--beat::after {
    animation: again-glow 2.4s ease-in-out 1s infinite;
  }

  .cont__ring circle {
    animation-timing-function: steps(5);
  }
}

/* The rewarded ad: an option, labelled as an ad, never the main action. */
.reward {
  gap: var(--space-2);
  border-color: color-mix(in srgb, var(--accent) 55%, transparent);
  background: color-mix(in srgb, var(--accent) 8%, transparent);
  font-size: 0.88rem;
  font-weight: 800;
}

.reward:disabled {
  opacity: 0.55;
  cursor: default;
}

.reward__badge {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  padding: 0.15rem 0.45rem;
  border-radius: 999px;
  background: var(--accent-fill);
  color: var(--on-accent-fill);
  font-size: 0.68rem;
  letter-spacing: 0.06em;
}

.results__status {
  min-height: 1.1rem;
  color: var(--accent);
  font-size: 0.8rem;
  text-align: center;
}

/* Wide screens: the verdict and the result on the left, the rest on the right. */
@media (orientation: landscape) {
  .results[open] {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    grid-auto-flow: row dense;
  }

  .results__left {
    grid-column: 1;
  }

  .results__right {
    grid-column: 2;
  }
}

/* A level number never breaks at its hyphen. */
.results__level {
  white-space: nowrap;
}

/* A Guardian's promise: the danger colour, a pulse of light. */
.results__teaser {
  max-width: 22rem;
  padding: var(--space-2) var(--space-3);
  border: 1px solid color-mix(in srgb, var(--danger) 55%, transparent);
  border-radius: var(--radius);
  background: color-mix(in srgb, var(--danger) 12%, transparent);
  font-size: 0.85rem;
  font-weight: 700;
  text-align: center;
}
</style>

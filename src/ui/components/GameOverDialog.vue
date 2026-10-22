<script setup lang="ts">
import { computed, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useServices } from '@/app/AppServices';
import { useFormat } from '@/app/useFormat';
import type { CampaignLevel } from '@/campaign/Levels';
import { levelProgress } from '@/progression/Experience';
import type { GameOutcome } from '../GameOutcome';
import { useProgressText } from '../useProgressText';
import { useCountUp, useXpReveal, XP_FILL_MS } from '../useReveal';
import AppIcon from './AppIcon.vue';
import ModalDialog from './ModalDialog.vue';
import StarRow from './StarRow.vue';

/**
 * The end of a game, staged: the verdict, the result counting up (a record
 * pops), the experience filling its bar (a new level pops), what the game
 * unlocked, the optional rewarded ad, then the way on. Two columns on a
 * wide screen; nothing to scroll.
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
}>();
const emit = defineEmits<{
  again: [];
  home: [];
  share: [];
  campaign: [];
  next: [level: CampaignLevel];
  /** The player chooses to watch an ad for the bonus. */
  double: [];
}>();

const { t } = useI18n();
const format = useFormat();
const text = useProgressText();
const { profile } = useServices();

const title = computed(() => {
  const outcome = props.outcome;
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
</script>

<template>
  <ModalDialog
    class="results"
    :open="open"
    :title="title"
    hero
    wide
    @dismiss="outcome?.campaign ? emit('campaign') : emit('home')"
  >
    <template v-if="outcome">
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

      <div class="score results__left">
        <span v-if="!outcome.campaign && outcome.isNewBest" class="score__badge">
          {{ t('over.newBest') }}
        </span>
        <span class="score__label">{{ t('over.result') }}</span>
        <!-- The final value for screen readers; the count is for the eyes. -->
        <span class="sr-only">{{ outcome.value }}</span>
        <span class="score__value" aria-hidden="true">{{ shownScore }}</span>
        <span v-if="!outcome.campaign && !outcome.isNewBest" class="score__best">
          {{ t('over.best', { value: outcome.best }) }}
        </span>
      </div>

      <section
        v-if="outcome.progress.total > 0"
        class="xp results__right"
        :aria-label="t('progress.title')"
      >
        <p class="xp__line">
          <strong>{{ t('progress.gained', { n: format.number(outcome.progress.total) }) }}</strong>
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
              inlineSize: `${xp.fill.value * 100}%`,
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
      <p v-else class="sheet-note results__right">{{ t('progress.tooShort') }}</p>

      <button
        v-if="outcome.progress.total > 0 && (reward === 'offer' || reward === 'busy')"
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

    <div v-if="outcome?.campaign" class="sheet-buttons sheet-buttons--lead results__right">
      <button
        v-if="outcome.campaign.next"
        type="button"
        class="btn btn--primary btn--raised"
        autofocus
        @click="outcome.campaign.next && emit('next', outcome.campaign.next)"
      >
        <AppIcon name="play" :size="20" />
        {{ t('campaign.nextLevel', { level: outcome.campaign.next.id }) }}
      </button>
      <button
        type="button"
        class="btn btn--raised"
        :class="{ 'btn--primary': !outcome.campaign.next }"
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
      <button type="button" class="btn btn--primary btn--raised" autofocus @click="emit('again')">
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

.xp__bar i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--rift-glow), var(--accent-strong));
  box-shadow: 0 0 0.75rem color-mix(in srgb, var(--rift-glow) 70%, transparent);
  transition-property: inline-size;
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

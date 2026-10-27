<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useServices } from '@/app/AppServices';
import { useFormat } from '@/app/useFormat';
import { bonus } from '@/fx/sounds';
import { COLLECTIONS, type Collection } from '@/progression/Collections';
import { findCosmetic, type MaterialId, type ShatterId } from '@/progression/Cosmetics';
import { GIFT_DAYS, WELCOME_BACK_XP, type Gift } from '@/progression/DailyGifts';
import { nextStreakBonus, STREAK_BONUSES } from '@/progression/Experience';
import { justClaimed, type GiftCalendar, type GiftDay } from '@/progression/GiftCalendar';
import AppIcon from '../components/AppIcon.vue';
import ModalDialog from '../components/ModalDialog.vue';
import { useProgressText } from '../useProgressText';
import GemCanvas from './GemCanvas.vue';

/**
 * The gift calendar (1.35): seven days of gifts, today's to claim, its
 * experience twice for an ad the player chooses (where the channel has them,
 * after a newcomer's first minutes), a gift of welcome after a week away, and
 * the daily streak with its next step. A day missed only waits.
 */
const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();

const { t } = useI18n();
const format = useFormat();
const { gifts, platform, ads, audio, profile } = useServices();
const text = useProgressText();

const calendar = computed(() => gifts.calendar);
const today = computed(() => calendar.value.days[calendar.value.next]!);

/** What was just claimed, the week as it was and the sets it completed: kept until the window closes. */
const claimed = ref<{
  readonly gift: Gift;
  readonly doubled: boolean;
  readonly calendar: GiftCalendar;
  readonly sets: readonly Collection[];
} | null>(null);
/** The days in view: the week just claimed from, or the calendar as it stands. */
const shown = computed(() => claimed.value?.calendar ?? calendar.value);
const watching = ref(false);
const status = ref('');
watch(
  () => props.open,
  (open) => {
    if (!open) return;
    claimed.value = null;
    status.value = '';
  },
);

/** Today's experience twice, for an ad: only where an ad can play, never on a look. */
const canDouble = computed(
  () =>
    calendar.value.ready &&
    today.value.gift.kind === 'xp' &&
    platform.supportsRewarded &&
    ads.rewardedAllowed,
);

const xp = (n: number) => t('gifts.xp', { n: format.number(n) });
const giftWords = (gift: Gift) =>
  gift.kind === 'xp' ? xp(gift.amount) : text.cosmeticName(gift.cosmetic);

/**
 * A day's name on its tile: tomorrow, or its number. Today's tile shows its
 * number too (its gold says the rest): "Aujourd’hui" does not fit a phone's tile.
 */
const dayName = (day: GiftDay) =>
  day.state === 'tomorrow' ? t('gifts.tomorrow') : t('gifts.day', { n: day.index + 1 });

const claimWords = computed(() => {
  const gift = today.value.gift;
  return gift.kind === 'xp'
    ? t('gifts.claimXp', { n: format.number(gift.amount) })
    : t('gifts.claimLook', { name: text.cosmeticName(gift.cosmetic) });
});
const doubled = computed(() => (today.value.gift.kind === 'xp' ? today.value.gift.amount * 2 : 0));

/** A set's ambiance, its prize. */
const prizeOf = (set: Collection) => findCosmetic('ambiance', set.reward)!;
/** The sets complete now: a gift may complete one (its look, or the level its experience brings). */
const completeSets = () => COLLECTIONS.filter((set) => profile.isUnlocked(prizeOf(set)));

/** After the claim: what came, the sets it completed, and tomorrow's gift. */
const thanks = computed(() => {
  const got = claimed.value;
  if (!got) return '';
  const tomorrow = giftWords(today.value.gift);
  const came =
    got.gift.kind === 'xp'
      ? t('gifts.gotXp', {
          n: format.number(got.gift.amount * (got.doubled ? 2 : 1)),
          next: tomorrow,
        })
      : t('gifts.gotLook', { name: text.cosmeticName(got.gift.cosmetic), next: tomorrow });
  const sets = got.sets.map((set) =>
    t('gifts.setDone', {
      set: t(`collections.${set.id}.name`),
      prize: text.cosmeticName(prizeOf(set)),
    }),
  );
  return [came, ...sets].join(' ');
});

const take = (twice: boolean) => {
  const before = calendar.value;
  const gift = today.value.gift;
  const had = new Set(completeSets());
  gifts.claim(twice);
  const sets = completeSets().filter((set) => !had.has(set));
  claimed.value = { gift, doubled: twice, calendar: justClaimed(before), sets };
  audio.play(bonus);
};

const double = async () => {
  if (watching.value) return;
  watching.value = true;
  status.value = '';
  const watched = await platform.rewardedAd({
    onStart: () => audio.suspend(),
    onEnd: () => audio.resume(),
  });
  watching.value = false;
  if (!watched) {
    status.value = t('gifts.noAd');
    return;
  }
  ads.adShown();
  take(true);
};

// --- The daily streak -----------------------------------------------------------

const streak = computed(() => calendar.value.streak);
const step = computed(() => nextStreakBonus(streak.value));
const streakWords = computed(() => {
  const next = step.value;
  const first = STREAK_BONUSES[0]!;
  if (streak.value === 0) {
    return t('gifts.streakStart', { days: first.days, xp: format.number(first.xp) });
  }
  const now = t('gifts.streak', { n: format.number(streak.value) }, streak.value);
  return next
    ? `${now} ${t('gifts.streakNext', { days: next.days, xp: format.number(next.xp) })}`
    : now;
});
</script>

<template>
  <ModalDialog :open="open" :title="t('gifts.title')" closable wide @dismiss="emit('close')">
    <p class="gift-sub">
      {{ t('gifts.dayOf', { n: shown.next + 1, total: GIFT_DAYS }) }}
    </p>

    <p v-if="shown.welcome && (shown.ready || claimed)" class="gift-welcome">
      <AppIcon name="star" :size="18" />
      <span>{{ t('gifts.welcome', { n: format.number(WELCOME_BACK_XP) }) }}</span>
    </p>

    <div class="gift-body">
      <ol class="days" :aria-label="t('gifts.days')">
        <li
          v-for="day in shown.days"
          :key="day.index"
          class="day"
          :class="[
            `day--${day.state}`,
            {
              'day--look': day.gift.kind === 'look',
              'day--stamped': claimed && day.index === shown.next,
            },
          ]"
          :aria-current="day.state === 'today' ? 'date' : undefined"
        >
          <span class="day__name">{{ dayName(day) }}</span>
          <span class="day__art" aria-hidden="true">
            <AppIcon v-if="day.state === 'claimed'" name="check" :size="22" />
            <template v-else-if="day.gift.kind === 'look'">
              <GemCanvas
                v-if="day.gift.cosmetic.kind === 'material'"
                class="day__look"
                :material="day.gift.cosmetic.id as MaterialId"
              />
              <span
                v-else-if="day.gift.cosmetic.kind === 'ambiance'"
                class="day__look day__ambiance"
                :data-ambiance-preview="day.gift.cosmetic.id"
              />
              <GemCanvas v-else class="day__look" :shatter="day.gift.cosmetic.id as ShatterId" />
            </template>
            <AppIcon v-else name="gift" :size="24" />
          </span>
          <span class="day__gift">{{ giftWords(day.gift) }}</span>
          <small v-if="day.gift.kind === 'look'" class="day__kind">{{ t('gifts.look') }}</small>
          <span v-if="day.state === 'claimed'" class="sr-only">{{ t('gifts.claimed') }}</span>
          <span v-else-if="day.state === 'today'" class="sr-only">{{ t('gifts.today') }}</span>
        </li>
      </ol>

      <div v-if="claimed" class="gift-actions gift-actions--done">
        <p class="gift-thanks" role="status">{{ thanks }}</p>
        <button type="button" class="btn btn--primary btn--raised" @click="emit('close')">
          {{ t('gifts.continue') }}
        </button>
      </div>
      <div v-else-if="calendar.ready" class="gift-actions">
        <button type="button" class="btn btn--primary btn--raised" @click="take(false)">
          {{ claimWords }}
        </button>
        <button
          v-if="canDouble"
          type="button"
          class="btn btn--raised gift-double"
          :disabled="watching"
          :aria-label="t('gifts.doubleLabel', { n: format.number(doubled) })"
          @click="double"
        >
          <span class="gift-ad" aria-hidden="true">
            <AppIcon name="play" :size="12" />{{ t('over.adBadge') }}
          </span>
          <span aria-hidden="true">{{ t('gifts.double', { n: format.number(doubled) }) }}</span>
        </button>
        <p v-if="status" class="gift-status" role="status">{{ status }}</p>
      </div>
      <p v-else class="gift-thanks">
        {{ t('gifts.next', { gift: giftWords(today.gift) }) }}
      </p>

      <div class="gift-streak">
        <AppIcon name="flame" :size="28" />
        <p>
          {{ streakWords }}
          <span class="gift-waits">{{ t('gifts.waits') }}</span>
        </p>
      </div>
    </div>
  </ModalDialog>
</template>

<style scoped>
.gift-sub {
  margin-top: -0.6rem;
  color: var(--text-muted);
  font-size: 0.9rem;
}

.gift-welcome {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border: 1px solid color-mix(in srgb, var(--accent) 55%, transparent);
  border-radius: 1rem;
  background: color-mix(in srgb, var(--accent-fill) 14%, transparent);
  color: var(--accent-strong);
  font-size: 0.88rem;
  font-weight: 700;
}

.gift-welcome :deep(svg) {
  fill: currentColor;
}

/* The days and the actions adapt to the window's width: four tiles a row on a phone, seven on a desktop. */
.gift-body {
  container: gift / inline-size;
  display: grid;
  gap: var(--space-3);
}

.days {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.day {
  position: relative;
  display: grid;
  justify-items: center;
  align-content: start;
  gap: 0.3rem;
  min-width: 0;
  padding: 0.6rem 0.25rem;
  border: 1px solid var(--border);
  border-radius: 0.9rem;
  background: var(--surface-2);
  color: var(--text-muted);
  text-align: center;
}

.day__name {
  font-size: 0.75rem;
  font-weight: 700;
}

.day__art {
  display: grid;
  place-items: center;
  width: 2.2rem;
  height: 2.2rem;
}

.day__gift {
  max-width: 100%;
  overflow: hidden;
  font-size: 0.82rem;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.day__kind {
  margin-top: -0.2rem;
  font-size: 0.7rem;
}

.day--claimed {
  background: var(--well-bg);
  opacity: 0.65;
}

.day--claimed .day__art {
  border: 1.5px solid var(--jewel-lime);
  border-radius: 50%;
  color: var(--jewel-lime);
}

.day--today {
  border: 2px solid var(--accent);
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--accent) 22%, transparent),
    color-mix(in srgb, var(--accent) 6%, transparent)
  );
  box-shadow: 0 0 1.4rem color-mix(in srgb, var(--rift-glow) 35%, transparent);
  color: var(--accent-strong);
}

/* Today's tile breathes: a halo that brightens and fades (opacity only). */
.day--today::after {
  content: '';
  position: absolute;
  inset: -2px;
  border-radius: inherit;
  box-shadow: 0 0 2rem color-mix(in srgb, var(--rift-glow) 55%, transparent);
  opacity: 0;
  pointer-events: none;
  animation: today-glow 2.4s ease-in-out infinite;
}

.day--tomorrow {
  border-color: color-mix(in srgb, var(--accent) 45%, transparent);
  color: var(--text);
}

@keyframes today-glow {
  50% {
    opacity: 1;
  }
}

/* The day just claimed: its tick lands like a stamp. */
.day--stamped .day__art {
  animation: day-stamp 0.45s cubic-bezier(0.2, 1.6, 0.4, 1) both;
}

@keyframes day-stamp {
  from {
    opacity: 0;
    transform: scale(1.8) rotate(-12deg);
  }
}

/* The seventh day's look: on a phone, two tiles wide. */
.day--look {
  grid-column: span 2;
  border-color: var(--jewel-violet);
  background: radial-gradient(
    circle at 30% 30%,
    color-mix(in srgb, var(--jewel-violet) 45%, transparent),
    var(--surface-2) 72%
  );
  color: var(--text);
}

.day__look {
  width: 2.2rem;
  height: 2.2rem;
  border-radius: 0.6rem;
}

/* The prize shows larger than the days' gifts. */
.day--look .day__art,
.day--look .day__look {
  width: 2.8rem;
  height: 2.8rem;
}

/* An ambiance is a faint backdrop: its swatch shows its lights at full strength, to read as a prize. */
.day__ambiance {
  display: block;
  background:
    radial-gradient(70% 80% at 25% 20%, var(--glow-1), transparent 70%),
    radial-gradient(70% 80% at 80% 90%, var(--glow-2), transparent 70%), var(--bg);
  background:
    radial-gradient(70% 80% at 25% 20%, rgb(from var(--glow-1) r g b / 0.85), transparent 75%),
    radial-gradient(70% 80% at 80% 90%, rgb(from var(--glow-2) r g b / 0.85), transparent 75%),
    var(--bg);
  box-shadow: inset 0 0 0 1px var(--border);
}

.gift-actions {
  display: grid;
  gap: var(--space-2);
}

.gift-actions .btn {
  min-height: 3.2rem;
}

.gift-double {
  gap: var(--space-2);
}

.gift-ad {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  padding: 0.15rem 0.45rem;
  border-radius: 999px;
  background: var(--accent-fill);
  color: var(--on-accent-fill);
  font-size: 0.7rem;
  letter-spacing: 0.06em;
}

.gift-thanks,
.gift-status {
  color: var(--accent-strong);
  font-size: 0.9rem;
  font-weight: 700;
  text-align: center;
}

.gift-status {
  grid-column: 1 / -1;
  color: var(--text-muted);
  font-weight: 600;
}

.gift-streak {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3);
  border-radius: 1rem;
  background: var(--well-bg);
  color: var(--accent);
}

.gift-streak p {
  color: var(--text-muted);
  font-size: 0.85rem;
  line-height: 1.45;
}

.gift-waits {
  display: block;
}

/* A wide window (a desktop): the seven days in a row, the prize's wider; the actions side by side. */
@container gift (width >= 36rem) {
  .days {
    grid-template-columns: repeat(6, minmax(0, 1fr)) minmax(0, 1.5fr);
  }

  .day--look {
    grid-column: auto;
  }

  .gift-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
  }

  .gift-actions .btn {
    flex: 1 1 0;
    max-width: 20rem;
  }

  .gift-actions > p {
    flex-basis: 100%;
  }
}

/*
 * A short screen (a phone on its side): the seven days on one row, smaller,
 * and the actions beside the streak, so that the window fits without scrolling.
 */
@media (height < 30rem) {
  .gift-body {
    grid-template-columns: minmax(0, 2fr) minmax(0, 3fr);
    align-items: center;
  }

  .days {
    grid-column: 1 / -1;
    grid-template-columns: repeat(6, minmax(0, 1fr)) minmax(0, 1.5fr);
  }

  .day {
    gap: 0.15rem;
    padding-block: 0.35rem;
  }

  .day--look {
    grid-column: auto;
  }

  .day__kind {
    display: none;
  }

  .day__gift {
    font-size: 0.75rem;
  }

  .day__art,
  .day--look .day__art,
  .day--look .day__look {
    width: 1.8rem;
    height: 1.8rem;
  }

  .gift-welcome {
    padding-block: 0.3rem;
  }

  .gift-streak {
    padding: var(--space-2) var(--space-3);
  }

  .gift-streak p {
    font-size: 0.8rem;
    line-height: 1.35;
  }
}

@media (prefers-reduced-motion: reduce) {
  .day--today::after,
  .day--stamped .day__art {
    animation: none;
  }
}

:global(:root[data-motion='still']) .day--today::after,
:global(:root[data-motion='still']) .day--stamped .day__art {
  animation: none;
}
</style>

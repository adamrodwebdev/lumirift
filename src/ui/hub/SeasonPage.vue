<script setup lang="ts">
import { computed, nextTick, onMounted, ref, useId } from 'vue';
import { useI18n } from 'vue-i18n';
import { useServices } from '@/app/AppServices';
import { useFormat } from '@/app/useFormat';
import { bonus } from '@/fx/sounds';
import { COLLECTIONS } from '@/progression/Collections';
import { findCosmeticByKey, type MaterialId, type ShatterId } from '@/progression/Cosmetics';
import type { SeasonTierView } from '@/services/SeasonService';
import AppIcon from '../components/AppIcon.vue';
import ElementIcon from '../components/ElementIcon.vue';
import { useProgressText } from '../useProgressText';
import { ELEMENT_TINTS, useSeasonText } from '../useSeasonText';
import GemCanvas from './GemCanvas.vue';

/**
 * The season's page (1.36): the tier reached and the points to the next,
 * the week's event, the track's tiers (claimed, waiting for their claim, to
 * come), and the season's set with its crown. The premium track shows only
 * where purchases exist: nowhere yet. Back (or Escape) leaves it.
 */
const emit = defineEmits<{ close: [] }>();

const { t } = useI18n();
const format = useFormat();
const { seasons, profile, clock, audio, platform } = useServices();
/**
 * Where the week's element is dealt, in words: free games of Sand, or Dunes
 * in its test build (1.37; its name takes a case in Russian, so a sentence each).
 */
const EVENT_WORDS = {
  sand: { featured: 'events.featured', counts: 'events.inSand' },
  dunes: { featured: 'events.featuredDunes', counts: 'events.inDunes' },
} as const;
const eventWords = EVENT_WORDS[platform.edition.solo === 'dunes' ? 'dunes' : 'sand'];
const words = useSeasonText();
const text = useProgressText();
const titleId = useId();

const view = computed(() => seasons.view);
const span = computed(() => view.value.span);
const week = computed(() => view.value.week);
const total = computed(() => span.value?.season.track.tiers ?? 0);

/** The tier to bring into view: the first waiting for its claim, else the next to reach. */
const current = computed(() => {
  const tiers = view.value.tiers;
  return (
    tiers.find((tier) => tier.state === 'ready') ??
    tiers.find((tier) => tier.state === 'locked') ??
    tiers.at(-1)
  )?.tier;
});

const pointsLine = computed(() => {
  const { points, needed, tier } = view.value;
  if (needed === 0) {
    return t('seasons.maxed', { n: format.number(points) }, points);
  }
  const next = (tier + 1) * (span.value?.season.track.pointsPerTier ?? 0);
  return t('seasons.points', { done: format.number(points), next: format.number(next) }, next);
});

const lookOf = (tier: SeasonTierView) =>
  tier.reward.kind === 'look' ? (findCosmeticByKey(tier.reward.key) ?? null) : null;

/** What a claim said, for screen readers; the tier claimed just now, for its stamp. */
const status = ref('');
const stamped = ref<number | null>(null);
const claim = (tier: SeasonTierView) => {
  seasons.claim(tier.tier);
  stamped.value = tier.tier;
  status.value = `${t('seasons.claimed')}: ${words.reward(tier.reward)}`;
  audio.play(bonus);
};
const claimAll = () => {
  const count = view.value.ready;
  seasons.claimAll();
  stamped.value = null;
  status.value = `${t('seasons.claimed')}: ${format.number(count)}`;
  audio.play(bonus);
};

/** The season's set: its looks gathered, and its crown. */
const set = computed(() => {
  const id = span.value?.season.id;
  const collection = COLLECTIONS.find((each) => each.season === id);
  if (!collection) return null;
  const crown = findCosmeticByKey(collection.reward)!;
  return {
    name: t(`collections.${collection.id}.name`),
    items: collection.items.map((key) => {
      const cosmetic = findCosmeticByKey(key)!;
      return { cosmetic, owned: profile.isUnlocked(cosmetic) };
    }),
    crown: { cosmetic: crown, owned: profile.isUnlocked(crown) },
  };
});

const nextLine = computed(() => {
  const next = view.value.next;
  return next
    ? t('seasons.next', { name: words.title(next), date: format.date(next.startsAt) })
    : t('seasons.soon');
});
/** The next season's looks, shown ahead: what it will bring. */
const nextLooks = computed(() =>
  (view.value.next?.season.looks ?? []).map((look) =>
    findCosmeticByKey(`${look.kind}.${look.id}`)!,
  ),
);

// The page opens on its title, the current tier in view (scrolled by the
// track's own box: scrolling into view would move the menu's pages too).
const heading = ref<HTMLElement | null>(null);
const body = ref<HTMLElement | null>(null);
const track = ref<HTMLElement | null>(null);
onMounted(async () => {
  await nextTick();
  heading.value?.focus();
  const item = track.value?.querySelector<HTMLElement>('[aria-current="step"]');
  if (!item || !track.value || !body.value) return;
  if (track.value.scrollWidth > track.value.clientWidth) {
    track.value.scrollLeft = item.offsetLeft - (track.value.clientWidth - item.offsetWidth) / 2;
  } else {
    body.value.scrollTop = item.offsetTop - body.value.clientHeight / 2;
  }
});

const onKey = (event: KeyboardEvent) => {
  if (event.key !== 'Escape') return;
  event.preventDefault();
  emit('close');
};
</script>

<template>
  <section class="season" :aria-labelledby="titleId" @keydown="onKey">
    <header class="season__head">
      <button
        type="button"
        class="btn btn--square"
        :aria-label="t('seasons.back')"
        @click="emit('close')"
      >
        <AppIcon name="back" />
      </button>
      <div class="season__titles">
        <h2 :id="titleId" ref="heading" tabindex="-1">
          {{ span ? words.title(span) : t('seasons.soon') }}
        </h2>
        <p v-if="span">{{ words.seasonLeft(span, clock()) }}</p>
      </div>
    </header>

    <div ref="body" class="season__body">
      <template v-if="span">
        <div class="season__top">
          <section class="season__mine">
            <p class="season__tier">
              <strong>{{ t('seasons.tier', { n: format.number(view.tier) }) }}</strong>
              <span>{{ t('seasons.of', { n: format.number(total) }) }}</span>
            </p>
            <p class="season__points">{{ pointsLine }}</p>
            <span class="season__bar" aria-hidden="true">
              <i
                :style="{
                  transform: `scaleX(${view.needed === 0 ? 1 : view.into / view.needed})`,
                }"
              />
            </span>
            <p class="season__sources">{{ t('seasons.sources') }}</p>
            <button
              v-if="view.ready > 1"
              type="button"
              class="btn btn--primary btn--raised season__all"
              @click="claimAll"
            >
              {{ t('seasons.claimAll', { n: format.number(view.ready) }) }}
            </button>
          </section>

          <section
            v-if="week"
            class="season__week"
            :style="{ '--el': ELEMENT_TINTS[week.event.element] }"
          >
            <span class="season__element" aria-hidden="true">
              <ElementIcon :element="week.event.element" :size="26" />
            </span>
            <div class="season__week-text">
              <h3>{{ words.weekName(week) }} · {{ words.weekLeft(week, clock()) }}</h3>
              <p class="season__goal">
                <template v-if="week.done">
                  <AppIcon name="check" :size="14" />
                  {{ t('events.done', { n: format.number(week.points) }, week.points) }}
                </template>
                <template v-else>
                  {{ words.goal(week) }} ·
                  {{ t('events.reward', { n: format.number(week.points) }, week.points) }}
                </template>
              </p>
              <span v-if="!week.done" class="season__progress">
                <span class="season__week-bar" aria-hidden="true">
                  <i :style="{ transform: `scaleX(${week.deeds / week.target})` }" />
                </span>
                <small>
                  {{
                    t('events.progress', {
                      done: format.number(week.deeds),
                      target: format.number(week.target),
                    })
                  }}
                </small>
              </span>
              <p class="season__featured">
                {{ t(`${eventWords.featured}.${week.event.element}`) }} {{ t(eventWords.counts) }}
              </p>
            </div>
          </section>
        </div>

        <p class="sr-only" role="status">{{ status }}</p>
        <ol ref="track" class="track" :aria-label="t('seasons.track')">
          <li
            v-for="tier in view.tiers"
            :key="tier.tier"
            class="tier"
            :class="[
              `tier--${tier.state}`,
              { 'tier--look': tier.reward.kind === 'look', 'tier--stamped': stamped === tier.tier },
            ]"
            :aria-current="tier.tier === current ? 'step' : undefined"
          >
            <span class="tier__number">
              <span class="sr-only">{{ t('seasons.tier', { n: tier.tier }) }}</span>
              <span aria-hidden="true">{{ format.number(tier.tier) }}</span>
            </span>
            <span class="tier__reward">
              <span class="tier__art" aria-hidden="true">
                <template v-if="lookOf(tier)">
                  <GemCanvas
                    v-if="lookOf(tier)!.kind === 'material'"
                    class="tier__look"
                    :material="lookOf(tier)!.id as MaterialId"
                  />
                  <span
                    v-else-if="lookOf(tier)!.kind === 'ambiance'"
                    class="tier__look tier__ambiance"
                    :data-ambiance-preview="lookOf(tier)!.id"
                  />
                  <GemCanvas v-else class="tier__look" :shatter="lookOf(tier)!.id as ShatterId" />
                </template>
                <span v-else class="tier__xp">{{ t('seasons.xpBadge') }}</span>
              </span>
              <span class="tier__name">
                {{
                  tier.reward.kind === 'xp'
                    ? t('seasons.plus', { n: format.number(tier.reward.amount) })
                    : words.reward(tier.reward)
                }}
                <small v-if="lookOf(tier)">{{ t('gifts.look') }}</small>
              </span>
            </span>
            <button
              v-if="tier.state === 'ready'"
              type="button"
              class="btn btn--primary tier__claim"
              :aria-label="
                t('seasons.claimLabel', { n: tier.tier, reward: words.reward(tier.reward) })
              "
              @click="claim(tier)"
            >
              {{ t('seasons.claim') }}
            </button>
            <span v-else-if="tier.state === 'claimed'" class="tier__done">
              <AppIcon name="check" :size="18" />
              <span class="sr-only">{{ t('seasons.claimed') }}</span>
            </span>
            <small v-else class="tier__at">
              {{ t('seasons.locked', { n: format.number(tier.points) }) }}
            </small>
          </li>
        </ol>

        <section v-if="set" class="season__set">
          <p>
            {{
              set.crown.owned
                ? t('seasons.setDone', { crown: text.cosmeticName(set.crown.cosmetic) })
                : t('seasons.set', {
                    name: set.name,
                    crown: text.cosmeticName(set.crown.cosmetic),
                  })
            }}
          </p>
          <span class="season__set-looks" aria-hidden="true">
            <span
              v-for="item in [...set.items, set.crown]"
              :key="item.cosmetic.id"
              class="season__set-look"
              :class="{
                'season__set-look--owned': item.owned,
                'season__set-look--crown': item === set.crown,
              }"
            >
              <GemCanvas
                v-if="item.cosmetic.kind === 'material'"
                class="tier__look"
                :material="item.cosmetic.id as MaterialId"
              />
              <span
                v-else-if="item.cosmetic.kind === 'ambiance'"
                class="tier__look tier__ambiance"
                :data-ambiance-preview="item.cosmetic.id"
              />
              <GemCanvas v-else class="tier__look" :shatter="item.cosmetic.id as ShatterId" />
            </span>
          </span>
        </section>
      </template>
      <section v-if="nextLooks.length > 0" class="season__upcoming">
        <p>{{ nextLine }}</p>
        <span class="season__set-looks" aria-hidden="true">
          <span v-for="look in nextLooks" :key="look.id" class="season__set-look--owned">
            <GemCanvas
              v-if="look.kind === 'material'"
              class="tier__look"
              :material="look.id as MaterialId"
            />
            <span
              v-else-if="look.kind === 'ambiance'"
              class="tier__look tier__ambiance"
              :data-ambiance-preview="look.id"
            />
            <GemCanvas v-else class="tier__look" :shatter="look.id as ShatterId" />
          </span>
        </span>
      </section>
      <p v-else class="season__next">{{ nextLine }}</p>
    </div>
  </section>
</template>

<style scoped>
/* The season's page covers the menu's pages; its body scrolls, its head stays. */
.season {
  container: season / inline-size;
  position: absolute;
  inset: 0;
  z-index: 3;
  display: flex;
  flex-direction: column;
  background:
    radial-gradient(
      120% 60% at 50% 0%,
      color-mix(in srgb, var(--accent) 16%, transparent),
      transparent 60%
    ),
    var(--bg);
}

.season__head {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4) var(--space-2);
}

.season__titles {
  display: grid;
  gap: 0.1rem;
  min-width: 0;
}

.season__titles h2 {
  font-family: var(--font-display, inherit);
  font-size: clamp(1.15rem, 1rem + 1.2vw, 1.9rem);
  line-height: 1.15;
  text-wrap: balance;
}

.season__titles h2:focus {
  outline: none;
}

.season__titles p {
  color: var(--text-muted);
  font-size: 0.85rem;
}

.season__body {
  display: grid;
  flex: 1 1 auto;
  align-content: start;
  gap: var(--space-3);
  min-height: 0;
  padding: var(--space-1) var(--space-4) var(--space-4);
  overflow-y: auto;
  overscroll-behavior: contain;
}

.season__top {
  display: grid;
  gap: var(--space-3);
}

.season__mine {
  display: grid;
  gap: 0.45rem;
  padding: var(--space-3);
  border: 1px solid var(--border);
  border-radius: 1.1rem;
  background: var(--surface);
}

.season__tier {
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
}

.season__tier strong {
  font-family: var(--font-display, inherit);
  font-size: 1.25rem;
}

.season__tier span,
.season__sources {
  color: var(--text-muted);
  font-size: 0.85rem;
}

.season__points {
  color: var(--accent-strong);
  font-size: 0.9rem;
  font-weight: 700;
}

.season__bar,
.season__week-bar {
  display: block;
  height: 0.55rem;
  overflow: hidden;
  border-radius: 999px;
  background: var(--well-bg);
}

.season__bar i,
.season__week-bar i {
  display: block;
  height: 100%;
  background: var(--accent-gradient);
  transform-origin: left;
}

.season__all {
  justify-self: start;
}

.season__week {
  display: flex;
  gap: var(--space-3);
  padding: var(--space-3);
  border: 1px solid color-mix(in srgb, var(--el) 55%, transparent);
  border-radius: 1.1rem;
  background: linear-gradient(
    115deg,
    color-mix(in srgb, var(--el) 18%, var(--surface)),
    var(--surface) 65%
  );
}

.season__element {
  display: grid;
  flex: none;
  place-items: center;
  width: 2.75rem;
  height: 2.75rem;
  border: 1.5px solid color-mix(in srgb, var(--el) 70%, transparent);
  border-radius: 50%;
  color: var(--el);
}

.season__week-text {
  display: grid;
  flex: 1 1 auto;
  gap: 0.35rem;
  min-width: 0;
}

.season__week-text h3 {
  color: color-mix(in srgb, var(--el) 70%, var(--text));
  font-size: 0.72rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.season__goal {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.95rem;
  font-weight: 700;
}

.season__week-bar i {
  background: linear-gradient(90deg, color-mix(in srgb, var(--el) 60%, white), var(--el));
}

.season__progress {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.season__progress .season__week-bar {
  flex: 1 1 auto;
}

.season__progress small {
  color: var(--text-muted);
  font-size: 0.78rem;
  font-weight: 700;
}

.season__featured {
  color: var(--text-muted);
  font-size: 0.8rem;
  line-height: 1.4;
}

/* The track: a list down a phone, a strip across a wide screen. */
.track {
  display: grid;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.tier {
  display: grid;
  grid-template-columns: 2.4rem minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-3);
  min-height: 3.6rem;
  padding: 0.45rem var(--space-3);
  border: 1px solid var(--border);
  border-radius: 1rem;
  background: var(--surface);
}

.tier__number {
  display: grid;
  place-items: center;
  width: 2.2rem;
  height: 2.2rem;
  border: 2px solid var(--border);
  border-radius: 50%;
  color: var(--text-muted);
  font-family: var(--font-display, inherit);
  font-size: 0.85rem;
  font-weight: 800;
}

.tier__reward {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-width: 0;
}

.tier__art {
  display: grid;
  flex: none;
  place-items: center;
  width: 2.4rem;
  height: 2.4rem;
}

.tier__look {
  display: block;
  width: 2.4rem;
  height: 2.4rem;
  border-radius: 0.6rem;
}

.tier__ambiance {
  background:
    radial-gradient(70% 80% at 25% 20%, var(--glow-1), transparent 70%),
    radial-gradient(70% 80% at 80% 90%, var(--glow-2), transparent 70%), var(--bg);
  background:
    radial-gradient(70% 80% at 25% 20%, rgb(from var(--glow-1) r g b / 0.85), transparent 75%),
    radial-gradient(70% 80% at 80% 90%, rgb(from var(--glow-2) r g b / 0.85), transparent 75%),
    var(--bg);
  box-shadow: inset 0 0 0 1px var(--border);
}

.tier__xp {
  padding: 0.15rem 0.45rem;
  border-radius: 0.5rem;
  background: color-mix(in srgb, var(--accent) 22%, var(--surface-2));
  color: var(--accent-strong);
  font-size: 0.72rem;
  font-weight: 800;
}

.tier__name {
  display: grid;
  min-width: 0;
  font-size: 0.92rem;
  font-weight: 700;
  line-height: 1.2;
}

.tier__name small {
  color: var(--text-muted);
  font-size: 0.72rem;
  font-weight: 600;
}

.tier__claim {
  min-height: var(--touch);
  padding-inline: var(--space-4);
}

.tier__done {
  display: grid;
  place-items: center;
  width: var(--touch);
  color: var(--jewel-lime);
}

.tier__at {
  max-width: 6.5rem;
  color: var(--text-muted);
  font-size: 0.72rem;
  text-align: end;
}

.tier--claimed {
  opacity: 0.62;
}

.tier--ready {
  border: 2px solid var(--accent);
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--accent) 18%, var(--surface)),
    var(--surface)
  );
  box-shadow: 0 0 1.2rem color-mix(in srgb, var(--rift-glow) 30%, transparent);
}

.tier--ready .tier__number,
.tier--claimed .tier__number {
  border-color: var(--accent);
  background: var(--accent-fill);
  color: var(--on-accent-fill);
}

.tier--look:not(.tier--claimed) {
  border-color: color-mix(in srgb, var(--jewel-violet) 70%, transparent);
}

/* The tier claimed just now: its tick lands like a stamp. */
.tier--stamped .tier__done {
  animation: tier-stamp 0.45s cubic-bezier(0.2, 1.6, 0.4, 1) both;
}

@keyframes tier-stamp {
  from {
    opacity: 0;
    transform: scale(1.8) rotate(-12deg);
  }
}

.season__set {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-3);
  border: 1px solid color-mix(in srgb, var(--jewel-violet) 45%, transparent);
  border-radius: 1.1rem;
  background: var(--surface);
}

.season__set p {
  font-size: 0.88rem;
  line-height: 1.4;
}

.season__set-looks {
  display: flex;
  gap: var(--space-2);
}

.season__set-look {
  opacity: 0.35;
  filter: grayscale(0.7);
}

.season__set-look--owned {
  opacity: 1;
  filter: none;
}

.season__set-look--crown {
  margin-left: var(--space-3);
  border-radius: 0.7rem;
  box-shadow: 0 0 0 2px var(--accent);
}

.season__next {
  color: var(--text-muted);
  font-size: 0.85rem;
  text-align: center;
}

/* The next season, ahead: its date and the looks it brings. */
.season__upcoming {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-3);
  border: 1px dashed color-mix(in srgb, var(--accent) 45%, transparent);
  border-radius: 1.1rem;
  background: color-mix(in srgb, var(--accent) 6%, transparent);
}

.season__upcoming p {
  flex: 1 1 14rem;
  color: var(--accent-strong);
  font-size: 0.9rem;
  font-weight: 700;
}

/* A wide screen: the season and the week side by side, the tiers in a strip across. */
@container season (inline-size >= 48rem) {
  .season__top {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);
  }

  .track {
    grid-auto-columns: 10.5rem;
    grid-auto-flow: column;
    overflow-x: auto;
    padding-bottom: var(--space-2);
    scroll-snap-type: x proximity;
  }

  .tier {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto 1fr auto;
    justify-items: center;
    min-height: 13rem;
    padding: var(--space-3) var(--space-2);
    text-align: center;
    scroll-snap-align: center;
  }

  .tier__art,
  .tier__art .tier__look {
    width: 3.4rem;
    height: 3.4rem;
  }

  .tier__reward {
    flex-direction: column;
  }

  .tier__name {
    justify-items: center;
  }

  .tier__at {
    max-width: none;
    text-align: center;
  }
}

@media (prefers-reduced-motion: reduce) {
  .tier--stamped .tier__done {
    animation: none;
  }
}

:global(:root[data-motion='still']) .tier--stamped .tier__done {
  animation: none;
}
</style>

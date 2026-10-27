<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { useServices } from '@/app/AppServices';
import { useFormat } from '@/app/useFormat';
import AppIcon from '../components/AppIcon.vue';
import ElementIcon from '../components/ElementIcon.vue';
import { ELEMENT_TINTS, useSeasonText } from '../useSeasonText';

/**
 * The week's event on the home (1.36): its element, the time left, its goal
 * and how far the player is; beside it, the season's tier on a ring (a dot
 * when a reward waits). It opens the season's page.
 */
const emit = defineEmits<{ open: [origin: Element] }>();

const { t } = useI18n();
const format = useFormat();
const { seasons, clock } = useServices();
const words = useSeasonText();

const view = computed(() => seasons.view);
const week = computed(() => view.value.week);
const span = computed(() => view.value.span);

/** The ring: how far into the next tier (full once the track is done). */
const RING = 2 * Math.PI * 14;
const ring = computed(() => {
  const { into, needed } = view.value;
  return needed === 0 ? RING : (RING * into) / needed;
});

const label = computed(() => {
  const now = clock();
  if (!week.value || !span.value) return '';
  return t('events.label', {
    week: words.weekName(week.value),
    left: words.weekLeft(week.value, now),
    goal: words.goal(week.value),
    done: format.number(week.value.deeds),
    target: format.number(week.value.target),
    season: words.title(span.value),
    tier: format.number(view.value.tier),
  });
});
</script>

<template>
  <button
    v-if="week && span"
    type="button"
    class="event"
    :class="{ 'event--done': week.done }"
    :style="{ '--el': ELEMENT_TINTS[week.event.element] }"
    :aria-label="label"
    @click="emit('open', $event.currentTarget as Element)"
  >
    <span class="event__icon" aria-hidden="true">
      <ElementIcon :element="week.event.element" :size="24" />
    </span>
    <span class="event__text" aria-hidden="true">
      <small class="event__kicker">
        {{ words.weekName(week)
        }}<span class="event__left"> · {{ words.weekLeft(week, clock()) }}</span>
      </small>
      <strong v-if="week.done" class="event__goal event__goal--done">
        <AppIcon name="check" :size="14" />
        {{ t('events.done', { n: format.number(week.points) }, week.points) }}
      </strong>
      <strong v-else class="event__goal">{{ words.goal(week) }}</strong>
      <span v-if="!week.done" class="event__progress">
        <span class="event__bar"
          ><i :style="{ transform: `scaleX(${week.deeds / week.target})` }"
        /></span>
        <small>{{
          t('events.progress', {
            done: format.number(week.deeds),
            target: format.number(week.target),
          })
        }}</small>
      </span>
    </span>
    <span class="event__season" aria-hidden="true">
      <svg class="event__ring" viewBox="0 0 34 34">
        <circle cx="17" cy="17" r="14" class="event__track" />
        <circle
          cx="17"
          cy="17"
          r="14"
          class="event__fill"
          :stroke-dasharray="`${ring} ${RING}`"
          transform="rotate(-90 17 17)"
        />
        <text x="17" y="21.5" text-anchor="middle">{{ format.number(view.tier) }}</text>
      </svg>
      <small>{{ words.title(span) }}</small>
      <span v-if="view.ready > 0" class="event__dot" />
    </span>
  </button>
</template>

<style scoped>
/* The week's event: a card in its element's colour, the season's ring at its end. */
.event {
  container: event / inline-size;
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: min(100%, 27rem);
  min-height: 3.6rem;
  padding: 0.45rem var(--space-3);
  border: 1px solid color-mix(in srgb, var(--el) 55%, transparent);
  border-radius: 1.15rem;
  background: linear-gradient(
    115deg,
    color-mix(in srgb, var(--el) 22%, var(--surface)),
    color-mix(in srgb, var(--surface-2) 90%, transparent) 62%
  );
  box-shadow: 0 0 1.4rem color-mix(in srgb, var(--el) 22%, transparent);
  color: var(--text);
  text-align: start;
  transition: transform 120ms ease;
}

.event:active {
  transform: scale(0.98);
}

.event__icon {
  display: grid;
  flex: none;
  place-items: center;
  width: 2.5rem;
  height: 2.5rem;
  border: 1.5px solid color-mix(in srgb, var(--el) 70%, transparent);
  border-radius: 50%;
  background: color-mix(in srgb, var(--el) 14%, var(--bg));
  color: var(--el);
}

.event__text {
  display: grid;
  flex: 1 1 auto;
  gap: 0.2rem;
  min-width: 0;
}

.event__kicker {
  overflow: hidden;
  color: color-mix(in srgb, var(--el) 70%, var(--text));
  font-size: 0.66rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-overflow: ellipsis;
  text-transform: uppercase;
  white-space: nowrap;
}

.event__goal {
  display: -webkit-box;
  overflow: hidden;
  font-size: 0.9rem;
  line-height: 1.2;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
}

.event__goal--done {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  color: var(--jewel-lime);
}

.event__progress {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.event__progress small {
  flex: none;
  color: var(--text-muted);
  font-size: 0.72rem;
  font-weight: 700;
}

.event__bar {
  flex: 1 1 auto;
  height: 0.4rem;
  overflow: hidden;
  border-radius: 999px;
  background: var(--well-bg);
}

.event__bar i {
  display: block;
  height: 100%;
  background: linear-gradient(90deg, color-mix(in srgb, var(--el) 60%, white), var(--el));
  transform-origin: left;
}

.event__season {
  position: relative;
  display: grid;
  flex: none;
  justify-items: center;
  gap: 0.1rem;
  max-width: 5.5rem;
}

.event__season small {
  max-width: 100%;
  overflow: hidden;
  color: var(--text-muted);
  font-size: 0.6rem;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.event__ring {
  width: 2.2rem;
  height: 2.2rem;
}

.event__track,
.event__fill {
  fill: none;
  stroke-width: 4;
}

.event__track {
  stroke: var(--well-bg);
}

.event__fill {
  stroke: var(--accent);
  stroke-linecap: round;
}

.event__ring text {
  fill: var(--text);
  font-family: var(--font-display, inherit);
  font-size: 11px;
  font-weight: 800;
}

/* A reward waits on the track. */
.event__dot {
  position: absolute;
  top: -0.1rem;
  right: 0.6rem;
  width: 0.6rem;
  height: 0.6rem;
  border-radius: 50%;
  background: var(--accent-fill);
  box-shadow: 0 0 0.6rem color-mix(in srgb, var(--accent) 70%, transparent);
}

/* A short menu (a small phone): the icon says the week, the goal and its bar stay. */
@container pages (height < 30rem) {
  .event {
    min-height: 3rem;
    padding-block: 0.35rem;
  }

  .event__kicker {
    display: none;
  }
}

/* A very short menu (a phone on its side): one line, the goal and its count. */
@container pages (height < 22rem) {
  .event {
    min-height: 2.75rem;
    gap: var(--space-2);
    padding-block: 0.2rem;
  }

  .event__icon {
    width: 2rem;
    height: 2rem;
  }

  .event__text {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .event__goal {
    flex: 1 1 auto;
    min-width: 0;
    font-size: 0.8rem;
  }

  .event__bar {
    display: none;
  }

  .event__ring {
    width: 1.9rem;
    height: 1.9rem;
  }
}

/* Narrower still (a small phone on its side): the goal alone, its count on the season's page. */
@container event (inline-size < 14rem) {
  .event__progress {
    display: none;
  }
}

/* The narrowest: the goal takes the ring's room too; the season's page says the tier. */
@container event (inline-size < 12rem) {
  .event__season {
    display: none;
  }
}

/* Too narrow for the season's name: the ring says the tier; the week's name, without its time left. */
@container event (inline-size < 21rem) {
  .event__season small,
  .event__left {
    display: none;
  }
}
</style>

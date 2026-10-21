<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import { useI18n } from 'vue-i18n';
import { useServices } from '@/app/AppServices';
import { CHAPTERS, LEVELS, type CampaignLevel } from '@/campaign/Levels';
import { allowsLevel } from '@/platform/Edition';
import AppIcon from '../components/AppIcon.vue';
import StarRow from '../components/StarRow.vue';
import UpgradesDialog from '../components/UpgradesDialog.vue';
import LevelDialog from './LevelDialog.vue';

/**
 * The campaign as a map: one chapter at a time, its six levels along a
 * winding path, the way travelled so far lit. A level shows its goal before
 * it starts; the upgrades are bought here.
 */
const emit = defineEmits<{ play: [level: CampaignLevel, origin: Element] }>();

const { t } = useI18n();
const { campaign, catalog, platform } = useServices();

type Point = readonly [x: number, y: number];
/** Where the six levels sit, in % of the path's field: up a tall screen, across a wide one. */
const TALL: readonly Point[] = [
  [24, 100],
  [76, 80],
  [26, 60],
  [74, 40],
  [28, 20],
  [72, 0],
];
const WIDE: readonly Point[] = [
  [0, 78],
  [20, 22],
  [40, 78],
  [60, 22],
  [80, 78],
  [100, 22],
];
const STARS_PER_CHAPTER = 18;

/** The map opens on the chapter of the next level to win. */
const chapterIndex = ref(
  Math.max(
    0,
    CHAPTERS.findIndex((chapter) => chapter === campaign.model.nextLevel.chapter),
  ),
);
const direction = ref<-1 | 1>(1);
const turn = (step: -1 | 1) => {
  const next = chapterIndex.value + step;
  if (next < 0 || next >= CHAPTERS.length) return;
  direction.value = step;
  chapterIndex.value = next;
};

type NodeState = 'done' | 'current' | 'open' | 'locked';
const view = computed(() => {
  const model = campaign.model;
  const chapter = CHAPTERS[chapterIndex.value]!;
  const next = model.nextLevel;
  const levels = LEVELS.filter((level) => level.chapter === chapter).map((level) => {
    const inEdition = allowsLevel(platform.edition, level);
    const stars = model.starsOf(level.id);
    const state: NodeState = !(inEdition && model.isUnlocked(level))
      ? 'locked'
      : stars > 0
        ? 'done'
        : level === next
          ? 'current'
          : 'open';
    return { level, stars, state, inEdition, family: catalog.get(level.modeId).family };
  });
  return { chapter, levels, stars: levels.reduce((sum, entry) => sum + entry.stars, 0) };
});
const spare = computed(() => campaign.model.availableStars);

/** What a screen reader says of a level: its name, then where the player stands with it. */
const nodeLabel = ({ level, state, stars, inEdition }: (typeof view.value.levels)[number]) => {
  const name = t('campaign.levelTitle', { level: level.id, mode: t(`modes.${level.modeId}.name`) });
  const status =
    state === 'locked'
      ? inEdition
        ? t('hub.locked')
        : t('demo.fullGame')
      : state === 'done'
        ? t('campaign.starsWon', { n: stars }, stars)
        : t('hub.next');
  return `${name}, ${status}`;
};

// --- The path: tall or wide, as its box is ----------------------------------

const path = ref<HTMLElement | null>(null);
const wide = ref(false);
const observer = new ResizeObserver(([entry]) => {
  if (entry) wide.value = entry.contentRect.width > entry.contentRect.height;
});
onMounted(() => path.value && observer.observe(path.value));
onBeforeUnmount(() => observer.disconnect());

const points = computed(() => (wide.value ? WIDE : TALL));
/** The way between levels: lit up to the last level opened, dotted after. */
const ways = computed(() => {
  let lit = '';
  let ahead = '';
  const at = points.value;
  for (let i = 1; i < at.length; i++) {
    const [x0, y0] = at[i - 1]!;
    const [x1, y1] = at[i]!;
    const bend = wide.value
      ? `C${(x0 + x1) / 2} ${y0} ${(x0 + x1) / 2} ${y1}`
      : `C${x0} ${(y0 + y1) / 2} ${x1} ${(y0 + y1) / 2}`;
    const way = `M${x0} ${y0} ${bend} ${x1} ${y1}`;
    if (view.value.levels[i]?.state === 'locked') ahead += way;
    else lit += way;
  }
  return { lit, ahead };
});

// --- A level's card, then the game -------------------------------------------

const selected = shallowRef<CampaignLevel | null>(null);
let origin: Element | null = null;
const open = (level: CampaignLevel, node: Element) => {
  origin = node;
  selected.value = level;
};
const play = (level: CampaignLevel) => {
  selected.value = null;
  if (origin) emit('play', level, origin);
};
const shopOpen = ref(false);
</script>

<template>
  <section class="page map">
    <header class="map__head">
      <button
        type="button"
        class="btn btn--square"
        :aria-label="t('hub.prevChapter')"
        :disabled="chapterIndex === 0"
        @click="turn(-1)"
      >
        <AppIcon name="left" />
      </button>
      <div class="map__title">
        <small>{{ t('campaign.chapter', { n: view.chapter }) }}</small>
        <h2>{{ t(`campaign.chapters.${view.chapter}`) }}</h2>
        <span>{{ t('campaign.chapterStars', { n: view.stars, max: STARS_PER_CHAPTER }) }}</span>
      </div>
      <button
        type="button"
        class="btn btn--square"
        :aria-label="t('hub.nextChapter')"
        :disabled="chapterIndex === CHAPTERS.length - 1"
        @click="turn(1)"
      >
        <AppIcon name="right" />
      </button>
    </header>
    <div class="map__dots" aria-hidden="true">
      <i v-for="(chapter, i) in CHAPTERS" :key="chapter" :class="{ on: i === chapterIndex }" />
    </div>

    <div ref="path" class="path">
      <div
        :key="view.chapter"
        class="path__field"
        :style="{ '--from': direction > 0 ? '1.75rem' : '-1.75rem' }"
      >
        <svg class="path__ways" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <path class="path__ahead" :d="ways.ahead" />
          <path class="path__lit" :d="ways.lit" />
        </svg>
        <ol class="path__levels">
          <li
            v-for="(entry, i) in view.levels"
            :key="entry.level.id"
            class="node"
            :class="`node--${entry.state}`"
            :data-family="entry.family"
            :style="{ '--x': `${points[i]![0]}%`, '--y': `${points[i]![1]}%` }"
          >
            <button
              type="button"
              class="node__button"
              :aria-label="nodeLabel(entry)"
              @click="open(entry.level, $event.currentTarget as Element)"
            >
              <span class="node__disc">
                <AppIcon v-if="entry.state === 'locked'" name="lock" :size="20" />
                <template v-else>{{ entry.level.id }}</template>
                <span class="node__mode" aria-hidden="true" />
              </span>
              <span class="node__label">{{ t(`modes.${entry.level.modeId}.name`) }}</span>
              <StarRow
                class="node__stars"
                :count="entry.stars"
                :label="t('campaign.starsWon', { n: entry.stars }, entry.stars)"
                :size="13"
              />
            </button>
          </li>
        </ol>
      </div>
    </div>

    <div class="map__foot">
      <button type="button" class="btn btn--raised map__shop" @click="shopOpen = true">
        <AppIcon name="star" :size="18" />
        <span>
          {{ t('upgrades.title') }}
          <template v-if="spare > 0">· {{ t('campaign.spare', { n: spare }, spare) }}</template>
        </span>
      </button>
    </div>

    <LevelDialog :level="selected" @play="play" @close="selected = null" />
    <UpgradesDialog :open="shopOpen" @close="shopOpen = false" />
  </section>
</template>

<style scoped>
.map__head {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-3);
  padding-bottom: var(--space-1);
}

.map__title {
  display: grid;
  justify-items: center;
  text-align: center;
}

.map__title small {
  color: var(--accent);
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.map__title h2 {
  font-size: clamp(1.1rem, 5.6cqw, 1.6rem);
  font-weight: 900;
  line-height: 1.1;
}

.map__title span {
  color: var(--text-muted);
  font-size: 0.75rem;
}

.map__dots {
  display: flex;
  justify-content: center;
  gap: 0.375rem;
  padding-bottom: var(--space-1);
}

.map__dots i {
  width: 0.45rem;
  height: 0.45rem;
  border-radius: 50%;
  background: var(--border);
  transition:
    background-color 200ms ease,
    transform 200ms ease;
}

.map__dots i.on {
  background: var(--accent);
  transform: scale(1.25);
}

.path {
  position: relative;
  flex: 1;
  min-height: 0;
}

/* Inset by half a level's size, so the end levels stay whole. */
.path__field {
  position: absolute;
  inset: 2.9rem 2.6rem;
  animation: chapter-in 420ms var(--ease-out);
}

@keyframes chapter-in {
  from {
    opacity: 0;
    transform: translateX(var(--from));
  }
}

.path__ways {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.path__ways path {
  fill: none;
  stroke-width: 4;
  stroke-linecap: round;
  vector-effect: non-scaling-stroke;
}

.path__lit {
  stroke: var(--accent);
  filter: drop-shadow(0 0 4px color-mix(in srgb, var(--rift-glow) 60%, transparent));
}

.path__ahead {
  stroke: var(--well-frame);
  stroke-dasharray: 2 9;
}

.path__levels {
  margin: 0;
  padding: 0;
  list-style: none;
}

.node {
  --family: var(--jewel-violet);
  position: absolute;
  left: var(--x);
  top: var(--y);
  transform: translate(-50%, -50%);
}

.node[data-family='sand'] {
  --family: var(--jewel-amber);
}

.node[data-family='placement'] {
  --family: var(--jewel-rose);
}

.node[data-family='volume'] {
  --family: var(--jewel-cyan);
}

.node__button {
  display: grid;
  justify-items: center;
  gap: 0.2rem;
  padding: 0;
  border: 0;
  background: none;
  color: var(--text);
  transition: transform 200ms var(--ease-out);
}

.node__button:active {
  transform: scale(0.94);
}

.node__disc {
  position: relative;
  display: grid;
  place-items: center;
  width: 3.5rem;
  height: 3.5rem;
  border-radius: 50%;
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--surface-2) 78%, var(--jewel-violet)),
    var(--surface-2)
  );
  box-shadow:
    0 4px 0 var(--surface-edge),
    inset 0 2px 0 var(--highlight),
    0 0 0 2px var(--well-frame);
  font-family: var(--font-display);
  font-size: 0.95rem;
  font-weight: 900;
}

.node__mode {
  position: absolute;
  right: -0.4rem;
  bottom: -0.25rem;
  width: 1.35rem;
  height: 1.35rem;
  border-radius: 0.45rem;
  background: var(--family);
  box-shadow: 0 0 0 2px var(--bg);
}

.node__label {
  color: var(--text-muted);
  font-size: 0.7rem;
  font-weight: 700;
}

.node__stars :deep(.star--on svg) {
  fill: currentColor;
}

.node--done .node__disc,
.node--current .node__disc {
  background: var(--accent-gradient);
  color: var(--on-accent-fill);
  box-shadow:
    0 4px 0 var(--accent-edge),
    inset 0 2px 0 var(--highlight-strong);
}

.node--current .node__disc {
  box-shadow:
    0 4px 0 var(--accent-edge),
    inset 0 2px 0 var(--highlight-strong),
    0 0 0 4px color-mix(in srgb, var(--accent) 35%, transparent);
}

/* The next level calls: a ring that keeps rippling out of it. */
.node--current .node__disc::after {
  content: '';
  position: absolute;
  inset: -0.55rem;
  border: 2px solid color-mix(in srgb, var(--accent) 70%, transparent);
  border-radius: 50%;
  animation: ping 1.8s ease-out infinite;
}

@keyframes ping {
  from {
    opacity: 0.9;
    transform: scale(0.9);
  }

  to {
    opacity: 0;
    transform: scale(1.35);
  }
}

.node--current .node__label {
  color: var(--text);
}

.node--locked .node__disc {
  background: var(--surface);
  color: var(--text-muted);
  box-shadow:
    0 4px 0 var(--surface-edge),
    0 0 0 2px var(--border);
}

.node--locked .node__mode {
  opacity: 0.4;
}

.map__foot {
  display: flex;
  justify-content: center;
  padding-top: var(--space-2);
}

.map__shop :deep(svg) {
  color: var(--accent);
  fill: currentColor;
}

/* Large screens: larger levels on the longer path. */
@container hub (min-width: 64rem) and (min-height: 46rem) {
  .node__disc {
    width: 4.25rem;
    height: 4.25rem;
    font-size: 1.1rem;
  }

  .node__label {
    font-size: 0.8rem;
  }
}

/* Short screens: smaller levels, the chapter's stars in the dots only. */
@container hub (max-height: 26rem) {
  .map__title span {
    display: none;
  }

  .node__disc {
    width: 3rem;
    height: 3rem;
  }

  .path__field {
    inset: 2.6rem 2.4rem;
  }
}
</style>

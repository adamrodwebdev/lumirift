<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue';
import { useI18n } from 'vue-i18n';
import { useServices } from '@/app/AppServices';
import { useFormat } from '@/app/useFormat';
import { levelOpening } from '@/campaign/ModeUnlocks';
import { allowsMode } from '@/platform/Edition';
import type { ModeDescriptor } from '@/session/ModeCatalog';
import type { ModeId } from '@/session/ModeId';
import AppIcon from '../components/AppIcon.vue';
import VariantDialog from '../components/VariantDialog.vue';
import GemCanvas from './GemCanvas.vue';

/**
 * Every mode on one screen: the Rift Race on a banner (1.34), the four no
 * other game has, large, then the nine falling variants. A tile shows its
 * mode below; Play starts it (a duel asks for its opponent first). A mode
 * may wait for the full game (the demo) or for a level of the campaign.
 */
const emit = defineEmits<{ play: [modeId: ModeId, variant: string | null, origin: Element] }>();

const { t } = useI18n();
const format = useFormat();
const { catalog, scores, platform, campaign } = useServices();

/** The race, on its banner above the tiles. */
const BANNER: ModeId = 'race';
/** The modes no other game has come first, large. */
const FEATURED: readonly ModeId[] = ['sand', 'tower', 'mosaic', 'duel'];

/** Why a mode waits: the full game (the demo's), or the level of the campaign that opens it. */
type Lock = { readonly kind: 'edition' } | { readonly kind: 'campaign'; readonly level: string };

const lockOf = (mode: ModeDescriptor): Lock | null => {
  if (!allowsMode(platform.edition, mode.id)) return { kind: 'edition' };
  const opening = levelOpening(mode.id);
  return opening && !campaign.model.isUnlocked(opening)
    ? { kind: 'campaign', level: opening.id }
    : null;
};

const entryOf = (mode: ModeDescriptor) => {
  const lock = lockOf(mode);
  return {
    mode,
    featured: FEATURED.includes(mode.id),
    lock,
    locked: lock !== null,
    best: scores.best(mode.id),
  };
};

const banner = computed(() => entryOf(catalog.get(BANNER)));
const modes = computed(() => {
  // A mode on test (Dunes) is not shown at all where the build does not open it.
  const all = catalog
    .list()
    .filter((mode) => !mode.prototype || allowsMode(platform.edition, mode.id));
  const ordered = [
    ...FEATURED.map((id) => all.find((mode) => mode.id === id)!),
    ...all.filter((mode) => !FEATURED.includes(mode.id) && mode.id !== BANNER),
  ];
  return ordered.map(entryOf);
});

const selectedId = ref<ModeId>(FEATURED[0]!);
const selected = computed(() =>
  selectedId.value === BANNER
    ? banner.value
    : modes.value.find((entry) => entry.mode.id === selectedId.value)!,
);
/** What the detail says of a mode that waits. */
const lockText = (lock: Lock): string =>
  lock.kind === 'edition' ? t('demo.fullGame') : t('race.locked', { level: lock.level });

/** A mode with variants (the duel) asks which one before starting. */
const choosing = shallowRef<ModeDescriptor | null>(null);
let origin: Element | null = null;
const play = (button: Element) => {
  const { mode, locked } = selected.value;
  if (locked) return;
  origin = button;
  if (mode.variants) choosing.value = mode;
  else emit('play', mode.id, null, button);
};
const onVariant = (variant: string) => {
  const mode = choosing.value;
  choosing.value = null;
  if (mode && origin) emit('play', mode.id, variant, origin);
};
</script>

<template>
  <section class="page modes">
    <!-- The race's banner: its own line under the title (portrait), beside it (landscape). -->
    <header class="page__head modes__head">
      <h2 class="page__title">{{ t('hub.tabs.modes') }}</h2>
      <p class="page__lead">{{ t('title.tagline') }}</p>
      <button
        type="button"
        class="tile tile--banner"
        :class="{ 'tile--locked': banner.locked }"
        data-family="rift"
        :aria-pressed="selectedId === banner.mode.id"
        @click="selectedId = banner.mode.id"
      >
        <GemCanvas class="tile__art" :mode="banner.mode.id" />
        <span class="tile__text">
          <span class="tile__name">{{ t(`modes.${banner.mode.id}.name`) }}</span>
          <span class="tile__line">
            {{ banner.lock ? lockText(banner.lock) : t(`modes.${banner.mode.id}.tagline`) }}
          </span>
        </span>
        <AppIcon v-if="banner.locked" name="lock" :size="14" class="tile__lock" />
        <span v-else-if="banner.best === null" class="tile__new">{{ t('race.new') }}</span>
      </button>
    </header>

    <div class="modes__grid">
      <button
        v-for="entry in modes"
        :key="entry.mode.id"
        type="button"
        class="tile"
        :class="{ 'tile--big': entry.featured, 'tile--locked': entry.locked }"
        :data-family="entry.mode.family"
        :aria-pressed="selectedId === entry.mode.id"
        @click="selectedId = entry.mode.id"
      >
        <GemCanvas class="tile__art" :mode="entry.mode.id" />
        <span class="tile__name">{{ t(`modes.${entry.mode.id}.name`) }}</span>
        <AppIcon v-if="entry.locked" name="lock" :size="14" class="tile__lock" />
      </button>
    </div>

    <div class="detail" aria-live="polite">
      <div class="detail__text">
        <h3 class="detail__name">{{ t(`modes.${selected.mode.id}.name`) }}</h3>
        <p class="detail__pitch">{{ t(`modes.${selected.mode.id}.pitch`) }}</p>
        <p class="detail__best">
          <template v-if="selected.lock">{{ lockText(selected.lock) }}</template>
          <template v-else-if="selected.best !== null">
            {{ t('home.best', { value: format.result(selected.mode.result, selected.best) }) }}
          </template>
          <template v-else>{{ t('home.noBest') }}</template>
        </p>
      </div>
      <button
        type="button"
        class="btn btn--primary btn--raised detail__play"
        :disabled="selected.locked"
        @click="play($event.currentTarget as Element)"
      >
        <AppIcon name="play" :size="20" />{{ t('home.play') }}
      </button>
    </div>

    <VariantDialog :mode="choosing" @choose="onVariant" @close="choosing = null" />
  </section>
</template>

<style scoped>
/*
 * Portrait: the race's banner, two rows of large tiles, three rows of small
 * ones, then the detail. A tile never gets under a thumb's size (44 px).
 */
.modes__grid {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  grid-template-rows: repeat(2, minmax(var(--touch), 1.3fr)) repeat(3, minmax(var(--touch), 1fr));
  gap: var(--space-2);
}

/* The smallest phones (320 × 568): tighter gaps keep the five rows on screen. */
@container hub (orientation: portrait) and (height < 36rem) {
  .modes__grid {
    gap: 0.375rem;
  }
}

.tile {
  --family: var(--jewel-violet);
  position: relative;
  grid-column: span 2;
  min-height: 0;
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
  gap: 0.15rem;
  padding: var(--space-2) var(--space-1);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: linear-gradient(180deg, var(--surface-2), var(--surface));
  box-shadow:
    inset 0 1px 0 var(--highlight),
    0 4px 0 var(--surface-edge);
  color: var(--text);
  transition:
    transform 160ms ease,
    box-shadow 160ms ease,
    border-color 160ms ease;
}

.tile::before {
  content: '';
  position: absolute;
  inset: -1px 22% auto;
  height: 3px;
  border-radius: 0 0 3px 3px;
  background: var(--family);
}

.tile[data-family='sand'] {
  --family: var(--jewel-amber);
}

.tile[data-family='placement'] {
  --family: var(--jewel-rose);
}

.tile[data-family='volume'] {
  --family: var(--jewel-cyan);
}

/* The header holds the race's banner: on a line of its own unless there is room beside the title. */
.modes__head {
  flex-wrap: wrap;
  align-items: center;
}

/* The race: its banner across the page, the art beside its name and its line. */
.tile--banner {
  --family: var(--rift-glow);
  container: race-banner / inline-size;
  flex: 1 0 100%;
  min-width: 0;
  grid-template-columns: auto minmax(0, 1fr);
  grid-template-rows: none;
  align-items: center;
  gap: var(--space-3);
  min-height: calc(var(--touch) * 1.3);
  margin-bottom: var(--space-2);
  padding: var(--space-1) var(--space-4) var(--space-1) var(--space-2);
  background:
    radial-gradient(
      60% 140% at 0% 50%,
      color-mix(in srgb, var(--rift-glow) 22%, transparent),
      transparent 70%
    ),
    linear-gradient(180deg, var(--surface-2), var(--surface));
  text-align: start;
}

.tile--banner .tile__art {
  width: calc(var(--touch) * 1.6);
  height: calc(var(--touch) * 1.15);
}

.tile__text {
  display: grid;
  gap: 0.1rem;
  min-width: 0;
}

.tile--banner .tile__name {
  font-family: var(--font-display);
  font-size: 0.95rem;
  font-weight: 800;
}

.tile__line {
  overflow: hidden;
  color: var(--text-muted);
  font-size: 0.75rem;
  white-space: nowrap;
  text-overflow: ellipsis;
}

/* A narrow banner (beside the title of a small phone): the name takes the art's room. */
@container race-banner (width < 14rem) {
  .tile__art {
    display: none;
  }
}

/* Locked: the padlock at the banner's end, the words kept clear of it. */
.tile--banner.tile--locked {
  padding-right: calc(var(--space-4) + 14px);
}

.tile--banner .tile__lock {
  top: 50%;
  translate: 0 -50%;
}

.tile__new {
  position: absolute;
  top: var(--space-2);
  right: var(--space-2);
  padding: 0.05rem 0.45rem;
  border-radius: 999px;
  background: var(--accent-gradient);
  color: var(--on-accent-fill);
  font-size: 0.65rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.tile--big {
  grid-column: span 3;
}

.tile__art {
  min-height: 0;
}

.tile__name {
  overflow: hidden;
  font-size: 0.72rem;
  font-weight: 700;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.tile--big .tile__name {
  font-family: var(--font-display);
  font-size: 0.82rem;
  font-weight: 800;
}

.tile--locked .tile__art {
  opacity: 0.35;
}

.tile__lock {
  position: absolute;
  top: var(--space-2);
  right: var(--space-2);
  color: var(--text-muted);
}

.tile[aria-pressed='true'] {
  border-color: var(--accent);
  box-shadow:
    0 0 0 2px color-mix(in srgb, var(--accent) 50%, transparent),
    0 4px 0 var(--surface-edge),
    0 0.6rem 1.6rem color-mix(in srgb, var(--rift-glow) 22%, transparent);
  transform: translateY(-2px);
}

.tile:active {
  transform: translateY(2px);
  box-shadow:
    inset 0 1px 0 var(--highlight),
    0 1px 0 var(--surface-edge);
}

.detail {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-3);
  margin-top: var(--space-2);
  padding: var(--space-3) var(--space-3) var(--space-3) var(--space-4);
  border: 1px solid var(--border);
  border-radius: 1.25rem;
  background: color-mix(in srgb, var(--bg) 82%, transparent);
}

/* A long name (Renversement, Переворот) breaks rather than spills on the Play button. */
.detail__name {
  font-size: clamp(0.95rem, 0.7rem + 1.2vw, 1.05rem);
  overflow-wrap: break-word;
  hyphens: auto;
}

.detail__pitch {
  margin-top: 0.2rem;
  font-size: 0.82rem;
  line-height: 1.35;
  color: var(--text-muted);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.detail__best {
  margin-top: 0.2rem;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--accent);
}

/*
 * A short screen (its header's lead hidden then): the race's banner joins the
 * title's row, on one line, so that the tiles and Play keep their room.
 */
@container hub (max-height: 44rem) {
  .tile--banner {
    flex: 1 1 0;
    min-height: var(--touch);
    margin-bottom: 0;
    padding-block: 0;
  }

  .tile--banner .tile__line,
  .tile--banner .tile__new {
    display: none;
  }

  /* The name whole, on two lines if need be, before the art. */
  .tile--banner .tile__name {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    font-size: 0.85rem;
    line-height: 1.1;
    white-space: normal;
  }

  .tile--banner .tile__art {
    width: calc(var(--touch) * 0.8);
    height: calc(var(--touch) * 0.7);
  }
}

/* Short phones: the pitch on one line, the room goes to the tiles. */
@container hub (max-height: 42rem) {
  .detail__pitch {
    -webkit-line-clamp: 1;
  }
}

/* Landscape: the four large tiles in a square on the left, the nine small ones on the right. */
@media (orientation: landscape) {
  /* The race's banner beside the page's title, in the room the header leaves: the tiles keep theirs. */
  .tile--banner {
    flex: 1 1 0;
    min-height: var(--touch);
    margin-bottom: 0;
    padding-block: 0.1rem;
  }

  .tile--banner .tile__art {
    width: calc(var(--touch) * 1.2);
    height: calc(var(--touch) * 0.85);
  }

  .modes__grid {
    grid-template-columns: repeat(12, minmax(0, 1fr));
    grid-template-rows: repeat(6, minmax(0, 1fr));
  }

  .tile:nth-child(1) {
    grid-area: 1 / 1 / 4 / 4;
  }

  .tile:nth-child(2) {
    grid-area: 1 / 4 / 4 / 7;
  }

  .tile:nth-child(3) {
    grid-area: 4 / 1 / 7 / 4;
  }

  .tile:nth-child(4) {
    grid-area: 4 / 4 / 7 / 7;
  }

  .tile:nth-child(n + 5) {
    grid-column: span 2;
    grid-row: span 2;
  }

  .detail {
    padding-block: var(--space-2);
  }

  .detail__pitch {
    -webkit-line-clamp: 1;
  }
}
/*
 * A tiny window (a 400 % zoom, 320 × 256): the portrait grid, every tile at a
 * thumb's size; the page scrolls (hub.css).
 */
@container hub (height < 20rem) {
  .modes__grid {
    flex: none;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    grid-template-rows: none;
    grid-auto-rows: minmax(var(--touch), auto);
  }

  .modes__grid .tile {
    grid-area: auto;
    grid-column: span 2;
  }

  .modes__grid .tile--big {
    grid-column: span 3;
  }
}
</style>

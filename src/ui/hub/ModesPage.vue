<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue';
import { useI18n } from 'vue-i18n';
import { useServices } from '@/app/AppServices';
import { useFormat } from '@/app/useFormat';
import { allowsMode } from '@/platform/Edition';
import type { ModeDescriptor } from '@/session/ModeCatalog';
import type { ModeId } from '@/session/ModeId';
import AppIcon from '../components/AppIcon.vue';
import VariantDialog from '../components/VariantDialog.vue';
import GemCanvas from './GemCanvas.vue';

/**
 * Every mode on one screen: the four no other game has, large, then the
 * nine falling variants. A tile shows its mode below; Play starts it (a
 * duel asks for its opponent first).
 */
const emit = defineEmits<{ play: [modeId: ModeId, variant: string | null, origin: Element] }>();

const { t } = useI18n();
const format = useFormat();
const { catalog, scores, platform } = useServices();

/** The modes no other game has come first, large. */
const FEATURED: readonly ModeId[] = ['sand', 'tower', 'mosaic', 'duel'];

const modes = computed(() => {
  const all = catalog.list();
  const ordered = [
    ...FEATURED.map((id) => all.find((mode) => mode.id === id)!),
    ...all.filter((mode) => !FEATURED.includes(mode.id)),
  ];
  return ordered.map((mode) => ({
    mode,
    featured: FEATURED.includes(mode.id),
    locked: !allowsMode(platform.edition, mode.id),
    best: scores.best(mode.id),
  }));
});

const selectedId = ref<ModeId>(FEATURED[0]!);
const selected = computed(() => modes.value.find((entry) => entry.mode.id === selectedId.value)!);

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
    <header class="page__head">
      <h2 class="page__title">{{ t('hub.tabs.modes') }}</h2>
      <p class="page__lead">{{ t('title.tagline') }}</p>
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
          <template v-if="selected.locked">{{ t('demo.fullGame') }}</template>
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
/* Portrait: two rows of large tiles, three rows of small ones, then the detail. */
.modes__grid {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  grid-template-rows: repeat(2, minmax(0, 1.3fr)) repeat(3, minmax(0, 1fr));
  gap: var(--space-2);
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

/* Short phones: the pitch on one line, the room goes to the tiles. */
@container hub (max-height: 42rem) {
  .detail__pitch {
    -webkit-line-clamp: 1;
  }
}

/* Landscape: the four large tiles in a square on the left, the nine small ones on the right. */
@media (orientation: landscape) {
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
</style>

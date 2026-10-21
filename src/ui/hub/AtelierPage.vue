<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useServices } from '@/app/AppServices';
import {
  COSMETIC_KINDS,
  COSMETICS,
  cosmeticKey,
  type Cosmetic,
  type CosmeticKind,
  type MaterialId,
  type ShatterId,
} from '@/progression/Cosmetics';
import { newCosmetics } from '@/progression/Profile';
import AppIcon from '../components/AppIcon.vue';
import { useProgressText } from '../useProgressText';
import { isTouchScreen } from '../useOrientation';
import type { GemArt } from './GemArt';
import GemCanvas from './GemCanvas.vue';
import { ambianceWave } from './ambianceWave';
import { loadGemArt } from './loadArt';

/**
 * The Atelier: a stage that shows a look before it is worn, over a shelf of
 * every cosmetic. A first tap tries a look on the stage, a second wears it;
 * a locked one says how to earn it. Nothing here changes the game. Looks
 * earned since the last visit are marked new until the player has seen them.
 */
const props = defineProps<{
  /** Shown (its tab chosen): what is on the shelf then has been seen. */
  active: boolean;
}>();

const { t } = useI18n();
const { profile } = useServices();
const text = useProgressText();
const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const again = t(isTouchScreen() ? 'cosmetics.tapToWear' : 'cosmetics.clickToWear');

const kind = ref<CosmeticKind>('material');
/** The look tried on the stage, per kind; the worn one until another is tried. */
const trying = ref<Partial<Record<CosmeticKind, string>>>({});
const status = ref('');

const worn = computed(() => profile.current.equipment);
const shownId = computed(() => trying.value[kind.value] ?? worn.value[kind.value]);

// --- New looks: earned, not seen yet ------------------------------------------

const fresh = computed(() => new Set(newCosmetics(profile.current).map(cosmeticKey)));
const isNew = (cosmetic: Cosmetic) => fresh.value.has(cosmeticKey(cosmetic));
const kindIsNew = (id: CosmeticKind) =>
  COSMETICS.some((cosmetic) => cosmetic.kind === id && isNew(cosmetic));
/** The new looks of a kind have been on the shelf: they are not new any more. */
const seeKind = (id: CosmeticKind) =>
  profile.markSeen(COSMETICS.filter((cosmetic) => cosmetic.kind === id && isNew(cosmetic)));

watch(
  () => props.active,
  (active, was) => {
    // The shelf opens on a kind with something new; leaving, the player has seen it.
    if (active) kind.value = COSMETIC_KINDS.find(kindIsNew) ?? kind.value;
    else if (was) seeKind(kind.value);
  },
  { immediate: true },
);
onBeforeUnmount(() => {
  if (props.active) seeKind(kind.value);
});

interface ShelfItem {
  readonly cosmetic: Cosmetic;
  readonly unlocked: boolean;
  readonly worn: boolean;
  readonly shown: boolean;
  readonly isNew: boolean;
}
const items = computed<ShelfItem[]>(() =>
  COSMETICS.filter((cosmetic) => cosmetic.kind === kind.value).map((cosmetic) => ({
    cosmetic,
    unlocked: profile.model.isUnlocked(cosmetic),
    worn: worn.value[kind.value] === cosmetic.id,
    shown: shownId.value === cosmetic.id,
    isNew: isNew(cosmetic),
  })),
);
const shown = computed(() => items.value.find((item) => item.shown) ?? items.value[0]!);

/** What an item says under its name: worn, wear it, or how to earn it. */
const note = (item: ShelfItem): string =>
  item.worn
    ? t('cosmetics.worn')
    : !item.unlocked
      ? text.unlockRule(item.cosmetic)
      : item.shown
        ? again
        : t('cosmetics.wear');

/** What a screen reader says of an item: its name, new or not, its note. */
const itemLabel = (item: ShelfItem): string =>
  [text.cosmeticName(item.cosmetic), item.isNew ? t('cosmetics.new') : null, note(item)]
    .filter(Boolean)
    .join(', ');

/** The same, shorter, under an item on the shelf (the stage says the rest). */
const shortNote = (item: ShelfItem): string =>
  item.shown && item.unlocked && !item.worn ? t('cosmetics.trying') : note(item);

const setKind = (next: CosmeticKind) => {
  if (next !== kind.value && props.active) seeKind(kind.value);
  kind.value = next;
  status.value = '';
};

const nudge = (element: HTMLElement, keyframes: Keyframe[], duration: number) => {
  if (!still) element.animate(keyframes, { duration, easing: 'ease-out' });
};

const choose = (item: ShelfItem, element: HTMLElement) => {
  const { cosmetic } = item;
  if (item.isNew) profile.markSeen([cosmetic]);
  const name = text.cosmeticName(cosmetic);
  const second = item.shown;
  trying.value = { ...trying.value, [cosmetic.kind]: cosmetic.id };
  if (!item.unlocked) {
    status.value = t('cosmetics.unlocksWith', { name, rule: text.unlockRule(cosmetic) });
    nudge(
      element,
      [
        { transform: 'translateX(0)' },
        { transform: 'translateX(-4px)' },
        { transform: 'translateX(4px)' },
        { transform: 'translateX(-4px)' },
        { transform: 'translateX(0)' },
      ],
      360,
    );
    return;
  }
  if (item.worn || !second) {
    status.value = '';
    return;
  }
  profile.equip(cosmetic.kind, cosmetic.id);
  if (cosmetic.kind === 'ambiance') ambianceWave(cosmetic.id, element);
  // An ambiance shows at once around the menu; the others in the game.
  status.value = t(cosmetic.kind === 'ambiance' ? 'cosmetics.nowWorn' : 'cosmetics.nowWornGame', {
    name,
  });
};

// --- The stage: a small well wearing the look -------------------------------

const stage = ref<HTMLCanvasElement | null>(null);
let art: GemArt | null = null;
const material = computed(
  () => (kind.value === 'material' ? shownId.value : worn.value.material) as MaterialId,
);
const shatter = computed(() => (kind.value === 'shatter' ? (shownId.value as ShatterId) : null));
const ambiance = computed(() => (kind.value === 'ambiance' ? shownId.value : worn.value.ambiance));

const draw = () => {
  if (art && stage.value) art.drawStage(stage.value, material.value, shatter.value);
};
const observer = new ResizeObserver(draw);
onMounted(async () => {
  if (stage.value) observer.observe(stage.value);
  art = await loadGemArt();
  draw();
});
onBeforeUnmount(() => observer.disconnect());
watch([material, shatter, ambiance], async () => {
  await nextTick();
  draw();
  if (stage.value)
    nudge(
      stage.value,
      [
        { transform: 'scale(0.94)', opacity: 0.4 },
        { transform: 'none', opacity: 1 },
      ],
      420,
    );
});
</script>

<template>
  <section class="page atelier">
    <header class="page__head">
      <h2 class="page__title">{{ t('cosmetics.title') }}</h2>
      <p class="page__lead">{{ t('hub.atelierLead') }}</p>
    </header>

    <div class="atelier__body">
      <div class="showcase" :data-ambiance-preview="ambiance">
        <canvas ref="stage" class="showcase__canvas" aria-hidden="true" />
        <p class="showcase__label">
          <b>{{ text.cosmeticName(shown.cosmetic) }}</b>
          <span>{{ note(shown) }}</span>
        </p>
      </div>

      <div class="shelf">
        <div class="kinds" role="group" :aria-label="t('hub.kindsLabel')">
          <button
            v-for="id in COSMETIC_KINDS"
            :key="id"
            type="button"
            :aria-pressed="kind === id"
            @click="setKind(id)"
          >
            {{ t(`hub.kinds.${id}`) }}
            <span v-if="kindIsNew(id)" class="kinds__new">
              <span class="sr-only">{{ t('cosmetics.new') }}</span>
            </span>
          </button>
        </div>

        <div class="items" :class="{ 'items--four': items.length === 4 }">
          <button
            v-for="item in items"
            :key="item.cosmetic.id"
            type="button"
            class="item"
            :class="{
              'item--shown': item.shown && !item.worn,
              'item--locked': !item.unlocked,
            }"
            :aria-pressed="item.worn"
            :aria-label="itemLabel(item)"
            @click="choose(item, $event.currentTarget as HTMLElement)"
          >
            <GemCanvas
              v-if="kind === 'material'"
              class="item__art"
              :material="item.cosmetic.id as MaterialId"
            />
            <span
              v-else-if="kind === 'ambiance'"
              class="item__art item__ambiance"
              :data-ambiance-preview="item.cosmetic.id"
            />
            <GemCanvas v-else class="item__art" :shatter="item.cosmetic.id as ShatterId" />
            <b>{{ text.cosmeticName(item.cosmetic) }}</b>
            <small>{{ shortNote(item) }}</small>
            <span v-if="!item.unlocked" class="item__lock" aria-hidden="true">
              <AppIcon name="lock" :size="15" />
            </span>
            <span v-if="item.isNew" class="item__new" aria-hidden="true">
              {{ t('cosmetics.new') }}
            </span>
          </button>
        </div>

        <p class="status">
          <span aria-live="polite">{{ status }}</span>
          <!-- Until something happens: where this kind of look shows. -->
          <span v-if="!status && kind !== 'ambiance'">{{ t(`cosmetics.scope.${kind}`) }}</span>
        </p>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* Portrait: the stage above, the shelf below; nothing to scroll. */
.atelier__body {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
  gap: var(--space-3);
}

.showcase {
  position: relative;
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
  min-height: 0;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 1.4rem;
  background:
    radial-gradient(70% 80% at 22% 18%, var(--glow-1), transparent 70%),
    radial-gradient(70% 80% at 82% 88%, var(--glow-2), transparent 70%),
    linear-gradient(180deg, var(--surface-2), var(--well-bg));
}

.showcase__canvas {
  display: block;
  width: 100%;
  height: 100%;
  min-height: 0;
}

.showcase__label {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: center;
  gap: 0.15rem var(--space-2);
  margin: 0 var(--space-3) var(--space-3);
  text-align: center;
}

.showcase__label b {
  font-family: var(--font-display);
  font-size: 0.9rem;
  line-height: 1.1;
}

.showcase__label span {
  color: var(--accent);
  font-size: 0.72rem;
  font-weight: 700;
}

.shelf {
  display: grid;
  gap: var(--space-2);
}

.kinds {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--space-1);
  padding: var(--space-1);
  border: 1px solid var(--border);
  border-radius: 1rem;
  background: var(--glass);
}

.kinds button {
  position: relative;
  min-height: var(--touch);
  padding: 0 0.4rem;
  border: 0;
  border-radius: 0.75rem;
  background: none;
  color: var(--text-muted);
  font-size: 0.82rem;
  font-weight: 800;
}

.kinds button[aria-pressed='true'] {
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--surface-2) 70%, var(--jewel-violet)),
    var(--surface-2)
  );
  color: var(--text);
  box-shadow:
    inset 0 1px 0 var(--highlight),
    0 0 0 1px color-mix(in srgb, var(--accent) 45%, transparent);
}

.items {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  grid-auto-rows: 5.5rem;
  gap: var(--space-2);
}

.items--four {
  grid-template-columns: repeat(4, minmax(0, 1fr));
  grid-auto-rows: 6rem;
}

.item {
  position: relative;
  min-height: 0;
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto auto;
  gap: 0.1rem;
  padding: var(--space-2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: linear-gradient(180deg, var(--surface-2), var(--surface));
  box-shadow:
    inset 0 1px 0 var(--highlight),
    0 4px 0 var(--surface-edge);
  color: var(--text);
  text-align: center;
  transition:
    transform 160ms var(--ease-out),
    border-color 160ms ease;
}

.item:active {
  transform: translateY(2px);
}

.item__art {
  min-height: 0;
  border-radius: 0.6rem;
}

.item__ambiance {
  display: block;
  background:
    radial-gradient(70% 80% at 25% 20%, var(--glow-1), transparent 70%),
    radial-gradient(70% 80% at 80% 90%, var(--glow-2), transparent 70%), var(--bg);
}

.item b {
  font-size: 0.75rem;
  line-height: 1.2;
}

.item small {
  overflow: hidden;
  color: var(--text-muted);
  font-size: 0.68rem;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.item[aria-pressed='true'] {
  border-color: var(--accent);
  box-shadow:
    0 0 0 2px color-mix(in srgb, var(--accent) 50%, transparent),
    0 4px 0 var(--surface-edge);
}

.item[aria-pressed='true'] small {
  color: var(--accent);
  font-weight: 800;
}

/* Tried on the stage, not worn yet. */
.item--shown {
  border-color: var(--jewel-violet);
  box-shadow:
    0 0 0 2px color-mix(in srgb, var(--jewel-violet) 55%, transparent),
    0 4px 0 var(--surface-edge);
}

.item--shown small {
  color: var(--text);
  font-weight: 700;
}

.item--locked .item__art {
  opacity: 0.35;
  filter: grayscale(0.6);
}

/* Something new: a pink dot on its kind, a chip on the item. */
.kinds__new {
  position: absolute;
  top: 0.45rem;
  right: 0.5rem;
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  background: var(--jewel-rose);
  box-shadow: 0 0 0.5rem color-mix(in srgb, var(--jewel-rose) 70%, transparent);
}

.item__new {
  position: absolute;
  top: var(--space-2);
  left: var(--space-2);
  padding: 0.1rem 0.4rem;
  border-radius: 999px;
  background: var(--jewel-rose);
  color: var(--bg);
  font-size: 0.6rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  box-shadow: 0 0.25rem 0.7rem color-mix(in srgb, var(--jewel-rose) 45%, transparent);
}

.item__lock {
  position: absolute;
  top: var(--space-2);
  right: var(--space-2);
  display: grid;
  place-items: center;
  width: 1.6rem;
  height: 1.6rem;
  border-radius: 0.5rem;
  background: color-mix(in srgb, var(--bg) 85%, transparent);
  color: var(--text-muted);
}

.status {
  min-height: 1.15rem;
  color: var(--text-muted);
  font-size: 0.78rem;
  text-align: center;
}

/* Short phones: a shorter shelf. */
@container hub (max-height: 42rem) {
  .items {
    grid-auto-rows: 4.6rem;
  }

  .items--four {
    grid-auto-rows: 5rem;
  }

  .item small {
    display: none;
  }
}

/* Landscape: the stage on the left, the shelf filling the right. */
@media (orientation: landscape) {
  .atelier__body {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr);
    grid-template-rows: minmax(0, 1fr);
  }

  .shelf {
    grid-template-rows: auto minmax(0, 1fr) auto;
    min-height: 0;
  }

  .items,
  .items--four {
    grid-auto-rows: minmax(0, 1fr);
    min-height: 0;
  }

  .items--four {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>

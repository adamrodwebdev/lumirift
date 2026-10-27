<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useServices } from '@/app/AppServices';
import { COLLECTIONS, type Collection } from '@/progression/Collections';
import {
  COSMETIC_KINDS,
  COSMETICS,
  cosmeticKey,
  findCosmeticByKey,
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
 * a locked one says how to earn it, and a locked material or ambiance may be
 * worn for one game for an ad the player chooses (1.31). Nothing here changes
 * the game. Looks earned since the last visit are marked new until the
 * player has seen them. The collections (1.35) show how far each set of
 * looks is, and the ambiance it unlocks once complete.
 */
const props = defineProps<{
  /** Shown (its tab chosen): what is on the shelf then has been seen. */
  active: boolean;
}>();

const { t } = useI18n();
const { profile, look, platform, ads, audio } = useServices();
const text = useProgressText();
const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const again = t(isTouchScreen() ? 'cosmetics.tapToWear' : 'cosmetics.clickToWear');

const kind = ref<CosmeticKind>('material');
/** The collections are on the shelf instead of a kind of look. */
const collecting = ref(false);
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
    unlocked: profile.isUnlocked(cosmetic),
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
  !item.unlocked
    ? text.unlockHint(item.cosmetic)
    : item.shown && !item.worn
      ? t('cosmetics.trying')
      : note(item);

const setKind = (next: CosmeticKind) => {
  if (next !== kind.value && props.active && !collecting.value) seeKind(kind.value);
  kind.value = next;
  collecting.value = false;
  status.value = '';
};

// --- The collections (1.35) ------------------------------------------------------

interface CollectionCard {
  readonly collection: Collection;
  readonly items: readonly { readonly cosmetic: Cosmetic; readonly owned: boolean }[];
  readonly done: number;
  readonly reward: Cosmetic;
  readonly complete: boolean;
}
const collections = computed<CollectionCard[]>(() =>
  COLLECTIONS.map((collection) => {
    const items = collection.items
      .map(findCosmeticByKey)
      .filter((cosmetic): cosmetic is Cosmetic => cosmetic !== undefined)
      .map((cosmetic) => ({ cosmetic, owned: profile.isUnlocked(cosmetic) }));
    const done = items.filter((item) => item.owned).length;
    return {
      collection,
      items,
      done,
      reward: findCosmeticByKey(`ambiance.${collection.reward}`)!,
      complete: done === items.length,
    };
  }),
);
const collectionId = ref(COLLECTIONS[0]!.id);
const card = computed(() =>
  collections.value.find((each) => each.collection.id === collectionId.value)!,
);
const collectionName = (entry: CollectionCard) => t(`collections.${entry.collection.id}.name`);
/** What a collection says: its progress, or its prize won. */
const collectionNote = (entry: CollectionCard) =>
  entry.complete
    ? t('collections.complete', { name: text.cosmeticName(entry.reward) })
    : t('collections.progress', {
        done: entry.done,
        total: entry.items.length,
        name: text.cosmeticName(entry.reward),
      });

const showCollections = () => {
  if (props.active && !collecting.value) seeKind(kind.value);
  collecting.value = true;
  status.value = '';
};
const chooseCollection = (entry: CollectionCard) => {
  collectionId.value = entry.collection.id;
  status.value = collectionNote(entry);
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

// --- A locked look for one game, for an ad (1.31) ---------------------------

const watching = ref(false);
/** A locked material or ambiance on the stage, where a rewarded ad may be offered. */
const canTry = computed(
  () =>
    !collecting.value &&
    !shown.value.unlocked &&
    shown.value.cosmetic.kind !== 'shatter' &&
    platform.supportsRewarded &&
    ads.rewardedAllowed,
);
/** The look on the stage is the one won for the next game. */
const tried = computed(() => look.trying === shown.value.cosmetic);

const tryOn = async () => {
  const { cosmetic } = shown.value;
  if (watching.value) return;
  watching.value = true;
  status.value = '';
  const watched = await platform.rewardedAd({
    onStart: () => audio.suspend(),
    onEnd: () => audio.resume(),
  });
  watching.value = false;
  if (!watched) {
    status.value = t('cosmetics.noAd');
    return;
  }
  ads.adShown();
  look.tryOn(cosmetic);
  status.value = t('cosmetics.tried', { name: text.cosmeticName(cosmetic) });
};

// --- The stage: a small well wearing the look -------------------------------

const stage = ref<HTMLCanvasElement | null>(null);
let art: GemArt | null = null;
const material = computed(
  () =>
    (kind.value === 'material' && !collecting.value
      ? shownId.value
      : worn.value.material) as MaterialId,
);
const shatter = computed(() =>
  kind.value === 'shatter' && !collecting.value ? (shownId.value as ShatterId) : null,
);
/** On the stage: the look tried, or a collection's prize. */
const ambiance = computed(() =>
  collecting.value
    ? card.value.collection.reward
    : kind.value === 'ambiance'
      ? shownId.value
      : worn.value.ambiance,
);

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
        <p v-if="collecting" class="showcase__label">
          <b>{{ collectionName(card) }}</b>
          <span>{{ collectionNote(card) }}</span>
        </p>
        <p v-else class="showcase__label">
          <b>{{ text.cosmeticName(shown.cosmetic) }}</b>
          <span>{{ note(shown) }}</span>
        </p>
        <button
          v-if="canTry || tried"
          type="button"
          class="btn btn--raised showcase__try"
          :disabled="watching || tried"
          :aria-label="
            tried ? undefined : t('cosmetics.tryLabel', { name: text.cosmeticName(shown.cosmetic) })
          "
          @click="tryOn"
        >
          <template v-if="tried">{{ t('cosmetics.triedShort') }}</template>
          <template v-else>
            <span class="showcase__ad" aria-hidden="true">
              <AppIcon name="play" :size="12" />{{ t('over.adBadge') }}
            </span>
            <span aria-hidden="true">{{ t('cosmetics.tryForGame') }}</span>
          </template>
        </button>
      </div>

      <div class="shelf">
        <div class="kinds" role="group" :aria-label="t('hub.kindsLabel')">
          <button
            v-for="id in COSMETIC_KINDS"
            :key="id"
            type="button"
            :aria-pressed="!collecting && kind === id"
            @click="setKind(id)"
          >
            {{ t(`hub.kinds.${id}`) }}
            <span v-if="kindIsNew(id)" class="kinds__new">
              <span class="sr-only">{{ t('cosmetics.new') }}</span>
            </span>
          </button>
          <button type="button" :aria-pressed="collecting" @click="showCollections">
            {{ t('hub.kinds.collections') }}
          </button>
        </div>

        <div v-if="collecting" class="collections">
          <button
            v-for="entry in collections"
            :key="entry.collection.id"
            type="button"
            class="collection"
            :class="{ 'collection--complete': entry.complete }"
            :aria-pressed="entry.collection.id === collectionId"
            :aria-label="`${collectionName(entry)}, ${collectionNote(entry)}`"
            @click="chooseCollection(entry)"
          >
            <b>{{ collectionName(entry) }}</b>
            <span class="collection__items" aria-hidden="true">
              <span
                v-for="item in entry.items"
                :key="cosmeticKey(item.cosmetic)"
                class="collection__item"
                :class="{ 'collection__item--owned': item.owned }"
              >
                <GemCanvas
                  v-if="item.cosmetic.kind === 'material'"
                  class="collection__art"
                  :material="item.cosmetic.id as MaterialId"
                />
                <span
                  v-else-if="item.cosmetic.kind === 'ambiance'"
                  class="collection__art item__ambiance"
                  :data-ambiance-preview="item.cosmetic.id"
                />
                <GemCanvas
                  v-else
                  class="collection__art"
                  :shatter="item.cosmetic.id as ShatterId"
                />
              </span>
            </span>
            <span class="collection__bar" aria-hidden="true">
              <i :style="{ transform: `scaleX(${entry.done / entry.items.length})` }" />
            </span>
            <small aria-hidden="true">
              {{ entry.done }}/{{ entry.items.length }} · {{ text.cosmeticName(entry.reward) }}
            </small>
          </button>
        </div>

        <div
          v-else
          class="items"
          :class="{ 'items--four': items.length === 4, 'items--wide': items.length > 9 }"
        >
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
          <!-- Until something happens: where this kind of look shows (a collection's prize). -->
          <span v-if="!status && collecting">{{ t('collections.lead') }}</span>
          <span v-else-if="!status && kind !== 'ambiance'">{{ t(`cosmetics.scope.${kind}`) }}</span>
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

/* A locked look for one game: an option, labelled as an ad, in the stage's corner. */
.showcase__try {
  position: absolute;
  top: var(--space-2);
  right: var(--space-2);
  gap: 0.4rem;
  min-height: 2.75rem;
  max-width: calc(100% - 2 * var(--space-2));
  font-size: 0.8rem;
  font-weight: 800;
}

.showcase__try:disabled {
  opacity: 0.8;
  cursor: default;
}

.showcase__ad {
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
  grid-template-columns: repeat(4, minmax(0, 1fr));
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

/* Many looks of a kind (the ambiances, 1.35): four a row, so that the shelf keeps its height. */
.items--wide {
  grid-template-columns: repeat(4, minmax(0, 1fr));
  grid-auto-rows: 5rem;
}

/* The collections: four cards, two a row. */
.collections {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  grid-auto-rows: minmax(5.5rem, auto);
  gap: var(--space-2);
}

.collection {
  container: collection / inline-size;
  display: grid;
  align-content: center;
  gap: 0.35rem;
  min-width: 0;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: linear-gradient(180deg, var(--surface-2), var(--surface));
  box-shadow:
    inset 0 1px 0 var(--highlight),
    0 4px 0 var(--surface-edge);
  color: var(--text);
  text-align: start;
}

.collection[aria-pressed='true'] {
  border-color: var(--jewel-violet);
  box-shadow:
    0 0 0 2px color-mix(in srgb, var(--jewel-violet) 55%, transparent),
    0 4px 0 var(--surface-edge);
}

.collection--complete {
  border-color: var(--accent);
}

/* A set's name and prize wrap rather than lose a word (Russian runs long). */
.collection b {
  font-size: 0.8rem;
  line-height: 1.2;
  text-wrap: balance;
}

.collection small {
  color: var(--text-muted);
  font-size: 0.7rem;
  line-height: 1.25;
}

.collection__items {
  display: flex;
  gap: 0.25rem;
}

.collection__item {
  flex: 1 1 0;
  min-width: 0;
  max-width: 2.75rem;
  aspect-ratio: 1;
  border-radius: 0.45rem;
  opacity: 0.35;
  filter: grayscale(0.7);
}

.collection__item--owned {
  opacity: 1;
  filter: none;
}

.collection__art {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: 0.45rem;
}

/* A small ambiance swatch shows its lights at full strength (the shelf's large ones stay true). */
.collection__art.item__ambiance {
  background:
    radial-gradient(70% 80% at 25% 20%, rgb(from var(--glow-1) r g b / 0.85), transparent 75%),
    radial-gradient(70% 80% at 80% 90%, rgb(from var(--glow-2) r g b / 0.85), transparent 75%),
    var(--bg);
}

.collection__bar {
  height: 0.3rem;
  overflow: hidden;
  border-radius: 999px;
  background: var(--well-bg);
}

.collection__bar i {
  display: block;
  height: 100%;
  background: var(--accent-gradient);
  transform-origin: left;
}

/* A wide card (a desktop): its name reads larger. */
@container collection (inline-size >= 12rem) {
  .collection b {
    font-size: 0.95rem;
  }

  .collection small {
    font-size: 0.78rem;
  }
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

/* How to earn a look takes two lines when it needs them (a Guardian's name). */
.item small {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  color: var(--text-muted);
  font-size: 0.68rem;
  line-height: 1.2;
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

/*
 * A card too short for its art (a short screen on its side) is its name
 * alone: a locked one dims it rather than hiding its end under the lock.
 */
.item {
  container-type: size;
}

@container (max-height: 3rem) {
  .item__lock {
    display: none;
  }

  .item--locked b {
    color: var(--text-muted);
  }
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

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useFormat } from '@/app/useFormat';
import type { ModeDescriptor } from '@/session/ModeCatalog';
import type { FamilyId } from '@/session/ModeId';
import AppIcon from './AppIcon.vue';
import ModeArt from './ModeArt.vue';

/**
 * The modes as a swiper: a row of cards that snaps under the finger, the
 * mouse wheel or the keyboard, arrows on the sides, and family filters. It
 * is native scrolling (scroll-snap): no library, smooth on every phone.
 */
export interface CarouselMode extends ModeDescriptor {
  readonly best: number | null;
}

const props = defineProps<{ modes: readonly CarouselMode[] }>();
const emit = defineEmits<{ choose: [mode: CarouselMode] }>();

const { t } = useI18n();
const format = useFormat();

const FAMILIES: readonly (FamilyId | 'all')[] = ['all', 'falling', 'sand', 'placement', 'volume'];
const family = ref<FamilyId | 'all'>('all');
const shown = computed(() =>
  family.value === 'all' ? props.modes : props.modes.filter((mode) => mode.family === family.value),
);

const track = ref<HTMLElement | null>(null);
const atStart = ref(true);
const atEnd = ref(false);
const progress = ref(0);

const update = () => {
  const el = track.value;
  if (!el) return;
  const max = el.scrollWidth - el.clientWidth;
  atStart.value = el.scrollLeft <= 4;
  atEnd.value = el.scrollLeft >= max - 4;
  progress.value = max <= 0 ? 1 : el.scrollLeft / max;
};

/** One page of cards to the side (most of the visible width). */
const page = (direction: -1 | 1) => {
  const el = track.value;
  if (!el) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollBy({ left: direction * el.clientWidth * 0.85, behavior: reduce ? 'auto' : 'smooth' });
};

watch(family, async () => {
  await nextTick();
  track.value?.scrollTo({ left: 0 });
  update();
});

const observer = new ResizeObserver(update);
onMounted(() => {
  if (track.value) observer.observe(track.value);
  update();
});
onBeforeUnmount(() => observer.disconnect());
</script>

<template>
  <section class="carousel" aria-labelledby="modes-title">
    <div class="carousel__head">
      <h2 id="modes-title" class="section-title">{{ t('home.modes') }}</h2>
      <div class="carousel__arrows">
        <button
          type="button"
          class="btn btn--icon"
          :aria-label="t('carousel.previous')"
          :disabled="atStart"
          @click="page(-1)"
        >
          <AppIcon name="left" :size="20" />
        </button>
        <button
          type="button"
          class="btn btn--icon"
          :aria-label="t('carousel.next')"
          :disabled="atEnd"
          @click="page(1)"
        >
          <AppIcon name="right" :size="20" />
        </button>
      </div>
    </div>

    <div class="chips" role="group" :aria-label="t('carousel.filter')">
      <button
        v-for="id in FAMILIES"
        :key="id"
        type="button"
        class="chip"
        :aria-pressed="family === id"
        @click="family = id"
      >
        {{ t(`families.${id}`) }}
      </button>
    </div>

    <ul ref="track" class="track" @scroll.passive="update">
      <li v-for="mode in shown" :key="mode.id" class="slide">
        <button
          type="button"
          class="mode card"
          :class="`mode--${mode.family}`"
          @click="emit('choose', mode)"
        >
          <span class="mode__art"><ModeArt :mode="mode.id" /></span>
          <span class="mode__name">{{ t(`modes.${mode.id}.name`) }}</span>
          <span class="mode__pitch">{{ t(`modes.${mode.id}.pitch`) }}</span>
          <span class="mode__meta">
            <span class="mode__family">{{ t(`families.${mode.family}`) }}</span>
            <span v-if="mode.best !== null">
              {{ t('home.best', { value: format.result(mode.result, mode.best) }) }}
            </span>
          </span>
        </button>
      </li>
    </ul>

    <div class="progress" aria-hidden="true">
      <span class="progress__bar" :style="{ inlineSize: `${Math.max(12, progress * 100)}%` }" />
    </div>
  </section>
</template>

<style scoped>
.carousel {
  display: grid;
  gap: var(--space-3);
  min-width: 0;
}

.carousel__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.carousel__arrows {
  display: flex;
  gap: var(--space-2);
}

.carousel__arrows .btn:disabled {
  opacity: 0.4;
  cursor: default;
}

.chips {
  display: flex;
  gap: var(--space-2);
  overflow-x: auto;
  scrollbar-width: none;
}

.chip {
  flex: none;
  min-height: var(--touch);
  padding: 0 var(--space-4);
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface);
  font-weight: 650;
}

.chip[aria-pressed='true'] {
  border-color: transparent;
  background: var(--accent-gradient);
  color: var(--on-accent-fill);
}

.track {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: min(78%, 17rem);
  gap: var(--space-3);
  margin: 0;
  padding: var(--space-1) var(--space-1) var(--space-3);
  list-style: none;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  scroll-snap-type: x mandatory;
  scroll-padding-inline: var(--space-1);
  scrollbar-width: none;
}

.track::-webkit-scrollbar,
.chips::-webkit-scrollbar {
  display: none;
}

.slide {
  scroll-snap-align: start;
  display: flex;
}

.mode {
  --mode-color: var(--accent-fill);
  display: grid;
  grid-template-rows: auto auto 1fr auto;
  gap: var(--space-2);
  width: 100%;
  padding: var(--space-3) var(--space-3) var(--space-4);
  text-align: left;
  transition:
    transform 160ms ease,
    border-color 160ms ease;
}

.mode:hover {
  transform: translateY(-3px);
  border-color: var(--mode-color);
}

.mode--falling {
  --mode-color: var(--tone-2);
}
.mode--sand {
  --mode-color: var(--tone-9);
}
.mode--placement {
  --mode-color: var(--tone-7);
}
.mode--volume {
  --mode-color: var(--tone-13);
}

.mode__art {
  display: block;
  padding: var(--space-2);
  border-radius: var(--radius);
  background:
    radial-gradient(
      80% 90% at 50% 100%,
      color-mix(in srgb, var(--mode-color) 22%, transparent),
      transparent
    ),
    var(--well-bg);
}

.mode__name {
  font-family: var(--font-display);
  font-size: 1.2rem;
  font-weight: 800;
}

.mode__pitch {
  font-size: 0.9rem;
  color: var(--text-muted);
}

.mode__meta {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: var(--space-1) var(--space-2);
  font-size: 0.8rem;
  color: var(--text-muted);
}

.mode__family {
  font-weight: 700;
  color: var(--text);
}

.progress {
  block-size: 0.25rem;
  border-radius: 999px;
  background: var(--surface-2);
  overflow: hidden;
}

.progress__bar {
  display: block;
  block-size: 100%;
  border-radius: inherit;
  background: var(--accent-gradient);
}

@media (min-width: 768px) {
  .track {
    grid-auto-columns: 17rem;
  }
}
</style>

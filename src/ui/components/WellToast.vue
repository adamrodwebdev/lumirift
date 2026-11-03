<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { GuideLine, WellPoint } from '@/session/GameSession';
import { toastParts } from '../toastParts';
import GuideKeys from './GuideKeys.vue';
import { useWellBox } from './useWellBox';

/**
 * The game's words over the well (a clear, an element, a Guardian's move):
 * centred on the well's canvas, never wider than it, in a size that follows
 * the well (1.45.1: over a narrow well, the words spilled past its sides and
 * hid its middle). Without a canvas, they centre on the well's area.
 *
 * A message that opens on an exclamation shows it as its headline, the rest
 * under it (1.46: « Shock! » over « 780 grains broken… »). In the training,
 * the guide's line takes the same place whenever no message is shown, at the
 * top of the well, over the sand still empty there: one voice, never two
 * texts at once, and a deed's reward replaces its line at once (1.46). The
 * line fades while the piece in play passes behind it; a reward never does:
 * its moment is its first second, when the next piece comes in behind it.
 */
const props = withDefaults(
  defineProps<{
    toast: { readonly text: string; readonly key: number } | null;
    /** The well's canvas, which the words sit on. */
    well: HTMLElement | null;
    /** The training guide's line, shown while no message is, or null. */
    line?: GuideLine | null;
    /** In the middle of the well, or at its top (the training's). */
    place?: 'middle' | 'top';
    /** The centre of the piece in play, as shares of the well, or null. */
    piece?: WellPoint | null;
  }>(),
  { line: null, place: 'middle', piece: null },
);

const { t } = useI18n();
const layer = ref<HTMLElement | null>(null);
const { box: wellBox, boxStyle } = useWellBox(() => props.well, layer);

const parts = computed(() => toastParts(props.toast?.text ?? ''));

/**
 * The rows the line covers, as shares of the well's height (layout boxes: no animation in
 * them), measured once the box has taken the well's size, and at each new line. No observer
 * of its own: the box resizes only with the well, and a second observer, told a step behind
 * the well's, made the browser report a loop at each game's start (Safari, 1.46).
 */
const box = ref<HTMLElement | null>(null);
const band = ref<{ top: number; bottom: number } | null>(null);
const measure = () => {
  const own = box.value;
  const words = own?.querySelector<HTMLElement>('.toast--line:not(.toast-leave-active)');
  band.value =
    own && words && own.clientHeight > 0
      ? {
          top: words.offsetTop / own.clientHeight,
          bottom: (words.offsetTop + words.offsetHeight) / own.clientHeight,
        }
      : null;
};
watch([wellBox, () => props.toast?.key, () => props.line?.text], measure, { flush: 'post' });
onMounted(measure);

/** About half a piece's height, as a share of the well's: its edge, from its centre. */
const PIECE_REACH = 0.07;
const behind = computed(() => {
  const piece = props.piece;
  const covered = band.value;
  return (
    props.place === 'top' &&
    piece !== null &&
    covered !== null &&
    piece.y + PIECE_REACH > covered.top &&
    piece.y - PIECE_REACH < covered.bottom
  );
});
</script>

<template>
  <div ref="layer" class="well-toast" :class="`well-toast--${place}`" aria-hidden="true">
    <div ref="box" class="well-toast__box" :style="boxStyle">
      <Transition name="toast">
        <p v-if="toast" :key="toast.key" class="toast">
          <span class="toast__head">{{ parts.head }}</span>
          <template v-if="parts.rest">
            {{ ' ' }}<span class="toast__rest">{{ parts.rest }}</span>
          </template>
        </p>
        <div
          v-else-if="line"
          :key="line.text"
          class="toast toast--line"
          :class="{ 'toast--behind': behind }"
        >
          <p>{{ t(line.text) }}</p>
          <GuideKeys v-if="line.action" :action="line.action" />
        </div>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.well-toast {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

/* The well's own box: the words measure themselves against it. */
.well-toast__box {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  container-type: inline-size;
}

/* The training's voice: at the top of the well, where the sand has not come yet. */
.well-toast--top .well-toast__box {
  align-items: start;
}

.well-toast--top .toast {
  margin-block-start: 20cqi;
}

/* A message takes the place of the last one, in the same cell: nothing jumps (1.42). */
.toast {
  grid-area: 1 / 1;
  display: grid;
  justify-items: center;
  gap: 0.35em;
  max-inline-size: calc(100% - 2 * var(--space-2));
  padding: var(--space-2) var(--space-3);
  border: 1px solid color-mix(in srgb, var(--accent) 55%, transparent);
  border-radius: 1em;
  background: color-mix(in srgb, var(--surface) 88%, transparent);
  box-shadow: var(--shadow);
  font-family: var(--font-display);
  font-size: clamp(0.95rem, 0.6rem + 3.5cqi, 1.6rem);
  font-weight: 800;
  line-height: 1.2;
  text-align: center;
  text-wrap: balance;
  transition: opacity 180ms ease;
}

/* The piece in play passes behind the line: it lets it show, still readable. */
.toast--behind {
  opacity: 0.45;
}

/* The headline of a deed: bigger, in the rift's gold; what it did, under it. */
.toast__head {
  color: var(--accent-strong);
  font-size: 1.25em;
  font-weight: 900;
}

.toast__rest {
  font-family: var(--font-ui);
  font-size: 0.8em;
  font-weight: 700;
}

/* A headline alone (« Second chance! ») keeps the words' size and colour. */
.toast__head:only-child {
  color: inherit;
  font-size: 1em;
  font-weight: inherit;
}

.toast-enter-active {
  animation: toast-in var(--motion-in) cubic-bezier(0.2, 1.4, 0.4, 1);
}

.toast-leave-active {
  transition: opacity var(--motion-out) var(--ease-in);
}

.toast-leave-to {
  opacity: 0;
}

@keyframes toast-in {
  from {
    opacity: 0;
    transform: scale(calc(1 - var(--move) * 0.4));
  }
}
</style>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import type { TonePalette } from '@/render/TonePalette';
import type { OfferedSand } from '../engine/DunesDealer';
import { paintPiece } from '../render/paintPiece';

/**
 * One piece of the hand (1.37): a button showing the piece as sand, to drag,
 * tap or pick with a key. Under it, a short note: the element's name, or in
 * danger whether it still fits.
 */
const props = defineProps<{
  piece: OfferedSand | null;
  palette: TonePalette | null;
  /** Side of the square box, in CSS pixels. */
  size: number;
  label: string;
  /** The words under the piece, or ''. */
  note: string;
  selected: boolean;
  /** False when the piece fits nowhere on the board. */
  fits: boolean;
  /** The only piece that fits: it glows. */
  only: boolean;
  /** Being dragged: its place in the hand stays empty. */
  lifted: boolean;
  /** Its place in the hand: a new hand arrives piece after piece. */
  index: number;
  /** Motion allowed (effects and system setting). */
  moving: boolean;
}>();
const emit = defineEmits<{ grab: [event: PointerEvent]; select: [] }>();

const canvas = ref<HTMLCanvasElement | null>(null);

const draw = () => {
  const element = canvas.value;
  const ctx = element?.getContext('2d');
  if (!element || !ctx || !props.palette) return;
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  const px = Math.round(props.size * ratio);
  element.width = px;
  element.height = px;
  element.style.width = `${props.size}px`;
  element.style.height = `${props.size}px`;
  ctx.clearRect(0, 0, px, px);
  const piece = props.piece;
  if (!piece) return;
  const { shape } = piece;
  const cell = Math.floor(px / Math.max(3.2, shape.width + 0.6, shape.height + 0.6));
  paintPiece(ctx, piece, props.palette, {
    cell,
    left: (px - shape.width * cell) / 2,
    top: (px - shape.height * cell) / 2,
  });
};

/** A new piece arrives in the hand: it pops in, after the ones on its left. */
const arrive = () => {
  const element = canvas.value;
  if (!element || !props.moving || typeof element.animate !== 'function') return;
  element.animate(
    [
      { transform: 'translateY(40%) scale(0.3)', opacity: 0 },
      { transform: 'translateY(-6%) scale(1.08)', opacity: 1, offset: 0.65 },
      { transform: 'none', opacity: 1 },
    ],
    { duration: 320, delay: props.index * 70, easing: 'ease-out', fill: 'backwards' },
  );
};

onMounted(() => {
  draw();
  if (props.piece) arrive();
});
watch(() => [props.palette, props.size] as const, draw);
watch(
  () => props.piece,
  (piece, previous) => {
    draw();
    if (piece && piece.id !== previous?.id) arrive();
  },
);

/** Put back from a drag: the piece settles into its place again. */
watch(
  () => props.lifted,
  (lifted, was) => {
    const element = canvas.value;
    if (lifted || !was || !element || !props.moving || typeof element.animate !== 'function')
      return;
    element.animate([{ transform: 'scale(1.12)' }, { transform: 'none' }], {
      duration: 180,
      easing: 'ease-out',
    });
  },
);

/** Keyboard activation (Enter, Space) has no pointer: it selects. */
const onClick = (event: MouseEvent) => {
  if (event.detail === 0) emit('select');
};
</script>

<template>
  <button
    type="button"
    class="hand-piece"
    :class="{
      'hand-piece--selected': selected,
      'hand-piece--stuck': piece && !fits,
      'hand-piece--only': piece && only,
      'hand-piece--lifted': lifted,
    }"
    :aria-label="label"
    :aria-pressed="selected"
    :disabled="!piece"
    @pointerdown="emit('grab', $event)"
    @click="onClick"
    @contextmenu.prevent
  >
    <canvas ref="canvas" aria-hidden="true" />
    <span v-if="note && piece" class="hand-piece__note" aria-hidden="true">{{ note }}</span>
  </button>
</template>

<style scoped>
.hand-piece {
  position: relative;
  display: grid;
  place-items: center;
  min-width: var(--touch);
  min-height: var(--touch);
  padding: var(--space-1);
  border: 2px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  touch-action: none;
  -webkit-tap-highlight-color: transparent;
  transition:
    transform 120ms ease,
    border-color 120ms ease,
    opacity 160ms ease;
}

.hand-piece:disabled {
  cursor: default;
  opacity: 0.35;
}

.hand-piece--selected {
  border-color: var(--accent-fill);
  transform: translateY(-3px);
}

.hand-piece--stuck {
  opacity: 0.5;
}

/* The only piece that fits: it calls the eye. */
.hand-piece--only {
  border-color: var(--jewel-lime);
  box-shadow: 0 0 1.2rem color-mix(in srgb, var(--jewel-lime) 45%, transparent);
}

.hand-piece canvas {
  display: block;
  pointer-events: none;
}

/* A short note at the bottom of the box, over the piece's empty corner. */
.hand-piece__note {
  position: absolute;
  inset: auto 0 0.1rem;
  font-size: 0.875rem;
  font-weight: 800;
  line-height: 1.1;
  text-align: center;
  color: var(--text-muted);
  pointer-events: none;
}

.hand-piece--only .hand-piece__note {
  color: var(--text);
}

/* Its piece is in the player's hand: an empty socket remains. */
.hand-piece--lifted {
  border-style: dashed;
  background: transparent;
}

.hand-piece--lifted canvas,
.hand-piece--lifted .hand-piece__note {
  visibility: hidden;
}
</style>

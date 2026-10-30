<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { useServices } from '@/app/AppServices';
import type { TonePalette } from '@/render/TonePalette';
import type { OfferedPiece } from '../engine/Dealer';
import { CeramicSprites } from '../render/CeramicSprites';

/** One piece of the hand: a button showing the piece, to tap, drag or pick with the keyboard. */
const props = defineProps<{
  piece: OfferedPiece | null;
  palette: TonePalette | null;
  /** Side of the square box, in CSS pixels. */
  size: number;
  label: string;
  selected: boolean;
  /** False when the piece fits nowhere on the board. */
  fits: boolean;
  /** A joker waits for a piece: every piece is a target. */
  targeted: boolean;
  /** In the player's hand (being dragged): its place in the hand stays empty. */
  lifted: boolean;
  /** Its place in the hand: a new hand arrives piece after piece. */
  index: number;
  /** Motion allowed (effects and system setting). */
  moving: boolean;
}>();
const emit = defineEmits<{ grab: [event: PointerEvent]; select: [] }>();

const canvas = ref<HTMLCanvasElement | null>(null);
const { pixelRatio } = useServices();

const draw = () => {
  const element = canvas.value;
  const ctx = element?.getContext('2d');
  if (!element || !ctx || !props.palette) return;
  const ratio = pixelRatio();
  const px = Math.round(props.size * ratio);
  element.width = px;
  element.height = px;
  element.style.width = `${props.size}px`;
  element.style.height = `${props.size}px`;
  ctx.clearRect(0, 0, px, px);
  const piece = props.piece;
  if (!piece) return;
  const cell = Math.floor(px / Math.max(3.2, piece.shape.width + 0.6, piece.shape.height + 0.6));
  const sprite = new CeramicSprites(cell, props.palette).get(piece.tone);
  const left = (px - piece.shape.width * cell) / 2;
  const top = (px - piece.shape.height * cell) / 2;
  for (const c of piece.shape.cells) ctx.drawImage(sprite, left + c.x * cell, top + c.y * cell);
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
    if (piece && piece !== previous) arrive();
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
      'hand-piece--targeted': targeted && piece,
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
  </button>
</template>

<style scoped>
.hand-piece {
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
  opacity: 0.45;
}

.hand-piece--targeted {
  border-color: var(--danger);
  border-style: dashed;
}

.hand-piece canvas {
  display: block;
  pointer-events: none;
}

/* Its piece is in the player's hand: an empty socket remains. */
.hand-piece--lifted {
  border-style: dashed;
  background: transparent;
}

.hand-piece--lifted canvas {
  visibility: hidden;
}
</style>

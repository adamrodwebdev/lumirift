<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
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
  const cell = Math.floor(px / Math.max(3.2, piece.shape.width + 0.6, piece.shape.height + 0.6));
  const sprite = new CeramicSprites(cell, props.palette).get(piece.tone);
  const left = (px - piece.shape.width * cell) / 2;
  const top = (px - piece.shape.height * cell) / 2;
  for (const c of piece.shape.cells) ctx.drawImage(sprite, left + c.x * cell, top + c.y * cell);
};

onMounted(draw);
watch(() => [props.piece, props.palette, props.size] as const, draw);

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
</style>

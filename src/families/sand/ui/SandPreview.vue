<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { useServices } from '@/app/AppServices';
import { shapeCells } from '@/families/falling/pieces/Shapes';
import { MOTIFS } from '@/render/motifs';
import { shade, type TonePalette } from '@/render/TonePalette';
import { isElement } from '../engine/Elements';
import type { PieceSpec } from '../engine/SandGame';

/** An upcoming piece, drawn as a block of sand of its colour. */
const props = defineProps<{ spec: PieceSpec | null; palette: TonePalette | null; size: number }>();

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
  if (!props.spec) return;
  const cells = shapeCells(props.spec.type, 0);
  const xs = cells.map((c) => c.x);
  const ys = cells.map((c) => c.y);
  const cell = Math.floor(px / 4.4);
  const left = (px - (Math.max(...xs) - Math.min(...xs) + 1) * cell) / 2 - Math.min(...xs) * cell;
  const top = (px - (Math.max(...ys) - Math.min(...ys) + 1) * cell) / 2 - Math.min(...ys) * cell;
  const rgb = props.palette.color(props.spec.tone);
  const grain = cell / 6;
  for (const c of cells) {
    for (let y = 0; y < 6; y++) {
      for (let x = 0; x < 6; x++) {
        ctx.fillStyle = shade(rgb, ((x * 7 + y * 3 + c.x + c.y) % 4) * 0.05 - 0.05);
        ctx.fillRect(
          left + c.x * cell + x * grain,
          top + c.y * cell + y * grain,
          grain + 0.5,
          grain + 0.5,
        );
      }
    }
  }
  const tone = props.spec.tone;
  if (isElement(tone)) {
    // Elements are announced by their motif, not by their colour alone.
    const radius = cell * 0.9;
    ctx.save();
    ctx.translate(px / 2 - radius, px / 2 - radius);
    ctx.strokeStyle = props.palette.wellBackground;
    ctx.fillStyle = props.palette.wellBackground;
    ctx.lineWidth = Math.max(2, cell * 0.22);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    MOTIFS[tone](ctx, radius, radius * 0.75);
    ctx.restore();
  }
};

onMounted(draw);
watch(() => [props.spec, props.palette, props.size] as const, draw);
</script>

<template>
  <canvas ref="canvas" class="preview" aria-hidden="true" />
</template>

<style scoped>
.preview {
  display: block;
  border-radius: var(--radius-sm);
  background: var(--surface-2);
}
</style>

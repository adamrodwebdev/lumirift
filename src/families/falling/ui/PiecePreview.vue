<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import type { PieceSpec } from '../game/Game';
import { PieceRenderer } from '../render/PieceRenderer';
import type { TonePalette } from '@/render/TonePalette';

const props = defineProps<{
  spec: PieceSpec | null;
  palette: TonePalette | null;
  size: number;
  dimmed?: boolean;
}>();

const canvas = ref<HTMLCanvasElement | null>(null);
let renderer: PieceRenderer | null = null;

const draw = () => {
  if (!renderer || !props.palette) return;
  renderer.layout(props.size, Math.min(2, window.devicePixelRatio || 1), props.palette);
  renderer.render(props.spec, props.dimmed);
};

onMounted(() => {
  if (canvas.value) renderer = new PieceRenderer(canvas.value);
  draw();
});

watch(() => [props.spec, props.palette, props.size, props.dimmed] as const, draw);
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

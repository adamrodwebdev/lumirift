<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { useServices } from '@/app/AppServices';
import type { PieceSpec } from '../game/Game';
import { PieceRenderer } from '../render/PieceRenderer';
import type { MaterialId } from '@/progression/Cosmetics';
import type { TonePalette } from '@/render/TonePalette';

const props = defineProps<{
  spec: PieceSpec | null;
  palette: TonePalette | null;
  size: number;
  dimmed?: boolean;
  /** The player's block material (crystal by default). */
  material?: MaterialId;
  /** Twice as wide as high (a piece in the rift, 1.43); a square otherwise. */
  wide?: boolean;
}>();

const canvas = ref<HTMLCanvasElement | null>(null);
const { pixelRatio } = useServices();
let renderer: PieceRenderer | null = null;

const draw = () => {
  if (!renderer || !props.palette) return;
  renderer.layout({
    width: props.size,
    height: props.wide ? Math.round(props.size / 2) : props.size,
    pixelRatio: pixelRatio(),
    palette: props.palette,
    material: props.material,
  });
  renderer.render(props.spec, props.dimmed);
};

onMounted(() => {
  if (canvas.value) renderer = new PieceRenderer(canvas.value);
  draw();
});

watch(
  () => [props.spec, props.palette, props.size, props.dimmed, props.material, props.wide] as const,
  draw,
);
</script>

<template>
  <canvas ref="canvas" class="preview" :class="{ 'preview--wide': wide }" aria-hidden="true" />
</template>

<style scoped>
.preview {
  display: block;
  border-radius: var(--radius-sm);
  background: var(--surface-2);
}

/* In the rift, the piece floats out of the light: no tile behind it. */
.preview--wide {
  background: none;
}
</style>

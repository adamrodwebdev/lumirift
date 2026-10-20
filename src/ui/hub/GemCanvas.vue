<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { MaterialId, ShatterId } from '@/progression/Cosmetics';
import type { ModeId } from '@/session/ModeId';
import type { GemArt } from './GemArt';
import { loadGemArt } from './loadArt';

/**
 * A picture drawn with the game's gems, fitted to its box: a mode, a
 * material sample or a shatter signature. Decorative: the button around it
 * carries the name.
 */
const props = defineProps<{
  mode?: ModeId;
  material?: MaterialId;
  shatter?: ShatterId;
}>();

const canvas = ref<HTMLCanvasElement | null>(null);
let art: GemArt | null = null;

const draw = () => {
  const target = canvas.value;
  if (!art || !target) return;
  if (props.mode) art.drawMode(target, props.mode);
  else if (props.material) art.drawMaterial(target, props.material);
  else if (props.shatter) art.drawShatter(target, props.shatter);
};

const observer = new ResizeObserver(() => draw());
onMounted(async () => {
  if (canvas.value) observer.observe(canvas.value);
  art = await loadGemArt();
  draw();
});
watch(() => [props.mode, props.material, props.shatter], draw);
onBeforeUnmount(() => observer.disconnect());
</script>

<template>
  <canvas ref="canvas" class="gems" aria-hidden="true" />
</template>

<style scoped>
.gems {
  display: block;
  width: 100%;
  height: 100%;
  min-height: 0;
}
</style>

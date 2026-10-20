<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { MaterialId, ShatterId } from '@/progression/Cosmetics';
import type { ModeId } from '@/session/ModeId';
import type { GemArt } from './GemArt';
import { loadGemArt } from './loadArt';

/**
 * A picture drawn with the game's gems, fitted to its box: a mode, a
 * material sample or a shatter signature. Decorative: the button around it
 * carries the name. Drawn only once on screen (a page not shown yet, a
 * window not open yet cost nothing).
 */
const props = defineProps<{
  mode?: ModeId;
  material?: MaterialId;
  shatter?: ShatterId;
}>();

const canvas = ref<HTMLCanvasElement | null>(null);
let art: GemArt | null = null;
let visible = false;
/** Something changed while it was off screen: draw on the way in. */
let stale = true;

const draw = () => {
  const target = canvas.value;
  if (!art || !target) return;
  if (!visible) {
    stale = true;
    return;
  }
  stale = false;
  if (props.mode) art.drawMode(target, props.mode);
  else if (props.material) art.drawMaterial(target, props.material);
  else if (props.shatter) art.drawShatter(target, props.shatter);
};

const sizes = new ResizeObserver(() => draw());
const view = new IntersectionObserver(([entry]) => {
  visible = entry?.isIntersecting ?? false;
  if (visible && stale) draw();
});
onMounted(async () => {
  if (canvas.value) {
    sizes.observe(canvas.value);
    view.observe(canvas.value);
  }
  art = await loadGemArt();
  draw();
});
watch(() => [props.mode, props.material, props.shatter], draw);
onBeforeUnmount(() => {
  sizes.disconnect();
  view.disconnect();
});
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

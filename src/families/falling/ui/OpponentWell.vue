<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useServices } from '@/app/AppServices';
import type { FrameClock } from '@/app/FrameClock';
import type { FallingSession } from '../FallingSession';
import { FallingRenderer } from '../render/FallingRenderer';
import { TonePalette } from '@/render/TonePalette';

/** The opponent's well, as a live thumbnail: watched, never played. */
const props = defineProps<{ session: FallingSession; clock: FrameClock; label: string }>();

const { t } = useI18n();
const { theme } = useServices();
const box = ref<HTMLElement | null>(null);
const canvas = ref<HTMLCanvasElement | null>(null);
const ariaLabel = computed(() => `${t('game.opponent')} · ${props.label}`);
let renderer: FallingRenderer | null = null;

const observer = new ResizeObserver(([entry]) => {
  if (!entry || !renderer) return;
  const width = entry.contentRect.width;
  renderer.layout(width, width * 2, Math.min(2, window.devicePixelRatio || 1));
  renderer.render();
});

const refreshPalette = async () => {
  await nextTick();
  renderer?.setPalette(
    TonePalette.fromElement(document.documentElement),
    theme.resolved.value === 'dark',
  );
};

watch(theme.resolved, refreshPalette);
const offFrame = props.clock.subscribe(() => renderer?.render());

onMounted(() => {
  if (!canvas.value) return;
  renderer = new FallingRenderer(canvas.value, props.session.view);
  renderer.setGhost(false);
  renderer.setDangerEdge(true);
  if (box.value) observer.observe(box.value);
  void refreshPalette();
});

onBeforeUnmount(() => {
  offFrame();
  observer.disconnect();
});
</script>

<template>
  <figure class="opponent">
    <figcaption class="opponent__label">{{ label }}</figcaption>
    <div ref="box" class="opponent__box">
      <canvas ref="canvas" class="opponent__canvas" role="img" :aria-label="ariaLabel" />
    </div>
  </figure>
</template>

<style scoped>
.opponent {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  width: 100%;
  max-width: 10rem;
  margin: 0;
}

.opponent__label {
  font-size: 0.7rem;
  color: var(--text-muted);
  text-align: center;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

/* The box sets the size; a canvas is 300 px wide by default and must not push it. */
.opponent__box {
  width: 100%;
  min-width: 0;
}

.opponent__canvas {
  display: block;
  max-width: 100%;
  border: 1px solid var(--well-frame);
  border-radius: var(--radius-sm);
}
</style>

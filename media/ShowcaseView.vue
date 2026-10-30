<script setup lang="ts">
import { shallowRef, type Component } from 'vue';
import type { FrameClock } from '@/app/FrameClock';
import { stageFor } from '@/ui/stages';
import { ModeCatalog } from '@/session/ModeCatalog';
import type { Scene } from './scenes';

/**
 * One scene at a time, full frame: the family's real stage, its parts in a
 * grid like the game screen's (the stages have no box of their own).
 */
const props = defineProps<{ clock: FrameClock }>();

const scene = shallowRef<Scene | null>(null);
const stage = shallowRef<Component | null>(null);
const key = shallowRef(0);
const catalog = new ModeCatalog();

props.clock.subscribe((delta) => {
  const current = scene.value;
  if (!current) return;
  current.drive(delta);
  current.session.update(delta);
});

defineExpose({
  show(next: Scene) {
    scene.value?.dispose();
    stage.value = stageFor(catalog.get(next.session.modeId));
    scene.value = next;
    key.value++;
    next.session.start();
  },
});
</script>

<template>
  <main class="showcase">
    <component
      :is="stage"
      v-if="scene && stage"
      :key="key"
      :session="scene.session"
      :clock="clock"
      :active="true"
      :ghost="true"
    />
  </main>
</template>

<style scoped>
/*
 * Like the game screen: the hold, then the coming pieces in the rift above the
 * well (1.43). Every area a stage names is in the grid: one missing would open
 * tracks of its own, at the well's expense.
 */
.showcase {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  grid-template-rows: auto auto minmax(0, 1fr) auto auto auto;
  grid-template-areas:
    'hold .'
    'rift rift'
    'well well'
    'prompt prompt'
    'jokers jokers'
    'hand hand';
  gap: 0.75rem;
  height: 100dvh;
  /* The clip set (1.39) adds a margin of background above and below the screen. */
  padding: calc(var(--clip-margin, 0px) + 1rem) 1rem;
  overflow: hidden;
}

.showcase :deep(.stage__hold) {
  align-self: start;
  justify-self: start;
}

/* Landscape: the well in the middle under its rift, the hold on its left, like the game. */
@media (orientation: landscape) {
  .showcase {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.5fr) minmax(0, 1fr);
    grid-template-rows: auto auto auto minmax(0, 1fr);
    grid-template-areas:
      '. rift .'
      'hold well hand'
      'jokers well hand'
      'prompt well hand';
    column-gap: 1.5rem;
    padding: 1.25rem 2rem;
  }

  .showcase :deep(.stage__hold) {
    justify-self: end;
  }
}
</style>

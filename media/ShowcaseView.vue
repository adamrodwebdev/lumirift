<script setup lang="ts">
import { shallowRef, type Component } from 'vue';
import type { FrameClock } from '@/app/FrameClock';
import { stageFor } from '@/ui/stages';
import { ModeCatalog } from '@/session/ModeCatalog';
import type { Scene } from './scenes';

/** One scene at a time, full frame: the family's real stage, nothing else. */
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
    scene.value?.session.dispose();
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
.showcase {
  height: 100dvh;
  overflow: hidden;
}
</style>

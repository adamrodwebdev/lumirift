<script setup lang="ts">
import AppIcon from './AppIcon.vue';

/** Three stars, `count` of them lit; the label says it in words. */
defineProps<{ count: number; label: string; size?: number }>();
</script>

<template>
  <span class="stars" role="img" :aria-label="label">
    <span v-for="n in 3" :key="n" class="star" :class="{ 'star--on': n <= count }">
      <AppIcon name="star" :size="size ?? 16" />
    </span>
  </span>
</template>

<style scoped>
.stars {
  display: inline-flex;
  gap: 0.1rem;
}

.star {
  display: inline-flex;
  color: var(--star-empty);
}

.star--on {
  color: var(--star);
}

.star--on :deep(path) {
  fill: currentColor;
}
</style>

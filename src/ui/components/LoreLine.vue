<script setup lang="ts">
/**
 * A line of the world (1.46.6): one sentence of Lumirift's story, in the
 * parchment tone, under a short mark of the Rift's light. It sits where
 * players already look, after play: the map, the end of a game, the
 * Atelier, the season. Two lines at most where it is placed; centred, or
 * from the start of a title it follows.
 */
withDefaults(defineProps<{ text: string; align?: 'center' | 'start' }>(), { align: 'center' });
</script>

<template>
  <div class="lore" :class="`lore--${align}`">
    <span class="lore__mark" aria-hidden="true" />
    <p class="lore__line">{{ text }}</p>
  </div>
</template>

<style scoped>
.lore {
  display: grid;
  justify-items: center;
  gap: 0.375rem;
}

.lore--start {
  justify-items: start;
}

.lore__mark {
  display: block;
  width: 1.75rem;
  height: 0.125rem;
  border-radius: 0.125rem;
  background: var(--lore-mark);
}

.lore__line {
  margin: 0;
  color: var(--lore);
  font-family: var(--font-ui);
  font-size: 0.875rem;
  font-weight: 400;
  line-height: 1.45;
  text-align: center;
  text-wrap: balance;
}

.lore--start .lore__line {
  text-align: start;
}
</style>

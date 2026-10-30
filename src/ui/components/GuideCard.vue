<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { GuideLine } from '@/session/GameSession';
import AppIcon from './AppIcon.vue';
import InputHint from './InputHint.vue';

/**
 * The training's guide (1.29), in the dashboard rather than over the well:
 * nothing of the game hides behind it, neither the piece coming in nor the
 * Dune Wyrm. What to do now and, for an action, how (the keys or the
 * gesture). It keeps the room of the longest line it may say (`lines`), so
 * that the well never moves as it talks. The player may hide it.
 */
defineProps<{ line: GuideLine; lines: readonly GuideLine[] }>();
const emit = defineEmits<{ skip: [] }>();

const { t } = useI18n();
</script>

<template>
  <div class="guide" role="status">
    <div class="guide__lines">
      <div
        v-for="each in lines"
        :key="each.text"
        class="guide__line guide__line--room"
        aria-hidden="true"
      >
        <InputHint v-if="each.action" class="guide__hint" :action="each.action" />
        <p class="guide__text">{{ t(each.text) }}</p>
      </div>
      <Transition name="guide" mode="out-in">
        <div :key="line.text" class="guide__line">
          <InputHint v-if="line.action" class="guide__hint" :action="line.action" />
          <p class="guide__text">{{ t(line.text) }}</p>
        </div>
      </Transition>
    </div>
    <button
      type="button"
      class="guide__skip"
      :aria-label="t('coach.skip')"
      :title="t('coach.skip')"
      @click="emit('skip')"
    >
      <AppIcon name="close" :size="18" />
    </button>
  </div>
</template>

<style scoped>
/* Sizes in `em`, like the rest of the HUD; the card adapts to its place. */
.guide {
  container: guide / inline-size;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: start;
  min-width: 0;
  padding-inline-start: 0.75em;
  border: 1px solid color-mix(in srgb, var(--accent) 55%, transparent);
  border-radius: var(--radius);
  background: color-mix(in srgb, var(--surface) 92%, transparent);
  box-shadow:
    var(--shadow),
    0 0 1.5rem rgb(255 160 60 / 0.2);
}

/* Every line in the same cell: the card is as tall as the longest. */
.guide__lines {
  display: grid;
  align-self: stretch;
}

.guide__line {
  grid-area: 1 / 1;
  align-self: center;
  display: flex;
  align-items: center;
  gap: 0.75em;
  min-block-size: var(--touch);
  padding-block: 0.5em;
}

/* The keys or the gesture keep their width; the words take the rest. */
.guide__hint {
  flex: none;
}

/* The room kept: there, unseen, still. */
.guide__line--room {
  visibility: hidden;
}

.guide__line--room :deep(*) {
  animation: none;
}

.guide__text {
  font-weight: 700;
  line-height: 1.25;
  text-wrap: pretty;
}

/* A narrow column (beside the well, on a desktop): the keys above the words. */
@container guide (inline-size < 18em) {
  .guide__line {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.4em;
  }
}

.guide__skip {
  display: grid;
  place-items: center;
  inline-size: var(--touch);
  block-size: var(--touch);
  border: 0;
  border-radius: var(--radius);
  background: transparent;
  color: var(--text-muted);
}

.guide__skip:hover {
  color: var(--text);
}

.guide-enter-active {
  animation: guide-in var(--motion-in) cubic-bezier(0.2, 1.3, 0.4, 1);
}

.guide-leave-active {
  transition: opacity var(--motion-out) var(--ease-in);
}

.guide-leave-to {
  opacity: 0;
}

@keyframes guide-in {
  from {
    opacity: 0;
    transform: translateY(calc(var(--move) * -0.35rem)) scale(calc(1 - var(--move) * 0.04));
  }
}
</style>

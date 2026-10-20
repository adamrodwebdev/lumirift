<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import type { ModeDescriptor } from '@/session/ModeCatalog';
import ModalDialog from './ModalDialog.vue';

/** Asks which variant of a mode to play (the AI level of a duel). */
const props = defineProps<{ mode: ModeDescriptor | null }>();
const emit = defineEmits<{ choose: [variant: string]; close: [] }>();

const { t } = useI18n();
/** The mode asked about, kept while the window slides away. */
const shown = shallowRef<ModeDescriptor | null>(props.mode);
watch(
  () => props.mode,
  (mode) => {
    if (mode) shown.value = mode;
  },
);
const variants = computed(() => shown.value?.variants ?? []);
</script>

<template>
  <ModalDialog
    class="variant-sheet"
    :open="mode !== null"
    :title="t('variants.title')"
    closable
    wide
    @dismiss="emit('close')"
  >
    <div v-if="shown" class="variants">
      <button
        v-for="variant in variants"
        :key="variant"
        type="button"
        class="btn btn--raised variant"
        :class="{ 'variant--default': variant === shown.defaultVariant }"
        :autofocus="variant === shown.defaultVariant"
        @click="emit('choose', variant)"
      >
        <span class="variant__name">{{ t(`variants.${shown.id}.${variant}`) }}</span>
        <span class="variant__hint">{{ t(`variants.${shown.id}Hint.${variant}`) }}</span>
      </button>
    </div>
  </ModalDialog>
</template>

<style scoped>
.variants {
  display: grid;
  gap: var(--space-2);
}

.variant {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  justify-items: start;
  gap: 0.1rem;
  min-height: 3.5rem;
  padding: var(--space-2) var(--space-4);
  border-radius: 1rem;
  background: var(--highlight);
  text-align: start;
}

.variant--default {
  border-color: var(--accent-fill);
  box-shadow:
    0 0 0 1px var(--accent-fill),
    0 4px 0 var(--surface-edge);
}

.variant__name {
  font-family: var(--font-display);
  font-size: 1rem;
  font-weight: 800;
}

.variant__hint {
  color: var(--text-muted);
  font-size: 0.8rem;
  font-weight: 600;
}

/* Wide screens: two columns of opponents. */
@media (orientation: landscape) {
  .variants {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .variant {
    min-height: 3.1rem;
    padding-block: 0.35rem;
  }
}
</style>

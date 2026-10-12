<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { ModeDescriptor } from '@/session/ModeCatalog';
import ModalDialog from './ModalDialog.vue';

/** Asks which variant of a mode to play (the AI level of a duel). */
const props = defineProps<{ mode: ModeDescriptor | null }>();
const emit = defineEmits<{ choose: [variant: string]; close: [] }>();

const { t } = useI18n();
const variants = computed(() => props.mode?.variants ?? []);
</script>

<template>
  <ModalDialog :open="mode !== null" :title="t('variants.title')" @dismiss="emit('close')">
    <div v-if="mode" class="variants">
      <button
        v-for="variant in variants"
        :key="variant"
        type="button"
        class="variant"
        :class="{ 'variant--default': variant === mode.defaultVariant }"
        :autofocus="variant === mode.defaultVariant"
        @click="emit('choose', variant)"
      >
        <span class="variant__name">{{ t(`variants.${mode.id}.${variant}`) }}</span>
        <span class="variant__hint">{{ t(`variants.${mode.id}Hint.${variant}`) }}</span>
      </button>
      <button type="button" class="btn btn--ghost" @click="emit('close')">
        {{ t('variants.cancel') }}
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
  gap: var(--space-1);
  min-height: var(--touch);
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface);
  text-align: left;
}

.variant:hover {
  background: var(--surface-2);
}

.variant--default {
  border-color: var(--accent-fill);
}

.variant__name {
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 1.1rem;
}

.variant__hint {
  color: var(--text-muted);
  font-size: 0.9rem;
}
</style>

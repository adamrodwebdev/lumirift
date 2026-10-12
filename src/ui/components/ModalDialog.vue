<script setup lang="ts">
import { onMounted, ref, useId, watch } from 'vue';

/**
 * Native modal dialog: focus trapping, Escape and the inert background come
 * from the browser. Escape emits `dismiss`; the parent decides what it means.
 */
const props = defineProps<{ open: boolean; title: string }>();
const emit = defineEmits<{ dismiss: [] }>();

const dialog = ref<HTMLDialogElement | null>(null);
const titleId = useId();

const sync = () => {
  const element = dialog.value;
  if (!element) return;
  if (props.open && !element.open) element.showModal();
  if (!props.open && element.open) element.close();
};

onMounted(sync);
watch(() => props.open, sync);

const onCancel = (event: Event) => {
  event.preventDefault();
  emit('dismiss');
};
</script>

<template>
  <dialog ref="dialog" class="modal" :aria-labelledby="titleId" @cancel="onCancel">
    <h2 :id="titleId" class="modal__title">{{ title }}</h2>
    <slot />
  </dialog>
</template>

<style scoped>
.modal {
  width: min(100% - 2rem, 26rem);
  max-height: calc(100dvh - 2rem);
  overflow: auto;
  padding: var(--space-6);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  color: var(--text);
  box-shadow: var(--shadow);
}

.modal::backdrop {
  background: rgb(5 7 10 / 0.6);
}

.modal[open] {
  animation: modal-in 160ms ease-out;
}

.modal__title {
  font-size: clamp(1.3rem, 1.1rem + 1vw, 1.6rem);
  margin-bottom: var(--space-4);
}

@keyframes modal-in {
  from {
    opacity: 0;
    transform: translateY(0.5rem) scale(0.98);
  }
}
</style>

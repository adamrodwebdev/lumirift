<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, useId, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import AppIcon from './AppIcon.vue';

/**
 * A window of the game, as a sheet: it rises from the bottom of a phone held
 * upright and pops in the middle of a wide screen, its content following in
 * a short cascade; it slides away when closed. Built on the native modal
 * dialog: focus trapping, Escape and the inert background come from the
 * browser. Escape (or the close button) emits `dismiss`; the parent decides
 * what it means. Laid out to fit the screen without scrolling.
 */
const props = defineProps<{
  open: boolean;
  title: string;
  /** A close button in the corner (windows that only inform or set). */
  closable?: boolean;
  /** Twice as wide on a wide screen: the content sets itself in two columns. */
  wide?: boolean;
  /** The title large and centred (the end of a game). */
  hero?: boolean;
}>();
const emit = defineEmits<{ dismiss: [] }>();

const { t } = useI18n();
const dialog = ref<HTMLDialogElement | null>(null);
const titleId = useId();
/** Sliding away: still open, so that the motion shows. */
const closing = ref(false);
const CLOSE_MS = 200;
let closeTimer: ReturnType<typeof setTimeout> | undefined;
/**
 * Arriving: for a moment, its buttons ignore taps, Enter and Space, so that
 * a key or a tap meant for the game (a player hammering Space at the end)
 * never presses the button that just took the focus.
 */
const settling = ref(false);
const SETTLE_MS = 350;
let settleTimer: ReturnType<typeof setTimeout> | undefined;
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const sync = () => {
  const element = dialog.value;
  if (!element) return;
  if (props.open) {
    clearTimeout(closeTimer);
    closing.value = false;
    if (!element.open) {
      element.showModal();
      if (!reducedMotion()) {
        settling.value = true;
        clearTimeout(settleTimer);
        settleTimer = setTimeout(() => (settling.value = false), SETTLE_MS);
      }
    }
    return;
  }
  if (!element.open || closing.value) return;
  if (reducedMotion()) {
    element.close();
    return;
  }
  closing.value = true;
  closeTimer = setTimeout(() => {
    closing.value = false;
    element.close();
  }, CLOSE_MS);
};

onMounted(sync);
watch(() => props.open, sync);
onBeforeUnmount(() => {
  clearTimeout(closeTimer);
  clearTimeout(settleTimer);
});

const onKey = (event: KeyboardEvent) => {
  if (settling.value && (event.key === 'Enter' || event.key === ' ')) event.preventDefault();
};

/** Escape or the close button; nothing more once the sheet is leaving. */
const dismiss = () => {
  if (!closing.value) emit('dismiss');
};
const onCancel = (event: Event) => {
  event.preventDefault();
  dismiss();
};
</script>

<template>
  <dialog
    ref="dialog"
    class="sheet"
    :class="{
      'sheet--wide': wide,
      'sheet--hero': hero,
      'sheet--closing': closing,
      'sheet--settling': settling,
    }"
    :aria-labelledby="titleId"
    @cancel="onCancel"
    @keydown.capture="onKey"
    @keyup.capture="onKey"
  >
    <header class="sheet__head">
      <h2 :id="titleId" class="sheet__title">{{ title }}</h2>
      <button
        v-if="closable"
        type="button"
        class="btn btn--square sheet__close"
        :aria-label="t('nav.close')"
        @click="dismiss"
      >
        <AppIcon name="close" :size="20" />
      </button>
    </header>
    <div class="sheet__body">
      <slot />
    </div>
  </dialog>
</template>

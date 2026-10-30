<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useServices } from '@/app/AppServices';
import { MOTION, transitionMs } from '../motion';
import AppIcon from './AppIcon.vue';

/**
 * A window of the game, as a sheet: it rises from the bottom of a phone held
 * upright and pops in the middle of a wide screen, its content following in
 * a short cascade (1.42: 220 ms, a plain fade under the fade). Built on the
 * native modal dialog: focus trapping, Escape and the inert background come
 * from the browser. Closed, it is closed at once: the page behind takes taps
 * and Escape while the sheet fades away (where the browser can keep it on
 * screen, sheet.css). Escape (or the close button) emits `dismiss`; the parent
 * decides what it means. On a portal, Escape is the portal's (see `App`):
 * only the buttons close a window there. Laid out to fit the screen without
 * scrolling. Its content is built the first time it opens: a closed window
 * costs nothing to the screen behind it.
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
  /**
   * A window that opens by itself (the end of a game, the day's gift): while
   * it arrives, its buttons ignore taps, Enter and Space, so that a key or a
   * tap meant for the game never presses the button that takes the focus.
   */
  guarded?: boolean;
}>();
const emit = defineEmits<{ dismiss: [] }>();

const { t } = useI18n();
const { motion } = useServices();
const dialog = ref<HTMLDialogElement | null>(null);
const titleId = useId();
/** Arriving, when guarded: its buttons wait for the end of the arrival. */
const settling = ref(false);
let settleTimer: ReturnType<typeof setTimeout> | undefined;
const rendered = ref(props.open);
/** Asked open and not shown yet (asked again after a wait: it may have changed). */
const toOpen = (element: HTMLDialogElement) => props.open && !element.open;

const sync = async () => {
  const element = dialog.value;
  if (!element) return;
  if (props.open) {
    if (!rendered.value) {
      rendered.value = true;
      // The content (and its autofocus) is in place before the dialog opens.
      await nextTick();
    }
    if (toOpen(element)) {
      element.inert = false;
      element.showModal();
      if (props.guarded) {
        settling.value = true;
        clearTimeout(settleTimer);
        settleTimer = setTimeout(
          () => (settling.value = false),
          transitionMs(MOTION.inMs, motion.fades),
        );
      }
    }
    return;
  }
  clearTimeout(settleTimer);
  settling.value = false;
  if (element.open) element.close();
  // Gone for taps, keys and assistive technologies at once: it only fades away.
  element.inert = true;
};

onMounted(() => void sync());
watch(
  () => props.open,
  () => void sync(),
);
onBeforeUnmount(() => clearTimeout(settleTimer));

const onKey = (event: KeyboardEvent) => {
  if (settling.value && (event.key === 'Enter' || event.key === ' ')) event.preventDefault();
};

/** Escape or the close button. */
const dismiss = () => emit('dismiss');
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
      <slot v-if="rendered" />
    </div>
  </dialog>
</template>

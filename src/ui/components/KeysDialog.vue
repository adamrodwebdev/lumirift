<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useServices } from '@/app/AppServices';
import { useFormat } from '@/app/useFormat';
import {
  isBindable,
  KEY_SLOTS,
  type KeyAction,
  type KeyBindings,
  type KeySlot,
} from '@/families/falling/input/KeyBindings';
import { ARR_RANGE, DAS_RANGE } from '@/families/falling/input/RepeatTiming';
import { useKeyBindings } from '../useKeyBindings';
import { useKeyLabels } from '../useKeyLabels';
import ModalDialog from './ModalDialog.vue';

/**
 * The keyboard controls (1.22): two keys for each action of the falling
 * family, the Sand and the Tower, and the timing of a held move (DAS, ARR).
 * A slot chosen listens for the next key: a key already used elsewhere swaps
 * places, Delete empties the slot, Esc and Tab give up, and a key the
 * browser or the portals keep is refused. Every change is saved at once.
 */
const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();

const { t } = useI18n();
const { settings } = useServices();
const format = useFormat();
const bindings = useKeyBindings();
const labels = useKeyLabels();

const LABELS: Readonly<Record<KeyAction, string>> = {
  left: 'controls.left',
  right: 'controls.right',
  softDrop: 'controls.softDrop',
  rotateCw: 'controls.rotateCw',
  rotateCcw: 'controls.rotateCcw',
  hardDrop: 'controls.hardDrop',
  hold: 'controls.hold',
  ability: 'controls.ability.flip',
  surge: 'surge.name',
  turnLeft: 'keymap.turnLeft',
  turnRight: 'keymap.turnRight',
  pause: 'controls.pause',
};

/** The mode an action belongs to, when it is not every mode's. */
const ONLY_IN: Readonly<Partial<Record<KeyAction, string>>> = {
  ability: 'modes.flip.name',
  turnLeft: 'modes.tower.name',
  turnRight: 'modes.tower.name',
};

/** Grouped as the touch buttons are: the moves, the rotations and the drop, the rest. */
const GROUPS: readonly { readonly title: string; readonly actions: readonly KeyAction[] }[] = [
  { title: 'controls.groupMove', actions: ['left', 'right', 'softDrop'] },
  { title: 'controls.groupAct', actions: ['rotateCw', 'rotateCcw', 'hardDrop'] },
  {
    title: 'keymap.groupMore',
    actions: ['hold', 'ability', 'surge', 'turnLeft', 'turnRight', 'pause'],
  },
];
const SLOTS = Array.from({ length: KEY_SLOTS }, (_, slot) => slot);

/** The slot waiting for a key, if any. */
const listening = ref<KeySlot | null>(null);
/** What the last change did, for every player (a screen reader reads it too). */
const status = ref('');
/** The key that ended a choice: its release must not press the button under the focus. */
let swallowUp: string | null = null;

const name = (action: KeyAction) => t(LABELS[action]);
const onlyIn = (action: KeyAction) => {
  const mode = ONLY_IN[action];
  return mode ? t(mode) : null;
};
const isListening = (action: KeyAction, slot: number) =>
  listening.value?.action === action && listening.value.slot === slot;

/** What a cap shows: the key, + when empty, … while it listens. */
const cap = (action: KeyAction, slot: number) => {
  if (isListening(action, slot)) return '…';
  const code = bindings.value.at(action, slot);
  return code === null ? '+' : labels.label(code);
};

const slotLabel = (action: KeyAction, slot: number) => {
  const code = bindings.value.at(action, slot);
  return code
    ? t('keymap.slot', { action: name(action), n: slot + 1, key: labels.spoken(code) })
    : t('keymap.slotEmpty', { action: name(action), n: slot + 1 });
};

const save = (next: KeyBindings) => settings.bindKeys(next.toJSON());

const listen = (action: KeyAction, slot: number) => {
  if (isListening(action, slot)) {
    stop();
    return;
  }
  listening.value = { action, slot };
  status.value = t('keymap.press', { action: name(action) });
};

const stop = () => {
  listening.value = null;
  status.value = '';
};

/** A slot losing the focus (a click elsewhere) stops listening. */
const onBlur = (action: KeyAction, slot: number) => {
  if (isListening(action, slot)) stop();
};

const choose = (target: KeySlot, code: string) => {
  const before = bindings.value;
  const found = before.find(code);
  const next = before.with(target.action, target.slot, code);
  save(next);
  listening.value = null;
  if (found && found.action !== target.action) {
    status.value =
      next.codes(found.action).length === 0
        ? t('keymap.unbound', { action: name(found.action) })
        : t('keymap.swapped', { action: name(found.action) });
  } else {
    status.value = t('keymap.set', { action: name(target.action), key: labels.spoken(code) });
  }
};

/** Before anything else hears it (the game, the window's Escape), the key for a slot. */
const onKeyDown = (event: KeyboardEvent) => {
  const target = listening.value;
  if (!target) return;
  // Tab gives up and lets the focus move.
  if (event.code === 'Tab') {
    stop();
    return;
  }
  event.preventDefault();
  event.stopImmediatePropagation();
  if (event.repeat) return;
  swallowUp = event.code;
  if (event.code === 'Escape') {
    stop();
  } else if (event.code === 'Delete') {
    save(bindings.value.without(target.action, target.slot));
    listening.value = null;
    status.value = t('keymap.cleared');
  } else if (!isBindable(event.code)) {
    status.value = t('keymap.reserved', { key: labels.spoken(event.code) });
  } else {
    choose(target, event.code);
  }
};

const onKeyUp = (event: KeyboardEvent) => {
  if (event.code !== swallowUp) return;
  swallowUp = null;
  event.preventDefault();
  event.stopImmediatePropagation();
};

/** The repeat interval in words: "Instant" at 0. */
const arrText = () =>
  settings.current.arr === 0 ? t('keymap.instant') : format.milliseconds(settings.current.arr);

const onDas = (event: Event) =>
  settings.setRepeat({ das: Number((event.target as HTMLInputElement).value) });
const onArr = (event: Event) =>
  settings.setRepeat({ arr: Number((event.target as HTMLInputElement).value) });

const reset = () => {
  stop();
  settings.resetKeys();
  status.value = t('keymap.restored');
};

const close = () => {
  stop();
  emit('close');
};

onMounted(() => {
  window.addEventListener('keydown', onKeyDown, true);
  window.addEventListener('keyup', onKeyUp, true);
});
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeyDown, true);
  window.removeEventListener('keyup', onKeyUp, true);
});
// Closed from outside (the window under it closing): nothing keeps listening.
watch(
  () => props.open,
  (open) => {
    if (!open) stop();
  },
);
</script>

<template>
  <ModalDialog
    class="keymap"
    :open="open"
    :title="t('keymap.title')"
    closable
    wide
    @dismiss="close"
  >
    <p class="sheet-note keymap__hint">{{ t('keymap.hint') }}</p>

    <div class="keymap__groups">
      <section v-for="group in GROUPS" :key="group.title" class="keymap__group">
        <h3 class="keymap__heading">{{ t(group.title) }}</h3>
        <div class="keymap__rows">
          <div
            v-for="action in group.actions"
            :key="action"
            class="keymap__row"
            :class="{ 'keymap__row--unbound': bindings.codes(action).length === 0 }"
          >
            <span class="keymap__action">
              {{ name(action) }}
              <small v-if="bindings.codes(action).length === 0" class="keymap__missing">
                {{ t('keymap.missing') }}
              </small>
              <small v-else-if="onlyIn(action)" class="keymap__only">{{ onlyIn(action) }}</small>
            </span>
            <span class="keymap__slots">
              <button
                v-for="slot in SLOTS"
                :key="slot"
                type="button"
                class="keymap__key"
                :class="{
                  'keymap__key--empty': bindings.at(action, slot) === null,
                  'keymap__key--listening': isListening(action, slot),
                  'keymap__key--wide': cap(action, slot).length > 2,
                }"
                :aria-label="slotLabel(action, slot)"
                :aria-pressed="isListening(action, slot)"
                @click="listen(action, slot)"
                @blur="onBlur(action, slot)"
              >
                <span aria-hidden="true">{{ cap(action, slot) }}</span>
              </button>
            </span>
          </div>
        </div>
      </section>
    </div>

    <div class="keymap__timing">
      <label class="keymap__range">
        <span class="keymap__range-label">
          {{ t('keymap.das') }}
          <small>{{ t('keymap.dasHint') }}</small>
        </span>
        <input
          type="range"
          :min="DAS_RANGE.min"
          :max="DAS_RANGE.max"
          :step="DAS_RANGE.step"
          :value="settings.current.das"
          :aria-valuetext="format.milliseconds(settings.current.das)"
          @input="onDas"
        />
        <output class="keymap__value" aria-hidden="true">{{
          format.milliseconds(settings.current.das)
        }}</output>
      </label>
      <label class="keymap__range">
        <span class="keymap__range-label">
          {{ t('keymap.arr') }}
          <small>{{ t('keymap.arrHint') }}</small>
        </span>
        <input
          type="range"
          :min="ARR_RANGE.min"
          :max="ARR_RANGE.max"
          :step="ARR_RANGE.step"
          :value="settings.current.arr"
          :aria-valuetext="arrText()"
          @input="onArr"
        />
        <output class="keymap__value" aria-hidden="true">{{ arrText() }}</output>
      </label>
    </div>

    <p class="keymap__status" role="status">{{ status }}</p>

    <div class="sheet-buttons keymap__buttons">
      <button type="button" class="btn btn--raised" @click="reset">{{ t('keymap.reset') }}</button>
      <button type="button" class="btn btn--primary btn--raised" @click="close">
        {{ t('settings.close') }}
      </button>
    </div>
    <p class="sheet-note keymap__note">{{ t('keymap.mosaicNote') }}</p>
  </ModalDialog>
</template>

<style scoped>
.keymap__hint {
  margin-top: calc(var(--space-2) * -1);
}

.keymap__groups {
  display: grid;
  gap: var(--space-2);
}

.keymap__group {
  display: grid;
  gap: 0.3rem;
}

.keymap__heading {
  color: var(--text-muted);
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.keymap__rows {
  display: grid;
  gap: 0.3rem;
}

.keymap__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  min-height: 3.1rem;
  padding: 0.15rem 0.3rem 0.15rem var(--space-3);
  border-radius: 1rem;
  background: var(--highlight);
}

.keymap__action {
  display: grid;
  min-width: 0;
  font-size: 0.84rem;
  font-weight: 700;
  line-height: 1.2;
}

.keymap__action small {
  font-size: 0.68rem;
  font-weight: 600;
}

.keymap__only {
  color: var(--text-muted);
}

.keymap__row--unbound .keymap__action,
.keymap__missing {
  color: var(--danger);
}

.keymap__slots {
  display: flex;
  flex: none;
  gap: 0.3rem;
}

/* A key: the raised cap of the legend, large enough to tap. */
.keymap__key {
  display: grid;
  place-items: center;
  min-width: var(--touch);
  height: var(--touch);
  padding: 0 0.45rem;
  border: 1px solid var(--border);
  border-bottom-width: 4px;
  border-radius: 0.6rem;
  background: var(--surface-2);
  color: var(--text);
  font-family: var(--font-display);
  font-size: 0.85rem;
  font-weight: 800;
  line-height: 1;
  transition:
    border-color 120ms ease,
    transform 90ms ease;
}

.keymap__key:hover {
  border-color: var(--accent);
}

.keymap__key:active {
  transform: translateY(2px);
}

.keymap__key--wide {
  min-width: 4.5rem;
  font-family: var(--font-ui);
  font-size: 0.7rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.keymap__key--empty {
  border-style: dashed;
  border-bottom-width: 1px;
  background: transparent;
  color: var(--text-muted);
}

/* Waiting for a key: the cap glows gold. */
.keymap__key--listening {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 22%, var(--surface-2));
  color: var(--accent-strong);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 45%, transparent);
}

@media (prefers-reduced-motion: no-preference) {
  .keymap__key--listening {
    animation: keymap-wait 1.1s ease-in-out infinite;
  }
}

@keyframes keymap-wait {
  50% {
    box-shadow: 0 0 0 6px color-mix(in srgb, var(--accent) 20%, transparent);
  }
}

.keymap__timing {
  display: grid;
  gap: 0.3rem;
}

.keymap__range {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.15rem var(--space-3);
  padding: 0.45rem var(--space-3);
  border-radius: 1rem;
  background: var(--highlight);
  font-size: 0.84rem;
  font-weight: 700;
}

.keymap__range-label {
  display: grid;
  min-width: 0;
}

.keymap__range-label small {
  color: var(--text-muted);
  font-size: 0.7rem;
  font-weight: 600;
}

.keymap__range input {
  grid-column: 1 / -1;
  grid-row: 2;
  width: 100%;
  min-height: 2rem;
  margin: 0;
  accent-color: var(--accent-fill);
}

.keymap__value {
  grid-column: 2;
  grid-row: 1;
  color: var(--accent-strong);
  font-family: var(--font-display);
  font-size: 0.85rem;
  font-variant-numeric: tabular-nums;
}

.keymap__status {
  min-height: 1.2rem;
  color: var(--accent-strong);
  font-size: 0.8rem;
  font-weight: 700;
  text-align: center;
}

.keymap__note {
  text-align: center;
}

/* A wide screen: the two first groups side by side, the third across both, in two columns. */
@media (orientation: landscape) {
  .keymap__groups {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    column-gap: var(--space-3);
  }

  .keymap__group:last-child {
    grid-column: 1 / -1;
  }

  .keymap__group:last-child .keymap__rows {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    column-gap: var(--space-3);
  }

  .keymap__timing {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    column-gap: var(--space-3);
  }

  .keymap__row {
    min-height: 2.95rem;
  }
}

/* A short screen (a small window): smaller caps, the hints and the note left out. */
@media (max-height: 45rem) {
  .keymap__row {
    min-height: 2.6rem;
  }

  .keymap__key {
    min-width: 2.4rem;
    height: 2.4rem;
  }

  .keymap__range {
    padding-block: 0.3rem;
  }

  .keymap__range-label small,
  .keymap__note {
    display: none;
  }
}
</style>

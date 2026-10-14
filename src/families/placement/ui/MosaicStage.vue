<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useServices } from '@/app/AppServices';
import type { FrameClock } from '@/app/FrameClock';
import { useFormat } from '@/app/useFormat';
import { effectsProfile } from '@/fx/EffectsProfile';
import { TonePalette } from '@/render/TonePalette';
import type { GameSession } from '@/session/GameSession';
import AppIcon, { type IconName } from '@/ui/components/AppIcon.vue';
import type { OfferedPiece } from '../engine/Dealer';
import type { SlotId } from '../engine/MosaicGame';
import { MosaicEffects } from '../fx/MosaicEffects';
import { MosaicSoundscape } from '../fx/MosaicSoundscape';
import { JOKER_IDS, JOKERS, type JokerId } from '../jokers/Joker';
import { MosaicController, type Preview } from '../MosaicController';
import { PlacementSession } from '../PlacementSession';
import { MosaicRenderer } from '../render/MosaicRenderer';
import HandPiece from './HandPiece.vue';

const props = defineProps<{
  session: GameSession;
  clock: FrameClock;
  /** False while paused or over: input is ignored. */
  active: boolean;
  ghost: boolean;
}>();
const emit = defineEmits<{ pause: [] }>();

if (!(props.session instanceof PlacementSession))
  throw new Error('MosaicStage needs a PlacementSession');
const session: PlacementSession = props.session;

const { t } = useI18n();
const format = useFormat();
const { theme, settings, audio, haptics } = useServices();

const JOKER_ICONS: Readonly<Record<JokerId, IconName>> = {
  rotate: 'rotateCw',
  reroll: 'restart',
  bomb: 'bomb',
  undo: 'undo',
  cube: 'cube',
};
const SLOTS: readonly SlotId[] = [0, 1, 2, 'bonus'];

// --- Engine, controller, effects ---------------------------------------------

const controller = new MosaicController(
  session.view,
  (command) => props.active && session.execute(command),
);
const profile = computed(() => effectsProfile(settings.current.effects, settings.current.shake));
const palette = shallowRef<TonePalette | null>(null);
const effects = new MosaicEffects(
  session.view,
  () => profile.value,
  () => palette.value,
  (points) => format.number(points),
);
const detachEffects = effects.attach(session);
const detachSounds = new MosaicSoundscape(audio, haptics).attach(session);

// --- Reactive mirror of the hand and the jokers --------------------------------

interface HandSlot {
  readonly slot: SlotId;
  readonly piece: OfferedPiece | null;
  readonly fits: boolean;
}
const hand = shallowRef<readonly HandSlot[]>([]);
const jokers = shallowRef<readonly JokerId[]>([]);
const selected = ref<SlotId | null>(null);
const pending = ref<number | null>(null);
const pieceSize = ref(72);

const refresh = () => {
  const view = session.view;
  hand.value = SLOTS.filter((slot) => slot !== 'bonus' || view.pieceAt('bonus')).map((slot) => {
    const piece = view.pieceAt(slot);
    return { slot, piece, fits: piece ? view.grid.fitsAnywhere(piece.shape) : false };
  });
  jokers.value = [...view.jokers];
  selected.value = controller.selected;
  pending.value = controller.pendingJoker;
};
const detachRefresh = (
  ['deal', 'place', 'jokerGained', 'jokerUsed', 'turn', 'undo', 'bomb', 'rescue'] as const
).map((type) => session.onGame(type, refresh));

/** One button per kind of joker, with how many are held; it uses the first of them. */
const jokerGroups = computed(() =>
  JOKER_IDS.filter((id) => jokers.value.includes(id)).map((id) => ({
    id,
    index: jokers.value.indexOf(id),
    count: jokers.value.filter((held) => held === id).length,
  })),
);

const prompt = computed(() => {
  const id = pending.value === null ? null : jokers.value[pending.value];
  if (!id) return '';
  return JOKERS[id].target === 'piece' ? t('mosaic.pickPiece') : t('mosaic.pickCell');
});

const pieceLabel = (entry: HandSlot, index: number) => {
  if (!entry.piece) return t('mosaic.empty');
  const name = entry.slot === 'bonus' ? t('mosaic.bonus') : t('mosaic.piece', { n: index + 1 });
  const cells = t('mosaic.cells', { n: entry.piece.shape.size });
  return entry.fits ? `${name}, ${cells}` : `${name}, ${cells}, ${t('mosaic.stuck')}`;
};

// --- Board rendering -------------------------------------------------------------

const boardArea = ref<HTMLElement | null>(null);
const canvas = ref<HTMLCanvasElement | null>(null);
const ghostCanvas = ref<HTMLCanvasElement | null>(null);
let renderer: MosaicRenderer | null = null;
let cellCss = 40;
let keyboardMode = false;
let hoverCell: { x: number; y: number } | null = null;
let dragPreview: Preview | null = null;

const observer = new ResizeObserver(([entry]) => {
  if (!entry || !renderer) return;
  const { width, height } = entry.contentRect;
  // Minus the 2 px frame on each side.
  cellCss = renderer.layout(Math.min(width, height) - 4, Math.min(2, window.devicePixelRatio || 1));
  // Four pieces (with the cube) must fit side by side. The size depends on the
  // screen only, never on the board: the board's room depends on the hand, and a
  // loop between the two would resize (and clear) the board every frame.
  const handRoom = (width - 3 * 12) / 4;
  pieceSize.value = Math.round(Math.max(48, Math.min(120, handRoom, window.innerHeight * 0.17)));
});

const refreshPalette = async () => {
  await nextTick();
  palette.value = TonePalette.fromElement(document.documentElement);
  renderer?.setPalette(palette.value);
};
watch(theme.resolved, refreshPalette);

const overlay = () => {
  const pendingId = controller.pendingJokerId;
  const bombAt = pendingId === 'bomb' ? (keyboardMode ? controller.cursor : hoverCell) : null;
  return {
    preview: dragPreview ?? (keyboardMode ? controller.keyboardPreview() : null),
    bomb: bombAt,
    cursor: keyboardMode && props.active ? controller.cursor : null,
  };
};

const offFrame = props.clock.subscribe((delta) => {
  if (props.active || session.state === 'over') effects.update(delta);
  renderer?.render(overlay());
});

// --- Pointer: tap, drag and drop ---------------------------------------------------

interface Drag {
  readonly slot: SlotId;
  readonly pointerId: number;
  readonly startX: number;
  readonly startY: number;
  readonly lift: number;
  moving: boolean;
}
let drag: Drag | null = null;

const cellAt = (clientX: number, clientY: number) => {
  const rect = canvas.value?.getBoundingClientRect();
  if (!rect) return null;
  const x = Math.floor((clientX - rect.left) / cellCss);
  const y = Math.floor((clientY - rect.top) / cellCss);
  const size = session.view.grid.size;
  return x >= 0 && y >= 0 && x < size && y < size ? { x, y } : null;
};

const onGrab = (slot: SlotId, event: PointerEvent) => {
  keyboardMode = false;
  if (!props.active || !session.view.pieceAt(slot)) return;
  if (controller.pendingJokerId && JOKERS[controller.pendingJokerId].target === 'piece') {
    controller.selectSlot(slot);
    refresh();
    return;
  }
  drag = {
    slot,
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    // A finger hides what it holds: the piece floats above it.
    lift: event.pointerType === 'touch' ? cellCss * 1.8 : cellCss * 0.6,
    moving: false,
  };
  window.addEventListener('pointermove', onDragMove);
  window.addEventListener('pointerup', onDragEnd);
  window.addEventListener('pointercancel', onDragCancel);
};

const onDragMove = (event: PointerEvent) => {
  if (!drag || event.pointerId !== drag.pointerId) return;
  if (!drag.moving && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 6)
    return;
  drag.moving = true;
  const piece = session.view.pieceAt(drag.slot);
  const rect = canvas.value?.getBoundingClientRect();
  if (!piece || !rect) return;
  const x = Math.round((event.clientX - rect.left) / cellCss - piece.shape.width / 2);
  const y = Math.round((event.clientY - drag.lift - rect.top) / cellCss - piece.shape.height / 2);
  const near =
    event.clientX > rect.left - cellCss &&
    event.clientX < rect.right + cellCss &&
    event.clientY - drag.lift > rect.top - cellCss &&
    event.clientY - drag.lift < rect.bottom + cellCss;
  dragPreview = near ? controller.previewAt(drag.slot, x, y) : null;
  moveGhost(event.clientX, event.clientY - drag.lift, piece, !near);
};

const onDragEnd = (event: PointerEvent) => {
  if (!drag || event.pointerId !== drag.pointerId) return;
  const { slot, moving } = drag;
  if (moving && dragPreview?.valid) controller.drop(slot, dragPreview.x, dragPreview.y);
  else if (!moving) controller.selectSlot(slot);
  endDrag();
  refresh();
};

const onDragCancel = () => endDrag();

const endDrag = () => {
  drag = null;
  dragPreview = null;
  hideGhost();
  window.removeEventListener('pointermove', onDragMove);
  window.removeEventListener('pointerup', onDragEnd);
  window.removeEventListener('pointercancel', onDragCancel);
};

/** The dragged piece, following the pointer when it is away from the board. */
const moveGhost = (clientX: number, clientY: number, piece: OfferedPiece, visible: boolean) => {
  const ghost = ghostCanvas.value;
  const tiles = renderer?.tiles;
  const host = ghost?.parentElement?.getBoundingClientRect();
  if (!ghost || !tiles || !host) return;
  if (!visible) {
    hideGhost();
    return;
  }
  const cell = tiles.size;
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  ghost.width = piece.shape.width * cell;
  ghost.height = piece.shape.height * cell;
  ghost.style.width = `${ghost.width / ratio}px`;
  ghost.style.height = `${ghost.height / ratio}px`;
  const ctx = ghost.getContext('2d');
  ctx?.clearRect(0, 0, ghost.width, ghost.height);
  for (const c of piece.shape.cells) ctx?.drawImage(tiles.get(piece.tone), c.x * cell, c.y * cell);
  const left = clientX - host.left - ghost.width / ratio / 2;
  const top = clientY - host.top - ghost.height / ratio / 2;
  ghost.style.transform = `translate(${left}px, ${top}px)`;
  ghost.style.visibility = 'visible';
};

const hideGhost = () => {
  if (ghostCanvas.value) ghostCanvas.value.style.visibility = 'hidden';
};

const onBoardMove = (event: PointerEvent) => {
  // The pointer takes over from the keyboard: previews follow it again.
  keyboardMode = false;
  hoverCell = cellAt(event.clientX, event.clientY);
};

const onBoardTap = (event: PointerEvent) => {
  // The end of a drag is handled by the drag itself.
  if (drag) return;
  keyboardMode = false;
  const cell = cellAt(event.clientX, event.clientY);
  if (!cell || !props.active) return;
  controller.tapCell(cell.x, cell.y);
  refresh();
};

// --- Jokers and keyboard ---------------------------------------------------------------

const jokerBar = ref<HTMLElement | null>(null);

const chooseJoker = (index: number) => {
  if (!props.active) return;
  controller.chooseJoker(index);
  refresh();
};

const DIGIT_SLOTS: Readonly<Record<string, SlotId>> = {
  Digit1: 0,
  Numpad1: 0,
  Digit2: 1,
  Numpad2: 1,
  Digit3: 2,
  Numpad3: 2,
  Digit4: 'bonus',
  Numpad4: 'bonus',
};
const ARROWS: Readonly<Record<string, readonly [number, number]>> = {
  ArrowLeft: [-1, 0],
  KeyA: [-1, 0],
  ArrowRight: [1, 0],
  KeyD: [1, 0],
  ArrowUp: [0, -1],
  KeyW: [0, -1],
  ArrowDown: [0, 1],
  KeyS: [0, 1],
};

const onKeyDown = (event: KeyboardEvent) => {
  if (document.querySelector('dialog[open]')) return;
  if (event.target instanceof HTMLElement && event.target.closest('input, select, textarea'))
    return;
  const code = event.code;
  if (code === 'Escape' || code === 'KeyP') {
    event.preventDefault();
    if (code === 'Escape' && (controller.selected !== null || controller.pendingJoker !== null))
      controller.cancel();
    else emit('pause');
    refresh();
    return;
  }
  if (!props.active) return;
  const slot = DIGIT_SLOTS[code];
  const arrow = ARROWS[code];
  if (slot !== undefined) {
    controller.selectSlot(slot);
  } else if (arrow) {
    controller.moveCursor(arrow[0], arrow[1]);
  } else if (code === 'Enter' || code === 'Space') {
    // Enter on a focused button activates it instead.
    if (event.target instanceof HTMLButtonElement) return;
    controller.confirm();
  } else if (code === 'KeyJ') {
    jokerBar.value?.querySelector('button')?.focus();
  } else {
    return;
  }
  event.preventDefault();
  keyboardMode = true;
  refresh();
};

watch(
  () => props.active,
  (active) => {
    if (!active) endDrag();
  },
);

onMounted(() => {
  if (canvas.value) renderer = new MosaicRenderer(canvas.value, session.view, effects);
  if (boardArea.value) observer.observe(boardArea.value);
  void refreshPalette();
  refresh();
  window.addEventListener('keydown', onKeyDown);
});

onBeforeUnmount(() => {
  offFrame();
  endDrag();
  detachEffects();
  detachSounds();
  detachRefresh.forEach((off) => off());
  observer.disconnect();
  window.removeEventListener('keydown', onKeyDown);
});
</script>

<template>
  <div class="mosaic">
    <div ref="boardArea" class="mosaic__board">
      <canvas
        ref="canvas"
        class="mosaic__canvas"
        role="img"
        :aria-label="t('mosaic.board')"
        @pointermove="onBoardMove"
        @pointerup="onBoardTap"
      />
    </div>

    <p class="mosaic__prompt" aria-live="polite">{{ prompt }}</p>

    <div class="mosaic__hand" role="group" :aria-label="t('mosaic.hand')">
      <HandPiece
        v-for="(entry, index) in hand"
        :key="entry.slot"
        :piece="entry.piece"
        :palette="palette"
        :size="pieceSize"
        :label="pieceLabel(entry, index)"
        :selected="selected === entry.slot"
        :fits="entry.fits"
        :targeted="pending !== null && jokers[pending] === 'rotate'"
        @grab="onGrab(entry.slot, $event)"
        @select="
          controller.selectSlot(entry.slot);
          refresh();
        "
      />
    </div>

    <div ref="jokerBar" class="mosaic__jokers" role="group" :aria-label="t('mosaic.jokers')">
      <p v-if="jokers.length === 0" class="mosaic__no-joker">{{ t('mosaic.noJoker') }}</p>
      <button
        v-for="group in jokerGroups"
        :key="group.id"
        type="button"
        class="joker"
        :class="{ 'joker--pending': pending === group.index }"
        :aria-pressed="pending === group.index"
        @click="chooseJoker(group.index)"
      >
        <AppIcon :name="JOKER_ICONS[group.id]" :size="20" />
        <span>{{ t(`jokers.${group.id}`) }}</span>
        <span v-if="group.count > 1" class="joker__count">
          {{ t('mosaic.jokerCount', { n: group.count }) }}
        </span>
      </button>
    </div>

    <canvas ref="ghostCanvas" class="mosaic__ghost" aria-hidden="true" />
  </div>
</template>

<style scoped>
.mosaic {
  position: relative;
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto auto auto;
  /* minmax(0, 1fr): the canvas must never widen the column it sits in. */
  grid-template-columns: minmax(0, 1fr);
  justify-items: center;
  gap: var(--space-2);
  height: 100%;
  padding: var(--space-2) var(--space-3) calc(var(--space-3) + env(safe-area-inset-bottom));
  overflow: hidden;
}

.mosaic__board {
  display: grid;
  place-items: center;
  width: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.mosaic__canvas {
  display: block;
  max-width: 100%;
  border: 2px solid var(--well-frame);
  box-shadow:
    0 0 3rem rgb(120 90 255 / 0.22),
    inset 0 0 2rem rgb(120 90 255 / 0.12);
  border-radius: var(--radius);
  touch-action: none;
  cursor: pointer;
}

.mosaic__prompt {
  min-height: 1.4em;
  font-weight: 700;
  color: var(--accent);
}

.mosaic__hand {
  display: flex;
  justify-content: center;
  gap: var(--space-3);
  width: min(100%, 34rem);
}

.mosaic__jokers {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--space-2);
  min-height: var(--touch);
}

.mosaic__no-joker {
  align-self: center;
  font-size: 0.875rem;
  color: var(--text-muted);
}

.joker {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  min-height: var(--touch);
  padding: 0 var(--space-3);
  border: 1px solid var(--accent-fill);
  border-radius: 999px;
  background: var(--surface);
  font-weight: 700;
}

.joker__count {
  font-variant-numeric: tabular-nums;
  opacity: 0.8;
}

.joker--pending {
  background: var(--accent-fill);
  color: var(--on-accent-fill);
}

.mosaic__ghost {
  position: absolute;
  top: 0;
  left: 0;
  visibility: hidden;
  pointer-events: none;
  opacity: 0.85;
  filter: drop-shadow(0 0.5rem 0.75rem rgb(0 0 0 / 0.35));
}
</style>

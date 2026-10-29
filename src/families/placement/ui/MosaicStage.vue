<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useServices } from '@/app/AppServices';
import type { FrameClock } from '@/app/FrameClock';
import { useFormat } from '@/app/useFormat';
import { effectsProfile } from '@/fx/EffectsProfile';
import * as sounds from '@/fx/sounds';
import { TonePalette } from '@/render/TonePalette';
import type { GameSession } from '@/session/GameSession';
import AppIcon, { type IconName } from '@/ui/components/AppIcon.vue';
import { useLandscape } from '@/ui/useOrientation';
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
const emit = defineEmits<{ pause: []; notice: [text: string] }>();

if (!(props.session instanceof PlacementSession))
  throw new Error('MosaicStage needs a PlacementSession');
const session: PlacementSession = props.session;

const { t } = useI18n();
const format = useFormat();
const { theme, settings, audio, haptics, pixelRatio } = useServices();

const JOKER_ICONS: Readonly<Record<JokerId, IconName>> = {
  rotate: 'rotateCw',
  // The swap of the Dunes' hand: new pieces (the restart arrow mirrored the rotation's).
  reroll: 'swap',
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
const soundscape = new MosaicSoundscape(audio, haptics);
const detachSounds = soundscape.attach(session);

// --- Reactive mirror of the hand and the jokers --------------------------------

interface HandSlot {
  readonly slot: SlotId;
  readonly piece: OfferedPiece | null;
  readonly fits: boolean;
}
const hand = shallowRef<readonly HandSlot[]>([]);
const jokers = shallowRef<readonly JokerId[]>([]);
const selected = ref<SlotId | null>(null);
/** The piece in the player's hand (dragged, or flying back): its place stays empty. */
const lifted = ref<SlotId | null>(null);
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const moving = computed(() => profile.value.motion && !reducedMotion);
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

interface JokerSlot {
  readonly id: JokerId;
  /** Where the first one held sits in the inventory (-1: none held). */
  readonly index: number;
  readonly count: number;
}

/**
 * One slot per kind of joker, always shown (1.38.1): lit with how many are
 * held, dim until earned. The row keeps its size whatever is held, so the
 * board never shrinks when a joker comes.
 */
const jokerSlots = computed<readonly JokerSlot[]>(() =>
  JOKER_IDS.map((id) => ({
    id,
    index: jokers.value.indexOf(id),
    count: jokers.value.filter((held) => held === id).length,
  })),
);

/** The slot's name: how many are held, or how the joker is earned. */
const slotLabel = ({ id, count }: JokerSlot) =>
  count > 0
    ? t('mosaic.jokerHeld', { name: t(`jokers.${id}`), n: format.number(count) })
    : t('mosaic.jokerLocked', { name: t(`jokers.${id}`), how: t(`mosaic.jokerHow.${id}`) });

const prompt = computed(() => {
  const id = pending.value === null ? null : jokers.value[pending.value];
  if (!id) return '';
  return JOKERS[id].target === 'piece' ? t('mosaic.pickPiece') : t('mosaic.pickCell');
});

const pieceLabel = (entry: HandSlot, index: number) => {
  if (!entry.piece) return t('mosaic.empty');
  const name = entry.slot === 'bonus' ? t('mosaic.bonus') : t('mosaic.piece', { n: index + 1 });
  const cells = t('mosaic.cells', { n: entry.piece.shape.size }, entry.piece.shape.size);
  return entry.fits ? `${name}, ${cells}` : `${name}, ${cells}, ${t('mosaic.stuck')}`;
};

// --- Board rendering -------------------------------------------------------------

const boardArea = ref<HTMLElement | null>(null);
const handArea = ref<HTMLElement | null>(null);
const landscape = useLandscape();
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
  cellCss = renderer.layout(Math.min(width, height) - 4, pixelRatio());
});
/**
 * Four pieces (with the cube) must fit: side by side under the board in
 * portrait, one above the other beside it in landscape. The hand's room comes
 * from the grid, never from the pieces: no loop between the two.
 */
const handObserver = new ResizeObserver(([entry]) => {
  if (!entry) return;
  const { width, height } = entry.contentRect;
  const room = landscape.value ? Math.min(width - 8, (height - 3 * 8) / 4) : (width - 3 * 12) / 4;
  const cap = landscape.value ? 120 : Math.min(120, window.innerHeight * 0.15);
  pieceSize.value = Math.round(Math.max(44, Math.min(cap, room)));
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

const offFrame = props.clock.subscribe((delta, real) => {
  // Effects, and the sounds waiting for them, freeze with the pause.
  if (props.active || session.state === 'over') {
    effects.update(delta, real);
    soundscape.update(delta);
  }
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
  const piece = session.view.pieceAt(drag.slot);
  const rect = canvas.value?.getBoundingClientRect();
  if (!piece || !rect) return;
  if (!drag.moving) {
    // Picked up: the piece leaves its place and grows to the board's size.
    drag.moving = true;
    lifted.value = drag.slot;
    audio.play(sounds.pickUp);
    liftGhost = true;
  }
  const x = Math.round((event.clientX - rect.left) / cellCss - piece.shape.width / 2);
  const y = Math.round((event.clientY - drag.lift - rect.top) / cellCss - piece.shape.height / 2);
  const near =
    event.clientX > rect.left - cellCss &&
    event.clientX < rect.right + cellCss &&
    event.clientY - drag.lift > rect.top - cellCss &&
    event.clientY - drag.lift < rect.bottom + cellCss;
  const before = dragPreview;
  dragPreview = near ? controller.previewAt(drag.slot, x, y) : null;
  // A soft tick each time the piece finds a new place where it fits.
  if (dragPreview?.valid && (!before || dragPreview.x !== before.x || dragPreview.y !== before.y))
    audio.play(sounds.snapHint);
  moveGhost(event.clientX, event.clientY - drag.lift, piece);
};

const onDragEnd = (event: PointerEvent) => {
  if (!drag || event.pointerId !== drag.pointerId) return;
  const { slot, moving: dragged } = drag;
  const target = dragPreview?.valid ? dragPreview : null;
  endDrag(false);
  if (!dragged) {
    controller.selectSlot(slot);
    refresh();
  } else if (target) {
    // The piece glides into its place, then is set down.
    void flyGhost(boardRect(target.x, target.y), 1, 90, 'ease-in').then(() => {
      if (props.active) controller.drop(slot, target.x, target.y);
      land();
    });
  } else {
    audio.play(sounds.putBack);
    void flyGhost(slotRect(slot), handScale(slot), 220, 'cubic-bezier(0.3, 1.3, 0.5, 1)').then(
      land,
    );
  }
};

const onDragCancel = () => {
  endDrag(false);
  land();
};

/** The flight is over: the piece is on the board or back in the hand. */
const land = () => {
  hideGhost();
  lifted.value = null;
  refresh();
};

const endDrag = (hide = true) => {
  drag = null;
  dragPreview = null;
  if (hide) land();
  window.removeEventListener('pointermove', onDragMove);
  window.removeEventListener('pointerup', onDragEnd);
  window.removeEventListener('pointercancel', onDragCancel);
};

/** The ghost has just been picked up: it grows from the hand's size on its first frame. */
let liftGhost = false;
/** Where the ghost is (client pixels of its top left corner). */
let ghostAt = { left: 0, top: 0 };

const ghostHost = () => {
  const ghost = ghostCanvas.value;
  // The ghost is placed in the game screen (the stage has no box of its own).
  return (ghost?.offsetParent ?? ghost?.parentElement)?.getBoundingClientRect() ?? null;
};

/** Where a piece put at (x, y) on the board would be, in client pixels. */
const boardRect = (x: number, y: number) => {
  const rect = canvas.value?.getBoundingClientRect();
  return { left: (rect?.left ?? 0) + x * cellCss, top: (rect?.top ?? 0) + y * cellCss };
};

/** Where the ghost would sit centred on a slot of the hand, in client pixels. */
const slotRect = (slot: SlotId) => {
  const box = handArea.value
    ?.querySelector(`[data-slot="${String(slot)}"]`)
    ?.getBoundingClientRect();
  const ghost = ghostCanvas.value?.getBoundingClientRect();
  if (!box || !ghost) return ghostAt;
  return {
    left: box.left + box.width / 2 - ghost.width / 2,
    top: box.top + box.height / 2 - ghost.height / 2,
  };
};

/** How much smaller the piece is drawn in the hand than on the board. */
const handScale = (slot: SlotId) => {
  const piece = session.view.pieceAt(slot);
  if (!piece) return 0.6;
  const handCell =
    pieceSize.value / Math.max(3.2, piece.shape.width + 0.6, piece.shape.height + 0.6);
  return Math.min(1, handCell / cellCss);
};

/** The ghost glides to a place (client pixels) at the given scale; instant without motion. */
const flyGhost = (
  to: { left: number; top: number },
  scale: number,
  duration: number,
  easing: string,
) =>
  new Promise<void>((resolve) => {
    const ghost = ghostCanvas.value;
    const host = ghostHost();
    if (!ghost || !host || ghost.style.visibility !== 'visible' || !moving.value) {
      resolve();
      return;
    }
    const from = `translate(${ghostAt.left - host.left}px, ${ghostAt.top - host.top}px)`;
    const end = `translate(${to.left - host.left}px, ${to.top - host.top}px) scale(${scale})`;
    const flight = ghost.animate([{ transform: from }, { transform: end }], {
      duration,
      easing,
      fill: 'forwards',
    });
    flight.onfinish = () => {
      flight.cancel();
      resolve();
    };
    flight.oncancel = () => resolve();
  });

/** The dragged piece, at the board's size, following the pointer above the finger. */
const moveGhost = (clientX: number, clientY: number, piece: OfferedPiece) => {
  const ghost = ghostCanvas.value;
  const tiles = renderer?.tiles;
  const host = ghostHost();
  if (!ghost || !tiles || !host) return;
  const cell = tiles.size;
  const ratio = pixelRatio();
  ghost.width = piece.shape.width * cell;
  ghost.height = piece.shape.height * cell;
  ghost.style.width = `${ghost.width / ratio}px`;
  ghost.style.height = `${ghost.height / ratio}px`;
  const ctx = ghost.getContext('2d');
  ctx?.clearRect(0, 0, ghost.width, ghost.height);
  for (const c of piece.shape.cells) ctx?.drawImage(tiles.get(piece.tone), c.x * cell, c.y * cell);
  ghostAt = { left: clientX - ghost.width / ratio / 2, top: clientY - ghost.height / ratio / 2 };
  ghost.style.transform = `translate(${ghostAt.left - host.left}px, ${ghostAt.top - host.top}px)`;
  ghost.style.visibility = 'visible';
  if (liftGhost) {
    liftGhost = false;
    if (moving.value)
      ghost.animate([{ scale: '0.6' }, { scale: '1.06', offset: 0.7 }, { scale: '1' }], {
        duration: 160,
        easing: 'ease-out',
      });
  }
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

/** A held joker is chosen; a dim one tells how it is earned. */
const onJokerSlot = (slot: JokerSlot) => {
  if (slot.count > 0) chooseJoker(slot.index);
  else emit('notice', slotLabel(slot));
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
  // Backspace cancels a choice (never Esc: portals keep it to leave full screen); P pauses.
  if (code === 'Backspace' && (controller.selected !== null || controller.pendingJoker !== null)) {
    event.preventDefault();
    controller.cancel();
    refresh();
    return;
  }
  if (code === 'KeyP') {
    event.preventDefault();
    emit('pause');
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
    jokerBar.value?.querySelector<HTMLElement>('.joker--held')?.focus();
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
  if (handArea.value) handObserver.observe(handArea.value);
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
  handObserver.disconnect();
  window.removeEventListener('keydown', onKeyDown);
});
</script>

<template>
  <div class="stage mosaic">
    <div ref="boardArea" class="stage__well mosaic__board">
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

    <div ref="handArea" class="mosaic__hand" role="group" :aria-label="t('mosaic.hand')">
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
        :lifted="lifted === entry.slot"
        :index="index"
        :moving="moving"
        :data-slot="String(entry.slot)"
        @grab="onGrab(entry.slot, $event)"
        @select="
          controller.selectSlot(entry.slot);
          refresh();
        "
      />
    </div>

    <div ref="jokerBar" class="mosaic__jokers" role="group" :aria-label="t('mosaic.jokers')">
      <button
        v-for="slot in jokerSlots"
        :key="slot.id"
        type="button"
        class="joker"
        :class="{
          'joker--held': slot.count > 0,
          'joker--pending': slot.count > 0 && pending === slot.index,
        }"
        :aria-label="slotLabel(slot)"
        :aria-disabled="slot.count === 0 ? 'true' : undefined"
        :aria-pressed="slot.count > 0 ? pending === slot.index : undefined"
        :title="slotLabel(slot)"
        @click="onJokerSlot(slot)"
      >
        <AppIcon :name="JOKER_ICONS[slot.id]" :size="22" />
        <span v-if="slot.count > 1" class="joker__count" aria-hidden="true">
          {{ format.number(slot.count) }}
        </span>
      </button>
    </div>

    <canvas ref="ghostCanvas" class="mosaic__ghost" aria-hidden="true" />
  </div>
</template>

<style scoped>
/* The shared parts are in styles/stage.css; each part names its grid area. */
.mosaic__board {
  width: 100%;
}

.mosaic__canvas {
  display: block;
  max-width: 100%;
  border-radius: var(--radius);
  box-shadow:
    0 0 0 2px var(--well-frame),
    0 0 3rem var(--well-glow),
    0 0 0 7px var(--well-halo);
  touch-action: none;
  cursor: pointer;
}

.mosaic__prompt {
  grid-area: prompt;
  text-align: center;
  min-height: 1.4em;
  font-weight: 700;
  color: var(--accent);
}

.mosaic__hand {
  grid-area: hand;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: var(--space-3);
  min-width: 0;
  min-height: 0;
}

/*
 * The jokers: five slots, one per kind, always there (1.38.1). With five
 * slots whatever is held, the bar's height depends on its width alone: the
 * board never shrinks when a joker comes. They wrap only in a column too
 * narrow for five (a phone in landscape).
 */
.mosaic__jokers {
  --joker-size: var(--touch);
  grid-area: jokers;
  display: grid;
  grid-template-columns: repeat(auto-fit, var(--joker-size));
  justify-content: center;
  gap: var(--space-2);
}

.joker {
  position: relative;
  display: grid;
  place-items: center;
  width: var(--joker-size);
  height: var(--joker-size);
  padding: 0;
  border: 1px solid var(--accent-fill);
  border-radius: 999px;
  background: var(--surface);
}

/* Not earned yet: a dim outline; touched, it tells how the joker is earned. */
.joker:not(.joker--held) {
  border-style: dashed;
  border-color: var(--border);
  background: transparent;
  color: var(--text-muted);
  opacity: 0.6;
  cursor: help;
}

.joker__count {
  position: absolute;
  top: -0.375rem;
  right: -0.375rem;
  min-width: 1.375rem;
  padding: 0 0.25rem;
  border-radius: 999px;
  background: var(--accent-fill);
  color: var(--on-accent-fill);
  box-shadow: 0 0 0 2px var(--bg);
  font-size: 0.875rem;
  font-weight: 800;
  line-height: 1.375rem;
  font-variant-numeric: tabular-nums;
  text-align: center;
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
  z-index: 5;
  pointer-events: none;
  will-change: transform;
  filter: drop-shadow(0 0.75rem 1rem rgb(0 0 0 / 0.4));
}

/* Landscape: the hand stands in a column beside the board. */
@media (orientation: landscape) {
  .mosaic__hand {
    flex-direction: column;
    gap: var(--space-2);
  }

  /* Under the dashboard and aligned with it: its 15em, in the HUD's size, hold the five. */
  .mosaic__jokers {
    justify-self: end;
    width: min(100%, 15em);
    font-size: var(--hud-size);
    justify-content: start;
    align-content: start;
    gap: 0.25rem;
  }
}

/*
 * Short landscape screens with a mouse (821 × 462 on CrazyGames): the five
 * slots on one row of the narrow column, up to 36 px each, clear of the keys
 * under them. A phone keeps its 44 px targets (two rows; no keys on touch).
 */
@media (orientation: landscape) and (max-height: 32rem) and (pointer: fine) {
  .mosaic__jokers {
    grid-template-columns: repeat(5, minmax(0, 2.25rem));
    gap: 0.375rem;
  }

  .joker {
    width: 100%;
    height: auto;
    aspect-ratio: 1;
  }
}
</style>

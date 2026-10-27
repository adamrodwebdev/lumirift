import { ref, type Ref } from 'vue';
import * as sounds from '@/fx/sounds';
import type { SoundRecipe } from '@/services/audio/AudioEngine';
import type { DunesPreview } from '../DunesController';
import type { OfferedSand } from '../engine/DunesDealer';

/** What the drag needs from its stage: the board, the hand, the rules, the drawing. */
export interface HandDragHost {
  readonly board: Ref<HTMLCanvasElement | null>;
  readonly ghost: Ref<HTMLCanvasElement | null>;
  readonly hand: Ref<HTMLElement | null>;
  /** A cell's side on the board, in CSS pixels. */
  cellCss(): number;
  pieceAt(slot: number): OfferedSand | null;
  previewAt(slot: number, x: number, y: number): DunesPreview | null;
  /** The piece goes down (after its glide). */
  drop(slot: number, x: number, y: number): void;
  /** A tap on a piece without moving it: it is picked. */
  select(slot: number): void;
  /** Draws a piece on the ghost canvas, at this cell size in device pixels. */
  paint(canvas: HTMLCanvasElement, piece: OfferedSand, cellPx: number): void;
  /** How much smaller a slot's piece is drawn in the hand than on the board. */
  handScale(slot: number): number;
  /** Input is taken (not paused, not over). */
  active(): boolean;
  /** Motion allowed. */
  moving(): boolean;
  play(sound: SoundRecipe): void;
}

interface Drag {
  readonly slot: number;
  readonly pointerId: number;
  readonly startX: number;
  readonly startY: number;
  readonly lift: number;
  moving: boolean;
}

/** Below this travel (px) a press is a tap: it picks the piece. */
const TAP_TRAVEL = 6;

/**
 * Dragging a piece of the hand onto the board (Dunes, 1.37), as the Mosaic
 * does it: the piece floats above the finger at the board's size, snaps to
 * the cells, glides into place when dropped where it fits, flies back to the
 * hand otherwise. `preview` is where it would go now.
 */
export function useHandDrag(host: HandDragHost) {
  /** The slot whose piece is in the player's hand (dragged, or flying back). */
  const lifted = ref<number | null>(null);
  let drag: Drag | null = null;
  let preview: DunesPreview | null = null;
  /** The ghost has just been picked up: it grows from the hand's size on its first frame. */
  let liftGhost = false;
  /** Where the ghost is (client pixels of its top-left corner). */
  let ghostAt = { left: 0, top: 0 };

  const ratio = () => Math.min(2, window.devicePixelRatio || 1);

  const ghostHost = () => {
    const ghost = host.ghost.value;
    // The ghost is placed in the game screen (the stage has no box of its own).
    return (ghost?.offsetParent ?? ghost?.parentElement)?.getBoundingClientRect() ?? null;
  };

  /** Where a piece put at (x, y) on the board would be, in client pixels. */
  const boardRect = (x: number, y: number) => {
    const rect = host.board.value?.getBoundingClientRect();
    const cell = host.cellCss();
    return { left: (rect?.left ?? 0) + x * cell, top: (rect?.top ?? 0) + y * cell };
  };

  /** Where the ghost would sit centred on a slot of the hand, in client pixels. */
  const slotRect = (slot: number) => {
    const box = host.hand.value?.querySelector(`[data-slot="${slot}"]`)?.getBoundingClientRect();
    const ghost = host.ghost.value?.getBoundingClientRect();
    if (!box || !ghost) return ghostAt;
    return {
      left: box.left + box.width / 2 - ghost.width / 2,
      top: box.top + box.height / 2 - ghost.height / 2,
    };
  };

  /** The ghost glides to a place (client pixels) at the given scale; instant without motion. */
  const fly = (
    to: { left: number; top: number },
    scale: number,
    duration: number,
    easing: string,
  ) =>
    new Promise<void>((resolve) => {
      const ghost = host.ghost.value;
      const box = ghostHost();
      if (!ghost || !box || ghost.style.visibility !== 'visible' || !host.moving()) {
        resolve();
        return;
      }
      const from = `translate(${ghostAt.left - box.left}px, ${ghostAt.top - box.top}px)`;
      const end = `translate(${to.left - box.left}px, ${to.top - box.top}px) scale(${scale})`;
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
  const follow = (clientX: number, clientY: number, piece: OfferedSand) => {
    const ghost = host.ghost.value;
    const box = ghostHost();
    if (!ghost || !box) return;
    const cell = Math.round(host.cellCss() * ratio());
    ghost.width = piece.shape.width * cell;
    ghost.height = piece.shape.height * cell;
    ghost.style.width = `${ghost.width / ratio()}px`;
    ghost.style.height = `${ghost.height / ratio()}px`;
    host.paint(ghost, piece, cell);
    ghostAt = {
      left: clientX - ghost.width / ratio() / 2,
      top: clientY - ghost.height / ratio() / 2,
    };
    ghost.style.transform = `translate(${ghostAt.left - box.left}px, ${ghostAt.top - box.top}px)`;
    ghost.style.visibility = 'visible';
    if (!liftGhost) return;
    liftGhost = false;
    if (host.moving()) {
      ghost.animate([{ scale: '0.6' }, { scale: '1.06', offset: 0.7 }, { scale: '1' }], {
        duration: 160,
        easing: 'ease-out',
      });
    }
  };

  const hideGhost = () => {
    if (host.ghost.value) host.ghost.value.style.visibility = 'hidden';
  };

  /** The flight is over: the piece is on the board or back in the hand. */
  const land = () => {
    hideGhost();
    lifted.value = null;
  };

  const onMove = (event: PointerEvent) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const travel = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
    if (!drag.moving && travel < TAP_TRAVEL) return;
    const piece = host.pieceAt(drag.slot);
    const rect = host.board.value?.getBoundingClientRect();
    if (!piece || !rect) return;
    if (!drag.moving) {
      // Picked up: the piece leaves its place and grows to the board's size.
      drag.moving = true;
      lifted.value = drag.slot;
      host.play(sounds.pickUp);
      liftGhost = true;
    }
    const cell = host.cellCss();
    const above = event.clientY - drag.lift;
    const x = Math.round((event.clientX - rect.left) / cell - piece.shape.width / 2);
    const y = Math.round((above - rect.top) / cell - piece.shape.height / 2);
    const near =
      event.clientX > rect.left - cell &&
      event.clientX < rect.right + cell &&
      above > rect.top - cell &&
      above < rect.bottom + cell;
    const before = preview;
    preview = near ? host.previewAt(drag.slot, x, y) : null;
    // A soft tick each time the piece finds a new place where it fits.
    if (preview?.valid && (!before || preview.x !== before.x || preview.y !== before.y)) {
      host.play(sounds.snapHint);
    }
    follow(event.clientX, above, piece);
  };

  const onUp = (event: PointerEvent) => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const { slot, moving: dragged } = drag;
    const target = preview?.valid ? preview : null;
    release();
    if (!dragged) {
      host.select(slot);
    } else if (target) {
      // The piece glides into its place, then goes down.
      void fly(boardRect(target.x, target.y), 1, 90, 'ease-in').then(() => {
        if (host.active()) host.drop(slot, target.x, target.y);
        land();
      });
    } else {
      host.play(sounds.putBack);
      void fly(slotRect(slot), host.handScale(slot), 220, 'cubic-bezier(0.3, 1.3, 0.5, 1)').then(
        land,
      );
    }
  };

  const onCancel = () => {
    release();
    land();
  };

  /** Stops following the pointer (the ghost may still be flying). */
  const release = () => {
    drag = null;
    preview = null;
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onCancel);
  };

  /** A press on a piece of the hand: a tap or the start of a drag. */
  const grab = (slot: number, event: PointerEvent) => {
    // One piece at a time: a second finger does not take over.
    if (drag || !host.active() || !host.pieceAt(slot)) return;
    drag = {
      slot,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      // A finger hides what it holds: the piece floats above it.
      lift: event.pointerType === 'touch' ? host.cellCss() * 1.8 : host.cellCss() * 0.6,
      moving: false,
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
  };

  /** Drops everything at once (the game paused or ended). */
  const cancel = () => {
    release();
    land();
  };

  return {
    lifted,
    grab,
    cancel,
    /** Where the dragged piece would go now, or null. */
    preview: (): DunesPreview | null => preview,
    /** A piece is being dragged. */
    dragging: (): boolean => drag !== null,
  };
}

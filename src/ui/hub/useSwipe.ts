import { onBeforeUnmount, onMounted, type Ref } from 'vue';

/** What a sideways drag reports to the one who follows it. */
export interface SwipeHandlers {
  /** The finger is this far (px) sideways from where it went down. */
  move(dx: number): void;
  /** Released: how far it went (px) and how fast it was going at the end (px/ms). */
  end(dx: number, velocity: number): void;
  /** Taken away (the system, a scroll, a second finger): back to rest. */
  cancel(): void;
}

/** Sideways travel (px) before a press becomes a drag. */
const START = 10;
/** A drag must be this much more sideways than vertical. */
const SLOPE = 1.2;
/** After a drag, the click its release would cause is not a tap (ms). */
const CLICK_GUARD_MS = 400;
/** Where a press belongs to something else. */
const IGNORED = 'dialog, input, select, textarea, [data-own-pointer]';

/**
 * Follows sideways drags on an element (finger or mouse), for a pager: it
 * starts once the press has clearly moved sideways, so taps and vertical
 * moves stay what they were, and swallows the click a drag would end with.
 */
export function useSwipe(target: Ref<HTMLElement | null>, handlers: SwipeHandlers): void {
  let pointer: number | null = null;
  let dragging = false;
  let startX = 0;
  let startY = 0;
  let lastX = 0;
  let lastTime = 0;
  let velocity = 0;
  let guardUntil = 0;

  const down = (event: PointerEvent) => {
    if (pointer !== null || !event.isPrimary || event.button !== 0) return;
    if (event.target instanceof Element && event.target.closest(IGNORED)) return;
    pointer = event.pointerId;
    dragging = false;
    startX = lastX = event.clientX;
    startY = event.clientY;
    lastTime = event.timeStamp;
    velocity = 0;
  };

  const move = (event: PointerEvent) => {
    if (event.pointerId !== pointer) return;
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    if (!dragging) {
      if (Math.abs(dy) > START * 2 && Math.abs(dy) > Math.abs(dx)) {
        pointer = null;
        return;
      }
      if (Math.abs(dx) < START || Math.abs(dx) < Math.abs(dy) * SLOPE) return;
      dragging = true;
      target.value?.setPointerCapture(event.pointerId);
    }
    const elapsed = event.timeStamp - lastTime;
    if (elapsed > 0) velocity = 0.8 * ((event.clientX - lastX) / elapsed) + 0.2 * velocity;
    lastX = event.clientX;
    lastTime = event.timeStamp;
    handlers.move(dx);
  };

  const up = (event: PointerEvent) => {
    if (event.pointerId !== pointer) return;
    pointer = null;
    if (!dragging) return;
    dragging = false;
    guardUntil = performance.now() + CLICK_GUARD_MS;
    handlers.end(event.clientX - startX, velocity);
  };

  const cancel = (event: PointerEvent) => {
    if (event.pointerId !== pointer) return;
    pointer = null;
    if (dragging) handlers.cancel();
    dragging = false;
  };

  const click = (event: MouseEvent) => {
    if (performance.now() > guardUntil) return;
    guardUntil = 0;
    event.stopPropagation();
    event.preventDefault();
  };

  onMounted(() => {
    const element = target.value;
    if (!element) return;
    element.addEventListener('pointerdown', down);
    element.addEventListener('pointermove', move);
    element.addEventListener('pointerup', up);
    element.addEventListener('pointercancel', cancel);
    element.addEventListener('click', click, { capture: true });
  });
  onBeforeUnmount(() => {
    const element = target.value;
    if (!element) return;
    element.removeEventListener('pointerdown', down);
    element.removeEventListener('pointermove', move);
    element.removeEventListener('pointerup', up);
    element.removeEventListener('pointercancel', cancel);
    element.removeEventListener('click', click, { capture: true });
  });
}

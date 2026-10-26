import { inject, onBeforeUnmount, onMounted, type InjectionKey, type Ref } from 'vue';

/**
 * The whole game screen, which the game screen shares with its stage: on a
 * touch screen, a gesture may start anywhere on it, not only on the well, so
 * the finger never hides the pieces.
 */
export const GAME_SURFACE: InjectionKey<Readonly<Ref<HTMLElement | null>>> = Symbol('game-surface');

export interface SurfaceHandlers {
  down(event: PointerEvent): void;
  move(event: PointerEvent): void;
  up(event: PointerEvent): void;
  cancel(event: PointerEvent): void;
}

/** Controls and dialogs keep their own pointer events. */
const OWN_EVENTS = 'button, a, input, select, textarea, dialog, [data-own-pointer]';

/**
 * Sends the pointer events of the game screen to a stage's gestures, except
 * the ones that start on a control or in a dialog. Answers the game screen.
 */
export function useGameSurface(
  handlers: SurfaceHandlers,
): Readonly<Ref<HTMLElement | null>> | null {
  const surface = inject(GAME_SURFACE, null);
  let element: HTMLElement | null = null;
  const tracked = new Set<number>();

  const onDown = (event: PointerEvent) => {
    if (event.target instanceof Element && event.target.closest(OWN_EVENTS)) return;
    tracked.add(event.pointerId);
    try {
      element?.setPointerCapture(event.pointerId);
    } catch {
      // The pointer is already gone.
    }
    handlers.down(event);
  };
  const onMove = (event: PointerEvent) => {
    if (tracked.has(event.pointerId)) handlers.move(event);
  };
  const onUp = (event: PointerEvent) => {
    if (!tracked.delete(event.pointerId)) return;
    handlers.up(event);
  };
  const onCancel = (event: PointerEvent) => {
    if (!tracked.delete(event.pointerId)) return;
    handlers.cancel(event);
  };
  const onMenu = (event: Event) => event.preventDefault();

  onMounted(() => {
    element = surface?.value ?? null;
    if (!element) return;
    element.addEventListener('pointerdown', onDown);
    element.addEventListener('pointermove', onMove);
    element.addEventListener('pointerup', onUp);
    element.addEventListener('pointercancel', onCancel);
    element.addEventListener('contextmenu', onMenu);
  });
  onBeforeUnmount(() => {
    if (!element) return;
    element.removeEventListener('pointerdown', onDown);
    element.removeEventListener('pointermove', onMove);
    element.removeEventListener('pointerup', onUp);
    element.removeEventListener('pointercancel', onCancel);
    element.removeEventListener('contextmenu', onMenu);
  });
  return surface;
}

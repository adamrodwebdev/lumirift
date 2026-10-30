import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue';
import { useServices } from '@/app/AppServices';
import type { ControlScheme } from '@/services/SettingsService';
import type { TowerTurn } from '@/families/volume/input/TowerTurn';
import { useGameSurface } from '@/ui/useGameSurface';
import { isTouchScreen } from '@/ui/useOrientation';
import type { FallingCommand } from '../FallingSession';
import { TouchFeel } from '../fx/TouchFeel';
import type {
  PhoneGestures,
  PieceWatch,
  SurfaceBounds,
  TouchPoint,
} from '../input/phone/PhoneGestures';

/** The on-screen buttons shown: none, those that act (with the gestures), or all of them. */
export type PadMode = 'none' | 'act' | 'all';

const PADS: Readonly<Record<ControlScheme, PadMode>> = {
  gestures: 'none',
  both: 'act',
  buttons: 'all',
};

/** What the touch play needs of a session: its pieces as they enter, move and turn. */
export interface TouchSession {
  onGame(type: 'spawn' | 'move' | 'rotate', listener: () => void): () => void;
  readonly view: { readonly active: unknown };
}

export interface TouchPlayOptions {
  /** Plays a command; true when it took effect. */
  readonly execute: (command: FallingCommand) => boolean;
  /** A cell's size in CSS pixels (in the Tower, a column face on). */
  readonly cellSize: () => number;
  /** False while paused or over: the gestures let go. */
  readonly active: () => boolean;
  readonly session: TouchSession;
  /** The Tower turns with two fingers: the second finger is the tower's, not a turn of the piece. */
  readonly turn?: TowerTurn;
}

/** Safari before iOS 18.2 has no coalesced samples at all; Firefox on Android gives none. */
interface MaybeCoalesced {
  getCoalescedEvents?(): PointerEvent[];
}

/** A finger's samples: those the browser coalesced into the event, or the event itself. */
function samplesOf(event: PointerEvent): readonly PointerEvent[] {
  const coalesced = (event as MaybeCoalesced).getCoalescedEvents?.() ?? [];
  return coalesced.length > 0 ? coalesced : [event];
}

/** A sample of the event's finger (Safari's coalesced samples carry no pointer id of their own). */
const pointOf = (event: PointerEvent, sample: PointerEvent = event): TouchPoint => ({
  id: event.pointerId,
  x: sample.clientX,
  y: sample.clientY,
  time: sample.timeStamp,
});

/** A finger, or a pen; a mouse plays with the keyboard. */
const isTouch = ({ pointerType }: PointerEvent) => pointerType === 'touch' || pointerType === 'pen';

/**
 * The touch play of the falling well, the Sand and the Tower (1.32): the
 * phone gestures (their module loaded only on a touch screen), the buttons
 * the player chose, the misdrop guard's watch of the pieces, and the feel of
 * each move (a tick, or a glow where the phone cannot vibrate).
 */
export function useTouchPlay(options: TouchPlayOptions) {
  const { settings, haptics } = useServices();
  const touch = isTouchScreen();
  const pad = computed<PadMode>(() => (touch ? PADS[settings.current.controls] : 'none'));
  /** The glow's beat: it lights the well at each move, where the phone cannot vibrate. */
  const notch = ref(0);
  const glows = computed(() => touch && !haptics.supported && settings.current.haptics);
  const gestures = shallowRef<PhoneGestures | null>(null);

  let entered = 0;
  const pieces: PieceWatch = {
    get entered() {
      return entered;
    },
    get inPlay() {
      return options.session.view.active !== null;
    },
  };
  const offs = [options.session.onGame('spawn', () => entered++)];
  let feel: TouchFeel | null = null;
  if (touch) {
    const touchFeel = new TouchFeel(
      haptics,
      () => notch.value++,
      () => performance.now(),
    );
    feel = touchFeel;
    offs.push(
      options.session.onGame('move', () => touchFeel.moved()),
      options.session.onGame('rotate', () => touchFeel.turned()),
    );
  }

  const playing = () => settings.current.controls !== 'buttons';
  const surface = useGameSurface({
    down: (event) => {
      if (!isTouch(event)) return;
      options.turn?.down(event.pointerId, event.clientX);
      if (playing()) gestures.value?.down(pointOf(event));
    },
    move: (event) => {
      if (!isTouch(event)) return;
      options.turn?.move(event.pointerId, event.clientX);
      const current = gestures.value;
      if (current) for (const sample of samplesOf(event)) current.move(pointOf(event, sample));
    },
    up: (event) => {
      if (!isTouch(event)) return;
      options.turn?.up(event.pointerId);
      gestures.value?.up(pointOf(event));
    },
    cancel: (event) => {
      options.turn?.up(event.pointerId);
      gestures.value?.cancel();
    },
  });
  const bounds = (): SurfaceBounds => {
    const rect = surface?.value?.getBoundingClientRect();
    return rect
      ? { left: rect.left, width: rect.width, bottom: rect.bottom }
      : { left: 0, width: window.innerWidth, bottom: window.innerHeight };
  };

  let disposed = false;
  if (touch) {
    void import('../input/phone/PhoneGestures').then(({ PhoneGestures }) => {
      if (disposed) return;
      gestures.value = new PhoneGestures({
        // A row the finger takes the piece down ticks like a cell sideways (1.40).
        execute: (command) => {
          if (options.execute(command) && command.type === 'softStep') feel?.moved();
        },
        cellSize: options.cellSize,
        prefs: () => ({
          dragSpeed: settings.current.dragSpeed,
          tapSides: settings.current.tapSides,
          flicks: settings.current.controls === 'gestures',
        }),
        bounds,
        pieces,
        secondFingerTurns: !options.turn,
      });
    });
  }

  watch(options.active, (active) => {
    if (!active) gestures.value?.cancel();
  });
  onBeforeUnmount(() => {
    disposed = true;
    offs.forEach((off) => off());
  });

  return { pad, notch, glows };
}

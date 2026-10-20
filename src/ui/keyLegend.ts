import type { FamilyId, ModeId } from '@/session/ModeId';

/** A row of the controls legend: the keys (by physical place) and what they do. */
export interface LegendRow {
  /** `KeyboardEvent.code` of each key that does it: the same places on every layout. */
  readonly codes: readonly string[];
  /** The action, a translation key. */
  readonly action: string;
  /** Can be left out where room is short (an obvious key, or one with a button on screen). */
  readonly minor?: boolean;
}

const row = (action: string, ...codes: string[]): LegendRow => ({ codes, action });
const minor = (legend: LegendRow): LegendRow => ({ ...legend, minor: true });

const MOVE = row('controls.move', 'ArrowLeft', 'ArrowRight');
const SOFT_DROP = minor(row('controls.softDrop', 'ArrowDown'));
const HARD_DROP = row('controls.hardDrop', 'Space');
const ROTATE = row('controls.rotateCw', 'ArrowUp', 'KeyX');
const ROTATE_BACK = row('controls.rotateCcw', 'KeyZ');
const HOLD = row('controls.hold', 'KeyC');
// The pause also has its button on screen.
const PAUSE = minor(row('controls.pause', 'KeyP'));

/** The keys of each family (the bindings live in each family's input). */
const BY_FAMILY: Readonly<Record<FamilyId, readonly LegendRow[]>> = {
  falling: [MOVE, SOFT_DROP, HARD_DROP, ROTATE, ROTATE_BACK, HOLD, PAUSE],
  // Sand keeps no piece aside.
  sand: [MOVE, SOFT_DROP, HARD_DROP, ROTATE, ROTATE_BACK, PAUSE],
  volume: [
    MOVE,
    SOFT_DROP,
    HARD_DROP,
    ROTATE,
    ROTATE_BACK,
    HOLD,
    row('tower.turn', 'KeyQ', 'KeyE'),
    PAUSE,
  ],
  placement: [
    row('keys.pick', 'Digit1', 'Digit2', 'Digit3'),
    row('keys.aim', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'ArrowRight'),
    row('keys.place', 'Enter'),
    row('keys.joker', 'KeyJ'),
    row('keys.cancel', 'Backspace'),
    PAUSE,
  ],
};

/** A mode with a key of its own (the Flip's ability). */
const EXTRA: Readonly<Partial<Record<ModeId, LegendRow>>> = {
  flip: row('controls.ability.flip', 'KeyF'),
};

/** The legend of a mode: its family's keys, plus its own, before Pause. */
export function keyLegendFor(family: FamilyId, modeId: ModeId): readonly LegendRow[] {
  const rows = BY_FAMILY[family];
  const extra = EXTRA[modeId];
  return extra ? [...rows.slice(0, -1), extra, ...rows.slice(-1)] : rows;
}

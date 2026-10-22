import { KeyBindings, type KeyAction } from '@/families/falling/input/KeyBindings';
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

/** Where a row's keys come from: the player's bindings, or fixed keys (the Mosaic). */
type Keys = (bindings: KeyBindings) => readonly string[];

interface RowSpec {
  readonly action: string;
  readonly keys: Keys;
  readonly minor?: boolean;
}

/** The main key of each action. */
const main =
  (...actions: KeyAction[]): Keys =>
  (bindings) =>
    actions.flatMap((action) => bindings.codes(action).slice(0, 1));
/** Every key of an action (the rotation shows its two). */
const every =
  (action: KeyAction): Keys =>
  (bindings) =>
    bindings.codes(action);
const fixed =
  (...codes: string[]): Keys =>
  () =>
    codes;

const row = (action: string, keys: Keys): RowSpec => ({ action, keys });
const minor = (spec: RowSpec): RowSpec => ({ ...spec, minor: true });

const MOVE = row('controls.move', main('left', 'right'));
const SOFT_DROP = minor(row('controls.softDrop', main('softDrop')));
const HARD_DROP = row('controls.hardDrop', main('hardDrop'));
const ROTATE = row('controls.rotateCw', every('rotateCw'));
const ROTATE_BACK = row('controls.rotateCcw', every('rotateCcw'));
const HOLD = row('controls.hold', main('hold'));
// The pause also has its button on screen.
const PAUSE = minor(row('controls.pause', main('pause')));

/** The keys of each family: the player's, but the Mosaic's are its own. */
const BY_FAMILY: Readonly<Record<FamilyId, readonly RowSpec[]>> = {
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
    row('tower.turn', main('turnLeft', 'turnRight')),
    PAUSE,
  ],
  placement: [
    row('keys.pick', fixed('Digit1', 'Digit2', 'Digit3')),
    row('keys.aim', fixed('ArrowLeft', 'ArrowUp', 'ArrowDown', 'ArrowRight')),
    row('keys.place', fixed('Enter')),
    row('keys.joker', fixed('KeyJ')),
    row('keys.cancel', fixed('Backspace')),
    minor(row('controls.pause', fixed('KeyP'))),
  ],
};

/** The rift surge, in every mode that has one (not the Rhythm, not the Duel). */
const SURGE = row('surge.name', main('surge'));
const WITHOUT_SURGE: ReadonlySet<ModeId> = new Set(['rhythm', 'duel']);

/** A mode with a key of its own (the Flip's ability). */
const EXTRA: Readonly<Partial<Record<ModeId, RowSpec>>> = {
  flip: row('controls.ability.flip', main('ability')),
};

/** The legend of a mode, with the player's keys: its family's rows, its own and the surge, before Pause. */
export function keyLegendFor(
  family: FamilyId,
  modeId: ModeId,
  bindings: KeyBindings = KeyBindings.DEFAULT,
): readonly LegendRow[] {
  const specs = BY_FAMILY[family];
  const extras = [
    ...(EXTRA[modeId] ? [EXTRA[modeId]] : []),
    ...(family !== 'placement' && !WITHOUT_SURGE.has(modeId) ? [SURGE] : []),
  ];
  const rows = [...specs.slice(0, -1), ...extras, ...specs.slice(-1)];
  return rows.map(({ action, keys, minor: isMinor }) => ({
    action,
    codes: keys(bindings),
    ...(isMinor ? { minor: true } : {}),
  }));
}

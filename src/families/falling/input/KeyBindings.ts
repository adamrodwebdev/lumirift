import { InputRecord, orElse, readText } from '@/core/input';
import { TEXT_LIMITS } from '@/core/limits';
import type { FallingAction } from './FallingInput';

/**
 * What a key can do in the falling family, the Sand and the Tower: the
 * piece's actions, the Tower's camera, the rift surge (the screen's, not the
 * engine's).
 */
export type KeyAction = FallingAction | 'turnLeft' | 'turnRight' | 'surge';

/** The actions of the piece itself (not the Tower's camera, not the surge). */
export const isFallingAction = (action: KeyAction): action is FallingAction =>
  action !== 'turnLeft' && action !== 'turnRight' && action !== 'surge';

/** In the order the keys window lists them. */
export const KEY_ACTIONS: readonly KeyAction[] = [
  'left',
  'right',
  'softDrop',
  'rotateCw',
  'rotateCcw',
  'hardDrop',
  'hold',
  'ability',
  'surge',
  'turnLeft',
  'turnRight',
  'pause',
];

/** Each action takes two keys at most: a main one and a spare. */
export const KEY_SLOTS = 2;

/** The keys of each action by physical place (`KeyboardEvent.code`), an empty slot as null. */
export type KeyMap = Readonly<Record<KeyAction, readonly (string | null)[]>>;

/**
 * The keys a new player finds, by place: the same places work on AZERTY and
 * QWERTY (`KeyZ` is W on AZERTY, `KeyA` is Q).
 */
export const DEFAULT_KEYS: KeyMap = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  softDrop: ['ArrowDown', 'KeyS'],
  rotateCw: ['ArrowUp', 'KeyX'],
  rotateCcw: ['KeyZ', null],
  hardDrop: ['Space', null],
  hold: ['KeyC', 'ShiftLeft'],
  ability: ['KeyF', null],
  surge: ['KeyV', null],
  turnLeft: ['KeyQ', null],
  turnRight: ['KeyE', null],
  pause: ['KeyP', null],
};

/**
 * Keys a player cannot take. The portals and the browser keep Esc (it
 * leaves full screen), Tab (the focus), Ctrl, Alt and the system keys
 * (shortcuts such as Ctrl+W), and the function and media keys. Delete
 * empties a slot in the keys window.
 */
const RESERVED =
  /^(Escape|Tab|Delete|CapsLock|NumLock|ScrollLock|Pause|PrintScreen|ContextMenu|Help|Fn|FnLock|Power|Sleep|WakeUp|Eject|Unidentified|(Control|Alt|Meta|OS)(Left|Right)?|F\d{1,2}|(Browser|Audio|Media|Launch|Volume|Lang)\w*)$/;

/** Both Shift keys are one key to the player. */
const place = (code: string): string => (code === 'ShiftRight' ? 'ShiftLeft' : code);

/** A key's place as `KeyboardEvent.code` names it: a letter, then letters and digits (`Digit1`). */
const KEY_CODE = {
  maxLength: TEXT_LIMITS.keyCode,
  required: true,
  pattern: /^[A-Za-z][A-Za-z0-9]*$/,
} as const;

/**
 * A key from outside (a save, a key pressed) as the bindings keep it, or
 * null: a name such as `KeyboardEvent.code` gives, within its length, and
 * not one the player may not take; the right Shift is the left one.
 */
function bindableKey(value: unknown): string | null {
  return orElse(() => {
    const code = readText(value, KEY_CODE, 'key');
    return RESERVED.test(code) ? null : place(code);
  }, null);
}

export const isBindable = (code: string): boolean => bindableKey(code) !== null;

/** An action's keys in a save: its two slots, each a key or empty. */
const SAVED_SLOTS = { maxItems: KEY_SLOTS, item: bindableKey } as const;

/** Where a key is bound. */
export interface KeySlot {
  readonly action: KeyAction;
  readonly slot: number;
}

/**
 * The player's keys: an action has up to two, a key belongs to one action
 * at most. Immutable: each change returns new bindings.
 */
export class KeyBindings {
  private readonly byCode: ReadonlyMap<string, KeyAction>;

  private constructor(private readonly map: KeyMap) {
    const byCode = new Map<string, KeyAction>();
    for (const action of KEY_ACTIONS) {
      for (const code of map[action]) if (code !== null) byCode.set(code, action);
    }
    this.byCode = byCode;
  }

  static readonly DEFAULT = new KeyBindings(DEFAULT_KEYS);

  /**
   * Bindings read from a save. Anything invalid falls back: a key that is
   * not one, reserved or repeated is dropped; an action the save does not
   * know (added since), or whose list is not two slots at most, takes its
   * default keys, unless another action already uses them.
   */
  static read(save: InputRecord | null): KeyBindings {
    if (!save) return KeyBindings.DEFAULT;
    const used = new Set<string>();
    const take = (key: string | null): string | null => {
      if (key === null || used.has(key)) return null;
      used.add(key);
      return key;
    };
    const slots = (keys: readonly (string | null)[]): (string | null)[] =>
      Array.from({ length: KEY_SLOTS }, (_, slot) => take(keys[slot] ?? null));
    const map: Partial<Record<KeyAction, (string | null)[]>> = {};
    // The saved actions first, so that a new default never steals one of the player's keys.
    for (const action of KEY_ACTIONS) {
      const saved = orElse(() => save.list(action, SAVED_SLOTS), null);
      if (saved) map[action] = slots(saved);
    }
    for (const action of KEY_ACTIONS) map[action] ??= slots(DEFAULT_KEYS[action]);
    return new KeyBindings(map as KeyMap);
  }

  /** Bindings from any value: the settings' own map, or a save's field (see `read`). */
  static parse(value: unknown): KeyBindings {
    return KeyBindings.read(orElse(() => InputRecord.from(value, 'keys'), null));
  }

  /** The action of a key pressed, if it has one. */
  actionFor(code: string): KeyAction | undefined {
    return this.byCode.get(place(code));
  }

  /** The key in a slot, null when empty. */
  at(action: KeyAction, slot: number): string | null {
    return this.map[action][slot] ?? null;
  }

  /** The keys of an action, its main one first. */
  codes(action: KeyAction): readonly string[] {
    return this.map[action].filter((code): code is string => code !== null);
  }

  /** Where a key is bound, if it is. */
  find(code: string): KeySlot | null {
    const key = place(code);
    const action = this.byCode.get(key);
    return action ? { action, slot: this.map[action].indexOf(key) } : null;
  }

  /**
   * With a key in a slot. A key belongs to one action: wherever it was, the
   * slot's former key takes its place (the two swap). A reserved key changes
   * nothing.
   */
  with(action: KeyAction, slot: number, code: string): KeyBindings {
    const key = bindableKey(code);
    if (key === null || slot < 0 || slot >= KEY_SLOTS) return this;
    const found = this.find(key);
    if (found?.action === action && found.slot === slot) return this;
    const map = this.copy();
    const former = map[action][slot] ?? null;
    map[action][slot] = key;
    if (found) map[found.action][found.slot] = former;
    return new KeyBindings(map);
  }

  /** With a slot emptied. */
  without(action: KeyAction, slot: number): KeyBindings {
    if (this.at(action, slot) === null) return this;
    const map = this.copy();
    map[action][slot] = null;
    return new KeyBindings(map);
  }

  /** The actions left without a key. */
  unbound(): KeyAction[] {
    return KEY_ACTIONS.filter((action) => this.codes(action).length === 0);
  }

  /** What the settings save. */
  toJSON(): KeyMap {
    return this.copy();
  }

  private copy(): Record<KeyAction, (string | null)[]> {
    const map = {} as Record<KeyAction, (string | null)[]>;
    for (const action of KEY_ACTIONS) map[action] = [...this.map[action]];
    return map;
  }
}

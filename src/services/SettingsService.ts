import { reactive, readonly } from 'vue';
import {
  ARR_RANGE,
  DAS_RANGE,
  DEFAULT_REPEAT,
  type RepeatTiming,
} from '@/families/falling/input/RepeatTiming';
import { orElse, type InputRecord } from '@/core/input';
import { SAVE_LIMITS } from '@/core/limits';
import { DEFAULT_KEYS, KeyBindings, type KeyMap } from '@/families/falling/input/KeyBindings';
import { DRAG_SPEED, validDragSpeed } from '@/families/falling/input/phone/GestureTuning';
import { EFFECT_LEVELS, type EffectsLevel } from '@/fx/EffectsProfile';
import { LOCALES, type Locale } from '@/i18n/locales';
import type { KeyValueStorage } from './KeyValueStorage';
import { SaveSlot } from './SaveSlot';

/**
 * On a touch screen: gestures anywhere on the game, the on-screen buttons, or
 * both (the gestures move and turn, the buttons drop and hold).
 */
export type ControlScheme = 'gestures' | 'buttons' | 'both';
export const CONTROL_SCHEMES: readonly ControlScheme[] = ['gestures', 'buttons', 'both'];

export interface Settings extends RepeatTiming {
  readonly locale: Locale;
  readonly ghost: boolean;
  readonly effects: EffectsLevel;
  readonly shake: boolean;
  readonly haptics: boolean;
  /**
   * The player chose the vibrations (1.41). The settings are saved whole, so a
   * stored `haptics: false` alone says nothing: it may be the old default.
   */
  readonly hapticsChosen: boolean;
  /** Sound effects volume, 0 to 1. */
  readonly volume: number;
  /** Music volume, 0 to 1. */
  readonly musicVolume: number;
  readonly muted: boolean;
  readonly controls: ControlScheme;
  /** Cells of piece for a cell of finger (0.8 to 1.6). */
  readonly dragSpeed: number;
  /** A tap turns the way of its side of the screen; otherwise every tap turns right. */
  readonly tapSides: boolean;
  /** The buttons and the Hold box mirrored, for the left thumb. */
  readonly leftHanded: boolean;
  /** The keyboard's keys (falling family, Sand, Tower); `das` and `arr` time a held move. */
  readonly keys: KeyMap;
}

/** The game's first name (Stackrift) stays in the save keys: no player loses progress. */
export const SETTINGS_KEY = 'stackrift:settings';

/** A volume, from silence to full. */
const UNIT = { min: 0, max: 1 } as const;

const clamp = (value: number, min: number, max: number) =>
  Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : min;

/**
 * The player's preferences: validated when read, saved on every change, and
 * exposed read-only. They change only through intentions (1.28), each one
 * keeping its value valid: a volume within 0–1, a repeat within its range,
 * keys a player may bind.
 */
export class SettingsService {
  private readonly slot: SaveSlot;
  private readonly state: Settings;
  readonly current: Readonly<Settings>;

  constructor(storage: KeyValueStorage, defaults: Settings) {
    this.slot = new SaveSlot(storage, SETTINGS_KEY, SAVE_LIMITS.settings);
    this.state = reactive(SettingsService.read(this.slot.saved, defaults));
    this.current = readonly(this.state);
  }

  /** The interface's language, chosen by the player. */
  chooseLocale(locale: Locale): void {
    this.save({ locale });
  }

  /**
   * The language a portal gives at each launch, which wins over the saved
   * one: noted by the game, never saved over settings it could not read.
   */
  followLocale(locale: Locale): void {
    Object.assign(this.state, { locale });
    this.slot.note(this.state);
  }

  /** A touch screen plays with gestures, the on-screen buttons, or both. */
  chooseControls(controls: ControlScheme): void {
    this.save({ controls });
  }

  /** How far a drag takes the piece, kept within its range and on its steps. */
  setDragSpeed(speed: number): void {
    this.save({ dragSpeed: validDragSpeed(speed) });
  }

  /** Taps turn the way of their side, or always right. */
  turnBySides(tapSides: boolean): void {
    this.save({ tapSides });
  }

  playLeftHanded(leftHanded: boolean): void {
    this.save({ leftHanded });
  }

  chooseEffects(effects: EffectsLevel): void {
    this.save({ effects });
  }

  showGhost(ghost: boolean): void {
    this.save({ ghost });
  }

  allowShake(shake: boolean): void {
    this.save({ shake });
  }

  allowHaptics(haptics: boolean): void {
    this.save({ haptics, hapticsChosen: true });
  }

  /** The sound effects' volume (0 to 1): moving it means the player wants to hear, so it unmutes. */
  setVolume(volume: number): void {
    this.save({ volume: clamp(volume, 0, 1), muted: false });
  }

  /** The music's volume (0 to 1), unmuting as the sound effects' does. */
  setMusicVolume(volume: number): void {
    this.save({ musicVolume: clamp(volume, 0, 1), muted: false });
  }

  toggleMute(): void {
    this.save({ muted: !this.state.muted });
  }

  /** The keys of each action, kept only where a player may bind them (KeyBindings). */
  bindKeys(keys: KeyMap): void {
    this.save({ keys: KeyBindings.parse(keys).toJSON() });
  }

  /** A held move's repeat: its delay (DAS) and its rate (ARR), each kept within its range. */
  setRepeat(timing: Partial<RepeatTiming>): void {
    this.save({
      ...(timing.das === undefined ? {} : { das: clamp(timing.das, DAS_RANGE.min, DAS_RANGE.max) }),
      ...(timing.arr === undefined ? {} : { arr: clamp(timing.arr, ARR_RANGE.min, ARR_RANGE.max) }),
    });
  }

  /** The keys and their repeat as they came. */
  resetKeys(): void {
    this.save({ keys: DEFAULT_KEYS, ...DEFAULT_REPEAT });
  }

  private save(patch: Partial<Settings>): void {
    Object.assign(this.state, patch);
    this.slot.write(this.state);
  }

  /**
   * The saved settings over the defaults, field by field: a field that does
   * not fit (a wrong type, out of range, not one of its choices) keeps its
   * default, and the others stay.
   */
  private static read(save: InputRecord | null, defaults: Settings): Settings {
    if (!save) return { ...defaults };
    const flag = (key: string, fallback: boolean) => orElse(() => save.boolean(key), fallback);
    return {
      locale: orElse(() => save.choice('locale', LOCALES), defaults.locale),
      ghost: flag('ghost', defaults.ghost),
      effects: orElse(() => save.choice('effects', EFFECT_LEVELS), defaults.effects),
      shake: flag('shake', defaults.shake),
      ...SettingsService.haptics(save, defaults),
      muted: flag('muted', defaults.muted),
      volume: orElse(() => save.number('volume', UNIT), defaults.volume),
      musicVolume: orElse(() => save.number('musicVolume', UNIT), defaults.musicVolume),
      controls: orElse(() => save.choice('controls', CONTROL_SCHEMES), defaults.controls),
      dragSpeed: orElse(
        () => validDragSpeed(save.number('dragSpeed', DRAG_SPEED)),
        defaults.dragSpeed,
      ),
      tapSides: flag('tapSides', defaults.tapSides),
      leftHanded: flag('leftHanded', defaults.leftHanded),
      keys: orElse(() => KeyBindings.read(save.record('keys')).toJSON(), defaults.keys),
      das: orElse(() => save.number('das', DAS_RANGE), defaults.das),
      arr: orElse(() => save.number('arr', ARR_RANGE), defaults.arr),
    };
  }

  /** The vibrations as chosen; before 1.41 only an "on" was a choice (off was the default). */
  private static haptics(
    save: InputRecord,
    defaults: Settings,
  ): Pick<Settings, 'haptics' | 'hapticsChosen'> {
    const haptics = orElse(() => save.boolean('haptics'), null);
    if (orElse(() => save.boolean('hapticsChosen'), false) && haptics !== null) {
      return { haptics, hapticsChosen: true };
    }
    if (haptics === true) return { haptics: true, hapticsChosen: true };
    return { haptics: defaults.haptics, hapticsChosen: defaults.hapticsChosen };
  }
}

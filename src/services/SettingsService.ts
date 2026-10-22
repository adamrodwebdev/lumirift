import { reactive, readonly } from 'vue';
import { ARR_RANGE, DAS_RANGE, type RepeatTiming } from '@/families/falling/input/RepeatTiming';
import { KeyBindings, type KeyMap } from '@/families/falling/input/KeyBindings';
import { EFFECT_LEVELS, type EffectsLevel } from '@/fx/EffectsProfile';
import { isLocale, type Locale } from '@/i18n/locales';
import { readJson, type KeyValueStorage } from './KeyValueStorage';

/** On a touch screen: gestures anywhere on the game, or the on-screen buttons. */
export type ControlScheme = 'gestures' | 'buttons';
export const CONTROL_SCHEMES: readonly ControlScheme[] = ['gestures', 'buttons'];

export interface Settings extends RepeatTiming {
  readonly locale: Locale;
  readonly ghost: boolean;
  readonly effects: EffectsLevel;
  readonly shake: boolean;
  readonly haptics: boolean;
  /** Sound effects volume, 0 to 1. */
  readonly volume: number;
  /** Music volume, 0 to 1. */
  readonly musicVolume: number;
  readonly muted: boolean;
  readonly controls: ControlScheme;
  /** The keyboard's keys (falling family, Sand, Tower); `das` and `arr` time a held move. */
  readonly keys: KeyMap;
}

/** The game's first name (Stackrift) stays in the save keys: no player loses progress. */
export const SETTINGS_KEY = 'stackrift:settings';

const isUnit = (value: unknown): value is number =>
  typeof value === 'number' && value >= 0 && value <= 1;

const isControlScheme = (value: unknown): value is ControlScheme =>
  typeof value === 'string' && (CONTROL_SCHEMES as readonly string[]).includes(value);

const isEffectsLevel = (value: unknown): value is EffectsLevel =>
  typeof value === 'string' && (EFFECT_LEVELS as readonly string[]).includes(value);

const within = (value: unknown, range: { readonly min: number; readonly max: number }) =>
  typeof value === 'number' && value >= range.min && value <= range.max;

/**
 * The player's preferences: validated when read, saved on every change, and
 * exposed read-only so that only `update` can change them.
 */
export class SettingsService {
  private readonly state: Settings;
  readonly current: Readonly<Settings>;

  constructor(
    private readonly storage: KeyValueStorage,
    defaults: Settings,
  ) {
    this.state = reactive({
      ...defaults,
      ...SettingsService.parse(readJson(storage, SETTINGS_KEY)),
    });
    this.current = readonly(this.state);
  }

  update(patch: Partial<Settings>): void {
    Object.assign(this.state, patch);
    this.storage.set(SETTINGS_KEY, JSON.stringify(this.state));
  }

  /** Keeps only the valid fields of a stored value. */
  private static parse(value: unknown): Partial<Settings> {
    if (typeof value !== 'object' || value === null) return {};
    const record = value as Record<string, unknown>;
    const settings: { -readonly [K in keyof Settings]?: Settings[K] } = {};
    if (isLocale(record.locale)) settings.locale = record.locale;
    if (typeof record.ghost === 'boolean') settings.ghost = record.ghost;
    if (isEffectsLevel(record.effects)) settings.effects = record.effects;
    if (typeof record.shake === 'boolean') settings.shake = record.shake;
    if (typeof record.haptics === 'boolean') settings.haptics = record.haptics;
    if (typeof record.muted === 'boolean') settings.muted = record.muted;
    if (isUnit(record.volume)) settings.volume = record.volume;
    if (isUnit(record.musicVolume)) settings.musicVolume = record.musicVolume;
    if (isControlScheme(record.controls)) settings.controls = record.controls;
    if (record.keys !== undefined) settings.keys = KeyBindings.parse(record.keys).toJSON();
    if (within(record.das, DAS_RANGE)) settings.das = record.das as number;
    if (within(record.arr, ARR_RANGE)) settings.arr = record.arr as number;
    return settings;
  }
}

import { reactive, readonly } from 'vue';
import { EFFECT_LEVELS, type EffectsLevel } from '@/fx/EffectsProfile';
import { isLocale, type Locale } from '@/i18n/locales';
import { readJson, type KeyValueStorage } from './KeyValueStorage';

export const THEME_PREFERENCES = ['system', 'light', 'dark'] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];

export interface Settings {
  readonly locale: Locale;
  readonly theme: ThemePreference;
  readonly ghost: boolean;
  readonly effects: EffectsLevel;
  readonly shake: boolean;
  readonly haptics: boolean;
  /** Sound effects volume, 0 to 1. */
  readonly volume: number;
  readonly muted: boolean;
}

/** Same key as the theme bootstrap script in index.html. */
export const SETTINGS_KEY = 'stackrift:settings';

const isThemePreference = (value: unknown): value is ThemePreference =>
  typeof value === 'string' && (THEME_PREFERENCES as readonly string[]).includes(value);

const isEffectsLevel = (value: unknown): value is EffectsLevel =>
  typeof value === 'string' && (EFFECT_LEVELS as readonly string[]).includes(value);

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
    if (isThemePreference(record.theme)) settings.theme = record.theme;
    if (typeof record.ghost === 'boolean') settings.ghost = record.ghost;
    if (isEffectsLevel(record.effects)) settings.effects = record.effects;
    if (typeof record.shake === 'boolean') settings.shake = record.shake;
    if (typeof record.haptics === 'boolean') settings.haptics = record.haptics;
    if (typeof record.muted === 'boolean') settings.muted = record.muted;
    if (typeof record.volume === 'number' && record.volume >= 0 && record.volume <= 1) {
      settings.volume = record.volume;
    }
    return settings;
  }
}

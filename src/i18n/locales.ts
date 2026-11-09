// Relative imports with their extension: the build's own plugin reads this module too
// (scripts/bootPlugin.ts), outside the app's aliases.
import { orElse, readText } from '../core/input.ts';
import { TEXT_LIMITS } from '../core/limits.ts';

export const LOCALES = ['fr', 'en', 'id', 'ru'] as const;
export type Locale = (typeof LOCALES)[number];

export const isLocale = (value: unknown): value is Locale =>
  typeof value === 'string' && (LOCALES as readonly string[]).includes(value);

/**
 * Languages whose players read Russian more often than English: Belarusian,
 * Kazakh, Ukrainian and Uzbek (Yandex Games' own fallback for them).
 */
const READS_RUSSIAN: ReadonlySet<string> = new Set(['be', 'kk', 'uk', 'uz']);

/** A language tag as browsers and portals give it (`fr`, `pt-BR`, `zh-Hant-TW`): BCP 47's shape. */
const LANGUAGE_TAG = {
  maxLength: TEXT_LIMITS.languageTag,
  required: true,
  pattern: /^[A-Za-z]{1,8}(?:-[A-Za-z0-9]{1,8})*$/,
} as const;

/** A language tag from outside (the browser, a portal's SDK), or null when it is not one. */
export function readLanguageTag(value: unknown): string | null {
  return orElse(() => readText(value, LANGUAGE_TAG, 'language'), null);
}

/** Where the game is published decides the fallback (a platform is one). */
export interface LocaleRule {
  /** Russian for the languages of Russia's neighbours (Yandex), English otherwise. */
  readonly russianForNeighbours: boolean;
}

/**
 * The first supported language among the player's preferences; failing that,
 * Russian for its neighbours where the rule asks it (a preference the game
 * does have comes first: Ukrainian then English gives English), English
 * otherwise. A preference that is not a language tag is passed over.
 */
export function detectLocale(
  preferred: readonly unknown[],
  rule: LocaleRule = { russianForNeighbours: false },
): Locale {
  const languages = preferred.flatMap((value) => {
    const tag = readLanguageTag(value);
    if (tag === null) return [];
    const language = tag.toLowerCase().split('-')[0] ?? '';
    // "in" is the legacy code for Indonesian, still sent by some Android browsers.
    return [language === 'in' ? 'id' : language];
  });
  const neighbour = languages.some((language) => READS_RUSSIAN.has(language));
  return languages.find(isLocale) ?? (rule.russianForNeighbours && neighbour ? 'ru' : 'en');
}

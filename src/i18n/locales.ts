export const LOCALES = ['fr', 'en', 'id', 'ru'] as const;
export type Locale = (typeof LOCALES)[number];

export const isLocale = (value: unknown): value is Locale =>
  typeof value === 'string' && (LOCALES as readonly string[]).includes(value);

/**
 * Languages whose players read Russian more often than English: Belarusian,
 * Kazakh, Ukrainian and Uzbek (Yandex Games' own fallback for them).
 */
const READS_RUSSIAN: ReadonlySet<string> = new Set(['be', 'kk', 'uk', 'uz']);

/**
 * The first supported language among the player's preferences; failing that,
 * Russian for its neighbours (a preference the game does have comes first:
 * Ukrainian then English gives English), English otherwise.
 */
export function detectLocale(preferred: readonly string[]): Locale {
  const languages = preferred.map((tag) => {
    const language = tag.toLowerCase().split('-')[0] ?? '';
    // "in" is the legacy code for Indonesian, still sent by some Android browsers.
    return language === 'in' ? 'id' : language;
  });
  return (
    languages.find(isLocale) ??
    (languages.some((language) => READS_RUSSIAN.has(language)) ? 'ru' : 'en')
  );
}

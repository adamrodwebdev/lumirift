import { createI18n } from 'vue-i18n';
import type frMessages from './locales/fr.json';
import type { Locale } from './locales';

export { LOCALES, detectLocale, isLocale, type Locale } from './locales';

/** French is the reference: its keys define the schema the other locales must follow. */
export type MessageSchema = typeof frMessages;

/**
 * Each language is a chunk of its own: a player downloads only the messages
 * of the language played (the page asks for them early, see bootPlugin), the
 * others once chosen.
 */
const MESSAGES: Readonly<Record<Locale, () => Promise<{ default: MessageSchema }>>> = {
  fr: () => import('./locales/fr.json'),
  en: () => import('./locales/en.json'),
  id: () => import('./locales/id.json'),
};

export async function loadMessages(locale: Locale): Promise<MessageSchema> {
  return (await MESSAGES[locale]()).default;
}

/** The game's i18n, in the player's language (every locale has the same keys: no fallback needed). */
export async function createAppI18n(locale: Locale) {
  const messages = { [locale]: await loadMessages(locale) } as Record<Locale, MessageSchema>;
  return createI18n<[MessageSchema], Locale, false>({
    legacy: false,
    locale,
    fallbackLocale: locale,
    messages,
  });
}

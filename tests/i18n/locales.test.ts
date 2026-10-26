import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { detectLocale, isLocale } from '@/i18n/locales';
import { FALLING_MODE_IDS, MODE_IDS } from '@/session/ModeId';

type Tree = { readonly [key: string]: string | Tree };

/** Every leaf key, as "a.b.c". */
const keys = (tree: Tree, prefix = ''): string[] =>
  Object.entries(tree).flatMap(([key, value]) =>
    typeof value === 'string' ? [`${prefix}${key}`] : keys(value, `${prefix}${key}.`),
  );

const leaf = (tree: Tree, path: string): unknown =>
  path.split('.').reduce<unknown>((node, key) => (node as Tree | undefined)?.[key], tree);

/** Raw files: importing them would go through the i18n compiler. */
const load = (locale: string): Tree =>
  JSON.parse(
    readFileSync(new URL(`../../src/i18n/locales/${locale}.json`, import.meta.url), 'utf8'),
  ) as Tree;

const LOCALES: Record<string, Tree> = {
  fr: load('fr'),
  en: load('en'),
  id: load('id'),
  ru: load('ru'),
};
const fr = LOCALES.fr!;

/** Every message of a language, with its key. */
const messages = (locale: string): [string, string][] =>
  keys(LOCALES[locale]!).map((key) => [key, String(leaf(LOCALES[locale]!, key))]);

/** The forms of a message "a | b | c". */
const forms = (message: string) => message.split(' | ').length;

describe('translations', () => {
  const reference = keys(fr).sort();

  it.each(['en', 'id', 'ru'])('%s has exactly the keys of the French reference', (locale) => {
    expect(keys(LOCALES[locale]!).sort()).toEqual(reference);
  });

  it.each(Object.keys(LOCALES))('%s has no empty message', (locale) => {
    for (const [key, message] of messages(locale)) expect(message.trim(), key).not.toBe('');
  });

  it.each(Object.keys(LOCALES))('%s keeps the placeholders of the French reference', (locale) => {
    const names = (message: string) => [...message.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
    for (const [key, message] of messages(locale)) {
      const own = new Set(names(message));
      expect([...own].sort(), key).toEqual([...new Set(names(String(leaf(fr, key))))].sort());
    }
  });

  it('counts in Russian with one, few and many (and a zero first where French has one)', () => {
    for (const [key, message] of messages('ru')) {
      const french = forms(String(leaf(fr, key)));
      const english = forms(String(leaf(LOCALES.en!, key)));
      if (french === 1 && english === 1 && forms(message) === 1) continue;
      expect(forms(message), key).toBe(french === 3 ? 4 : 3);
    }
  });

  it('writes French with its no-break spaces and curly apostrophes', () => {
    for (const [key, message] of messages('fr')) {
      expect(message, key).not.toMatch(/ [:;!?%»]|« /);
      expect(message, key).not.toContain("'");
    }
  });

  it('writes Russian with its own punctuation: «ёлочки», no space before ! ? : ;', () => {
    for (const [key, message] of messages('ru')) {
      expect(message, key).not.toMatch(/\s[!?:;]/);
      expect(message, key).not.toMatch(/["'„“”]/);
    }
  });

  it('writes English apostrophes curly', () => {
    for (const [key, message] of messages('en')) expect(message, key).not.toContain("'");
  });

  it('names and pitches every mode', () => {
    for (const mode of MODE_IDS) {
      expect(leaf(fr, `modes.${mode}.name`), mode).toBeTypeOf('string');
      expect(leaf(fr, `modes.${mode}.pitch`), mode).toBeTypeOf('string');
    }
  });

  it('labels every HUD indicator and notice the falling modes can emit', () => {
    const indicators = [
      'score',
      'lines',
      'level',
      'time',
      'timeLeft',
      'nextRise',
      'rowsRisen',
      'charges',
      'nextCharge',
      'pureLines',
      'nextMirror',
      'mirrorIn',
      'reflex',
      'fused',
      'bestChain',
      'nextTilt',
      'tiltIn',
      'piecesLeft',
      'filled',
      'outside',
      'groove',
      'onBeat',
      'bpm',
      'incoming',
      'sent',
      'opponentLines',
    ];
    for (const indicator of indicators)
      expect(leaf(fr, `hud.${indicator}`), indicator).toBeTypeOf('string');
    const notices = [
      'chargeGained',
      'pureLine',
      'mirrorSoon',
      'mirror',
      'reflexBonus',
      'flip',
      'chain',
      'tiltSoon',
      'tilt',
      'grooveMax',
      'perfect',
      'sent',
    ];
    for (const notice of notices) expect(leaf(fr, `notice.${notice}`), notice).toBeTypeOf('string');
    expect(FALLING_MODE_IDS.length).toBeGreaterThan(0);
  });

  it('explains every way a game can end', () => {
    for (const reason of [
      'blockOut',
      'lockOut',
      'topOut',
      'timeUp',
      'outOfPieces',
      'shapeComplete',
    ]) {
      expect(leaf(fr, `over.reason.${reason}`), reason).toBeTypeOf('string');
    }
  });
});

describe('detectLocale', () => {
  it('takes the first supported language of the browser', () => {
    expect(detectLocale(['de-DE', 'fr-FR', 'en'])).toBe('fr');
    expect(detectLocale(['id-ID'])).toBe('id');
    expect(detectLocale(['ru-RU', 'en-US'])).toBe('ru');
    expect(detectLocale(['ru'])).toBe('ru');
  });

  it('understands the legacy Indonesian code', () => {
    expect(detectLocale(['in-ID'])).toBe('id');
  });

  it('opens in Russian for its neighbours, unless a language the game has comes first', () => {
    expect(detectLocale(['uk'])).toBe('ru');
    expect(detectLocale(['be-BY'])).toBe('ru');
    expect(detectLocale(['kk'])).toBe('ru');
    expect(detectLocale(['uz-UZ'])).toBe('ru');
    expect(detectLocale(['uk-UA', 'en-US'])).toBe('en');
    expect(detectLocale(['kk', 'ru'])).toBe('ru');
  });

  it('falls back to English', () => {
    expect(detectLocale(['ja-JP'])).toBe('en');
    expect(detectLocale([])).toBe('en');
  });

  it('recognises supported locales only', () => {
    expect(isLocale('fr')).toBe(true);
    expect(isLocale('de')).toBe(false);
    expect(isLocale(3)).toBe(false);
  });
});

describe('variants', () => {
  it('names and explains every variant of every mode', async () => {
    const { ModeCatalog } = await import('@/session/ModeCatalog');
    for (const mode of new ModeCatalog().list()) {
      for (const variant of mode.variants ?? []) {
        expect(leaf(fr, `variants.${mode.id}.${variant}`), variant).toBeTypeOf('string');
        expect(leaf(fr, `variants.${mode.id}Hint.${variant}`), variant).toBeTypeOf('string');
      }
    }
  });
});

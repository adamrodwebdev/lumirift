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

const LOCALES: Record<string, Tree> = { fr: load('fr'), en: load('en'), id: load('id') };
const fr = LOCALES.fr!;

describe('translations', () => {
  const reference = keys(fr).sort();

  it.each(['en', 'id'])('%s has exactly the keys of the French reference', (locale) => {
    expect(keys(LOCALES[locale]!).sort()).toEqual(reference);
  });

  it.each(Object.keys(LOCALES))('%s has no empty message', (locale) => {
    for (const key of keys(LOCALES[locale]!)) {
      expect(String(leaf(LOCALES[locale]!, key)).trim(), key).not.toBe('');
    }
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
  });

  it('understands the legacy Indonesian code', () => {
    expect(detectLocale(['in-ID'])).toBe('id');
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

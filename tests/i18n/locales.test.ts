import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CHAPTERS, LEVELS } from '@/campaign/Levels';
import { detectLocale, isLocale } from '@/i18n/locales';
import { COSMETICS } from '@/progression/Cosmetics';
import { SEASONS } from '@/seasons/SeasonData';
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

  // The IP review of 30 Oct 2026 (CAHIER § 2.3): The Tetris Company's marks, and the words and
  // the tune its notices cite, never enter the game's texts, in any language.
  it.each(Object.keys(LOCALES))('%s never uses The Tetris Company’s words', (locale) => {
    const owned = /tetris|тетрис|tetr[aio]mino|тетр[аи]мино|t-?spin|korobe[iy]niki|коробейники/i;
    for (const [key, message] of messages(locale)) expect(message, key).not.toMatch(owned);
  });

  // A “-tris” name draws notices on its own (Setris, 2023). Checked on names only: French words
  // such as « meurtris » end the same way.
  it.each(Object.keys(LOCALES))(
    '%s names the game and its modes without a “-tris” word',
    (locale) => {
      const names = ['meta.title', ...MODE_IDS.map((mode) => `modes.${mode}.name`)];
      for (const key of names) {
        expect(String(leaf(LOCALES[locale]!, key)), key).not.toMatch(
          /\p{L}+(tris|трис)(?!\p{L})/iu,
        );
      }
    },
  );

  // The review of names of 6 Nov 2026 (CAHIER § 9 terdecies): another studio's game title (the
  // ×10 shout RIFTBREAKER!, renamed), Diablo III's Rift Guardian, Dune's own words and Sauron's
  // lidless eye never enter the game's texts, in any language.
  it.each(Object.keys(LOCALES))('%s never names another game or borrows its world', (locale) => {
    const borrowed = new RegExp(
      [
        'rift\\s*-?\\s*breaker',
        'brise.?faille',
        'крушитель разлома',
        'pemecah retakan',
        'rift guardian',
        'gardiens? de (la )?faille',
        'стражи? разлома',
        'penjaga retakan',
        'shai.?hulud',
        'wormsign',
        'worm.?riding',
        'thumper',
        '\\bspice\\b',
        'épice',
        'lidless',
      ].join('|'),
      'iu',
    );
    for (const [key, message] of messages(locale)) expect(message, key).not.toMatch(borrowed);
  });

  it('tells a line of the world in each place the lore lot names, and nowhere else', () => {
    const bosses = [...new Set(LEVELS.flatMap((level) => (level.boss ? [level.boss] : [])))];
    const trophies = COSMETICS.flatMap(({ unlock }) =>
      unlock.by === 'boss' ? [unlock.value] : [],
    );
    const places = [
      ...CHAPTERS.map((chapter) => `lore.chapter.${chapter}`),
      ...bosses.flatMap((boss) => [`lore.stirs.${boss}`, `lore.fall.${boss}`]),
      'lore.finale',
      ...trophies.map((boss) => `lore.trophy.${boss}`),
      ...SEASONS.map((season) => `lore.season.${season.id}`),
    ];
    expect(places).toHaveLength(27);
    expect(
      keys(fr)
        .filter((key) => key.startsWith('lore.'))
        .sort(),
    ).toEqual([...places].sort());
  });

  it('keeps every line of the world to twelve words in English (one line, one image)', () => {
    const lines = messages('en').filter(([key]) => key.startsWith('lore.'));
    expect(lines).toHaveLength(27);
    for (const [key, line] of lines) {
      const words = line.split(/\s+/).filter((word) => /\p{L}/u.test(word));
      expect(words.length, `${key}: ${line}`).toBeLessThanOrEqual(12);
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

  /*
   * The training says one short thing at a time over the well (1.46): five words
   * at most, in every language (a word has a letter: « ! » and « … » are not words).
   */
  it.each(Object.keys(LOCALES))(
    '%s gives the training’s guide lines of five words at most',
    (locale) => {
      const lines = messages(locale).filter(([key]) => key.startsWith('training.guide.'));
      expect(lines.length).toBeGreaterThan(5);
      for (const [key, line] of lines) {
        const words = line.split(/\s+/).filter((word) => /\p{L}/u.test(word));
        expect(words.length, `${key}: ${line}`).toBeLessThanOrEqual(5);
      }
    },
  );
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

  it('opens in Russian for its neighbours on Yandex, unless a language the game has comes first', () => {
    const yandex = { russianForNeighbours: true };
    expect(detectLocale(['uk'], yandex)).toBe('ru');
    expect(detectLocale(['be-BY'], yandex)).toBe('ru');
    expect(detectLocale(['kk'], yandex)).toBe('ru');
    expect(detectLocale(['uz-UZ'], yandex)).toBe('ru');
    expect(detectLocale(['uk-UA', 'en-US'], yandex)).toBe('en');
    expect(detectLocale(['kk', 'ru'], yandex)).toBe('ru');
  });

  it('opens in English for them elsewhere: the portals’ fallback (Playgama), our site', () => {
    const elsewhere = { russianForNeighbours: false };
    for (const language of ['uk', 'be-BY', 'kk', 'uz-UZ'])
      expect(detectLocale([language], elsewhere), language).toBe('en');
    expect(detectLocale(['uk'])).toBe('en');
    expect(detectLocale(['uk-UA', 'ru'], elsewhere)).toBe('ru');
  });

  it('falls back to English', () => {
    expect(detectLocale(['ja-JP'])).toBe('en');
    expect(detectLocale([])).toBe('en');
  });

  it.each([
    { name: 'a number', tag: 42 },
    { name: 'nothing', tag: undefined },
    { name: 'an object', tag: { lang: 'ru' } },
    { name: 'a list', tag: ['ru'] },
    { name: 'an inherited name', tag: 'constructor' },
    { name: 'markup', tag: '<b>ru</b>' },
    { name: 'a tag one character over its limit', tag: `ru${'-aaaaaaaa'.repeat(3)}-aaaaaa` },
  ])('passes over $name among the preferences instead of failing the start', ({ tag }) => {
    expect(detectLocale([tag, 'fr-FR'])).toBe('fr');
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

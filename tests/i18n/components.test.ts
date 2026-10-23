import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** Every component of the game, with its source. */
const SOURCES = (
  readdirSync(new URL('../../src', import.meta.url), { recursive: true }) as string[]
)
  .filter((path) => path.endsWith('.vue'))
  .map((path) => ({
    path,
    source: readFileSync(
      new URL(`../../src/${path.replaceAll('\\', '/')}`, import.meta.url),
      'utf8',
    ),
  }));

/**
 * The build installs none of vue-i18n's components and directives (`fullInstall:
 * false` in vite.config.ts, for a lighter bundle): a template that uses one
 * without importing it shows an empty tag, with no error in production. The
 * Guardian's promise after level 1-1 and the home's Space hint were blank so
 * until 1.28.1.
 */
describe('vue-i18n in the templates', () => {
  it('finds the components', () => {
    expect(SOURCES.length).toBeGreaterThan(20);
  });

  it('imports <i18n-t> wherever a template uses it', () => {
    const missing = SOURCES.filter(
      ({ source }) =>
        /<(i18n-t|I18nT)[\s>]/.test(source) &&
        !/import \{[^}]*\bI18nT\b[^}]*\} from 'vue-i18n'/.test(source),
    ).map(({ path }) => path);
    expect(missing).toEqual([]);
  });

  it('uses neither <i18n-d>, <i18n-n> nor v-t (never imported: Intl formats instead)', () => {
    const using = SOURCES.filter(({ source }) => /<i18n-[dn][\s>]|\sv-t[=\s.]/.test(source)).map(
      ({ path }) => path,
    );
    expect(using).toEqual([]);
  });
});

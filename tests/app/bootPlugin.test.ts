import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { bootPlugin } from '../../scripts/bootPlugin';

/** A language's page title, read raw (the i18n plugin compiles imports). */
const title = (locale: string) =>
  (
    JSON.parse(readFileSync(`src/i18n/locales/${locale}.json`, 'utf8')) as {
      meta: { title: string };
    }
  ).meta.title;

/** Every character outside ASCII as `\uXXXX`, as a minifier may write it. */
const escaped = (text: string) =>
  text.replace(/[^\x20-\x7e]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);

type Handler = (html: string, context: { bundle: Record<string, unknown> }) => string;

const chunk = (fileName: string, code: string) => ({
  type: 'chunk',
  fileName,
  code,
  isDynamicEntry: true,
});

/** A build in miniature: the entry, a shared module, a stylesheet, a chunk per language. */
const html = [
  '<head>',
  '<script type="module" crossorigin src="./assets/index-1.js"></script>',
  '<link rel="modulepreload" crossorigin href="./assets/vendor-2.js">',
  '<link rel="stylesheet" crossorigin href="./assets/index-3.css">',
  '</head>',
].join('\n');
const bundle = {
  'assets/index-3.css': {
    type: 'asset',
    fileName: 'assets/index-3.css',
    source: '@font-face{src:url(./sora-4.woff2)}body{margin:0}',
  },
  'assets/a.js': chunk('assets/a.js', `export default {s:\`${title('en')}\`}`),
  'assets/b.js': chunk('assets/b.js', `export default {s:\`${title('fr')}\`}`),
  'assets/c.js': chunk('assets/c.js', `export default {s:\`${title('id')}\`}`),
  // Cyrillic as the minifier may escape it.
  'assets/d.js': chunk('assets/d.js', `export default {s:"${escaped(title('ru'))}"}`),
};

describe('bootPlugin', () => {
  const transform = (bootPlugin().transformIndexHtml as { handler: Handler }).handler;
  const page = transform(html, { bundle });

  it('inlines the stylesheets of the first screen, their urls under assets/', () => {
    expect(page).not.toContain('rel="stylesheet"');
    expect(page).toContain(
      '<style>@font-face{src:url(./assets/sora-4.woff2)}body{margin:0}</style>',
    );
  });

  it('fetches the code and the language after the first paint, then runs it', () => {
    expect(page).not.toContain('<link rel="modulepreload"');
    expect(page).not.toContain('src="./assets/index-1.js"');
    expect(page).toContain('"en":"./assets/a.js"');
    expect(page).toContain('"fr":"./assets/b.js"');
    expect(page).toContain('"id":"./assets/c.js"');
    expect(page).toContain('"ru":"./assets/d.js"');
    expect(page).toContain('["./assets/vendor-2.js"]');
    expect(page).toMatch(
      /requestAnimationFrame\(\(\)=>setTimeout\(.*import\('\.\/assets\/index-1\.js'\)/,
    );
  });

  it('refuses a build whose languages it cannot tell apart', () => {
    expect(() => transform(html, { bundle: { 'assets/a.js': bundle['assets/a.js'] } })).toThrow(
      /a chunk per language/,
    );
  });
});

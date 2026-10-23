// Builds the Yandex Games version, checks it against the platform's measurable
// requirements (references/yandex-games.md, § 4) and zips it for upload.
// Usage: npm run package:yandex   →  release/lumirift-yandex-<version>.zip
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const OUT = 'dist-yandex';
const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
const ZIP = join('release', `lumirift-yandex-${version}.zip`);
const MB = 1024 * 1024;
/** The SDK Yandex serves next to an uploaded archive (rule 1.19.1). */
const SDK = '/sdk.js';

/** Files our own site needs, not the platform (its page has its own tags and icons). */
const SITE_ONLY = [
  'og-image.png',
  'manifest.webmanifest',
  'robots.txt',
  'apple-touch-icon.png',
  'icon-192.png',
  'icon-512.png',
];

const run = (command, args) => execFileSync(command, args, { stdio: 'inherit', shell: true });

run('npx', ['vite', 'build', '--mode', 'yandex']);
for (const file of SITE_ONLY) rmSync(join(OUT, file), { force: true });

const files = [];
const walk = (dir) => {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path);
    else files.push(path);
  }
};
walk(OUT);
const names = files.map((file) => relative(OUT, file).split(sep).join('/'));
const total = files.reduce((sum, file) => sum + statSync(file).size, 0);
const html = readFileSync(join(OUT, 'index.html'), 'utf8');
const code = files
  .filter((file) => /\.(js|css|html)$/.test(file))
  .map((file) => readFileSync(file, 'utf8'))
  .join('\n');

/**
 * URLs that are text, never requested: XML namespaces, and the link Vue's
 * production build prints in its error messages.
 */
const TEXT_ONLY = ['http://www.w3.org/', 'https://vuejs.org/error-reference/'];
const urls = [...new Set(code.match(/https?:\/\/[^\s"'`)<>\\]+/g) ?? [])].filter(
  (url) => !TEXT_ONLY.some((prefix) => url.startsWith(prefix)),
);

// yandex.ru/dev/games/doc: requirements 1.7, 1.18, 1.19.1, 1.21, 1.22, 4.1, 8.4.2.
const checks = [
  ['index.html at the root', names.includes('index.html'), 'rule 1.22'],
  ['Unpacked size ≤ 100 MB', total <= 100 * MB, `${(total / MB).toFixed(2)} MB (rule 1.21)`],
  [
    'No space or Cyrillic in names',
    names.every((name) => /^[A-Za-z0-9._\-/]+$/.test(name)),
    `${names.length} files (rule 1.22)`,
  ],
  [
    'Relative paths only',
    !/(src|href)="\/(?!\/|sdk\.js")/.test(html) && !/["'(]\/assets\//.test(code),
    'no absolute asset path',
  ],
  ['SDK from /sdk.js in <head>', html.includes(`<script src="${SDK}"></script>`), 'rule 1.19.1'],
  ['No absolute Yandex S3 URL', !/s3\.yandex\.net/.test(code), 'rule 1.7'],
  ['No external request', urls.length === 0, urls.join(' ') || 'Yandex only (rules 4.1, 8.4.2)'],
  ['No other portal SDK', !/crazygames-sdk|playgama-bridge/.test(code), 'one platform per build'],
  [
    'No external analytics',
    !/googletagmanager|google-analytics|gtag\(|youtube\.com/.test(code),
    'GA4, gtag, YouTube (rule 3.9)',
  ],
  ['No "unsaved changes" prompt', !/beforeunload/.test(code), 'rule 1.14'],
  ['No social or search tags', !/og:|ld\+json|manifest/.test(html), 'Yandex page has its own'],
];
let failed = false;
for (const [name, ok, detail] of checks) {
  console.log(`${ok ? '✓' : '✗'} ${name.padEnd(32)} ${detail}`);
  failed ||= !ok;
}
if (failed) process.exit(1);

// bsdtar (Windows 10+, macOS) writes ZIP entries with "/" separators, which
// Compress-Archive on Windows PowerShell 5.1 does not.
mkdirSync('release', { recursive: true });
rmSync(ZIP, { force: true });
const tar = process.platform === 'win32' ? 'C:\\Windows\\System32\\tar.exe' : 'bsdtar';
const top = readdirSync(OUT);
execFileSync(tar, ['-a', '-c', '-f', ZIP, '-C', OUT, ...top], { stdio: 'inherit' });
const listed = execFileSync(tar, ['-t', '-f', ZIP], { encoding: 'utf8' }).trim().split(/\r?\n/);
if (!listed.includes('index.html') || listed.some((entry) => entry.includes('\\'))) {
  console.error('✗ The archive does not have index.html at its root with "/" paths');
  process.exit(1);
}
console.log(`\n${ZIP} (${(statSync(ZIP).size / MB).toFixed(2)} MB, ${listed.length} entries)`);

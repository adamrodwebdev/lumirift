// Builds the Playgama version, checks it against the platform's measurable
// requirements (and its partners'), and zips it for upload.
// Usage: npm run package:playgama   →  release/lumirift-playgama-<version>.zip
// A sandbox test build of one mode alone (1.37): `--solo dunes` or `--solo sand`
//   →  release/lumirift-playgama-dunes-<version>.zip (npm run package:playgama-dunes).
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const SOLOS = ['dunes', 'sand'];
const soloAt = process.argv.indexOf('--solo');
const solo = soloAt >= 0 ? process.argv[soloAt + 1] : null;
if (solo !== null && !SOLOS.includes(solo)) {
  console.error(`✗ --solo takes one of: ${SOLOS.join(', ')}`);
  process.exit(1);
}
const MODE = solo ? `playgama-${solo}` : 'playgama';
const OUT = `dist-${MODE}`;
const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
const ZIP = join('release', `lumirift-${MODE}-${version}.zip`);
const MB = 1024 * 1024;
/** The only external file a Playgama build may load. */
const BRIDGE = 'https://bridge.playgama.com/v2/stable/playgama-bridge.js';

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

run('npx', ['vite', 'build', '--mode', MODE]);
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
const sizes = files.map((file) => statSync(file).size);
const total = sizes.reduce((sum, size) => sum + size, 0);
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
// Every other absolute URL in the code, except the Bridge, would be a request.
const urls = [...new Set(code.match(/https?:\/\/[^\s"'`)<>\\]+/g) ?? [])].filter(
  (url) => url !== BRIDGE && !TEXT_ONLY.some((prefix) => url.startsWith(prefix)),
);
let config = null;
try {
  config = JSON.parse(readFileSync(join(OUT, 'playgama-bridge-config.json'), 'utf8'));
} catch {
  // Reported below.
}

// wiki.playgama.com: technical requirements, game checklist, platform-specific requirements.
const checks = [
  ['index.html at the root', names.includes('index.html'), 'archive root'],
  ['Total size ≤ 300 MB', total <= 300 * MB, `${(total / MB).toFixed(2)} MB`],
  [
    'Latin-only file names',
    names.every((name) => /^[A-Za-z0-9._\-/]+$/.test(name)),
    `${names.length} files`,
  ],
  [
    'Relative paths only',
    !/(src|href)="\/(?!\/)/.test(html) && !/["'(]\/assets\//.test(code),
    'no absolute asset path',
  ],
  ['Bridge v2 loaded in <head>', html.includes(`<script src="${BRIDGE}"></script>`), 'CDN'],
  ['Bridge config next to index', config !== null, 'playgama-bridge-config.json'],
  ['No other external request', urls.length === 0, urls.join(' ') || 'Bridge only'],
  [
    'No external analytics',
    !/googletagmanager|google-analytics|gtag\(|youtube\.com/.test(code),
    'GA4, gtag, YouTube',
  ],
  ['No social or search tags', !/og:|ld\+json|manifest/.test(html), 'platform page has its own'],
  // Partners (distribution is on by default): the strictest limits.
  ['MSN: build < 50 MB', total < 50 * MB, 'partner'],
  ['YouTube: ≤ 30 MB, ≤ 8000 files', total <= 30 * MB && files.length <= 8000, 'partner'],
  ['Facebook: ≤ 200 MB, ≤ 500 files', total <= 200 * MB && files.length <= 500, 'partner'],
  ['GameSnacks: every file < 10 MiB', sizes.every((size) => size < 10 * MB), 'partner'],
];
let failed = false;
for (const [name, ok, detail] of checks) {
  console.log(`${ok ? '✓' : '✗'} ${name.padEnd(34)} ${detail}`);
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

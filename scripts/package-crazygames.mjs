// Builds the CrazyGames version, checks it against the portal's technical
// requirements, and zips it for upload.
// Usage: npm run package:crazygames   →  release/lumirift-crazygames-<version>.zip
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const OUT = 'dist-crazygames';
const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
const ZIP = join('release', `lumirift-crazygames-${version}.zip`);
const MB = 1024 * 1024;

/** Files our own site needs, not the portal (its page has its own tags and icons). */
const SITE_ONLY = [
  'og-image.png',
  'manifest.webmanifest',
  'robots.txt',
  'apple-touch-icon.png',
  'icon-192.png',
  'icon-512.png',
];

const run = (command, args) => execFileSync(command, args, { stdio: 'inherit', shell: true });

run('npx', ['vite', 'build', '--mode', 'crazygames']);
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
const total = files.reduce((sum, file) => sum + statSync(file).size, 0);
const html = readFileSync(join(OUT, 'index.html'), 'utf8');
const code = files
  .filter((file) => /\.(js|css|html)$/.test(file))
  .map((file) => readFileSync(file, 'utf8'))
  .join('\n');

// The portal's measurable requirements (docs.crazygames.com/requirements/technical/).
const checks = [
  ['File count ≤ 1500', files.length <= 1500, `${files.length} files`],
  ['Total size ≤ 250 MB', total <= 250 * MB, `${(total / MB).toFixed(2)} MB`],
  ['Initial download ≤ 50 MB', total <= 50 * MB, 'whole build counted'],
  ['Mobile homepage ≤ 20 MB', total <= 20 * MB, 'whole build counted'],
  [
    'Relative paths only',
    !/(src|href)="\/(?!\/)/.test(html) && !/["'(]\/assets\//.test(code),
    'no absolute asset path',
  ],
  ['SDK v3 loaded in <head>', html.includes('crazygames-sdk-v3.js'), 'script tag'],
  ['No social or search tags', !/og:|ld\+json|manifest/.test(html), 'portal page has its own'],
];
let failed = false;
for (const [name, ok, detail] of checks) {
  console.log(`${ok ? '✓' : '✗'} ${name.padEnd(28)} ${detail}`);
  failed ||= !ok;
}
if (failed) process.exit(1);

mkdirSync('release', { recursive: true });
rmSync(ZIP, { force: true });
if (process.platform === 'win32') {
  run('powershell', [
    '-NoProfile',
    '-Command',
    `Compress-Archive -Path '${OUT}/*' -DestinationPath '${ZIP}'`,
  ]);
} else {
  run('sh', ['-c', `cd ${OUT} && zip -qr ${relative(OUT, ZIP)} .`]);
}
console.log(`\n${ZIP} (${(statSync(ZIP).size / MB).toFixed(2)} MB)`);

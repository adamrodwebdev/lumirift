// The portal media: CrazyGames covers and preview videos, Playgama covers.
// Usage: node scripts/crazygames-media.mjs   →  release/crazygames-media/,
//        release/playgama-media/ (`--covers-only` skips the videos)
//
// Covers (docs.crazygames.com/requirements/game-covers/): 1920×1080 (16:9),
// 800×1200 (2:3), 800×800 (1:1); the title as the only text; no border, no
// icon. Videos: 15–20 s, 1080p landscape (16:9) and portrait (2:3), no sound,
// no cursor, no black bars, opening on the cover. They are rendered frame by
// frame from the real game (media/showcase.html on the dev server) and
// encoded in VP9 (WebM) with the ffmpeg that comes with Playwright.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { COVERS } from './media-covers.mjs';

const OUT = join('release', 'crazygames-media');
/** `--covers-only`: skip the videos (a few minutes each). */
const COVERS_ONLY = process.argv.includes('--covers-only');
const FPS = 30;
const COVER_SECONDS = 1.5;
/**
 * The scenes (media/scenes.ts) and how long each lasts: the elements of the
 * Sand, then the four Guardians. With the cover, 19.7 s: under the 20 s cap.
 */
const SCENES = [
  ['elements', 4.0],
  ['worm', 4.0],
  ['eye', 3.4],
  ['golem', 3.4],
  ['heart', 3.4],
];
mkdirSync(OUT, { recursive: true });

// --- Covers -----------------------------------------------------------------

// The art lives in media-covers.mjs: the Eye of the Tower over the glass tower.
const browser = await chromium.launch({ channel: 'chrome' });

/** A picture of a page: PNG for the covers, JPEG frames for the videos (the encoder reads MJPEG). */
const FRAME = { type: 'jpeg', quality: 95 };
const shoot = async (html, width, height, options = { type: 'png' }) => {
  const tab = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  await tab.setContent(html);
  await tab.waitForTimeout(150);
  const png = await tab.screenshot(options);
  await tab.close();
  return png;
};

const covers = {
  landscape: await shoot(COVERS.landscape(), 1920, 1080),
  portrait: await shoot(COVERS.portrait(), 800, 1200),
  square: await shoot(COVERS.square(), 800, 800),
};
const { writeFileSync } = await import('node:fs');
writeFileSync(join(OUT, 'cover-landscape-1920x1080.png'), covers.landscape);
writeFileSync(join(OUT, 'cover-portrait-800x1200.png'), covers.portrait);
writeFileSync(join(OUT, 'cover-square-800x800.png'), covers.square);

// Playgama (wiki.playgama.com, submission form): 1920×1080, 1080×1920 (9:16)
// and 800×800, PNG ≤ 10 MB. Same art; the tall cover is drawn at its own size.
const PLAYGAMA = join('release', 'playgama-media');
mkdirSync(PLAYGAMA, { recursive: true });
writeFileSync(join(PLAYGAMA, 'cover-landscape-1920x1080.png'), covers.landscape);
writeFileSync(
  join(PLAYGAMA, 'cover-portrait-1080x1920.png'),
  await shoot(COVERS.portrait(1080, 1920), 1080, 1920),
);
writeFileSync(join(PLAYGAMA, 'cover-square-800x800.png'), covers.square);

// Our own site's social card (Open Graph, 1200 × 630): the landscape cover.
writeFileSync('public/og-image.png', await shoot(COVERS.landscape(1200, 630), 1200, 630));

// --- Videos -----------------------------------------------------------------

if (COVERS_ONLY) {
  await browser.close();
  console.log('covers written');
  process.exit(0);
}

const ffmpegDir = readdirSync(join(homedir(), 'AppData', 'Local', 'ms-playwright')).find((d) =>
  d.startsWith('ffmpeg'),
);
// LUMIRIFT_FFMPEG may point to another ffmpeg executable (with VP9); Playwright's by default.
const custom = process.env.LUMIRIFT_FFMPEG;
const FFMPEG =
  custom && existsSync(custom) && statSync(custom).isFile()
    ? custom
    : join(homedir(), 'AppData', 'Local', 'ms-playwright', ffmpegDir ?? '', 'ffmpeg-win64.exe');

const server = await createServer({
  // No hot reload: an edit during a recording must not reload the page.
  server: { port: 5179, strictPort: true, hmr: false, watch: null },
  logLevel: 'error',
});
await server.listen();

/** Records one video: the cover, then each scene, frame by frame. */
async function record(name, width, height, coverHtml) {
  const file = join(OUT, `preview-${name}-${width}x${height}.webm`);
  const encoder = spawn(
    FFMPEG,
    [
      '-y',
      '-f',
      'image2pipe',
      '-framerate',
      String(FPS),
      '-c:v',
      'mjpeg',
      '-i',
      'pipe:0',
      '-c:v',
      'libvpx-vp9',
      '-pix_fmt',
      'yuv420p',
      '-b:v',
      '0',
      '-crf',
      '31',
      '-row-mt',
      '1',
      '-deadline',
      'good',
      '-cpu-used',
      '3',
      '-an',
      file,
    ],
    { stdio: ['pipe', 'ignore', 'inherit'] },
  );
  // Stops at once if the encoder dies (instead of waiting for it forever).
  let failure = null;
  encoder.on(
    'close',
    (code) => (failure ??= code === 0 ? null : new Error(`ffmpeg exited with ${code}`)),
  );
  encoder.on('error', (error) => (failure = error));
  const write = (png) =>
    failure
      ? Promise.reject(failure)
      : new Promise((resolve) =>
          encoder.stdin.write(png) ? resolve() : encoder.stdin.once('drain', resolve),
        );

  const cover = await shoot(coverHtml, width, height, FRAME);
  for (let i = 0; i < COVER_SECONDS * FPS; i++) await write(cover);

  const tab = await browser.newPage({
    viewport: { width: width / 2, height: height / 2 },
    deviceScaleFactor: 2,
    colorScheme: 'dark',
    reducedMotion: 'no-preference',
  });
  await tab.goto('http://localhost:5179/media/showcase.html');
  await tab.waitForFunction(() => 'showcase' in window);
  for (const [scene, seconds] of SCENES) {
    console.log(`${name}: ${scene}`);
    await tab.evaluate((s) => window.showcase.scene(s), scene);
    // Two frames unrecorded: a canvas draws its first picture on the first frame (never a black one).
    for (let i = 0; i < 2; i++) await tab.evaluate((ms) => window.showcase.step(ms), 1000 / FPS);
    for (let i = 0; i < Math.round(seconds * FPS); i++) {
      await tab.evaluate((ms) => window.showcase.step(ms), 1000 / FPS);
      await write(await tab.screenshot(FRAME));
    }
  }
  await tab.close();
  encoder.stdin.end();
  await new Promise((resolve) => encoder.on('close', resolve));
  console.log(`${file} (${(statSync(file).size / 1024 / 1024).toFixed(1)} MB)`);
}

try {
  await record('landscape', 1920, 1080, COVERS.landscape(1920, 1080));
  await record('portrait', 1080, 1620, COVERS.portrait(1080, 1620));
} finally {
  await browser.close();
  await server.close();
}

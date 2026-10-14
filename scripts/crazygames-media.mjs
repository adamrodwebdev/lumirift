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
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';

const OUT = join('release', 'crazygames-media');
/** `--covers-only`: skip the videos (a few minutes each). */
const COVERS_ONLY = process.argv.includes('--covers-only');
const FPS = 30;
const COVER_SECONDS = 1.5;
const SCENE_SECONDS = 4.1;
const SCENES = ['classic', 'sand', 'mosaic', 'tower'];
mkdirSync(OUT, { recursive: true });

// --- Covers -----------------------------------------------------------------

const logo = readFileSync('public/favicon.svg', 'utf8').replace(
  '<rect width="64" height="64" rx="14" fill="#0b0e13"/>',
  '',
);
const logoUrl = `data:image/svg+xml;base64,${Buffer.from(logo).toString('base64')}`;
/** The piece colours of the dark theme (src/styles/tokens.css). */
const TONES = ['#e8795a', '#6fa0e6', '#e6bd5a', '#e77fa6', '#74bf8b', '#b08ad6', '#4fc2bb'];

/** A faceted crystal block, as in the game. */
const block = (x, y, s, colour) =>
  `<div style="position:absolute;left:${x}px;top:${y}px;width:${s}px;height:${s}px;border-radius:${s * 0.1}px;background:${colour};box-shadow:inset ${s * 0.16}px ${s * 0.16}px 0 rgb(255 255 255 / .32),inset -${s * 0.16}px -${s * 0.16}px 0 rgb(0 0 0 / .28),0 ${s * 0.12}px ${s * 0.3}px rgb(0 0 0 / .45)"></div>`;

const random = (seed) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

/** Shards flying out of a shattered row. */
const shards = (count, cx, cy, spread, size, seed) => {
  const next = random(seed);
  return Array.from({ length: count }, (_, i) => {
    const angle = next() * Math.PI * 2;
    const distance = spread * (0.25 + next() * 0.75);
    const s = size * (0.4 + next());
    return `<div style="position:absolute;left:${cx + Math.cos(angle) * distance}px;top:${cy + Math.sin(angle) * distance * 0.7}px;width:${s}px;height:${s}px;background:${TONES[i % TONES.length]};clip-path:polygon(50% 0,100% 100%,0 75%);transform:rotate(${next() * 360}deg);opacity:${0.6 + next() * 0.4};box-shadow:0 0 ${s}px rgb(255 255 255 / .2)"></div>`;
  }).join('');
};

/** A stack of blocks, rows from the bottom, with one row shattering (the rift). */
const stack = (left, bottom, s, columns, rows, seed) => {
  const next = random(seed);
  let html = '';
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < columns; c++) {
      if (r === rows - 1 && next() < 0.45) continue;
      if (r === rows - 2 && c === Math.floor(columns * 0.6)) continue;
      html += block(
        left + c * (s + 3),
        bottom - (r + 1) * (s + 3),
        s,
        TONES[(c * 3 + r * 5 + seed) % TONES.length],
      );
    }
  }
  return html;
};

/** The rift: a glowing crack through the stack. */
const rift = (x, top, height, width) => {
  const d = `M${width} 0 L${width * 0.6} ${height * 0.25} L${width * 1.35} ${height * 0.45} L${width * 0.7} ${height * 0.7} L${width * 1.2} ${height}`;
  // The glow is a wide, faint stroke under the bright one (no filter box).
  const stroke = (colour, w, opacity) =>
    `<path d="${d}" fill="none" stroke="${colour}" stroke-width="${w}" stroke-opacity="${opacity}" stroke-linecap="round" stroke-linejoin="round"/>`;
  return `<svg style="position:absolute;left:${x - width}px;top:${top}px;overflow:visible" width="${width * 2}" height="${height}" viewBox="0 0 ${width * 2} ${height}">${stroke('#f6cd6a', width * 0.9, 0.12)}${stroke('#f6cd6a', width * 0.5, 0.25)}${stroke('#fff3d6', width * 0.22, 1)}</svg>`;
};

const title = (x, y, size, align = 'left') =>
  `<div style="position:absolute;left:${x}px;top:${y}px;${align === 'center' ? 'transform:translateX(-50%);' : ''}display:flex;align-items:center;gap:${size * 0.12}px;font-family:'Segoe UI Black','Segoe UI',system-ui,sans-serif;font-weight:900;font-size:${size}px;letter-spacing:${-size * 0.02}px;color:#f7f1e6;text-shadow:0 ${size * 0.05}px ${size * 0.2}px rgb(0 0 0 / .6)"><img src="${logoUrl}" style="width:${size * 1.05}px;height:${size * 1.05}px">Stackrift</div>`;

const page = (width, height, body) =>
  `<!doctype html><html><body style="margin:0;width:${width}px;height:${height}px;overflow:hidden;position:relative;background:radial-gradient(70% 70% at 70% 35%,#2a3656,#0b0e13 72%)">
  <div style="position:absolute;inset:0;background:radial-gradient(40% 35% at 15% 85%,rgb(200 80 255 / .22),transparent 70%),radial-gradient(35% 30% at 85% 15%,rgb(80 90 255 / .2),transparent 70%)"></div>
  ${body}</body></html>`;

const COVERS = {
  landscape: (w = 1920, h = 1080) =>
    page(
      w,
      h,
      `${stack(w * 0.52, h * 0.97, h * 0.085, 9, 4, 3)}${rift(w * 0.74, h * 0.45, h * 0.52, h * 0.05)}${shards(46, w * 0.74, h * 0.42, h * 0.42, h * 0.035, 11)}${block(w * 0.66, h * 0.18, h * 0.085, TONES[2])}${block(w * 0.66 + h * 0.088, h * 0.18, h * 0.085, TONES[2])}${block(w * 0.66 + h * 0.044, h * 0.18 - h * 0.088, h * 0.085, TONES[2])}${title(w * 0.06, h * 0.36, h * 0.15)}`,
    ),
  portrait: (w = 800, h = 1200) =>
    page(
      w,
      h,
      `${stack(w * 0.07, h * 0.97, w * 0.085, 10, 6, 5)}${rift(w * 0.55, h * 0.5, h * 0.45, w * 0.06)}${shards(40, w * 0.55, h * 0.55, w * 0.45, w * 0.045, 17)}${title(w * 0.5, h * 0.12, w * 0.15, 'center')}`,
    ),
  square: (w = 800, h = 800) =>
    page(
      w,
      h,
      `${stack(w * 0.07, h * 0.97, w * 0.085, 10, 4, 7)}${rift(w * 0.6, h * 0.48, h * 0.48, w * 0.06)}${shards(30, w * 0.6, h * 0.6, w * 0.28, w * 0.04, 23)}${title(w * 0.5, h * 0.14, w * 0.15, 'center')}`,
    ),
};

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

// --- Videos -----------------------------------------------------------------

if (COVERS_ONLY) {
  await browser.close();
  console.log('covers written');
  process.exit(0);
}

const ffmpegDir = readdirSync(join(homedir(), 'AppData', 'Local', 'ms-playwright')).find((d) =>
  d.startsWith('ffmpeg'),
);
// STACKRIFT_FFMPEG may point to another ffmpeg executable (with VP9); Playwright's by default.
const custom = process.env.STACKRIFT_FFMPEG;
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
  for (const scene of SCENES) {
    console.log(`${name}: ${scene}`);
    await tab.evaluate((s) => window.showcase.scene(s), scene);
    for (let i = 0; i < SCENE_SECONDS * FPS; i++) {
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

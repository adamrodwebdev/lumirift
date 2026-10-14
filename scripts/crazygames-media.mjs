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

/** Unbounded, the identity's display face, embedded so the cover needs no network. */
const UNBOUNDED = readFileSync(
  'node_modules/@fontsource-variable/unbounded/files/unbounded-latin-wght-normal.woff2',
).toString('base64');
/** The piece tones of the Rift identity (src/styles/tokens.css). */
const TONES = ['#3de0ff', '#ff4fa3', '#b8f25c', '#8b6cff', '#ffb547', '#ff7a4d', '#5b8cff'];

/** A gem block, as in the game: light band top-left, shadow bottom-right, a gloss. */
const gem = (x, y, s, colour, tilt = 0) =>
  `<div style="position:absolute;left:${x}px;top:${y}px;width:${s}px;height:${s}px;border-radius:${s * 0.16}px;background:${colour};transform:rotate(${tilt}deg);box-shadow:inset ${s * 0.11}px ${s * 0.11}px 0 rgb(255 255 255 / .3),inset -${s * 0.11}px -${s * 0.11}px 0 rgb(0 0 0 / .32),0 ${s * 0.1}px ${s * 0.25}px rgb(0 0 0 / .4)"><div style="position:absolute;left:${s * 0.2}px;top:${s * 0.17}px;width:${s * 0.3}px;height:${s * 0.12}px;border-radius:${s * 0.06}px;background:rgb(255 255 255 / .55)"></div></div>`;

/**
 * The scene: a stack of gems torn in two by the rift (the right half lifted),
 * a piece about to fall, shards bursting out of the crack, sand pouring
 * through it. Sizes in px of the cover.
 */
function scene({ left, base, s, heights, riftX, riftTop, piece }) {
  const gap = s * 0.07;
  let html = '';
  heights.forEach((rows, c) => {
    for (let r = 0; r < rows; r++) {
      const x = left + c * (s + gap);
      const side = x + s / 2 < riftX ? -s * 0.22 : s * 0.22;
      html += gem(
        x + side,
        base - (r + 1) * (s + gap) - (side > 0 ? s * 0.12 : 0),
        s,
        TONES[(c * 3 + r * 5) % TONES.length],
        side > 0 ? 3 : -3,
      );
    }
  });
  for (const [px, py] of [
    [0, 0],
    [1, 0],
    [2, 0],
    [1, -1],
  ])
    html += gem(piece.x + px * (s + gap), piece.y + py * (s + gap), s, TONES[0]);
  // The rift: a zigzag of light from the crack down to the floor.
  const h = base - riftTop;
  const d = `M${riftX + s * 0.2} ${riftTop} L${riftX - s * 0.3} ${riftTop + h * 0.2} L${riftX + s * 0.35} ${riftTop + h * 0.4} L${riftX - s * 0.22} ${riftTop + h * 0.62} L${riftX + s * 0.26} ${riftTop + h * 0.82} L${riftX} ${base + s}`;
  const stroke = (colour, width, opacity) =>
    `<path d="${d}" fill="none" stroke="${colour}" stroke-width="${width}" stroke-opacity="${opacity}" stroke-linecap="round" stroke-linejoin="round"/>`;
  html += `<svg style="position:absolute;inset:0;overflow:visible" width="100%" height="100%">${stroke('#ff9a3c', s * 0.6, 0.16)}${stroke('#ffc35c', s * 0.22, 0.5)}${stroke('#fff6e0', s * 0.08, 1)}</svg>`;
  const next = random(11);
  for (let i = 0; i < 46; i++) {
    const angle = next() * Math.PI * 2;
    const distance = s * (0.6 + next() * 3.2);
    const size = s * (0.12 + next() * 0.32);
    html += `<div style="position:absolute;left:${riftX + Math.cos(angle) * distance * 1.15}px;top:${riftTop + h * 0.35 + Math.sin(angle) * distance * 0.7}px;width:${size}px;height:${size}px;background:${TONES[i % TONES.length]};clip-path:polygon(50% 0,100% 100%,0 70%);transform:rotate(${next() * 360}deg);opacity:${0.55 + next() * 0.45}"></div>`;
  }
  const pour = random(5);
  for (let j = 0; j < 160; j++) {
    const t = pour();
    const size = s * (0.07 + pour() * 0.05);
    html += `<div style="position:absolute;left:${riftX + (pour() - 0.5) * s * (0.3 + t * 1.6)}px;top:${base - s * 1.2 + t * s * 1.6}px;width:${size}px;height:${size}px;border-radius:50%;background:${['#ffb547', '#ff7a4d', '#ffd98f'][j % 3]}"></div>`;
  }
  return html;
}

const random = (seed) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

/** The title, split by the rift: LUMI over RIFT (the only text a cover may carry). */
const title = (x, y, size, align = 'left') =>
  `<h1 style="position:absolute;left:${x}px;top:${y}px;${align === 'center' ? 'transform:translateX(-50%);text-align:center;' : ''}margin:0;font:900 ${size}px/0.9 'Unbounded',sans-serif;letter-spacing:${-size * 0.035}px;color:#fbf7ff;text-shadow:0 ${size * 0.05}px ${size * 0.3}px rgb(120 80 255 / .55)">LUMI<br><span style="background:linear-gradient(180deg,#ffe2a3,#ff9a3c);-webkit-background-clip:text;background-clip:text;color:transparent;text-shadow:none">RIFT</span></h1>`;

const page = (width, height, glow, body) =>
  `<!doctype html><html><head><style>@font-face{font-family:'Unbounded';font-weight:200 900;src:url(data:font/woff2;base64,${UNBOUNDED}) format('woff2')}</style></head><body style="margin:0;width:${width}px;height:${height}px;overflow:hidden;position:relative;background:radial-gradient(70% 80% at ${glow},#2e2066 0%,#140e3a 48%,#07061a 100%)">
  <div style="position:absolute;inset:0;background:radial-gradient(30% 55% at ${glow},rgb(255 170 60 / .32),transparent 75%)"></div>
  ${body}</body></html>`;

const COVERS = {
  landscape: (w = 1920, h = 1080) => {
    const s = h * 0.104;
    return page(
      w,
      h,
      '72% 55%',
      `${title(w * 0.06, h * 0.3, h * 0.176)}${scene({
        left: w * 0.55,
        base: h * 0.965,
        s,
        heights: [4, 5, 3, 0, 4, 5, 3],
        riftX: w * 0.55 + 3.5 * s * 1.07,
        riftTop: h * 0.3,
        piece: { x: w * 0.68, y: h * 0.19 },
      })}`,
    );
  },
  portrait: (w = 800, h = 1200) => {
    const s = w * 0.107;
    return page(
      w,
      h,
      '50% 68%',
      `${title(w / 2, h * 0.08, w * 0.19, 'center')}${scene({
        left: w * 0.1,
        base: h * 0.98,
        s,
        heights: [5, 6, 4, 0, 5, 6, 4],
        riftX: w / 2,
        riftTop: h * 0.52,
        piece: { x: w * 0.33, y: h * 0.43 },
      })}`,
    );
  },
  square: (w = 800, h = 800) => {
    const s = w * 0.11;
    return page(
      w,
      h,
      '50% 70%',
      `${title(w / 2, h * 0.07, w * 0.165, 'center')}${scene({
        left: w * 0.13,
        base: h * 0.985,
        s,
        heights: [3, 3, 0, 2, 3, 2],
        // The rift runs down the empty third column.
        riftX: w * 0.13 + 2.5 * s * 1.07,
        riftTop: h * 0.52,
        piece: { x: w * 0.6, y: h * 0.5 },
      })}`,
    );
  },
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

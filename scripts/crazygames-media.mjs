// The portal media: CrazyGames covers and preview videos, Playgama covers.
// Usage: node scripts/crazygames-media.mjs   →  release/crazygames-media/,
//        release/playgama-media/ (`--covers-only` skips the videos)
//
// Covers (docs.crazygames.com/requirements/game-covers/): 1920×1080 (16:9),
// 800×1200 (2:3), 800×800 (1:1); the title as the only text; no border, no
// icon. Videos: 15–20 s, 1080p landscape (16:9) and portrait (2:3), no sound,
// no cursor, no black bars, opening on the cover. They are rendered frame by
// frame from the real game (showcase-frames.mjs) and encoded in H.264 (MP4) by
// Chrome (mp4-encoder.mjs), the format every upload form takes (1.45; WebM
// before).
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { COVERS } from './media-covers.mjs';
import { Mp4Encoder } from './mp4-encoder.mjs';
import { sceneFrames, startShowcase } from './showcase-frames.mjs';

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

/** A picture of a page: PNG for the covers, JPEG frames for the videos. */
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

const server = await startShowcase();

/** Records one video: the cover, then each scene, frame by frame, in H.264. */
async function record(name, width, height, coverHtml) {
  const file = join(OUT, `preview-${name}-${width}x${height}.mp4`);
  const video = await Mp4Encoder.open(browser, { width, height, fps: FPS });
  const cover = await shoot(coverHtml, width, height, FRAME);
  for (let i = 0; i < COVER_SECONDS * FPS; i++) await video.add(cover);
  const frames = sceneFrames(browser, {
    width,
    height,
    fps: FPS,
    scenes: SCENES,
    onScene: (scene) => console.log(`${name}: ${scene}`),
  });
  for await (const frame of frames) await video.add(frame);
  const bytes = await video.save(file);
  console.log(`${file} (${(bytes / 1024 / 1024).toFixed(1)} MB)`);
}

try {
  await record('landscape', 1920, 1080, COVERS.landscape(1920, 1080));
  await record('portrait', 1080, 1620, COVERS.portrait(1080, 1620));
} finally {
  await browser.close();
  await server.close();
}

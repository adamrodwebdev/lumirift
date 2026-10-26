// The Yandex Games media (draft form and rules 5.1, 5.6, 5.9, 8.3 of
// yandex.ru/dev/games/doc): the icon (512 × 512) and the cover (800 × 470),
// PNG, with no screenshot, interface or border; screenshots of real play in
// each language of the game, 1920 × 1080 for computers and 1080 × 1920 for
// phones (JPEG); the horizontal video (16:9 MP4, 28 s at most, required) and
// the vertical one (9:16), encoded by Chrome (mp4-encoder.mjs).
// Usage: node scripts/yandex-media.mjs [--no-video] [--no-shots] [--lang=ru] [--review]
//        →  release/yandex-media/   (--review: three timings per screenshot, to choose from)
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { preview } from 'vite';
import { COVERS } from './media-covers.mjs';
import { Mp4Encoder } from './mp4-encoder.mjs';
import { sceneFrames, startShowcase } from './showcase-frames.mjs';

const OUT = join('release', 'yandex-media');
/** `--no-video`: the pictures only (the videos take a few minutes each). */
const NO_VIDEO = process.argv.includes('--no-video');
/** `--no-shots`: no screenshots (the icon, the cover and the videos only). */
const NO_SHOTS = process.argv.includes('--no-shots');
/** `--review`: each screenshot at three timings, to choose the moment. */
const REVIEW = process.argv.includes('--review');
/** `--lang=xx`: the screenshots of one language only. */
const ONLY = process.argv.find((arg) => arg.startsWith('--lang='))?.slice(7);
const LANGUAGES = ['ru', 'en', 'fr', 'id'].filter((lang) => !ONLY || lang === ONLY);
const FPS = 30;
const COVER_SECONDS = 1.5;
/**
 * The scenes (media/scenes.ts) at the title screen's own lengths (SCENE_MS in
 * src/showcase/Scene.ts), the Mirror left out: 25.5 s with the cover, under
 * Yandex's 28 s, and 94 % of it real play (rule 5.1.1.3 asks for 70 %).
 */
const SCENES = [
  ['elements', 4.8],
  ['flip', 3.0],
  ['worm', 4.0],
  ['tilt', 3.0],
  ['golem', 3.2],
  ['eye', 3.0],
  ['heart', 3.0],
];
const PREVIEW_PORT = 4183;

// A full run starts clean; a partial one (a language, no shots or no videos) keeps the rest.
if (!ONLY && !REVIEW && !NO_SHOTS && !NO_VIDEO) rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });

/** A picture of an HTML page, PNG by default. */
const shoot = async (html, width, height, options = { type: 'png' }) => {
  const tab = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  await tab.setContent(html);
  await tab.waitForTimeout(150);
  const picture = await tab.screenshot(options);
  await tab.close();
  return picture;
};

// --- Icon and cover -----------------------------------------------------------

// The art of every portal (media-covers.mjs): the Eye of the Tower over its glass tower.
writeFileSync(join(OUT, 'icon-512x512.png'), await shoot(COVERS.icon(512), 512, 512));
writeFileSync(join(OUT, 'cover-800x470.png'), await shoot(COVERS.landscape(800, 470), 800, 470));
console.log('icon and cover written');

// --- Screenshots --------------------------------------------------------------

/** A player well into the campaign: every level open, the training done. */
const stars = {};
for (let chapter = 1; chapter <= 5; chapter++) {
  for (let level = 1; level <= 7; level++) stars[`${chapter}-${level}`] = 3;
}
const VETERAN = {
  'stackrift:profile': JSON.stringify({ xp: 2400, games: 60, trained: true }),
  'stackrift:campaign': JSON.stringify({ stars, ranks: {} }),
};
/** A new player: no data, so the game opens straight on the training. */
const NEWCOMER = {};

/** A stand-in for the SDK Yandex serves at /sdk.js: the player's language and data, no ads. */
const fakeSdk = (lang, player) => `(() => {
  const data = ${JSON.stringify(player)};
  const close = ({ callbacks }) => callbacks.onClose && callbacks.onClose(false);
  const ysdk = {
    features: { LoadingAPI: { ready() {} }, GameplayAPI: { start() {}, stop() {} } },
    environment: { i18n: { lang: ${JSON.stringify(lang)} } },
    adv: { showFullscreenAdv: close, showRewardedVideo: close },
    getPlayer: () => Promise.resolve({ getData: () => Promise.resolve({ ...data }), setData: () => Promise.resolve() }),
    on() {},
  };
  window.YaGames = { init: () => Promise.resolve(ysdk) };
})();`;

/** The words that mark a moment: the guide's line in the training, a toast in a level. */
const guideSays = (page) =>
  page
    .locator('.guide__line:not(.guide__line--room) .guide__text')
    .first()
    .textContent({ timeout: 50 })
    .catch(() => '');
const toastSays = (page) =>
  page
    .locator('.toast')
    .textContent({ timeout: 30 })
    .catch(() => '');

/** Whether `words` start with one of the texts of `list`. */
const texts = (list, words) => list.some((text) => (words ?? '').trim().startsWith(text));

/** Waits until `read` gives words that start with one of `list`; false after `timeout`. */
async function until(page, read, list, timeout) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (texts(list, await read(page))) return true;
    await page.waitForTimeout(40);
  }
  return false;
}

/** Where the player drops each piece, in columns from the middle: a spread, not a pile. */
const AIM = [-3, 1, -1, 3, 0, -2, 2];

/** Plays (spread hard drops) until a toast starts with one of `list`; false after `timeout`. */
async function playUntil(page, list, timeout = 60_000) {
  const started = Date.now();
  let drops = 0;
  let lastDrop = Date.now();
  await page.waitForTimeout(1200);
  while (Date.now() - started < timeout) {
    if (texts(list, await toastSays(page))) return true;
    if (Date.now() - lastDrop > 850) {
      const aim = AIM[drops++ % AIM.length];
      for (let i = 0; i < Math.abs(aim); i++)
        await page.keyboard.press(aim < 0 ? 'ArrowLeft' : 'ArrowRight');
      await page.keyboard.press('Space');
      lastDrop = Date.now();
    }
    await page.waitForTimeout(30);
  }
  return false;
}

/** Opens a level of the campaign map, turning its chapters one by one. */
async function openLevel(page, t, id) {
  await page.getByRole('tab', { name: t.hub.tabs.map }).click();
  const map = page.getByRole('tabpanel', { name: t.hub.tabs.map });
  const back = map.getByRole('button', { name: t.hub.prevChapter });
  while (await back.isEnabled().catch(() => false)) {
    await back.click();
    await page.waitForTimeout(350);
  }
  for (let turn = 1; turn < Number(id.split('-')[0]); turn++) {
    await map.getByRole('button', { name: t.hub.nextChapter }).click();
    await page.waitForTimeout(350);
  }
  await map.getByRole('button', { name: new RegExp(`(^|\\D)${id}(\\D|$)`) }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: t.campaign.play, exact: true })
    .click();
  // Every level shows its goal card, whatever its family's stage.
  await page.locator('.goal').waitFor();
}

/**
 * Training, step 1, played as a newcomer plays it (every piece dropped where
 * it appears) up to the second pair: the oil placed, then the fire dropped
 * onto it, the blaze spreading.
 */
async function blaze(page, t) {
  const started = Date.now();
  while (Date.now() - started < 60_000) {
    const words = await guideSays(page);
    if (texts([t.training.guide.dropFire], words)) {
      await page.waitForTimeout(400);
      await page.keyboard.press('Space');
      return true;
    }
    await page.keyboard.press('Space');
    await page.waitForTimeout(700);
  }
  return false;
}

/**
 * Training, step 2: step 1 played as a newcomer plays it, then the Wyrm
 * bursting out of the sand, its head bare.
 */
async function wyrm(page, t) {
  const next = page.getByRole('button', { name: t.training.continue, exact: true });
  const second = [t.training.guide.roam, t.training.guide.warn, t.training.guide.exposed];
  const started = Date.now();
  while (Date.now() - started < 120_000) {
    if (await next.isVisible().catch(() => false)) await next.click();
    else if (texts(second, await guideSays(page))) break;
    else await page.keyboard.press('Space');
    await page.waitForTimeout(700);
  }
  return until(page, guideSays, [t.training.guide.exposed], 40_000);
}

/** Arrow presses for each placement in the Mosaic: a spread over the board. */
const STEPS = [
  [],
  ['ArrowLeft', 'ArrowLeft'],
  ['ArrowRight', 'ArrowRight'],
  ['ArrowUp', 'ArrowUp'],
  ['ArrowDown', 'ArrowDown'],
  ['ArrowLeft', 'ArrowUp'],
  ['ArrowRight', 'ArrowDown'],
];

/**
 * The Ceramic Golem's level (3-7), fourteen placements from the keyboard: the
 * board in play, the Golem's face over it, its aimed cells glowing. (Its
 * notices show once per game, so a toast cannot mark a later moment.)
 */
async function golem(page, t) {
  await page.getByRole('tab', { name: t.hub.tabs.map }).waitFor();
  await openLevel(page, t, '3-7');
  for (let move = 0; move < 14; move++) {
    await page.keyboard.press(`Digit${(move % 3) + 1}`);
    for (const key of STEPS.at(move % STEPS.length)) await page.keyboard.press(key);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(450);
  }
  return true;
}

/** A campaign level: spread hard drops until a toast names the moment. */
const level = (id, toasts) => async (page, t) => {
  await page.getByRole('tab', { name: t.hub.tabs.map }).waitFor();
  await openLevel(page, t, id);
  return playUntil(page, toasts(t));
};

/**
 * What each picture shows, by device: the living sand and the Guardians at
 * their moment (the oil ablaze, the lightning on the Wyrm's head, the Heart
 * swelling, the Golem taking aim). The training shots start as a new player,
 * the level shots as a player with every level open.
 */
const SHOTS = {
  desktop: [
    { name: 'elements', player: NEWCOMER, moment: blaze, after: 600 },
    {
      name: 'heart',
      player: VETERAN,
      moment: level('5-7', (t) => [t.notice.boss.heart.swell]),
      after: 500,
    },
  ],
  mobile: [
    { name: 'wyrm', player: NEWCOMER, moment: wyrm, after: 150 },
    { name: 'golem', player: VETERAN, moment: golem, after: 300 },
  ],
};
/** The window of each device, at the pixel density that gives Yandex's sizes. */
const DEVICES = {
  desktop: { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5 },
  mobile: {
    viewport: { width: 360, height: 640 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  },
};
/** The toasts say what happens; a picture shows it, without the words over the well. */
const QUIET = '.toast { visibility: hidden !important; }';

if (!NO_SHOTS) {
  execFileSync('npx', ['vite', 'build', '--mode', 'yandex', '--logLevel', 'warn'], {
    stdio: 'inherit',
    shell: true,
  });
  const server = await preview({
    mode: 'yandex',
    preview: { port: PREVIEW_PORT, strictPort: true },
    logLevel: 'error',
  });
  try {
    for (const lang of LANGUAGES) {
      const t = JSON.parse(readFileSync(join('src', 'i18n', 'locales', `${lang}.json`), 'utf8'));
      mkdirSync(join(OUT, 'screenshots', lang), { recursive: true });
      for (const [device, shots] of Object.entries(SHOTS)) {
        const size = device === 'desktop' ? '1920x1080' : '1080x1920';
        for (const [index, shot] of shots.entries()) {
          const context = await browser.newContext({ ...DEVICES[device], colorScheme: 'dark' });
          const page = await context.newPage();
          await page.route('**/sdk.js', (route) =>
            route.fulfill({ contentType: 'text/javascript', body: fakeSdk(lang, shot.player) }),
          );
          await page.goto(`http://localhost:${PREVIEW_PORT}/`);
          const found = await shot.moment(page, t);
          await page.addStyleTag({ content: QUIET });
          const name = `${device}-${index + 1}-${shot.name}-${size}`;
          const timings = REVIEW ? [shot.after / 2, shot.after / 2, shot.after] : [shot.after];
          for (const [take, wait] of timings.entries()) {
            await page.waitForTimeout(wait);
            const suffix = REVIEW ? `-${'abc'.at(take)}` : '';
            const file = join(OUT, 'screenshots', lang, `${name}${suffix}.jpg`);
            writeFileSync(file, await page.screenshot({ type: 'jpeg', quality: 92 }));
            console.log(`${file}${found ? '' : ' (moment not seen: shot at the timeout)'}`);
          }
          await context.close();
        }
      }
    }
  } finally {
    await server.close();
  }
}

// --- Videos -------------------------------------------------------------------

/** One video: the cover, then each scene, frame by frame, in H.264. */
async function record(name, width, height, coverHtml) {
  const file = join(OUT, `video-${name}-${width}x${height}.mp4`);
  const video = await Mp4Encoder.open(browser, { width, height, fps: FPS });
  const cover = await shoot(coverHtml, width, height, { type: 'jpeg', quality: 95 });
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

if (!NO_VIDEO) {
  const showcase = await startShowcase();
  try {
    await record('horizontal', 1920, 1080, COVERS.landscape(1920, 1080));
    await record('vertical', 1080, 1920, COVERS.portrait(1080, 1920));
  } finally {
    await showcase.close();
  }
}
await browser.close();

// The clip factory (lot 25, 1.39): the week's short clips for TikTok,
// Instagram Reels and YouTube Shorts, filmed by the game itself on its real
// engines (media/showcase.html?clip, one take per load of the set). Each clip
// opens on its peak, an engine event that a first take finds (never a time
// set by hand), and its aftermath, then goes back to the start and plays up
// to the frame before the one it opened on: the loop has no seam, picture and
// sound run through it, and the peak plays once a loop. 1080 × 1920 at 30
// frames a second, H.264 and AAC (mp4-encoder.mjs), with the game's own sound
// rendered with the picture, levelled near −14 LUFS with its true peaks under
// −2 dBTP (loudness.mjs); a JPEG cover (the peak) and manifest.json (scene,
// variant, length, peak, the engines' counts, the sound's levels). It only
// writes files: no upload, no platform API (CAHIER § 9 ter).
// Usage: npm run clips -- --week 2026-11-02 [--clip mon-fire-on-oil]
//        →  release/clips/<week>/
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { loudness, normalise, truePeakDb } from './loudness.mjs';
import { Mp4Encoder } from './mp4-encoder.mjs';
import { SHOWCASE_URL, startShowcase } from './showcase-frames.mjs';

const FPS = 30;
const FRAME_MS = 1000 / FPS;
const VIDEO = { width: 1080, height: 1920 };
/** H.264 at 12 Mbit/s: the apps re-encode what they receive, so they get a clean source. */
const BITRATE = 12_000_000;
/** The clip set: the game's screen (540 × 960 CSS px) and its margins (media/showcase.ts), drawn at 3×. */
const SET = { width: 540, height: 1280, density: 3 };
const SAMPLE_RATE = 48_000;
/** Samples of sound per frame. */
const SPF = SAMPLE_RATE / FPS;
/** The clip opens this long before its peak (ms), as the punch-in starts. */
const LEAD_MS = 150;
/** The punch-in: × 1 → × 1.15 in the 150 ms before the peak, held 1.2 s, then back in 0.3 s. */
const PUNCH = { zoom: 1.15, inMs: 150, holdMs: 1200, outMs: 300 };
/** A challenge's decision: a moment after the fire appears; frozen to open the clip and to end it (ms). */
const DECISION_MS = 200;
const OPEN_FREEZE_MS = 1200;
const END_FREEZE_MS = 2500;
/** A clip's length (s). */
const LENGTH = { min: 7, max: 15 };
/**
 * The sound's levels: near −14 LUFS, true peaks under −2 dBTP before the
 * encoder, and the decoded AAC's samples at −1 dBFS or under.
 */
const SOUND = { lufs: -14, truePeakDb: -2, decodedPeakDb: -1 };
/** Where the action must be (shares of the frame): out of the right 15 % (the apps' buttons), the bottom 22 % (the caption), the top 10 % (the tabs). */
const SAFE = { left: 0.03, right: 0.85, top: 0.1, bottom: 0.78 };
/** The camera keeps the action this far inside the safe area (share of the frame). */
const SAFE_MARGIN = 0.02;
/** A split screen (a challenge's answers): each well this wide, side by side (video px). */
const SPLIT = { width: 440, gap: 16, left: 80 };
/** Frames played before the first one filmed: a canvas draws its first picture on the first frame. */
const WARM_UP = 2;
/** How long a first take looks for its peak (ms). */
const SEARCH_MS = 20_000;
/** A fade at each cut of the sound (samples): a cut never clicks. */
const FADE = Math.round(0.005 * SAMPLE_RATE);

const arg = (name) => {
  const at = process.argv.indexOf(`--${name}`);
  return at > 1 ? process.argv[at + 1] : undefined;
};
const WEEK = arg('week');
/** `--clip <id>`: that clip alone (the others in the manifest are kept). */
const ONLY = arg('clip');
if (!/^\d{4}-\d{2}-\d{2}$/.test(WEEK ?? '')) {
  console.error('Usage: npm run clips -- --week YYYY-MM-DD [--clip <id>]');
  process.exit(1);
}
const OUT = join('release', 'clips', WEEK);

const frames = (ms) => Math.round(ms / FRAME_MS);
const easeOut = (t) => 1 - (1 - t) ** 3;
const easeInOut = (t) => 0.5 - Math.cos(Math.PI * t) / 2;
/** A value on the set's pixel grid (CSS px, at 3×): a crop never blurs by a third of a pixel. */
const snap = (value) => Math.round(value * SET.density) / SET.density;

/** The zoom `ms` from the peak: the punch-in, held, then back. */
function punch(ms) {
  if (ms < -PUNCH.inMs || ms >= PUNCH.holdMs + PUNCH.outMs) return 1;
  if (ms < 0) return 1 + (PUNCH.zoom - 1) * easeOut((ms + PUNCH.inMs) / PUNCH.inMs);
  if (ms < PUNCH.holdMs) return PUNCH.zoom;
  return PUNCH.zoom - (PUNCH.zoom - 1) * easeInOut((ms - PUNCH.holdMs) / PUNCH.outMs);
}

/**
 * The camera at zoom 1: the game's screen, moved up or down into the set's
 * margins so the action sits inside the safe area (the board keeps its size).
 * The action is its anchor, or its extent when it reaches further (the Heart's
 * floor and the rows that burst over it); if it is taller than the safe area,
 * its bottom wins and the top of the well leaves the frame.
 */
function screenCrop({ screen, page }, anchor, extent = null) {
  const crop = { ...screen };
  const action = extent ?? (anchor && { top: anchor.y, bottom: anchor.y });
  if (action) {
    const share = (y) => (y - crop.y) / crop.height;
    const low = SAFE.bottom - SAFE_MARGIN;
    const high = SAFE.top + SAFE_MARGIN;
    if (share(action.top) < high) crop.y -= (high - share(action.top)) * crop.height;
    if (share(action.bottom) > low) crop.y += (share(action.bottom) - low) * crop.height;
    crop.y = Math.min(Math.max(crop.y, 0), page.height - crop.height);
  }
  return { x: snap(crop.x), y: snap(crop.y), width: snap(crop.width), height: snap(crop.height) };
}

/** Where a point of the set lands in the frame (shares) when `crop` fills it. */
const onScreen = (point, crop) => ({
  x: (point.x - crop.x) / crop.width,
  y: (point.y - crop.y) / crop.height,
});
const isSafe = ({ x, y }) => x >= SAFE.left && x <= SAFE.right && y >= SAFE.top && y <= SAFE.bottom;

/**
 * The picture of `crop` drawn so the frame shows it at `zoom`: the anchor
 * stays where it is on screen while everything grows around it.
 */
function zoomed(picture, crop, anchor, zoom) {
  const base = VIDEO.width / crop.width;
  const scale = base * zoom;
  const at = anchor ?? { x: crop.x + crop.width / 2, y: crop.y + crop.height / 2 };
  const dx = at.x - crop.x;
  const dy = at.y - crop.y;
  return {
    picture,
    x: dx * base - dx * scale,
    y: dy * base - dy * scale,
    width: crop.width * scale,
    height: crop.height * scale,
  };
}

// --- The sound -----------------------------------------------------------------

const fromBase64 = (text) => new Float32Array(new Uint8Array(Buffer.from(text, 'base64')).buffer);

/**
 * The sound of a run (`count` frames from frame `from`), faded in and out at
 * its cuts so that a cut never clicks; not at a seamless loop's point
 * (`fadeIn` or `fadeOut` false), where the sound runs on.
 */
function soundOf(channels, { from, count, fadeIn = true, fadeOut = true }) {
  return channels.map((samples) => {
    const part = new Float32Array(count * SPF);
    part.set(samples.subarray(from * SPF, Math.min(samples.length, (from + count) * SPF)));
    const fade = Math.min(FADE, part.length >> 1);
    for (let i = 0; i < fade; i++) {
      if (fadeIn) part[i] *= i / fade;
      if (fadeOut) part[part.length - 1 - i] *= i / fade;
    }
    return part;
  });
}

const join2 = (parts) =>
  parts[0].map((_, channel) => {
    const out = new Float32Array(parts.reduce((sum, part) => sum + part[channel].length, 0));
    parts.reduce((at, part) => (out.set(part[channel], at), at + part[channel].length), 0);
    return out;
  });

/** Two takes heard together, at half level each (their music is the same). */
const mix = (a, b) => a.map((samples, channel) => samples.map((v, i) => (v + b[channel][i]) / 2));

// --- The set ---------------------------------------------------------------------

const server = await startShowcase();
// Drawn by the processor, not the graphics card: the card composites the well's glow a little
// differently from one take to the next, the processor the same every time (two takes, one clip).
const browser = await chromium.launch({ channel: 'chrome', args: ['--disable-gpu'] });
const set = await browser.newPage({
  viewport: { width: SET.width, height: SET.height },
  deviceScaleFactor: SET.density,
  colorScheme: 'dark',
  reducedMotion: 'no-preference',
});

const step = () => set.evaluate((ms) => window.showcase.step(ms), FRAME_MS);
const shoot = (crop) => set.screenshot({ type: 'jpeg', quality: 92, clip: crop });

/** Puts the set up again (one take per load) and opens the page's API. */
async function openSet() {
  await set.goto(`${SHOWCASE_URL}?clip`);
  // `window.showcase` first names the page's <div id="showcase">: wait for the real API. Asked
  // again and again from here: the set's frames are its own, so `waitForFunction` (which waits
  // on the page's requestAnimationFrame) would wait for ever.
  for (const started = Date.now(); Date.now() - started < 120_000;) {
    if (await set.evaluate(() => typeof window.showcase?.scene === 'function')) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('The clip set did not come up in 2 minutes');
}

/** A take: the scene started on a fresh set, its first frames played. */
async function take(recipe, choice, options = {}) {
  await openSet();
  await set.evaluate(
    ({ scene, variant, choice, options }) => window.showcase.scene(scene, variant, choice, options),
    { scene: recipe.scene, variant: recipe.variant, choice, options: { fps: FPS, ...options } },
  );
  for (let frame = 1; frame <= WARM_UP; frame++) await step();
}

/**
 * The first take, nothing filmed: when and where the `nth` `event` happens
 * (its anchor, and its extent when the action reaches further), and the set's layout.
 */
async function findPeak(recipe, choice, event = recipe.peak, nth = recipe.nth ?? 1) {
  await take(recipe, choice);
  for (let frame = WARM_UP + 1; frame * FRAME_MS <= SEARCH_MS; frame++) {
    const peak = await set.evaluate(
      async ({ ms, event, nth }) => {
        await window.showcase.step(ms);
        return window.showcase.peaks().filter((peak) => peak.event === event)[nth - 1] ?? null;
      },
      { ms: FRAME_MS, event, nth },
    );
    if (peak) {
      const layout = await set.evaluate(() => window.showcase.layout());
      return { frame: Math.round(peak.ms / FRAME_MS), at: peak.at, extent: peak.extent, layout };
    }
  }
  throw new Error(
    `${recipe.id}: no ${event} #${nth} in the first ${SEARCH_MS / 1000} s of ${recipe.scene}`,
  );
}

/**
 * The take filmed: a picture of the crop (CSS px of the set, drawn at 3×) for
 * each frame `from` to `to`, its sound to `soundTo`, the engine's counts at
 * `to`. `crop(layout, badges)` frames it; `badge` shows one answer under the
 * well (a split screen's take, `plain`); `decision` also films the last frame
 * with both answers over the well.
 */
async function film(
  recipe,
  choice,
  { from, to, soundTo = to, crop: frameIt, plain = false, badge = null, decision = false },
) {
  await take(recipe, choice, { soundMs: (soundTo + 2) * FRAME_MS, plain });
  const badges = badge
    ? await set.evaluate((label) => window.showcase.markers([label], true), badge)
    : [];
  const layout = await set.evaluate(() => window.showcase.layout());
  const crop = frameIt(layout, badges);
  const pictures = new Map();
  const hash = createHash('sha256');
  let measures = null;
  let asked = null;
  let answers = [];
  for (let frame = WARM_UP + 1; frame <= soundTo; frame++) {
    await step();
    if (frame < from || frame > to) continue;
    const picture = await shoot(crop);
    pictures.set(frame, picture);
    hash.update(picture);
    if (frame !== to) continue;
    measures = await set.evaluate(() => window.showcase.measures());
    if (decision) {
      answers = await set.evaluate(() => window.showcase.markers(['A', 'B']));
      asked = await shoot(crop);
      hash.update(asked);
      await set.evaluate(() => window.showcase.markers(null));
    }
  }
  const sound = (await set.evaluate(() => window.showcase.audio())).map(fromBase64);
  const background = await set.evaluate(() => window.showcase.background());
  return {
    crop,
    layout,
    badges,
    pictures,
    asked,
    answers,
    measures,
    sound,
    background,
    hash: hash.digest('hex'),
  };
}

// --- The clips -----------------------------------------------------------------------

/**
 * A seamless loop around a peak (the frames of the take): the hook, from
 * 0.15 s before the peak through `afterMs` of its aftermath, then the replay,
 * from the scene's start to the frame just before the hook. The last frame
 * leads into the first, so the loop has no seam and the peak plays once a
 * loop. A clip that would last under 7 s gets a longer aftermath: the replay
 * never reaches the peak. `end` is the last frame to film.
 */
function seamlessLoop(peakFrame, afterMs) {
  const hook = peakFrame - frames(LEAD_MS);
  const replay = hook - (WARM_UP + 1);
  const hookFrames = Math.max(frames(LEAD_MS + afterMs), Math.ceil(LENGTH.min * FPS) - replay);
  return { hook, hookFrames, replay, end: hook + hookFrames - 1 };
}

/** The runs of a seamless loop: the sound runs through its loop point, unfaded (a cut between). */
const loopRuns = ({ hook, hookFrames, replay }, view) => [
  { from: hook, count: hookFrames, view, fadeIn: false },
  { from: WARM_UP + 1, count: replay, view, fadeOut: false },
];

/**
 * A moment: it opens 0.15 s before its peak with the punch-in, holds it 1.2 s
 * and its aftermath ~2.5 s, then replays from the start up to the frame
 * before the one it opened on (a seamless loop).
 */
async function momentClip(recipe) {
  const peak = await findPeak(recipe, null);
  const loop = seamlessLoop(peak.frame, recipe.afterMs);
  const shot = await film(recipe, null, {
    from: WARM_UP + 1,
    to: loop.end,
    crop: (layout) => screenCrop(layout, peak.at, peak.extent),
  });
  const view = (frame) => [
    zoomed(shot.pictures.get(frame), shot.crop, peak.at, punch((frame - peak.frame) * FRAME_MS)),
  ];
  return {
    runs: loopRuns(loop, view),
    sound: shot.sound,
    cover: view(peak.frame + frames(300)),
    peak: {
      frame: peak.frame,
      clipMs: (peak.frame - loop.hook) * FRAME_MS,
      at: peak.at && onScreen(peak.at, shot.crop),
      // How high the action reaches in the frame, top and bottom (shares of its height).
      extent: peak.extent && {
        top: (peak.extent.top - shot.crop.y) / shot.crop.height,
        bottom: (peak.extent.bottom - shot.crop.y) / shot.crop.height,
      },
    },
    measures: shot.measures,
    hash: shot.hash,
  };
}

/**
 * A challenge's question: it opens on the decision (the fire just appeared,
 * A and B over the well) with the punch-in, goes back to the start, plays up
 * to the decision, and holds it there with its A and B: the first picture.
 */
async function setupClip(recipe) {
  const spawn = await findPeak(recipe, null);
  const decision = spawn.frame + frames(DECISION_MS);
  const holdFrames = frames(END_FREEZE_MS);
  const shot = await film(recipe, null, {
    from: WARM_UP + 1,
    to: decision,
    soundTo: decision + holdFrames,
    crop: (layout) => screenCrop(layout, null),
    decision: true,
  });
  const [a, b] = shot.answers;
  const anchor = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const asked = (zoom) => [zoomed(shot.asked, shot.crop, anchor, zoom)];
  const runs = [
    // The music goes on under the frozen decision.
    {
      from: decision,
      count: frames(OPEN_FREEZE_MS),
      view: (_, i) => asked(punch(i * FRAME_MS - PUNCH.inMs)),
    },
    {
      from: WARM_UP + 1,
      count: decision - WARM_UP,
      view: (frame) => [zoomed(shot.pictures.get(frame), shot.crop, null, 1)],
    },
    { from: decision, count: holdFrames, view: () => asked(1) },
  ];
  return {
    runs,
    sound: shot.sound,
    cover: asked(1),
    peak: {
      frame: decision,
      clipMs: 0,
      at: null,
      answers: shot.answers.map((answer) => onScreen(answer, shot.crop)),
    },
    measures: shot.measures,
    hash: shot.hash,
  };
}

/**
 * A challenge's answer: both drops side by side, each well with its letter
 * under it, whole (no punch-in: a comparison needs both wells entire). It
 * opens 0.15 s before A's peak with its aftermath, then replays from the
 * start up to the frame before the one it opened on (a seamless loop).
 */
async function answerClip(recipe) {
  const peak = await findPeak(recipe, 'A');
  const loop = seamlessLoop(peak.frame, recipe.afterMs);
  const end = loop.end;
  const wellAndBadge = ({ well }, [badge]) => {
    // The letter's glow fades within 32 px of its edge.
    const bottom = badge.y + badge.size / 2 + 32;
    return {
      x: snap(well.x - 6),
      y: snap(well.y),
      width: snap(well.width + 12),
      height: snap(bottom - well.y),
    };
  };
  const takes = [];
  for (const choice of ['A', 'B']) {
    takes.push(
      await film(recipe, choice, {
        from: WARM_UP + 1,
        to: end,
        crop: wellAndBadge,
        plain: true,
        badge: choice,
      }),
    );
  }
  const { crop, background } = takes[0];
  const scale = SPLIT.width / crop.width;
  const height = crop.height * scale;
  const top = VIDEO.height * SAFE.top + (VIDEO.height * (SAFE.bottom - SAFE.top) - height) / 2;
  const view = (frame) =>
    takes.map((shot, i) => ({
      picture: shot.pictures.get(frame),
      x: SPLIT.left + i * (SPLIT.width + SPLIT.gap),
      y: top,
      width: SPLIT.width,
      height,
    }));
  // Where A's peak and each answer's letter land in the frame.
  const place = (point, i) => ({
    x: (SPLIT.left + i * (SPLIT.width + SPLIT.gap) + (point.x - crop.x) * scale) / VIDEO.width,
    y: (top + (point.y - crop.y) * scale) / VIDEO.height,
  });
  const letters = takes.map((shot, i) => place(shot.badges[0], i));
  return {
    runs: loopRuns(loop, view),
    background,
    sound: mix(takes[0].sound, takes[1].sound),
    cover: view(peak.frame + frames(300)),
    peak: {
      frame: peak.frame,
      clipMs: (peak.frame - loop.hook) * FRAME_MS,
      at: peak.at && place(peak.at, 0),
      answers: letters,
    },
    measures: { A: takes[0].measures, B: takes[1].measures },
    hash: createHash('sha256')
      .update(takes.map((shot) => shot.hash).join())
      .digest('hex'),
  };
}

const MONTAGES = { setup: setupClip, answer: answerClip };

/** One clip: filmed, cut, levelled, encoded; its cover and its manifest entry. */
async function makeClip(recipe) {
  const started = Date.now();
  const clip = await (MONTAGES[recipe.challenge] ?? momentClip)(recipe);
  const count = clip.runs.reduce((sum, run) => sum + run.count, 0);
  const seconds = count / FPS;
  const levelled = normalise(join2(clip.runs.map((run) => soundOf(clip.sound, run))), {
    target: SOUND.lufs,
    ceiling: SOUND.truePeakDb,
  });
  const truePeak = truePeakDb(levelled);
  const encoder = await Mp4Encoder.open(browser, { ...VIDEO, fps: FPS, bitrate: BITRATE });
  const background = clip.background ?? null;
  for (const run of clip.runs) {
    for (let i = 0; i < run.count; i++)
      await encoder.add(run.view(run.from + i, i), { background });
  }
  const { priming, decodedPeakDb } = await encoder.setAudio({
    channels: levelled,
    sampleRate: SAMPLE_RATE,
  });
  writeFileSync(join(OUT, `${recipe.id}.jpg`), await encoder.still(clip.cover, { background }));
  const bytes = await encoder.save(join(OUT, `${recipe.id}.mp4`));
  const points = [clip.peak.at, ...(clip.peak.answers ?? [])].filter(Boolean);
  const { extent } = clip.peak;
  const checks = {
    length: seconds >= LENGTH.min && seconds <= LENGTH.max,
    peakInFirst300ms: clip.peak.clipMs <= 300,
    safe:
      points.every(isSafe) && (!extent || (extent.top >= SAFE.top && extent.bottom <= SAFE.bottom)),
    // Measured to a hundredth, as the meters show them.
    truePeak: Math.round(truePeak * 100) <= SOUND.truePeakDb * 100,
    decodedPeak: Math.round(decodedPeakDb * 100) <= SOUND.decodedPeakDb * 100,
  };
  const entry = {
    id: recipe.id,
    day: recipe.day,
    video: `${recipe.id}.mp4`,
    cover: `${recipe.id}.jpg`,
    scene: recipe.scene,
    variant: recipe.variant,
    ...(recipe.challenge ? { challenge: recipe.challenge } : {}),
    seconds: Number(seconds.toFixed(2)),
    frames: count,
    peak: {
      event: recipe.peak,
      nth: recipe.nth ?? 1,
      sceneMs: Math.round(clip.peak.frame * FRAME_MS),
      clipMs: Math.round(clip.peak.clipMs),
      ...(clip.peak.at
        ? { at: { x: +clip.peak.at.x.toFixed(3), y: +clip.peak.at.y.toFixed(3) } }
        : {}),
      ...(extent
        ? { extent: { top: +extent.top.toFixed(3), bottom: +extent.bottom.toFixed(3) } }
        : {}),
    },
    measures: clip.measures,
    sound: {
      lufs: Number(loudness(levelled).toFixed(1)),
      truePeakDb: Number(truePeak.toFixed(2)),
      decodedPeakDb: Number(decodedPeakDb.toFixed(2)),
      priming,
    },
    checks,
    framesSha256: clip.hash,
    megabytes: Number((bytes / 1024 / 1024).toFixed(1)),
  };
  const failed = Object.entries(checks)
    .filter(([, ok]) => !ok)
    .map(([name]) => name);
  console.log(
    `${recipe.id}: ${seconds.toFixed(1)} s, peak ${recipe.peak} at ${(entry.peak.sceneMs / 1000).toFixed(2)} s, ` +
      `${entry.sound.lufs} LUFS, ${entry.sound.truePeakDb} dBTP, decoded ${entry.sound.decodedPeakDb} dBFS, ` +
      `priming ${priming.measured} (reported ${priming.reported}), ` +
      `${entry.megabytes} MB, ${((Date.now() - started) / 1000).toFixed(0)} s` +
      (failed.length ? `  CHECK FAILED: ${failed.join(', ')}` : ''),
  );
  return entry;
}

const started = Date.now();
try {
  await openSet();
  const week = await set.evaluate((monday) => window.showcase.week(monday), WEEK);
  if (!week) throw new Error(`No clips for the week of ${WEEK} in media/clips.ts`);
  const recipes = week.clips.filter((recipe) => !ONLY || recipe.id === ONLY);
  if (!recipes.length) throw new Error(`No clip ${ONLY} in the week of ${WEEK}`);
  mkdirSync(OUT, { recursive: true });
  const file = join(OUT, 'manifest.json');
  const kept = ONLY && existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')).clips : [];
  const made = [];
  for (const recipe of recipes) made.push(await makeClip(recipe));
  const clips = week.clips
    .map(({ id }) => made.find((entry) => entry.id === id) ?? kept.find((entry) => entry.id === id))
    .filter(Boolean);
  const manifest = {
    week: WEEK,
    element: week.element,
    guardian: week.guardian,
    video: { ...VIDEO, fps: FPS, codecs: 'H.264 + AAC' },
    clips,
  };
  writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(
    `${OUT}: ${made.length} clip(s) in ${((Date.now() - started) / 60_000).toFixed(1)} min`,
  );
} finally {
  await browser.close();
  await server.close();
}

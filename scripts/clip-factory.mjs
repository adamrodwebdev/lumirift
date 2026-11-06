// The clip factory (lot 25, 1.39): the week's short clips for TikTok,
// Instagram Reels and YouTube Shorts, filmed by the game itself on its real
// engines (media/showcase.html?clip, one take per load of the set). Each clip
// opens on its peak, an engine event that a first take finds (never a time
// set by hand), and its aftermath, then goes back to the start and plays up
// to the frame before the one it opened on: the loop has no seam, picture and
// sound run through it, and the peak plays once a loop. 1080 × 1920 at 30
// frames a second, H.264 and AAC (mp4-encoder.mjs), levelled near −14 LUFS
// with its true peaks under −2 dBTP (loudness.mjs); a JPEG cover (the peak)
// and manifest.json (scene, variant, length, peak, the engines' counts, the
// sound's levels and checks). It only writes files: no upload, no platform
// API (CAHIER § 9 ter).
// The music that loops (1.46.3, CAHIER § 9 decies): a week's clip lasts four
// bars of the game's own music at 96 BPM, 10 s, 300 frames. The music is a
// bed of its own (media/MusicBed.ts), a loop of those bars that runs through
// the montage's cuts and the seam, its first downbeat on the punch-in; the
// take's effects go with the picture, its music unheard. The sound is checked
// as the file plays it: its length, no dropout, no click, the bed in time.
// Usage: npm run clips -- --week 2026-11-02 [--clip mon-fire-on-oil]
//        →  release/clips/<week>/
// A week's recipes from a file (1.46.2), the shape of a week of media/clips.ts,
// each clip with its on-screen line (`onScreen`), written into the clip:
//        npm run clips -- --week 2026-11-09 --recipes <file.json>
// The morning's check (1.46.2): the clips filmed again, their frames' print
// set against the manifest's, and their files' sound checked (1.46.3),
// nothing written; exit 0 same and sound, 2 different or a sound check
// failed, 1 error:
//        npm run clips -- --week 2026-11-02 --check [--recipes <file>] [--clip <id>]
// A set of plain takes (1.41), filmed before and after a change of the game,
// to be seen side by side: each scene from its start, its sound, no montage.
//        npm run clips -- --set feel --label 1.40.0 [--clip rift]
//        →  release/clips/feel-1.40.0/
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';
import { boxesMeet, lineCovers } from '../media/clipLine.ts';
import { ClipLine } from './clip-line.mjs';
import {
  BASS_EVERY_BEATS,
  BEATS_PER_BAR,
  BED,
  LOOP_LIMITS,
  barSamples,
  bassOffsets,
  bedMatch,
  clickRatio,
  levelStepDb,
  longestSilence,
  median,
  mixed,
  turn,
} from '../media/loopSound.ts';
import { loudness, normalise, truePeakDb } from './loudness.mjs';
import { decodedSound, Mp4Encoder } from './mp4-encoder.mjs';
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
/** A challenge's decision: a moment after the fire appears; frozen to open the clip and to end it, for at least the end's (ms). */
const DECISION_MS = 200;
const OPEN_FREEZE_MS = 1200;
const END_FREEZE_MS = 2500;
/** The effects that leave at a cut go on this long after it, fading out (an L-cut, ms; 1.46.3). */
const L_CUT_MS = 100;
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
/** The on-screen line's middle (share of the frame's height): over the action, or under an answer's wells. */
const LINE_Y = { usual: 0.27, answer: 0.735 };
/** A font file of the game's types: the set's requests for them are watched. */
const FONT_FILE = /\.woff2?(?:[?#]|$)/;

const arg = (name) => {
  const at = process.argv.indexOf(`--${name}`);
  return at > 1 ? process.argv[at + 1] : undefined;
};
const WEEK = arg('week');
/** `--set <name> --label <version>`: a set of plain takes (media/clips.ts, `TAKE_SETS`). */
const TAKE_SET = arg('set');
const LABEL = arg('label');
/** `--clip <id>`: that clip alone (the others in the manifest are kept). */
const ONLY = arg('clip');
/** `--recipes <file>`: the week's recipes from a file, not from media/clips.ts (1.46.2). */
const RECIPES = arg('recipes');
/** `--check`: the clips filmed again and their frames set against the manifest, nothing written (1.46.2). */
const CHECK = process.argv.includes('--check');
if (!/^\d{4}-\d{2}-\d{2}$/.test(WEEK ?? '') && !(TAKE_SET && /^[\w.-]+$/.test(LABEL ?? ''))) {
  console.error(
    'Usage: npm run clips -- --week YYYY-MM-DD [--recipes <file>] [--check] [--clip <id>]\n' +
      '       npm run clips -- --set <name> --label <version> [--clip <id>]',
  );
  process.exit(1);
}
if (WEEK && !TAKE_SET && new Date(`${WEEK}T12:00:00Z`).getUTCDay() !== 1) {
  console.error(`--week ${WEEK} is not a Monday: a week of clips goes by its Monday`);
  process.exit(1);
}
if (RECIPES && TAKE_SET) {
  console.error('--recipes reads a week of clips, not a set of takes');
  process.exit(1);
}
const OUT = join('release', 'clips', TAKE_SET ? `${TAKE_SET}-${LABEL}` : WEEK);

/**
 * What a render films (1.46.2): the game's version and commit, and whether
 * tracked files differ from that commit (the frames are then not quite its).
 * Each post can name the build it shows.
 */
function buildOf() {
  const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
  const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
  return {
    version,
    commit: git('rev-parse', '--short', 'HEAD'),
    dirty: git('status', '--porcelain', '--untracked-files=no') !== '',
  };
}
const BUILD = buildOf();

const frames = (ms) => Math.round(ms / FRAME_MS);
/** A week's clip (1.46.3): its music bed's bars at their tempo, 10 s; the montage fills them. */
const CLIP_SAMPLES = barSamples(BED.bars, BED.bpm, SAMPLE_RATE);
const CLIP_FRAMES = CLIP_SAMPLES / SPF;
if (!Number.isInteger(CLIP_FRAMES)) {
  throw new Error(`The music bed's ${CLIP_SAMPLES} samples are not a whole number of frames`);
}
/** The bed's first downbeat lands on this frame of every clip: where the punch-in lands, the peak plays. */
const DOWNBEAT_FRAME = frames(LEAD_MS);
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
 * The sound of a plain take's run (`count` frames from frame `from`), its
 * music in it, faded in and out at its ends so that a cut never clicks.
 */
function soundOf(channels, { from, count }) {
  return channels.map((samples) => {
    const part = new Float32Array(count * SPF);
    part.set(samples.subarray(from * SPF, Math.min(samples.length, (from + count) * SPF)));
    const fade = Math.min(FADE, part.length >> 1);
    for (let i = 0; i < fade; i++) {
      part[i] *= i / fade;
      part[part.length - 1 - i] *= i / fade;
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

/** Two takes heard together, at half level each. */
const mix = (a, b) => a.map((samples, channel) => samples.map((v, i) => (v + b[channel][i]) / 2));

/**
 * The take's effects along a clip's runs (1.46.3), its music unheard: each
 * run's sound goes with its picture. A run that follows on from the one before
 * (the loop's seam) runs on unfaded; at a cut, the effects that come in fade in
 * over 5 ms, and those that leave go on 0.1 s past it, fading out (an L-cut). A
 * run without effects (a frozen picture) makes no sound. The clip loops: an
 * L-cut at its end goes on over its head.
 */
function effectsOf(sound, runs) {
  const total = runs.reduce((sum, run) => sum + run.count, 0) * SPF;
  const tail = Math.round((L_CUT_MS / 1000) * SAMPLE_RATE);
  const out = sound.map(() => new Float32Array(total));
  const heard = (run) => run.effects !== false;
  const follows = (a, b) => heard(a) && heard(b) && a.from + a.count === b.from;
  let at = 0;
  runs.forEach((run, i) => {
    const length = run.count * SPF;
    if (heard(run)) {
      const fadeIn = !follows(runs.at(i - 1), run);
      const ring = follows(run, runs[(i + 1) % runs.length]) ? 0 : tail;
      sound.forEach((samples, channel) => {
        const part = samples.subarray(run.from * SPF, run.from * SPF + length + ring);
        for (let j = 0; j < part.length; j++) {
          let gain = fadeIn && j < FADE ? j / FADE : 1;
          if (j >= length) gain *= 0.5 + 0.5 * Math.cos((Math.PI * (j - length)) / ring);
          out[channel][(at + j) % total] += part[j] * gain;
        }
      });
    }
    at += length;
  });
  return out;
}

/** The frames where a clip's runs after its first begin: its cuts. */
const cutsOf = (runs) =>
  runs.slice(1).map((_, i) => runs.slice(0, i + 1).reduce((sum, run) => sum + run.count, 0));

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

/**
 * The set's font files that failed, by address, as they first answered: a
 * junction the dev server refused (403, then aborted), a file missing.
 */
const fontFailures = new Map();
set.on('response', (response) => {
  if (
    FONT_FILE.test(response.url()) &&
    response.status() >= 400 &&
    !fontFailures.has(response.url())
  ) {
    fontFailures.set(response.url(), String(response.status()));
  }
});
set.on('requestfailed', (request) => {
  if (FONT_FILE.test(request.url()) && !fontFailures.has(request.url())) {
    fontFailures.set(request.url(), request.failure()?.errorText ?? 'failed');
  }
});

/**
 * Stops the render when a face of the game's types is not loaded on the set
 * (1.46.2): its words would be drawn in a system font, as a render from a
 * worktree whose fonts the dev server refused was on 1 November.
 */
async function checkFonts() {
  const faces = await set.evaluate(() => window.showcase.fonts());
  const problems = [
    ...[...fontFailures].map(([url, answer]) => `${answer} ${url}`),
    ...faces
      .filter((face) => face.status !== 'loaded')
      .map((face) => `${face.family} (${face.range.slice(0, 30)}...): ${face.status}`),
  ];
  fontFailures.clear();
  if (!faces.length) problems.push("no face of the game's types on the set");
  if (problems.length) {
    throw new Error(
      "The game's types did not load on the set: the clips would draw in a system font\n- " +
        problems.join('\n- '),
    );
  }
}

/** Puts the set up again (one take per load) and opens the page's API, its types loaded. */
async function openSet() {
  await set.goto(`${SHOWCASE_URL}?clip`);
  // `window.showcase` first names the page's <div id="showcase">: wait for the real API. Asked
  // again and again from here: the set's frames are its own, so `waitForFunction` (which waits
  // on the page's requestAnimationFrame) would wait for ever.
  for (const started = Date.now(); Date.now() - started < 120_000;) {
    if (await set.evaluate(() => typeof window.showcase?.scene === 'function')) {
      await checkFonts();
      return;
    }
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
 * with both answers over the well; `music: false` plays its music unheard (a
 * week's clip lays its bed, 1.46.3).
 */
async function film(
  recipe,
  choice,
  {
    from,
    to,
    soundTo = to,
    crop: frameIt,
    plain = false,
    badge = null,
    decision = false,
    music = true,
  },
) {
  await take(recipe, choice, { soundMs: (soundTo + 2) * FRAME_MS, plain, music });
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
 * 0.15 s before the peak through its aftermath, then the replay, from the
 * scene's start to the frame just before the hook. The last frame leads into
 * the first, so the loop has no seam and the peak plays once a loop. The
 * clip lasts its music bed's bars (1.46.3): the aftermath takes what the
 * replay leaves, `afterMs` at least, or the peak comes too late for the clip.
 * `end` is the last frame to film.
 */
function seamlessLoop(peakFrame, { id, afterMs }) {
  const hook = peakFrame - frames(LEAD_MS);
  const replay = hook - (WARM_UP + 1);
  const hookFrames = CLIP_FRAMES - replay;
  if (hookFrames < frames(LEAD_MS + afterMs)) {
    throw new Error(
      `${id}: its peak comes ${(peakFrame / FPS).toFixed(2)} s in, too late for a clip of ` +
        `${CLIP_FRAMES / FPS} s with ${afterMs} ms after it`,
    );
  }
  return { hook, hookFrames, replay, end: hook + hookFrames - 1 };
}

/** The runs of a seamless loop: the sound runs through its loop point (a cut between). */
const loopRuns = ({ hook, hookFrames, replay }, view) => [
  { from: hook, count: hookFrames, view },
  { from: WARM_UP + 1, count: replay, view },
];

/**
 * A moment: it opens 0.15 s before its peak with the punch-in, holds it 1.2 s
 * and its aftermath, then replays from the start up to the frame before the
 * one it opened on (a seamless loop).
 */
async function momentClip(recipe) {
  const peak = await findPeak(recipe, null);
  const loop = seamlessLoop(peak.frame, recipe);
  const shot = await film(recipe, null, {
    from: WARM_UP + 1,
    to: loop.end,
    soundTo: loop.end + frames(L_CUT_MS) + 1,
    crop: (layout) => screenCrop(layout, peak.at, peak.extent),
    music: false,
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
 * to the decision, and holds it there with its A and B, the first picture,
 * for the rest of the clip's bars (1.46.3).
 */
async function setupClip(recipe) {
  const spawn = await findPeak(recipe, null);
  const decision = spawn.frame + frames(DECISION_MS);
  const openFrames = frames(OPEN_FREEZE_MS);
  const replayFrames = decision - WARM_UP;
  const holdFrames = CLIP_FRAMES - openFrames - replayFrames;
  if (holdFrames < frames(END_FREEZE_MS)) {
    throw new Error(
      `${recipe.id}: its decision comes ${(decision / FPS).toFixed(2)} s in, too late for a ` +
        `clip of ${CLIP_FRAMES / FPS} s that holds it ${END_FREEZE_MS} ms`,
    );
  }
  const shot = await film(recipe, null, {
    from: WARM_UP + 1,
    to: decision,
    soundTo: decision + frames(L_CUT_MS) + 1,
    crop: (layout) => screenCrop(layout, null),
    decision: true,
    music: false,
  });
  const [a, b] = shot.answers;
  const anchor = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const asked = (zoom) => [zoomed(shot.asked, shot.crop, anchor, zoom)];
  const runs = [
    // The bed goes on under the frozen decision; a frozen picture makes no sound.
    {
      from: decision,
      count: openFrames,
      view: (_, i) => asked(punch(i * FRAME_MS - PUNCH.inMs)),
      effects: false,
    },
    {
      from: WARM_UP + 1,
      count: replayFrames,
      view: (frame) => [zoomed(shot.pictures.get(frame), shot.crop, null, 1)],
    },
    { from: decision, count: holdFrames, view: () => asked(1), effects: false },
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
  const loop = seamlessLoop(peak.frame, recipe);
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
        soundTo: end + frames(L_CUT_MS) + 1,
        crop: wellAndBadge,
        plain: true,
        badge: choice,
        music: false,
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

/**
 * A plain take (1.41): the scene from its start, `ms` long, the whole game
 * screen at zoom 1, its sound; no peak, no loop. Two takes of the same scene,
 * before and after a change, show the same moment side by side.
 */
async function plainTake(recipe) {
  const count = frames(recipe.ms);
  const shot = await film(recipe, null, {
    from: WARM_UP + 1,
    to: WARM_UP + count,
    crop: (layout) => screenCrop(layout, null),
  });
  const view = (frame) => [zoomed(shot.pictures.get(frame), shot.crop, null, 1)];
  return {
    runs: [{ from: WARM_UP + 1, count, view }],
    sound: shot.sound,
    cover: view(WARM_UP + Math.round(count / 2)),
    peak: null,
    measures: shot.measures,
    hash: shot.hash,
  };
}

const MONTAGES = { setup: setupClip, answer: answerClip };

/** A clip's takes, filmed and cut: its runs, sound, cover, peak, counts and frames' print. */
const filmed = (recipe) =>
  recipe.ms ? plainTake(recipe) : (MONTAGES[recipe.challenge] ?? momentClip)(recipe);

/**
 * A clip's music bed (1.46.3), rendered on the set after its takes (it seeds
 * the page's Math.random; the next take loads the set again): `bars` bars of
 * the game's music, a loop that starts on its first downbeat.
 */
async function musicBed({ bpm, bars, intensity, seed }) {
  const bed = await set.evaluate((asked) => window.showcase.bed(asked), {
    bpm,
    bars,
    intensity,
    seed,
  });
  return { ...bed, channels: bed.channels.map(fromBase64) };
}

/** A clip's music (1.46.3), as the manifest keeps it: what plays the same bed again. */
const musicOf = (recipe) => ({
  ...BED,
  seed: `bed:${recipe.id}`,
  downbeatFrame: DOWNBEAT_FRAME,
});

/** A measure for the manifest: a hundredth, or its name when it is not a number one can write. */
const kept = (value, digits = 2) =>
  Number.isFinite(value) ? Number(value.toFixed(digits)) : String(value);

/**
 * The checks of a looping clip's sound (1.46.3, CAHIER § 9 decies): the bed
 * as it was made, and the file's sound as a player decodes it (`heard`), with
 * its `frames` and its `cuts` (frames), against the `mix` it was made from
 * (the bed and the effects, before the levelling). Without a bed (a clip made
 * before it), the checks that need one fail. Returns the measures and the
 * checks.
 */
function loopChecks({ heard, bed, music, frames: count, cuts, mix }) {
  const length = count * SPF;
  const turned = bed && bed.channels.map((samples) => turn(samples, music.downbeatFrame * SPF));
  const beat = (60 / music.bpm) * SAMPLE_RATE;
  const notes = bed
    ? Array.from({ length: (music.bars * BEATS_PER_BAR) / BASS_EVERY_BEATS }, (_, k) =>
        Math.round(k * BASS_EVERY_BEATS * beat),
      )
    : [];
  const offsets = bed ? bassOffsets(bed.channels, notes, SAMPLE_RATE) : [];
  const middle = offsets.length ? median(offsets) : NaN;
  const spread = offsets.length ? Math.max(...offsets.map((o) => Math.abs(o - middle))) : Infinity;
  const silence = longestSilence(heard, SAMPLE_RATE);
  const points = [0, ...cuts.map((frame) => frame * SPF)];
  const clicks = points.map((at) => clickRatio(heard, at, SAMPLE_RATE));
  // The seam's level step against the mix's own: what the levelling and the AAC added to it.
  const seam = levelStepDb(heard, 0, SAMPLE_RATE);
  const mixSeam = mix ? levelStepDb(mix, 0, SAMPLE_RATE) : NaN;
  const inTime = turned
    ? points.map((at) => ({ atFrame: at / SPF, ...bedMatch(heard, turned, at, SAMPLE_RATE) }))
    : [];
  // Where the bed is heard over the effects: the places it can be timed.
  const timed = inTime.filter(({ correlation }) => correlation >= LOOP_LIMITS.bedCorrelation);
  const measures = {
    bed: bed
      ? {
          beforeDb: kept(bed.beforeDb, 1),
          ringDb: kept(bed.ringDb, 1),
          bassOffsetMs: kept(middle, 1),
          bassSpreadMs: kept(spread, 1),
        }
      : null,
    heard: {
      samples: heard[0].length,
      silence: { atMs: kept(silence.atMs, 1), ms: kept(silence.ms, 2) },
      clicks: clicks.map((ratio) => kept(ratio)),
      seamStepDb: { heard: kept(seam), mix: kept(mixSeam) },
      bed: inTime.map(({ atFrame, lagMs, correlation }) => ({
        atFrame,
        lagMs: kept(lagMs),
        correlation: kept(correlation),
      })),
    },
  };
  const checks = {
    bedWholeBars: Boolean(bed) && bed.channels.every((samples) => samples.length === length),
    bedOwnNotes:
      Boolean(bed) &&
      bed.beforeDb <= LOOP_LIMITS.ownNotesDb &&
      bed.ringDb <= LOOP_LIMITS.ownNotesDb,
    bedOnBeat: Boolean(bed) && spread <= LOOP_LIMITS.bassSpreadMs,
    soundLength: heard.every((samples) => samples.length === length),
    noDropout: silence.ms < LOOP_LIMITS.silenceMs,
    noClick: clicks.every((ratio) => ratio <= LOOP_LIMITS.clickRatio),
    seamLevel: Boolean(mix) && Math.abs(seam - mixSeam) <= LOOP_LIMITS.seamStepDb,
    bedInTime:
      timed.length > 0 && timed.every(({ lagMs }) => Math.abs(lagMs) <= LOOP_LIMITS.bedLagMs),
  };
  return { measures, checks };
}

/**
 * A week's clip's sound before its levelling (1.46.3): its music bed, turned
 * onto its downbeat, under the take's effects along its runs.
 */
const mixOf = (bed, clip, music) =>
  mixed([
    bed.channels.map((samples) => turn(samples, music.downbeatFrame * SPF)),
    effectsOf(clip.sound, clip.runs),
  ]);

/** The tab that draws the clips' on-screen lines, opened for the first one. */
let lineTab = null;

/** A clip's on-screen line (1.46.2), drawn where its recipe puts it, outlined like the well's words. */
async function drawLine(recipe) {
  lineTab ??= await ClipLine.open(browser);
  const y = recipe.onScreenY ?? (recipe.challenge === 'answer' ? LINE_Y.answer : LINE_Y.usual);
  const outline = await set.evaluate(() => window.showcase.outline());
  return { ...(await lineTab.draw(recipe.onScreen, { frame: VIDEO, safe: SAFE, y, outline })), y };
}

/** The clips' identity label (1.46.3), signing the clip's line, outlined like the well's words of its scene. */
async function drawLabel(line) {
  lineTab ??= await ClipLine.open(browser);
  const outline = await set.evaluate(() => window.showcase.outline());
  return lineTab.label({ frame: VIDEO, safe: SAFE, outline, under: line?.box ?? null });
}

/**
 * What of a clip's peak, or of each other, its texts would hide (1.46.3): the
 * line's and the label's covers of the peak, and the label over the line.
 */
function textCovers(line, labelled, peak) {
  return [
    ...(line ? lineCovers(line.box, VIDEO, peak).map((what) => `the line hides the ${what}`) : []),
    ...(labelled
      ? lineCovers(labelled.box, VIDEO, peak).map((what) => `the label hides the ${what}`)
      : []),
    ...(line && labelled && boxesMeet(line.box, labelled.box) ? ['the label meets the line'] : []),
  ];
}

/** One clip: filmed, cut, levelled, encoded; its cover and its manifest entry. */
async function makeClip(recipe) {
  const started = Date.now();
  const clip = await filmed(recipe);
  const line = recipe.onScreen ? await drawLine(recipe) : null;
  // A week's clip carries the label from its first frame to its last (1.46.3); a plain take does not.
  const labelled = clip.peak ? await drawLabel(line) : null;
  /** A frame's layers, the on-screen line and the label over them. */
  const framed = (layers) => [
    ...layers,
    ...(line ? [line.layer] : []),
    ...(labelled ? [labelled.layer] : []),
  ];
  const count = clip.runs.reduce((sum, run) => sum + run.count, 0);
  const seconds = count / FPS;
  // A week's clip loops on its music bed (1.46.3); a plain take keeps its own sound, cut and faded.
  const music = clip.peak ? musicOf(recipe) : null;
  if (music && count !== CLIP_FRAMES) {
    throw new Error(`${recipe.id}: ${count} frames, not the music bed's ${CLIP_FRAMES}`);
  }
  const bed = music ? await musicBed(music) : null;
  const sound = bed
    ? mixOf(bed, clip, music)
    : join2(clip.runs.map((run) => soundOf(clip.sound, run)));
  const loops = Boolean(bed);
  const levelled = normalise(sound, {
    target: SOUND.lufs,
    ceiling: SOUND.truePeakDb,
    loop: loops,
  });
  const truePeak = truePeakDb(levelled, { loop: loops });
  const encoder = await Mp4Encoder.open(browser, { ...VIDEO, fps: FPS, bitrate: BITRATE });
  const background = clip.background ?? null;
  for (const run of clip.runs) {
    for (let i = 0; i < run.count; i++)
      await encoder.add(framed(run.view(run.from + i, i)), { background });
  }
  const { priming, decodedPeakDb } = await encoder.setAudio({
    channels: levelled,
    sampleRate: SAMPLE_RATE,
    loop: loops,
  });
  writeFileSync(
    join(OUT, `${recipe.id}.jpg`),
    await encoder.still(framed(clip.cover), { background }),
  );
  const video = join(OUT, `${recipe.id}.mp4`);
  const bytes = await encoder.save(video);
  const cuts = cutsOf(clip.runs);
  // The file's sound as a player decodes it, checked as a loop (1.46.3).
  const looped = bed
    ? loopChecks({
        heard: await decodedSound(browser, video),
        bed,
        music,
        frames: count,
        cuts,
        mix: sound,
      })
    : null;
  // Measured to a hundredth, as the meters show them.
  const soundChecks = {
    truePeak: Math.round(truePeak * 100) <= SOUND.truePeakDb * 100,
    decodedPeak: Math.round(decodedPeakDb * 100) <= SOUND.decodedPeakDb * 100,
    ...(looped?.checks ?? {}),
  };
  const { peak } = clip;
  // What of the peak the on-screen texts would hide: its point, its action's reach, a letter.
  const covered = textCovers(line, labelled, peak);
  // A plain take has no peak: the apps' rules (length, hook, safe area) are the clips'.
  const checks = peak
    ? {
        length: seconds >= LENGTH.min && seconds <= LENGTH.max,
        peakInFirst300ms: peak.clipMs <= 300,
        safe:
          [peak.at, ...(peak.answers ?? [])].filter(Boolean).every(isSafe) &&
          (!peak.extent || (peak.extent.top >= SAFE.top && peak.extent.bottom <= SAFE.bottom)),
        ...(line || labelled ? { textClear: covered.length === 0 } : {}),
        ...soundChecks,
      }
    : soundChecks;
  const entry = {
    id: recipe.id,
    ...BUILD,
    ...(recipe.day ? { day: recipe.day } : {}),
    video: `${recipe.id}.mp4`,
    cover: `${recipe.id}.jpg`,
    scene: recipe.scene,
    variant: recipe.variant,
    ...(recipe.challenge ? { challenge: recipe.challenge } : {}),
    seconds: Number(seconds.toFixed(2)),
    frames: count,
    ...(music ? { music, cuts } : {}),
    ...(peak
      ? {
          peak: {
            event: recipe.peak,
            nth: recipe.nth ?? 1,
            sceneMs: Math.round(peak.frame * FRAME_MS),
            clipMs: Math.round(peak.clipMs),
            ...(peak.at ? { at: { x: +peak.at.x.toFixed(3), y: +peak.at.y.toFixed(3) } } : {}),
            ...(peak.extent
              ? {
                  extent: {
                    top: +peak.extent.top.toFixed(3),
                    bottom: +peak.extent.bottom.toFixed(3),
                  },
                }
              : {}),
          },
        }
      : {}),
    ...(line
      ? { onScreen: { text: recipe.onScreen, y: line.y, size: line.size, lines: line.lines } }
      : {}),
    ...(labelled ? { label: { text: labelled.text, y: labelled.y, size: labelled.size } } : {}),
    measures: clip.measures,
    sound: {
      lufs: Number(loudness(levelled, { loop: loops }).toFixed(1)),
      truePeakDb: Number(truePeak.toFixed(2)),
      decodedPeakDb: Number(decodedPeakDb.toFixed(2)),
      priming,
      ...(looped ? { loop: looped.measures } : {}),
    },
    checks,
    framesSha256: clip.hash,
    megabytes: Number((bytes / 1024 / 1024).toFixed(1)),
  };
  const failed = Object.entries(checks)
    .filter(([, ok]) => !ok)
    .map(([name]) => (name === 'textClear' ? `textClear (${covered.join(', ')})` : name));
  console.log(
    `${recipe.id}: ${seconds.toFixed(1)} s, ` +
      (entry.peak
        ? `peak ${recipe.peak} at ${(entry.peak.sceneMs / 1000).toFixed(2)} s, `
        : 'plain take, ') +
      (line ? `line ${line.size} px on ${line.lines.length} line(s), ` : '') +
      `${entry.sound.lufs} LUFS, ${entry.sound.truePeakDb} dBTP, decoded ${entry.sound.decodedPeakDb} dBFS, ` +
      `priming ${priming.measured} (reported ${priming.reported}, pre-roll ${priming.preRoll}), ` +
      `${entry.megabytes} MB, ${((Date.now() - started) / 1000).toFixed(0)} s` +
      (failed.length ? `  CHECK FAILED: ${failed.join(', ')}` : ''),
  );
  return entry;
}

/**
 * The sound checks of a clip's file (1.46.3), against its manifest entry and
 * the clip filmed again: its bed played again from the entry's music, its mix
 * made again, its file decoded. A clip made before the bed has none: the
 * checks that need one fail. The names of the checks that fail.
 */
async function soundFailures(entry, clip) {
  const video = join(OUT, entry.video);
  if (!existsSync(video)) return ['no file'];
  const bed = entry.music ? await musicBed(entry.music) : null;
  const music = entry.music ?? { ...BED, downbeatFrame: DOWNBEAT_FRAME };
  const { checks } = loopChecks({
    heard: await decodedSound(browser, video),
    bed,
    music,
    frames: entry.frames,
    cuts: entry.cuts ?? [],
    mix: bed && clip.peak ? mixOf(bed, clip, music) : null,
  });
  return Object.entries(checks)
    .filter(([, ok]) => !ok)
    .map(([name]) => name);
}

/**
 * The morning's check (1.46.2): each clip filmed again and its frames' print
 * set against the manifest's, nothing encoded nor written; and the sound of
 * its file checked as it plays (1.46.3). The exit code is 0 when every clip
 * draws the same frames and its sound passes, 2 when one differs, is new or
 * fails a sound check.
 */
async function checkFresh(recipes) {
  const file = join(OUT, 'manifest.json');
  if (!existsSync(file)) throw new Error(`No manifest in ${OUT} to check the clips against`);
  const { clips } = JSON.parse(readFileSync(file, 'utf8'));
  let stale = 0;
  for (const recipe of recipes) {
    const clip = await filmed(recipe);
    const { hash } = clip;
    const entry = clips.find((made) => made.id === recipe.id);
    const was = entry?.framesSha256;
    const verdict = !was ? 'new' : was === hash ? 'same' : 'different';
    const failed = entry ? await soundFailures(entry, clip) : [];
    if (verdict !== 'same' || failed.length) stale++;
    console.log(
      `${recipe.id}: ${verdict}, ` +
        (verdict === 'same'
          ? hash.slice(0, 16)
          : `manifest ${was?.slice(0, 16) ?? 'none'}, now ${hash.slice(0, 16)}`) +
        (entry ? `; sound ${failed.length ? `FAILED: ${failed.join(', ')}` : 'passes'}` : ''),
    );
  }
  process.exitCode = stale ? 2 : 0;
  return stale;
}

/** The recipes asked for: a week's clips, or a set of plain takes; and what the manifest says of them. */
async function asked() {
  if (TAKE_SET) {
    const takes = await set.evaluate((name) => window.showcase.takes(name), TAKE_SET);
    if (!takes) throw new Error(`No set of takes ${TAKE_SET} in media/clips.ts`);
    return { all: takes, about: { set: TAKE_SET, label: LABEL } };
  }
  const week = RECIPES
    ? await set.evaluate(
        (text) => window.showcase.parseWeek(text),
        // A file saved with a byte-order mark (Windows' Notepad) is still JSON: trimStart drops it.
        readFileSync(RECIPES, 'utf8').trimStart(),
      )
    : await set.evaluate((monday) => window.showcase.week(monday), WEEK);
  if (!week) throw new Error(`No clips for the week of ${WEEK} in media/clips.ts`);
  return { all: week.clips, about: { week: WEEK, element: week.element, guardian: week.guardian } };
}

/** The clips asked for, rendered, and the manifest written: `all`'s other clips are kept from it. */
async function render(recipes, all, about) {
  mkdirSync(OUT, { recursive: true });
  const file = join(OUT, 'manifest.json');
  const kept = ONLY && existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')).clips : [];
  const made = [];
  for (const recipe of recipes) made.push(await makeClip(recipe));
  const clips = all
    .map(({ id }) => made.find((entry) => entry.id === id) ?? kept.find((entry) => entry.id === id))
    .filter(Boolean);
  const manifest = {
    ...about,
    ...BUILD,
    video: { ...VIDEO, fps: FPS, codecs: 'H.264 + AAC' },
    clips,
  };
  writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`);
  return made.length;
}

const started = Date.now();
// Plain ASCII: a Windows console shows the terminal's own code page.
const built = `${BUILD.version} (${BUILD.commit}${BUILD.dirty ? ', changed since' : ''})`;
const minutes = () => ((Date.now() - started) / 60_000).toFixed(1);
try {
  await openSet();
  const { all, about } = await asked();
  const recipes = all.filter((recipe) => !ONLY || recipe.id === ONLY);
  if (!recipes.length) throw new Error(`No clip ${ONLY} in ${TAKE_SET ?? `the week of ${WEEK}`}`);
  if (CHECK) {
    const stale = await checkFresh(recipes);
    console.log(
      `${OUT}: ${recipes.length - stale} of ${recipes.length} clip(s) the same and sound on ${built}, ` +
        `in ${minutes()} min`,
    );
  } else {
    const made = await render(recipes, all, about);
    console.log(`${OUT}: ${made} clip(s) on ${built} in ${minutes()} min`);
  }
} finally {
  await browser.close();
  await server.close();
}

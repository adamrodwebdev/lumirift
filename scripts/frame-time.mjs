// The frame time of the feel takes (lot 27's gate, 1.41): the six takes of `TAKE_SETS.feel`
// (media/clips.ts) played frame by frame on the showcase set (media/showcase.ts, the game's own
// stages), at a phone's size (390 × 844 CSS px, drawn at 3×), the processor slowed four times
// (CDP). Each frame is timed in the page: the set's step (rules, effects, drawing) and, in the
// software raster, the canvases flushed so that their raster counts. Prints a JSON report:
// per take, the frames' mean, median, 95th and 99th percentiles and maximum (ms).
//
//   npm run frame-time                                  # GPU canvases: the main thread's work
//   npm run frame-time -- --raster software             # the processor rasters (the worst case)
//   npm run frame-time -- --takes combo,tower --passes 3
//
// To compare two versions, run the same command on each, alternating them two rounds or more
// (one run varies by up to 10 ms at the 95th percentile in the software raster); an older commit
// without this file is measured with a copy of it kept outside the tree. Stop other heavy jobs
// first. The first pass of each run warms the code and is not counted.
import { chromium } from '@playwright/test';
import { SHOWCASE_URL, startShowcase } from './showcase-frames.mjs';

const arg = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index > 0 ? process.argv[index + 1] : fallback;
};

const RASTER = arg('raster', 'gpu');
if (RASTER !== 'gpu' && RASTER !== 'software') throw new Error('--raster is gpu or software');
const PASSES = Number(arg('passes', '4'));
const ONLY = arg('takes', null)?.split(',') ?? null;
const FRAME_MS = 1000 / 60;
/** Frames played before the timing starts: the first picture drawn, the code warmed up. */
const WARM_UP = 12;
const THROTTLE = 4;

const quantile = (sorted, q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
const round = (value) => Math.round(value * 100) / 100;
const summary = (times) => {
  const sorted = [...times].sort((a, b) => a - b);
  return {
    frames: times.length,
    mean: round(times.reduce((sum, t) => sum + t, 0) / times.length),
    p50: round(quantile(sorted, 0.5)),
    p95: round(quantile(sorted, 0.95)),
    p99: round(quantile(sorted, 0.99)),
    max: round(sorted.at(-1)),
  };
};

const server = await startShowcase();
const browser = await chromium.launch({
  channel: 'chrome',
  args: RASTER === 'software' ? ['--disable-gpu'] : [],
});
try {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    colorScheme: 'dark',
    reducedMotion: 'no-preference',
  });
  page.on('pageerror', (error) => console.error('page error:', error.message));
  await page.goto(SHOWCASE_URL);
  await page.waitForFunction(() => typeof window.showcase?.scene === 'function', null, {
    timeout: 120_000,
  });
  const takes = (await page.evaluate(() => window.showcase.takes('feel'))).filter(
    (take) => !ONLY || ONLY.includes(take.id),
  );
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
  const byTake = {};
  const all = [];
  for (let pass = 1; pass <= PASSES; pass++) {
    for (const take of takes) {
      await page.evaluate(({ scene, variant }) => window.showcase.scene(scene, variant), take);
      const times = await page.evaluate(
        async ({ count, ms, warm, flush }) => {
          for (let frame = 0; frame < warm; frame++) await window.showcase.step(ms);
          const contexts = flush
            ? [...document.querySelectorAll('canvas')]
                .filter((canvas) => canvas.width > 0 && canvas.height > 0)
                .map((canvas) => canvas.getContext('2d'))
                .filter(Boolean)
            : [];
          const out = [];
          for (let frame = 0; frame < count; frame++) {
            const start = performance.now();
            await window.showcase.step(ms);
            for (const context of contexts) context.getImageData(0, 0, 1, 1);
            out.push(performance.now() - start);
          }
          return out;
        },
        {
          count: Math.round(take.ms / FRAME_MS),
          ms: FRAME_MS,
          warm: WARM_UP,
          flush: RASTER === 'software',
        },
      );
      if (pass === 1 && PASSES > 1) continue;
      (byTake[take.id] ??= []).push(...times);
      all.push(...times);
    }
  }
  const report = { raster: RASTER, throttle: THROTTLE, passes: PASSES, all: summary(all) };
  for (const [id, times] of Object.entries(byTake)) report[id] = summary(times);
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
  await server.close();
}

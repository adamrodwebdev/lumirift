// The frames of the preview videos: the real stages of media/showcase.html, on
// Vite's dev server, moved by a clock the recorder steps itself, so that every
// frame is rendered exactly, whatever the speed of the machine. Shared by the
// portals' media scripts (crazygames-media.mjs, yandex-media.mjs).
import { createServer } from 'vite';

const PORT = 5179;

/** The dev server of the showcase (no hot reload: an edit must not reload a recording). */
export async function startShowcase() {
  const server = await createServer({
    server: { port: PORT, strictPort: true, hmr: false, watch: null },
    logLevel: 'error',
  });
  await server.listen();
  return server;
}

/**
 * Each frame of the scenes (`[name, seconds]`, names from media/scenes.ts), as
 * JPEG bytes of `width` × `height` (drawn at twice the pixel density).
 */
export async function* sceneFrames(browser, { width, height, fps, scenes, onScene = () => {} }) {
  const tab = await browser.newPage({
    viewport: { width: width / 2, height: height / 2 },
    deviceScaleFactor: 2,
    colorScheme: 'dark',
    reducedMotion: 'no-preference',
  });
  await tab.goto(`http://localhost:${PORT}/media/showcase.html`);
  // `window.showcase` first names the page's <div id="showcase">: wait for the real API.
  await tab.waitForFunction(() => typeof window.showcase?.scene === 'function', null, {
    timeout: 120_000,
  });
  const step = () => tab.evaluate((ms) => window.showcase.step(ms), 1000 / fps);
  try {
    for (const [scene, seconds] of scenes) {
      onScene(scene);
      await tab.evaluate((name) => window.showcase.scene(name), scene);
      // Two frames unrecorded: a canvas draws its first picture on the first frame (never a black one).
      for (let i = 0; i < 2; i++) await step();
      for (let i = 0; i < Math.round(seconds * fps); i++) {
        await step();
        yield await tab.screenshot({ type: 'jpeg', quality: 95 });
      }
    }
  } finally {
    await tab.close();
  }
}

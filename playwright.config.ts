import {
  defineConfig,
  devices,
  type PlaywrightTestOptions,
  type PlaywrightWorkerOptions,
} from '@playwright/test';
import { ENGINE_PACE } from './e2e/engines';

const PORT = 4177;
/** The CrazyGames build, for the portals' first run (its SDK runs in its local mode). */
const PORTAL_PORT = 4178;
const PORTAL = /portal\.spec\.ts/;
/** The Yandex Games build, its SDK replaced by a stand-in in the test itself. */
const YANDEX_PORT = 4179;
const YANDEX = /yandex\.spec\.ts/;
/** Dunes alone (1.37), the build of its sandbox test on our own site: the mode lives there only. */
const DUNES_PORT = 4181;
const DUNES = /dunes\.spec\.ts/;

type Engine = 'chrome' | 'firefox' | 'webkit';
/** What a project says of its browser: the engine, and the device it plays. */
type BrowserUse = Partial<PlaywrightTestOptions & PlaywrightWorkerOptions>;
interface EngineUse {
  readonly desktop: BrowserUse;
  readonly phone: BrowserUse;
  /** How many times the usual time its tests and their waits are given. */
  readonly pace: number;
}

/**
 * The three engines (1.46): the installed Chrome by default (channel
 * `chrome`, the browser most players have); Playwright's own Firefox and
 * WebKit, Safari's engine, when `E2E_ENGINE` names one. The CI plays the
 * whole suite in each, one job per engine, under the same projects: a test
 * played by one project only is played once per engine. A phone is a Pixel 7
 * in Chrome, the Pixel's screen in Firefox (with its own user agent), an
 * iPhone 13 in WebKit; the projects set the sizes. Playwright's Firefox does
 * not start on the Windows machine of development (a missing system
 * library): the CI plays it, on Linux. The CI's WebKit draws without a
 * graphics card, about twice as slowly as the others (21 min of journeys
 * against 12 for Firefox, 3 November): twice the time.
 */
const ENGINES: Readonly<Record<Engine, EngineUse>> = {
  chrome: {
    desktop: { channel: 'chrome' },
    phone: { ...devices['Pixel 7'], channel: 'chrome' },
    pace: ENGINE_PACE.chrome,
  },
  firefox: {
    desktop: { browserName: 'firefox' },
    phone: {
      browserName: 'firefox',
      deviceScaleFactor: devices['Pixel 7'].deviceScaleFactor,
      isMobile: true,
      hasTouch: true,
    },
    pace: ENGINE_PACE.firefox,
  },
  webkit: {
    desktop: { browserName: 'webkit' },
    phone: devices['iPhone 13'],
    pace: ENGINE_PACE.webkit,
  },
};

const isEngine = (name: string): name is Engine => Object.hasOwn(ENGINES, name);
const ENGINE = process.env.E2E_ENGINE ?? 'chrome';
if (!isEngine(ENGINE)) {
  throw new Error(`E2E_ENGINE="${ENGINE}": expected one of ${Object.keys(ENGINES).join(', ')}`);
}
const { desktop, phone, pace } = ENGINES[ENGINE];

/**
 * End-to-end journeys on the production build, at the two sizes of the
 * specification: a phone (390 × 844) and a desktop (1280 × 800), in the
 * engine chosen above. The portals' first run is played on the CrazyGames
 * build, and the Yandex integration on the Yandex build, each built and
 * served beside it.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 30_000 * pace,
  expect: { timeout: 5_000 * pace },
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}/`,
    locale: 'fr-FR',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'mobile',
      testIgnore: [PORTAL, YANDEX, DUNES],
      use: { ...phone, viewport: { width: 390, height: 844 } },
    },
    {
      name: 'desktop',
      testIgnore: [PORTAL, YANDEX, DUNES],
      use: { ...desktop, viewport: { width: 1280, height: 800 } },
    },
    {
      name: 'portal',
      testMatch: PORTAL,
      use: {
        ...desktop,
        baseURL: `http://localhost:${PORTAL_PORT}/`,
        viewport: { width: 1280, height: 800 },
      },
    },
    {
      name: 'dunes-mobile',
      testMatch: DUNES,
      use: {
        ...phone,
        baseURL: `http://localhost:${DUNES_PORT}/`,
        viewport: { width: 390, height: 844 },
      },
    },
    {
      name: 'dunes-desktop',
      testMatch: DUNES,
      use: {
        ...desktop,
        baseURL: `http://localhost:${DUNES_PORT}/`,
        viewport: { width: 1280, height: 800 },
      },
    },
    {
      name: 'yandex',
      testMatch: YANDEX,
      use: {
        ...desktop,
        baseURL: `http://localhost:${YANDEX_PORT}/`,
        viewport: { width: 1280, height: 800 },
      },
    },
  ],
  webServer: [
    {
      command: `npx vite preview --port ${PORT} --strictPort`,
      port: PORT,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: `npx vite build --mode crazygames --logLevel warn && npx vite preview --mode crazygames --port ${PORTAL_PORT} --strictPort`,
      port: PORTAL_PORT,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
    {
      command: `npx vite build --mode dunes --logLevel warn && npx vite preview --mode dunes --port ${DUNES_PORT} --strictPort`,
      port: DUNES_PORT,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
    {
      command: `npx vite build --mode yandex --logLevel warn && npx vite preview --mode yandex --port ${YANDEX_PORT} --strictPort`,
      port: YANDEX_PORT,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  ],
});

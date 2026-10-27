import { defineConfig, devices } from '@playwright/test';

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

/**
 * End-to-end journeys on the production build, at the two sizes of the
 * specification: a phone (390 × 844) and a desktop (1280 × 800). The
 * installed Chrome runs them (channel `chrome`). The portals' first run is
 * played on the CrazyGames build, and the Yandex integration on the Yandex
 * build, each built and served beside it.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}/`,
    channel: 'chrome',
    locale: 'fr-FR',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'mobile',
      testIgnore: [PORTAL, YANDEX, DUNES],
      use: {
        ...devices['Pixel 7'],
        viewport: { width: 390, height: 844 },
        channel: 'chrome',
      },
    },
    {
      name: 'desktop',
      testIgnore: [PORTAL, YANDEX, DUNES],
      use: { viewport: { width: 1280, height: 800 }, channel: 'chrome' },
    },
    {
      name: 'portal',
      testMatch: PORTAL,
      use: {
        baseURL: `http://localhost:${PORTAL_PORT}/`,
        viewport: { width: 1280, height: 800 },
        channel: 'chrome',
      },
    },
    {
      name: 'dunes-mobile',
      testMatch: DUNES,
      use: {
        ...devices['Pixel 7'],
        baseURL: `http://localhost:${DUNES_PORT}/`,
        viewport: { width: 390, height: 844 },
        channel: 'chrome',
      },
    },
    {
      name: 'dunes-desktop',
      testMatch: DUNES,
      use: {
        baseURL: `http://localhost:${DUNES_PORT}/`,
        viewport: { width: 1280, height: 800 },
        channel: 'chrome',
      },
    },
    {
      name: 'yandex',
      testMatch: YANDEX,
      use: {
        baseURL: `http://localhost:${YANDEX_PORT}/`,
        viewport: { width: 1280, height: 800 },
        channel: 'chrome',
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

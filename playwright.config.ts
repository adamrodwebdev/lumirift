import { defineConfig, devices } from '@playwright/test';

const PORT = 4177;

/**
 * End-to-end journeys on the production build, at the two sizes of the
 * specification: a phone (390 × 844) and a desktop (1280 × 800). The
 * installed Chrome runs them (channel `chrome`).
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
      use: {
        ...devices['Pixel 7'],
        viewport: { width: 390, height: 844 },
        channel: 'chrome',
      },
    },
    {
      name: 'desktop',
      use: { viewport: { width: 1280, height: 800 }, channel: 'chrome' },
    },
  ],
  webServer: {
    command: `npx vite preview --port ${PORT} --strictPort`,
    port: PORT,
    reuseExistingServer: !process.env.CI,
  },
});

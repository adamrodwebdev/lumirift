// Lighthouse audit of the production build, mobile profile (the default).
// Usage: npm run build && npm run lighthouse  [-- --desktop]
// Fails when a category scores below the threshold of the specification
// (Performance 98, the three others 95).
import { mkdirSync, writeFileSync } from 'node:fs';
import * as chromeLauncher from 'chrome-launcher';
import lighthouse from 'lighthouse';
import desktopConfig from 'lighthouse/core/config/desktop-config.js';
import { preview } from 'vite';

/** The four categories the specification requires, and their minimum; others (experimental) are informative. */
const THRESHOLDS = { performance: 98, accessibility: 95, 'best-practices': 95, seo: 95 };
const PORT = 4176;
const desktop = process.argv.includes('--desktop');

const server = await preview({ preview: { port: PORT, strictPort: true }, logLevel: 'error' });
const chrome = await chromeLauncher.launch({
  // Installed Chrome, found by chrome-launcher; CHROME_PATH overrides it.
  ...(process.env.CHROME_PATH ? { chromePath: process.env.CHROME_PATH } : {}),
  chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu'],
});

let failed = false;
try {
  const result = await lighthouse(
    `http://localhost:${PORT}/`,
    { port: chrome.port, output: 'html', logLevel: 'error' },
    desktop ? desktopConfig : undefined,
  );
  if (!result) throw new Error('Lighthouse returned no result');

  mkdirSync('reports', { recursive: true });
  const name = `reports/lighthouse-${desktop ? 'desktop' : 'mobile'}.html`;
  writeFileSync(name, result.report);

  for (const category of Object.values(result.lhr.categories)) {
    const score = Math.round((category.score ?? 0) * 100);
    const threshold = THRESHOLDS[category.id];
    const required = threshold !== undefined;
    const ok = required && score >= threshold;
    if (required) failed ||= !ok;
    const mark = required ? (ok ? '✓' : '✗') : '·';
    const note = required ? ` (≥ ${threshold})` : ' (informative)';
    console.log(`${mark} ${category.title.padEnd(16)} ${score}${note}`);
  }
  console.log(`Report: ${name}`);
} finally {
  await chrome.kill();
  await new Promise((resolve) => server.httpServer.close(resolve));
}

if (failed) {
  console.error('At least one category is below its threshold.');
  process.exit(1);
}

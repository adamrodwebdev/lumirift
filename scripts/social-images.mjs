// Draws the app icons (180, 192, 512 px). The social card shared on networks
// (public/og-image.png, 1200 × 630) is drawn with the covers: crazygames-media.mjs.
// They are screenshots of small HTML pages, rendered by the installed Chrome.
// Usage: node scripts/social-images.mjs  (writes into public/)
import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const logo = readFileSync(new URL('../public/favicon.svg', import.meta.url), 'utf8');
const logoUrl = `data:image/svg+xml;base64,${Buffer.from(logo).toString('base64')}`;

const icon = (size) =>
  `<!doctype html><html><body style="margin:0;width:${size}px;height:${size}px;background:#0d0a26"><img src="${logoUrl}" style="width:${size}px;height:${size}px;display:block"></body></html>`;

const browser = await chromium.launch({ channel: 'chrome' });
try {
  const shoot = async (html, width, height, file) => {
    const page = await browser.newPage({ viewport: { width, height } });
    await page.setContent(html);
    await page.screenshot({ path: `public/${file}` });
    await page.close();
    console.log(`public/${file}`);
  };
  await shoot(icon(180), 180, 180, 'apple-touch-icon.png');
  await shoot(icon(192), 192, 192, 'icon-192.png');
  await shoot(icon(512), 512, 512, 'icon-512.png');
} finally {
  await browser.close();
}

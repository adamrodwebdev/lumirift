// Draws the images the web needs outside the game: the social card shared on
// networks (Open Graph, 1200 × 630) and the app icons (180, 192, 512 px).
// They are screenshots of small HTML pages, rendered by the installed Chrome.
// Usage: node scripts/social-images.mjs  (writes into public/)
import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const logo = readFileSync(new URL('../public/favicon.svg', import.meta.url), 'utf8');
const logoUrl = `data:image/svg+xml;base64,${Buffer.from(logo).toString('base64')}`;

// The colours of the dark theme (src/styles/tokens.css) and of the pieces.
const TONES = ['#e8795a', '#6fa0e6', '#e6bd5a', '#e77fa9', '#74bf8b', '#a98ad8', '#5cbcb5'];

const block = (x, y, size, colour) =>
  `<div style="position:absolute;left:${x}px;top:${y}px;width:${size}px;height:${size}px;border-radius:${size * 0.12}px;background:${colour};box-shadow:inset ${size * 0.12}px ${size * 0.12}px 0 rgb(255 255 255 / .28),inset -${size * 0.12}px -${size * 0.12}px 0 rgb(0 0 0 / .25)"></div>`;

const shards = (seed) => {
  let s = seed;
  const random = () => (s = (s * 16807) % 2147483647) / 2147483647;
  return Array.from({ length: 26 }, (_, i) => {
    const size = 14 + random() * 26;
    const colour = TONES[i % TONES.length];
    return `<div style="position:absolute;left:${720 + random() * 420}px;top:${60 + random() * 300}px;width:${size}px;height:${size}px;background:${colour};clip-path:polygon(50% 0,100% 100%,0 80%);transform:rotate(${random() * 360}deg);opacity:${0.55 + random() * 0.45}"></div>`;
  }).join('');
};

const card = `<!doctype html><html><body style="margin:0;width:1200px;height:630px;overflow:hidden;font-family:'Segoe UI',system-ui,sans-serif;background:radial-gradient(60% 70% at 80% 30%,#24304a,#0b0e13 70%);color:#f4efe4;position:relative">
  <img src="${logoUrl}" style="position:absolute;left:80px;top:90px;width:120px;height:120px">
  <div style="position:absolute;left:80px;top:240px;font-size:104px;font-weight:800;letter-spacing:-2px">Stackrift</div>
  <div style="position:absolute;left:84px;top:378px;font-size:38px;color:#c9c2b4;max-width:620px;line-height:1.25">13 modes · défi du jour · FR · EN · ID</div>
  <div style="position:absolute;left:84px;top:500px;font-size:28px;color:#f2c35b;font-weight:700">Gratuit · sans inscription · mobile et ordinateur</div>
  ${shards(7)}
  ${[0, 1, 2, 3, 4, 5].map((i) => block(760 + i * 62, 470, 58, TONES[i])).join('')}
  ${[0, 1, 3, 4].map((i) => block(760 + i * 62, 408, 58, TONES[(i + 3) % 7])).join('')}
  <div style="position:absolute;left:880px;top:390px;width:6px;height:150px;background:#fff3d6;transform:rotate(14deg);box-shadow:0 0 18px #fff3d6"></div>
</body></html>`;

const icon = (size) =>
  `<!doctype html><html><body style="margin:0;width:${size}px;height:${size}px;background:#0b0e13"><img src="${logoUrl}" style="width:${size}px;height:${size}px;display:block"></body></html>`;

const browser = await chromium.launch({ channel: 'chrome' });
try {
  const shoot = async (html, width, height, file) => {
    const page = await browser.newPage({ viewport: { width, height } });
    await page.setContent(html);
    await page.screenshot({ path: `public/${file}` });
    await page.close();
    console.log(`public/${file}`);
  };
  await shoot(card, 1200, 630, 'og-image.png');
  await shoot(icon(180), 180, 180, 'apple-touch-icon.png');
  await shoot(icon(192), 192, 192, 'icon-192.png');
  await shoot(icon(512), 512, 512, 'icon-512.png');
} finally {
  await browser.close();
}

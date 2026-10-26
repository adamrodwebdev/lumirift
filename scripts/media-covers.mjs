// The portal covers, drawn in HTML and SVG (rendered to PNG by crazygames-media.mjs).
//
// The art (1.17): the Eye of the Tower, the game's most readable Guardian, rises
// behind the glass tower of gems; its red gaze strikes the tower, where a bomb
// gem goes off. Bright and saturated, so that it reads as a thumbnail: one big
// round shape (the eye), one strong silhouette (the tower), the title. The
// title is the only text, as the portals require.
import { readFileSync } from 'node:fs';

/** Unbounded, the identity's display face, embedded so the cover needs no network. */
const UNBOUNDED = readFileSync(
  'node_modules/@fontsource-variable/unbounded/files/unbounded-latin-wght-normal.woff2',
).toString('base64');
/** The piece tones of the Rift identity (src/styles/tokens.css). */
const TONES = ['#3de0ff', '#ff4fa3', '#b8f25c', '#8b6cff', '#ffb547', '#ff7a4d', '#5b8cff'];

const random = (seed) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;

/** The title: LUMI over RIFT (molten gold over a dark copy, its shadow), then BLOCKS. */
const title = (x, y, size, align = 'left') => {
  const drop = size * 0.045;
  return `<h1 style="position:absolute;left:${x}px;top:${y}px;${align === 'center' ? 'transform:translateX(-50%);text-align:center;' : ''}margin:0;font:900 ${size}px/0.9 'Unbounded',sans-serif;letter-spacing:${-size * 0.035}px;color:#fffaf0;text-shadow:0 ${drop}px 0 #2a0f5c,0 ${size * 0.06}px ${size * 0.3}px rgb(40 10 90 / .7)">LUMI<br><span style="position:relative;display:inline-block"><span aria-hidden="true" style="position:absolute;left:0;top:${drop}px;color:#5a1f0a;text-shadow:0 0 ${size * 0.25}px rgb(255 140 40 / .65)">RIFT</span><span style="position:relative;background:linear-gradient(180deg,#fff3c8 10%,#ffb340 55%,#ff7a2a);-webkit-background-clip:text;background-clip:text;color:transparent;text-shadow:none">RIFT</span></span><span style="display:block;margin-top:.14em;font-size:.26em;line-height:1;letter-spacing:.55em;color:#ffe9c7;text-shadow:0 2px 0 #2a0f5c">BLOCKS</span></h1>`;
};

/**
 * The Eye: a pale almond, an iris of molten gold and rift violet, a slit of a
 * pupil, a red-gold halo and rays. Centred on (cx, cy), `w` wide.
 */
function eye(cx, cy, w) {
  const h = w * 0.5;
  const r = h * 0.62;
  const rays = random(3);
  let beams = '';
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2 + rays() * 0.2;
    const len = w * (0.75 + rays() * 0.45);
    beams += `<polygon points="${cx},${cy} ${cx + Math.cos(a - 0.05) * len},${cy + Math.sin(a - 0.05) * len} ${cx + Math.cos(a + 0.05) * len},${cy + Math.sin(a + 0.05) * len}" fill="url(#ray)"/>`;
  }
  const almond = `M${cx - w / 2} ${cy} Q${cx} ${cy - h * 1.15} ${cx + w / 2} ${cy} Q${cx} ${cy + h * 1.15} ${cx - w / 2} ${cy} Z`;
  return `<svg style="position:absolute;inset:0;overflow:visible" width="100%" height="100%">
  <defs>
    <radialGradient id="halo" cx="${cx}" cy="${cy}" r="${w * 0.95}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#ffcf6b" stop-opacity=".95"/>
      <stop offset=".35" stop-color="#ff5a3c" stop-opacity=".55"/>
      <stop offset="1" stop-color="#ff3c8a" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="ray"><stop offset="0" stop-color="#fff2c8" stop-opacity=".55"/><stop offset="1" stop-color="#ff8a3c" stop-opacity="0"/></linearGradient>
    <radialGradient id="sclera" cx="${cx}" cy="${cy - h * 0.2}" r="${w * 0.55}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#ffffff"/><stop offset=".7" stop-color="#f1ecff"/><stop offset="1" stop-color="#b9a8e8"/>
    </radialGradient>
    <radialGradient id="iris" cx="${cx}" cy="${cy + h * 0.08}" r="${r}" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#fff6d0"/><stop offset=".25" stop-color="#ffc23c"/><stop offset=".6" stop-color="#ff5a2a"/><stop offset=".85" stop-color="#a3218a"/><stop offset="1" stop-color="#3a0d5c"/>
    </radialGradient>
    <clipPath id="lid"><path d="${almond}"/></clipPath>
  </defs>
  ${beams}
  <circle cx="${cx}" cy="${cy}" r="${w * 0.95}" fill="url(#halo)"/>
  <path d="${almond}" fill="url(#sclera)"/>
  <g clip-path="url(#lid)">
    <circle cx="${cx}" cy="${cy + h * 0.08}" r="${r}" fill="url(#iris)"/>
    <ellipse cx="${cx}" cy="${cy + h * 0.08}" rx="${r * 0.16}" ry="${r * 0.82}" fill="#1a0630"/>
    <ellipse cx="${cx - r * 0.38}" cy="${cy - r * 0.3}" rx="${r * 0.22}" ry="${r * 0.14}" fill="#fff" opacity=".85"/>
    <path d="M${cx - w / 2} ${cy} Q${cx} ${cy - h * 1.15} ${cx + w / 2} ${cy}" fill="none" stroke="#2a0f5c" stroke-opacity=".35" stroke-width="${h * 0.3}"/>
  </g>
  <path d="${almond}" fill="none" stroke="#24083f" stroke-width="${w * 0.03}" stroke-linejoin="round"/>
  <path d="M${cx - w * 0.56} ${cy - h * 0.12} Q${cx} ${cy - h * 1.42} ${cx + w * 0.56} ${cy - h * 0.12}" fill="none" stroke="#ffd27a" stroke-width="${w * 0.012}" stroke-linecap="round" opacity=".8"/>
</svg>`;
}

/** A gem block, as in the game: light band top-left, shadow bottom-right, a gloss. */
const gem = (x, y, sw, sh, colour, shade = 0) =>
  `<div style="position:absolute;left:${x}px;top:${y}px;width:${sw}px;height:${sh}px;border-radius:${Math.min(sw, sh) * 0.16}px;background:${colour};filter:brightness(${1 - shade});box-shadow:inset ${sw * 0.1}px ${sh * 0.1}px 0 rgb(255 255 255 / .32),inset -${sw * 0.1}px -${sh * 0.1}px 0 rgb(0 0 0 / .3)"><div style="position:absolute;left:${sw * 0.2}px;top:${sh * 0.16}px;width:${sw * 0.3}px;height:${sh * 0.12}px;border-radius:${sh * 0.06}px;background:rgb(255 255 255 / .6)"></div></div>`;

/**
 * The glass tower of gems, seen face on: columns narrow towards its edges as on
 * the cylinder, darker on the right (the light comes from the left). The gaze
 * of the Eye lights its top red; a bomb goes off on its flank. `fill` gives
 * the share of gems in each row (by default, gaps at the top: the tower is
 * still being built).
 */
function tower(cx, top, bottom, radius, rows, fill = (r) => (r < 2 ? 0.35 : r < 4 ? 0.7 : 0.94)) {
  const columns = 9;
  const rowH = (bottom - top) / rows;
  const next = random(7);
  let html = '';
  // The glass body.
  html += `<div style="position:absolute;left:${cx - radius}px;top:${top - rowH * 0.6}px;width:${radius * 2}px;height:${bottom - top + rowH * 0.6}px;border-radius:${radius}px / ${rowH * 0.6}px;background:linear-gradient(90deg,rgb(120 210 255 / .22),rgb(180 160 255 / .1) 45%,rgb(40 10 80 / .4));box-shadow:inset 0 0 ${radius * 0.2}px rgb(160 220 255 / .45),0 0 ${radius * 0.6}px rgb(120 80 255 / .5)"></div>`;
  for (let r = 0; r < rows; r++) {
    const filled = fill(r);
    for (let c = 0; c < columns; c++) {
      const a0 = -Math.PI / 2 + (c / columns) * Math.PI;
      const a1 = -Math.PI / 2 + ((c + 1) / columns) * Math.PI;
      const x0 = cx + Math.sin(a0) * radius;
      const x1 = cx + Math.sin(a1) * radius;
      if (next() > filled) continue;
      const w = x1 - x0;
      const pad = w * 0.06;
      const shade = Math.max(0, Math.sin((a0 + a1) / 2)) * 0.35;
      html += gem(
        x0 + pad,
        top + r * rowH + rowH * 0.05 + Math.cos((a0 + a1) / 2) * rowH * 0.1,
        w - pad * 2,
        rowH * 0.9,
        TONES[(c * 3 + r * 5) % TONES.length],
        shade,
      );
    }
  }
  // The rims of the rings: thin ellipses, so that the stack reads as a cylinder.
  let rims = '';
  for (let r = 0; r <= rows; r++) {
    const y = top + r * rowH;
    rims += `<path d="M${cx - radius} ${y} Q${cx} ${y + rowH * 0.24} ${cx + radius} ${y}" fill="none" stroke="rgb(200 230 255 / .35)" stroke-width="${Math.max(1, rowH * 0.03)}"/>`;
  }
  html += `<svg style="position:absolute;inset:0;overflow:visible" width="100%" height="100%">${rims}<ellipse cx="${cx}" cy="${top - rowH * 0.05}" rx="${radius}" ry="${rowH * 0.28}" fill="rgb(190 220 255 / .12)" stroke="rgb(210 235 255 / .6)" stroke-width="${Math.max(1.5, rowH * 0.04)}"/></svg>`;
  return html;
}

/** The Eye's gaze: a red beam from its pupil down onto the tower, widening as it falls. */
function gaze(cx, from, to, width) {
  return `<svg style="position:absolute;inset:0;overflow:visible;mix-blend-mode:screen" width="100%" height="100%"><defs><linearGradient id="gaze" x1="0" y1="${from}" x2="0" y2="${to}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#ff4040" stop-opacity=".85"/><stop offset=".7" stop-color="#ff3a5a" stop-opacity=".35"/><stop offset="1" stop-color="#ff3a5a" stop-opacity="0"/></linearGradient></defs><polygon points="${cx - width * 0.12},${from} ${cx + width * 0.12},${from} ${cx + width / 2},${to} ${cx - width / 2},${to}" fill="url(#gaze)"/></svg>`;
}

/** A bomb going off: a white-gold core, a ring, shards of every colour flying out. */
function blast(x, y, size) {
  const next = random(13);
  let shards = '';
  for (let i = 0; i < 34; i++) {
    const a = next() * Math.PI * 2;
    const d = size * (0.5 + next() * 1.6);
    const s = size * (0.08 + next() * 0.16);
    shards += `<div style="position:absolute;left:${x + Math.cos(a) * d - s / 2}px;top:${y + Math.sin(a) * d * 0.8 - s / 2}px;width:${s}px;height:${s}px;background:${TONES[i % TONES.length]};clip-path:polygon(50% 0,100% 100%,0 70%);transform:rotate(${next() * 360}deg);box-shadow:0 0 ${s}px #fff"></div>`;
  }
  return `<div style="position:absolute;left:${x - size}px;top:${y - size}px;width:${size * 2}px;height:${size * 2}px;border-radius:50%;background:radial-gradient(circle,#ffffff 0,#fff2b0 18%,#ffb340 38%,rgb(255 90 50 / .55) 58%,rgb(255 60 120 / 0) 72%)"></div><div style="position:absolute;left:${x - size * 0.9}px;top:${y - size * 0.9}px;width:${size * 1.8}px;height:${size * 1.8}px;border-radius:50%;border:${size * 0.05}px solid rgb(255 240 200 / .8)"></div>${shards}`;
}

/** Specks of light drifting in the air. */
function motes(width, height, count, seed) {
  const next = random(seed);
  let html = '';
  for (let i = 0; i < count; i++) {
    const s = 2 + next() * 6;
    html += `<div style="position:absolute;left:${next() * width}px;top:${next() * height}px;width:${s}px;height:${s}px;border-radius:50%;background:${next() < 0.5 ? '#ffd27a' : '#c9b6ff'};opacity:${0.35 + next() * 0.5};box-shadow:0 0 ${s * 2}px currentColor"></div>`;
  }
  return html;
}

/** A bright violet sky with a warm glow where the Eye is. */
const page = (width, height, glow, body) =>
  `<!doctype html><html><head><style>@font-face{font-family:'Unbounded';font-weight:200 900;src:url(data:font/woff2;base64,${UNBOUNDED}) format('woff2')}</style></head><body style="margin:0;width:${width}px;height:${height}px;overflow:hidden;position:relative;background:radial-gradient(75% 85% at ${glow},#7d3ae0 0%,#4a1fa8 38%,#22105e 72%,#120838 100%)">
  <div style="position:absolute;inset:0;background:radial-gradient(40% 45% at ${glow},rgb(255 120 80 / .35),transparent 75%)"></div>
  ${motes(width, height, Math.round((width * height) / 22000), 21)}
  ${body}</body></html>`;

export const COVERS = {
  landscape: (w = 1920, h = 1080) =>
    page(
      w,
      h,
      '70% 32%',
      `${eye(w * 0.69, h * 0.29, h * 0.62)}${tower(w * 0.69, h * 0.5, h * 1.02, h * 0.27, 8)}${gaze(w * 0.69, h * 0.36, h * 0.8, h * 0.42)}${blast(w * 0.69 + h * 0.22, h * 0.72, h * 0.11)}${title(w * 0.055, h * 0.27, h * 0.185)}`,
    ),
  portrait: (w = 800, h = 1200) =>
    page(
      w,
      h,
      '50% 50%',
      `${eye(w * 0.5, h * 0.5, w * 0.74)}${tower(w * 0.5, h * 0.665, h * 1.02, w * 0.33, 6)}${gaze(w * 0.5, h * 0.54, h * 0.88, w * 0.5)}${blast(w * 0.5 + w * 0.27, h * 0.84, w * 0.13)}${title(w / 2, h * 0.05, w * 0.2, 'center')}`,
    ),
  square: (w = 800, h = 800) =>
    page(
      w,
      h,
      '50% 58%',
      `${eye(w * 0.5, h * 0.585, w * 0.56)}${tower(w * 0.5, h * 0.74, h * 1.03, w * 0.26, 4)}${gaze(w * 0.5, h * 0.625, h * 0.95, w * 0.4)}${blast(w * 0.5 + w * 0.21, h * 0.89, w * 0.1)}${title(w / 2, h * 0.04, w * 0.15, 'center')}`,
    ),
  /**
   * The app icon (Yandex Games, 512 × 512): the Eye over the top of its tower,
   * full of gems; no text, square corners (the catalogue rounds them itself).
   */
  icon: (s = 512) =>
    page(
      s,
      s,
      '50% 38%',
      `${eye(s * 0.5, s * 0.36, s * 0.8)}${tower(s * 0.5, s * 0.71, s * 1.13, s * 0.38, 3, () => 0.9)}${gaze(s * 0.5, s * 0.44, s * 0.98, s * 0.5)}`,
    ),
};

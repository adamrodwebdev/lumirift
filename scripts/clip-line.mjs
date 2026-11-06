// The on-screen line of a clip (1.46.2): the web schedulers have no text
// stickers, so the clip factory writes the line into the clip, in the game's
// display type (Unbounded, 900), white with the outline of the well's words,
// centred in the apps' safe area at the height its recipe gives. The layout's
// rules are in media/clipLine.ts; here the line is measured and drawn in a tab
// of the factory's browser, from the type's own files. A line too long, or a
// character the type lacks (Chrome names the fonts that drew it), stops the render.
// The clips' identity label (1.46.3) is drawn here too, in the game's interface
// type (Sora), small and quiet at the top of the safe area.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  LABEL,
  labelY,
  LINE_PAD,
  LINE_SIZE,
  LINE_SPACING,
  OUTLINE,
  chooseLayout,
  fontFaces,
  lineBox,
  lineChoices,
} from '../media/clipLine.ts';

/** The display type, as src/styles/fonts.css names it, at the weight of the well's words. */
const FAMILY = 'Unbounded Variable';
const WEIGHT = 900;
/** The interface type, for the clips' label (1.46.3). */
const LABEL_FAMILY = 'Sora Variable';
/** The fonts' strings for the canvas. */
const LINE_FONT = (size) => `${WEIGHT} ${size}px '${FAMILY}'`;
const LABEL_FONT = `${LABEL.weight} ${LABEL.size}px '${LABEL_FAMILY}'`;
/** The line's page: never loaded from a server (routed), like the encoder's. */
const LINE_PAGE = 'http://localhost:5199/';
const FONTS_CSS = fileURLToPath(new URL('../src/styles/fonts.css', import.meta.url));
const NODE_MODULES = fileURLToPath(new URL('../node_modules/', import.meta.url));

/** Where a clip's line goes and how it looks, drawn in a tab of the factory's browser. */
export class ClipLine {
  #page;
  #cdp = null;

  constructor(page) {
    this.#page = page;
  }

  /** Opens the line's tab with the game's display and interface types, read from their own files (node_modules). */
  static async open(browser) {
    const css = readFileSync(FONTS_CSS, 'utf8');
    const families = [FAMILY, LABEL_FAMILY].map((family) => ({
      family,
      faces: fontFaces(css, family),
    }));
    for (const { family, faces } of families) {
      if (!faces.length) throw new Error(`No @font-face of ${family} in ${FONTS_CSS}`);
    }
    const page = await browser.newPage();
    await page.route(`${LINE_PAGE}**`, (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: '<!doctype html><title>Line</title><div id="probe" style="white-space:pre"></div>',
      }),
    );
    await page.goto(LINE_PAGE);
    for (const { family, faces } of families) {
      await page.evaluate(
        async ({ family, faces }) => {
          for (const face of faces) {
            const bytes = Uint8Array.from(atob(face.base64), (char) => char.charCodeAt(0));
            const font = new FontFace(family, bytes, {
              ...(face.weight ? { weight: face.weight } : {}),
              ...(face.unicodeRange ? { unicodeRange: face.unicodeRange } : {}),
            });
            document.fonts.add(await font.load());
          }
        },
        {
          family,
          faces: faces.map((face) => ({
            weight: face.weight,
            unicodeRange: face.unicodeRange,
            base64: readFileSync(NODE_MODULES + face.file).toString('base64'),
          })),
        },
      );
    }
    return new ClipLine(page);
  }

  /** The fonts other than the game's that draw `text` in `font`: Chrome names those that drew a node. */
  async #fallbacks(text, font) {
    await this.#page.evaluate(
      ({ text, font }) => {
        const probe = document.querySelector('#probe');
        probe.style.font = font;
        probe.textContent = text;
      },
      { text, font },
    );
    if (!this.#cdp) {
      this.#cdp = await this.#page.context().newCDPSession(this.#page);
      await this.#cdp.send('DOM.enable');
      await this.#cdp.send('CSS.enable');
    }
    const { root } = await this.#cdp.send('DOM.getDocument');
    const { nodeId } = await this.#cdp.send('DOM.querySelector', {
      nodeId: root.nodeId,
      selector: '#probe',
    });
    const { fonts } = await this.#cdp.send('CSS.getPlatformFontsForNode', { nodeId });
    return fonts.filter((font) => !font.isCustomFont).map((font) => font.familyName);
  }

  /** Stops the render when the game's type (`font`) lacks a character of `text`, naming them. */
  async #checkGlyphs(text, font = LINE_FONT(100)) {
    const families = await this.#fallbacks(text, font);
    if (!families.length) return;
    const missing = [];
    for (const char of new Set(text.replace(/\s/g, ''))) {
      if ((await this.#fallbacks(char, font)).length) missing.push(char);
    }
    throw new Error(
      `The clip's text "${text}": ${missing.map((char) => `"${char}"`).join(', ')} not in the ` +
        `game's type, drawn in ${[...new Set(families)].join(', ')}`,
    );
  }

  /** Each line's width (px) in `font` (the display type at `size` px by default). */
  #measure(lines, size, font = LINE_FONT(size)) {
    return this.#page.evaluate(
      ({ lines, font }) => {
        const ctx = new OffscreenCanvas(1, 1).getContext('2d');
        ctx.font = font;
        return lines.map((line) => ctx.measureText(line).width);
      },
      { lines, font },
    );
  }

  /**
   * The line drawn for a frame of `frame`'s size: as a layer for the encoder
   * (a PNG and its place, video px), with its box, size and lines. Centred
   * across `safe` (shares of the width) and at `y` (share of the height);
   * `outline`, the colour of the well's background.
   */
  async draw(text, { frame, safe, y, outline }) {
    await this.#checkGlyphs(text);
    const choices = lineChoices(text);
    const widthsAt100 = await Promise.all(choices.map((lines) => this.#measure(lines, 100)));
    const width = (safe.right - safe.left) * frame.width - 2 * LINE_PAD;
    const layout = chooseLayout(choices, widthsAt100, { width });
    if (!layout) {
      throw new Error(
        `The on-screen line "${text}" does not fit the safe area, even on two lines at ` +
          `${LINE_SIZE.min} px: shorten it`,
      );
    }
    const widths = await this.#measure(layout.lines, layout.size);
    const box = lineBox(layout, widths, {
      x: ((safe.left + safe.right) / 2) * frame.width,
      y: y * frame.height,
    });
    const base64 = await this.#page.evaluate(
      async ({ lines, size, box, spacing, outline, colour, font }) => {
        const canvas = new OffscreenCanvas(box.width, box.height);
        const ctx = canvas.getContext('2d');
        ctx.font = font;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineJoin = 'round';
        const first = (box.height - spacing * size * (lines.length - 1)) / 2;
        const at = (i) => first + i * spacing * size;
        // Every outline first: one line's outline never covers the other's letters.
        ctx.lineWidth = outline;
        ctx.strokeStyle = colour;
        lines.forEach((line, i) => ctx.strokeText(line, box.width / 2, at(i)));
        ctx.fillStyle = '#ffffff';
        lines.forEach((line, i) => ctx.fillText(line, box.width / 2, at(i)));
        const blob = await canvas.convertToBlob({ type: 'image/png' });
        const bytes = new Uint8Array(await blob.arrayBuffer());
        let binary = '';
        for (let i = 0; i < bytes.length; i += 0x8000) {
          binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        }
        return btoa(binary);
      },
      {
        lines: layout.lines,
        size: layout.size,
        box,
        spacing: LINE_SPACING,
        outline: OUTLINE * layout.size,
        colour: outline,
        font: LINE_FONT(layout.size),
      },
    );
    return {
      layer: { picture: Buffer.from(base64, 'base64'), ...box },
      box,
      size: layout.size,
      lines: layout.lines,
    };
  }

  /**
   * The clips' identity label (1.46.3, LABEL), drawn for a frame of `frame`'s
   * size: one line in the interface type at its size, centred across `safe`
   * (shares of the width), right under the line's box `under` when it fits
   * there, else at the top of the safe area (labelY); white at its alpha with
   * the outline `outline`. A layer for the encoder, with its box and height.
   */
  async label({ frame, safe, outline, under = null }) {
    const { text, size, alpha } = LABEL;
    await this.#checkGlyphs(text, `${LABEL.weight} 100px '${LABEL_FAMILY}'`);
    const widths = await this.#measure([text], size, LABEL_FONT);
    const x = ((safe.left + safe.right) / 2) * frame.width;
    const { height } = lineBox({ lines: [text], size }, widths, { x, y: 0 });
    const y = labelY(under, height, { frame, safeBottom: safe.bottom });
    const box = lineBox({ lines: [text], size }, widths, { x, y: y * frame.height });
    const base64 = await this.#page.evaluate(
      async ({ text, box, outline, colour, font, alpha }) => {
        const canvas = new OffscreenCanvas(box.width, box.height);
        const ctx = canvas.getContext('2d');
        ctx.font = font;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineJoin = 'round';
        ctx.globalAlpha = alpha;
        ctx.lineWidth = outline;
        ctx.strokeStyle = colour;
        ctx.strokeText(text, box.width / 2, box.height / 2);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(text, box.width / 2, box.height / 2);
        const blob = await canvas.convertToBlob({ type: 'image/png' });
        const bytes = new Uint8Array(await blob.arrayBuffer());
        let binary = '';
        for (let i = 0; i < bytes.length; i += 0x8000) {
          binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        }
        return btoa(binary);
      },
      { text, box, outline: OUTLINE * size, colour: outline, font: LABEL_FONT, alpha },
    );
    return { layer: { picture: Buffer.from(base64, 'base64'), ...box }, box, text, size, y };
  }

  async close() {
    await this.#page.close();
  }
}

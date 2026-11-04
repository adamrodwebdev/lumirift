import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  LINE_PAD,
  LINE_SIZE,
  OUTLINE,
  chooseLayout,
  fontFaces,
  lineBox,
  lineChoices,
  lineCovers,
} from '../../media/clipLine';

/** The frame of the clips (video px). */
const FRAME = { width: 1080, height: 1920 };
/** The safe area's width inside its padding (video px): 3 % to 85 % of the frame. */
const WIDTH = 0.82 * FRAME.width - 2 * LINE_PAD;
/** Widths at 100 px for a type whose every character is 70 px wide there. */
const widthsOf = (choices: readonly (readonly string[])[]) =>
  choices.map((lines) => lines.map((line) => line.length * 70));

describe('the on-screen line of a clip', () => {
  it('can be cut in two at each space', () => {
    expect(lineChoices('Fire meets oil')).toEqual([
      ['Fire meets oil'],
      ['Fire', 'meets oil'],
      ['Fire meets', 'oil'],
    ]);
    expect(lineChoices('Ablaze')).toEqual([['Ablaze']]);
  });

  it('stands whole and as large as it may when it fits', () => {
    const choices = lineChoices('Fire meets oil');
    expect(chooseLayout(choices, widthsOf(choices), { width: WIDTH })).toEqual({
      lines: ['Fire meets oil'],
      size: LINE_SIZE.max,
    });
  });

  it('goes on two balanced lines rather than shrink under its one-line size', () => {
    const choices = lineChoices('Lightning into still water takes it all');
    const layout = chooseLayout(choices, widthsOf(choices), { width: WIDTH });
    expect(layout?.lines).toEqual(['Lightning into still', 'water takes it all']);
    // 20 characters at 0.7 of the size each, and the outline, across the safe area.
    expect(layout?.size).toBe(Math.floor(WIDTH / (20 * 0.7 + OUTLINE)));
    expect(layout?.size).toBeGreaterThanOrEqual(LINE_SIZE.min);
  });

  it('takes, between cuts at the largest size, one after a mark, then the most balanced', () => {
    // 62 px a character at 100 px: whole, under the one-line size; several cuts at the largest.
    const narrower = (choices: readonly (readonly string[])[]) =>
      choices.map((lines) => lines.map((line) => line.length * 62));
    const question = lineChoices('Where should the fire go?');
    expect(chooseLayout(question, narrower(question), { width: WIDTH })).toEqual({
      lines: ['Where should', 'the fire go?'],
      size: LINE_SIZE.max,
    });
    const answer = lineChoices('A lights the oil, B the water');
    expect(chooseLayout(answer, narrower(answer), { width: WIDTH })?.lines).toEqual([
      'A lights the oil,',
      'B the water',
    ]);
  });

  it('has no layout when even two lines are too long', () => {
    // 30 characters on the longer line: 41 px, under the two lines' least size.
    const choices = lineChoices('Lightningintostillwaterforever takesitallatonce');
    expect(chooseLayout(choices, widthsOf(choices), { width: WIDTH })).toBeNull();
  });

  it('is drawn in a box around its letters and outline, centred where it is placed', () => {
    const box = lineBox({ lines: ['Fire meets oil'], size: 72 }, [700], { x: 475, y: 518 });
    const outline = OUTLINE * 72;
    expect(box.width).toBe(Math.ceil(700 + outline + 2 * LINE_PAD));
    expect(box.height).toBe(Math.ceil(72 + outline + 2 * LINE_PAD));
    // On whole pixels: half a pixel off at most.
    expect(Math.abs(box.x + box.width / 2 - 475)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(box.y + box.height / 2 - 518)).toBeLessThanOrEqual(0.5);
    const two = lineBox({ lines: ['a', 'b'], size: 50 }, [100, 120], { x: 475, y: 518 });
    expect(two.height).toBe(Math.ceil(50 * 2.18 + OUTLINE * 50 + 2 * LINE_PAD));
  });

  it('keeps clear of the peak, the reach of its action and a challenge’s letters', () => {
    const box = lineBox({ lines: ['Fire meets oil'], size: 72 }, [700], { x: 475, y: 0.27 * 1920 });
    expect(lineCovers(box, FRAME, { at: { x: 0.507, y: 0.545 } })).toEqual([]);
    expect(lineCovers(box, FRAME, { at: { x: 0.5, y: 0.29 } })).toEqual(['peak']);
    expect(
      lineCovers(box, FRAME, { at: { x: 0.5, y: 0.3 }, extent: { top: 0.61, bottom: 0.764 } }),
    ).toEqual(['peak']);
    expect(lineCovers(box, FRAME, { extent: { top: 0.2, bottom: 0.4 } })).toEqual(['extent']);
    expect(
      lineCovers(box, FRAME, {
        answers: [
          { x: 0.2, y: 0.6 },
          { x: 0.7, y: 0.3 },
        ],
      }),
    ).toEqual(['answer B']);
    expect(lineCovers(box, FRAME, null)).toEqual([]);
  });

  it('reads the game’s display type from its stylesheet: Latin, Latin Extended and Cyrillic', () => {
    const css = readFileSync(new URL('../../src/styles/fonts.css', import.meta.url), 'utf8');
    const faces = fontFaces(css, 'Unbounded Variable');
    expect(faces.map((face) => face.file)).toEqual([
      '@fontsource-variable/unbounded/files/unbounded-latin-wght-normal.woff2',
      '@fontsource-variable/unbounded/files/unbounded-latin-ext-wght-normal.woff2',
      '@fontsource-variable/unbounded/files/unbounded-cyrillic-wght-normal.woff2',
    ]);
    expect(faces.every((face) => face.weight === '200 900')).toBe(true);
    expect(faces[0]?.unicodeRange).toMatch(/^U\+0000-00FF, U\+0131, .* U\+FFFD$/);
    expect(fontFaces(css, 'Sora Variable')).toHaveLength(3);
  });
});

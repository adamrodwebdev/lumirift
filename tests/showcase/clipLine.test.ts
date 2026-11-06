import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  LABEL,
  LABEL_GAP,
  LINE_PAD,
  LINE_SIZE,
  OUTLINE,
  boxesMeet,
  chooseLayout,
  fontFaces,
  lineBox,
  labelY,
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

  it('cuts after a mark while its size stays within a tenth of the largest', () => {
    const choices = [
      ['A lights the oil, B the water'],
      ['A lights the', 'oil, B the water'],
      ['A lights the oil,', 'B the water'],
    ];
    // At 100 px: whole, too long; cut mid-phrase, 72 px; cut after the comma, 66 px.
    expect(chooseLayout(choices, [[2600], [1150, 1200], [1300, 1000]], { width: WIDTH })).toEqual({
      lines: ['A lights the oil,', 'B the water'],
      size: 66,
    });
    // After the comma at 64 px, more than a tenth under 72: the size wins.
    expect(
      chooseLayout(choices, [[2600], [1150, 1200], [1340, 1000]], { width: WIDTH })?.lines,
    ).toEqual(['A lights the', 'oil, B the water']);
  });

  it('leaves no short word alone on a line, though alone it would stand larger', () => {
    const choices = [
      ['Where should the fire go?'],
      ['Where', 'should the fire go?'],
      ['Where should', 'the fire go?'],
      ['Where should the fire', 'go?'],
    ];
    const widths = [[2600], [400, 1100], [1250, 1000], [1450, 250]];
    expect(chooseLayout(choices, widths, { width: WIDTH })).toEqual({
      lines: ['Where should', 'the fire go?'],
      size: 69,
    });
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

describe("the clips' identity label", () => {
  /** The middle of the safe area's width (3 % to 85 %), where the label and the lines are centred. */
  const middle = 0.44 * FRAME.width;
  // Sora at 600: about 0.6 of the size a character.
  const label = lineBox(
    { lines: [LABEL.text], size: LABEL.size },
    [LABEL.text.length * 0.6 * LABEL.size],
    {
      x: middle,
      y: LABEL.y * FRAME.height,
    },
  );

  it("stands in the apps' safe area, just under their tabs", () => {
    expect(label.y / FRAME.height).toBeGreaterThanOrEqual(0.1);
    expect((label.y + label.height) / FRAME.height).toBeLessThanOrEqual(0.15);
    expect(label.x / FRAME.width).toBeGreaterThanOrEqual(0.03);
    expect((label.x + label.width) / FRAME.width).toBeLessThanOrEqual(0.85);
  });

  it("stays clear of the highest line a recipe has set (Friday's, at 0.2)", () => {
    const friday = lineBox(
      { lines: ["This puzzle's final boss", 'hides under the floor'], size: 58 },
      [24 * 0.7 * 58, 21 * 0.7 * 58],
      { x: middle, y: 0.2 * FRAME.height },
    );
    expect(boxesMeet(label, friday)).toBe(false);
  });

  it('meets a line set at its own height', () => {
    const line = lineBox({ lines: ['Fire meets oil'], size: 72 }, [14 * 0.7 * 72], {
      x: middle,
      y: 0.13 * FRAME.height,
    });
    expect(boxesMeet(label, line)).toBe(true);
  });
});

describe("the label's place", () => {
  const middle = 0.44 * FRAME.width;
  const height = 48;
  const safe = { frame: FRAME, safeBottom: 0.78 };
  const question = lineBox(
    { lines: ['A or B:', 'which burns more?'], size: 70 },
    [7 * 0.7 * 70, 17 * 0.7 * 70],
    { x: middle, y: 0.27 * FRAME.height },
  );

  it("signs the clip's line, right under it", () => {
    const y = labelY(question, height, safe) * FRAME.height;
    expect(y - height / 2).toBeCloseTo(question.y + question.height + LABEL_GAP, 6);
  });

  it('goes to the top of the safe area when the line is too low for it, or missing', () => {
    // An answer's line, under its wells: no room left above the apps' caption.
    const answer = lineBox(
      { lines: ["Thursday's answer:", 'A or B?'], size: 67 },
      [18 * 0.7 * 67, 7 * 0.7 * 67],
      { x: middle, y: 0.735 * FRAME.height },
    );
    expect(labelY(answer, height, safe)).toBe(LABEL.y);
    expect(labelY(null, height, safe)).toBe(LABEL.y);
  });
});

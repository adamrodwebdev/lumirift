/*
 * The layout of a clip's on-screen line (1.46.2), pure: the clip factory
 * (scripts/clip-line.mjs) measures the line in the game's display type, then
 * these rules set it. One line as large as it fits, or two balanced lines;
 * its picture's box; what of the clip's peak it would cover. Plain types
 * only: Node imports this file as it is (the factory is not built).
 */

/** The line's sizes (video px, the frame 1080 wide): as large as fits, one line from `oneLine`, two from `min`. */
export const LINE_SIZE = { max: 72, oneLine: 56, min: 44 } as const;
/** From one line's middle to the next's, in sizes. */
export const LINE_SPACING = 1.18;
/** The outline's width, in sizes: the well's words (WellOverlay: 0.12 of a cell for a word 1.05 cells high). */
export const OUTLINE = 0.12 / 1.05;
/** Room around the outline inside the line's picture (video px). */
export const LINE_PAD = 6;
/** How close to the line a peak's point may come (share of the frame's height): a letter's badge is ~0.07 high. */
export const POINT_MARGIN = 0.035;

/**
 * The clips' identity label (1.46.3, CAHIER § 9 undecies): who made them and
 * which game, from the first frame to the last, in place of a greeting. Small
 * and quiet in the game's interface type (Sora, 32 px for 1 080 wide: about
 * 11 points on a phone), white at 90 % with the well's outline. It signs the
 * clip's line, right under it (the user's choice, 05/11/2026); at the top of
 * the safe area (its middle at `y`, a share of the height) when the line is
 * too low for it (an answer's) or when there is none.
 */
export const LABEL = {
  text: 'Lumirift Blocks · @adamrodwebdev',
  size: 32,
  weight: 600,
  alpha: 0.9,
  y: 0.118,
} as const;

/** Between the line's picture and the label's (video px): the label signs the line, close under it. */
export const LABEL_GAP = 4;

/**
 * Where the label's middle goes (share of the frame's height): right under
 * the line's box when it stays inside the safe area there, else at the top of
 * the safe area (`LABEL.y`).
 */
export function labelY(
  line: FrameBox | null,
  labelHeight: number,
  {
    frame,
    safeBottom,
  }: { readonly frame: { readonly height: number }; readonly safeBottom: number },
): number {
  if (line) {
    const top = line.y + line.height + LABEL_GAP;
    if (top + labelHeight <= safeBottom * frame.height)
      return (top + labelHeight / 2) / frame.height;
  }
  return LABEL.y;
}

/** Whether two boxes of the frame overlap. */
export const boxesMeet = (a: FrameBox, b: FrameBox): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

export interface LineSizes {
  readonly max: number;
  readonly oneLine: number;
  readonly min: number;
}

/** The line set: its lines (one or two) and their size (video px). */
export interface LineLayout {
  readonly lines: readonly string[];
  readonly size: number;
}

/** A box in the frame (video px). */
export interface FrameBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** A clip's peak in shares of the frame, as the factory's manifest gives it. */
export interface FramePeak {
  readonly at?: { readonly x: number; readonly y: number } | null;
  readonly extent?: { readonly top: number; readonly bottom: number } | null;
  readonly answers?: readonly { readonly x: number; readonly y: number }[];
}

/** The ways to set `text`: whole, or cut in two at each space. */
export function lineChoices(text: string): string[][] {
  const choices = [[text]];
  for (let at = text.indexOf(' '); at > 0; at = text.indexOf(' ', at + 1)) {
    choices.push([text.slice(0, at), text.slice(at + 1)]);
  }
  return choices;
}

/** A cut just after a mark reads best: "A lights the oil, / B the water". */
const AFTER_MARK = /[,;:.!?…–—]$/;
/** A cut after a mark wins while its size stays within this share of the largest: sense before size. */
const MARK_SLACK = 0.1;
/** A line of one word this short, alone, reads as a fragment ("Where / should…", "… / go?"). */
const LONE_WORD = 5;

/**
 * The line's layout: whole and as large as fits from `sizes.oneLine` up,
 * else one of the cuts in two (or the whole) from `sizes.min` up. A cut that
 * leaves one short word alone on a line comes last; a cut after a mark wins
 * when its size is within `MARK_SLACK` of the largest; then the largest size,
 * then the most balanced. Null when nothing fits `width` (video px).
 * `widthsAt100` holds each choice's line widths drawn at 100 px; the outline
 * reaches half its width beyond the letters on each side.
 */
export function chooseLayout(
  choices: readonly (readonly string[])[],
  widthsAt100: readonly (readonly number[])[],
  { width, sizes = LINE_SIZE }: { readonly width: number; readonly sizes?: LineSizes },
): LineLayout | null {
  const sizeOf = (widths: readonly number[]) =>
    Math.min(sizes.max, Math.floor(width / (Math.max(...widths) / 100 + OUTLINE)));
  const [first] = choices;
  if (!first) return null;
  const whole = sizeOf(widthsAt100[0] ?? []);
  if (whole >= sizes.oneLine) return { lines: first, size: whole };
  const fits = choices
    .map((lines, i) => ({
      lines,
      size: sizeOf(widthsAt100[i] ?? []),
      longest: Math.max(...(widthsAt100[i] ?? [])),
      marked: lines.length > 1 && AFTER_MARK.test(lines[0] ?? ''),
      lone:
        lines.length > 1 && lines.some((line) => !line.includes(' ') && line.length <= LONE_WORD),
    }))
    .filter(({ size }) => size >= sizes.min);
  // The largest size among the cuts that leave no word alone (among all, when every cut does).
  const clean = fits.filter(({ lone }) => !lone);
  const largest = Math.max(...(clean.length ? clean : fits).map(({ size }) => size));
  const sensible = (fit: (typeof fits)[number]) =>
    fit.marked && fit.size >= largest * (1 - MARK_SLACK);
  const [best] = fits.sort(
    (a, b) =>
      Number(a.lone) - Number(b.lone) ||
      Number(sensible(b)) - Number(sensible(a)) ||
      b.size - a.size ||
      a.longest - b.longest,
  );
  return best ? { lines: best.lines, size: best.size } : null;
}

/** The line's picture in the frame (video px): `widths`, its lines' widths at its size, centred on (x, y). */
export function lineBox(
  { lines, size }: LineLayout,
  widths: readonly number[],
  { x, y }: { readonly x: number; readonly y: number },
): FrameBox {
  const outline = OUTLINE * size;
  const width = Math.ceil(Math.max(...widths) + outline + 2 * LINE_PAD);
  const height = Math.ceil(size * (1 + LINE_SPACING * (lines.length - 1)) + outline + 2 * LINE_PAD);
  return { x: Math.round(x - width / 2), y: Math.round(y - height / 2), width, height };
}

/**
 * What of a clip's peak the line would cover, by name (`peak`, `extent`,
 * `answer A`…): the peak's point, the stretch of height its action reaches,
 * a challenge's letters. Empty when the line is clear of them all.
 */
export function lineCovers(
  box: FrameBox,
  frame: { readonly width: number; readonly height: number },
  peak: FramePeak | null,
): string[] {
  const top = box.y / frame.height;
  const bottom = (box.y + box.height) / frame.height;
  const left = box.x / frame.width;
  const right = (box.x + box.width) / frame.width;
  // The margin is a share of the height; across, the same distance in pixels.
  const across = (POINT_MARGIN * frame.height) / frame.width;
  const near = ({ x, y }: { readonly x: number; readonly y: number }) =>
    x >= left - across &&
    x <= right + across &&
    y >= top - POINT_MARGIN &&
    y <= bottom + POINT_MARGIN;
  const covered: string[] = [];
  if (peak?.at && near(peak.at)) covered.push('peak');
  if (peak?.extent && peak.extent.top <= bottom && peak.extent.bottom >= top)
    covered.push('extent');
  for (const [i, answer] of (peak?.answers ?? []).entries()) {
    if (near(answer)) covered.push(`answer ${String.fromCharCode(65 + i)}`);
  }
  return covered;
}

/** A face of a type in a stylesheet: its file (as `url()` names it), weights and characters. */
export interface FontFaceRule {
  readonly file: string;
  readonly weight: string | null;
  readonly unicodeRange: string | null;
}

/** The `@font-face` rules of `family` in a stylesheet's text (src/styles/fonts.css). */
export function fontFaces(css: string, family: string): FontFaceRule[] {
  const faces: FontFaceRule[] = [];
  for (const [, body = ''] of css.matchAll(/@font-face\s*\{([^}]*)\}/g)) {
    const field = (name: string) =>
      new RegExp(`${name}:\\s*([^;]+);`).exec(body)?.[1]?.replace(/\s+/g, ' ').trim() ?? null;
    if (field('font-family')?.replace(/['"]/g, '') !== family) continue;
    const file = /url\(['"]?([^'")]+)['"]?\)/.exec(field('src') ?? '')?.[1];
    if (file)
      faces.push({ file, weight: field('font-weight'), unicodeRange: field('unicode-range') });
  }
  return faces;
}

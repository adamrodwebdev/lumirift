import { Tone } from '@/core/Tone';
import type { ElementTone } from './Elements';
import type { PieceType } from '@/families/falling/pieces/PieceType';
import type { ElementPace, ScriptedPiece } from './SandGame';

/**
 * The first level's show: within about a minute the player sees what no
 * other sand game has. Three sand pieces to learn linking, then water and a
 * lightning bolt aimed at it (the shock breaks every colour touching the
 * water), then oil and fire (the blaze), then a seed and water (a vine
 * bridging a gap in its colour). Each reacting piece appears right above
 * the element it reacts with: just dropping it is enough to see the show.
 */
export const SHOWCASE: readonly ScriptedPiece[] = [
  { at: 4, tone: Tone.Water, type: 'I' },
  { at: 5, tone: Tone.Lightning, type: 'O', above: true },
  { at: 7, tone: Tone.Oil, type: 'I' },
  { at: 8, tone: Tone.Fire, type: 'O', above: true },
  { at: 10, tone: Tone.Seed, type: 'O' },
  { at: 11, tone: Tone.Water, type: 'O', above: true },
];

/**
 * The second level's practice: the elements the show has just shown, dealt
 * by chance and soon, without wind, so the player tries them alone.
 */
export const PRACTICE_ELEMENTS: readonly ElementTone[] = [
  Tone.Water,
  Tone.Lightning,
  Tone.Oil,
  Tone.Fire,
  Tone.Seed,
];
export const PRACTICE_PACE: ElementPace = { after: 2, chance: 0.35 };

/** The pairs that react, in the order they play: the shock, the blaze, the vine. */
const PAIRS: readonly (readonly [ElementTone, ElementTone])[] = [
  [Tone.Water, Tone.Lightning],
  [Tone.Oil, Tone.Fire],
  [Tone.Seed, Tone.Water],
];
const LONG: PieceType = 'I';
const SQUARE: PieceType = 'O';

/**
 * The elements in pairs (the home's reel, the training's first step): a pair
 * at once, its second piece right above the first, then a piece of sand
 * dealt by chance before the next pair.
 */
export const PAIRS_SCRIPT: readonly ScriptedPiece[] = PAIRS.flatMap(([first, second], k) => [
  { at: k * 3 + 1, tone: first, type: LONG },
  { at: k * 3 + 2, tone: second, type: SQUARE, above: true },
]);

/** The training's encounter: a bolt every other piece, until the Dune Wyrm is struck. */
export const BOLTS_SCRIPT: readonly ScriptedPiece[] = Array.from({ length: 40 }, (_, k) => ({
  at: k * 2 + 1,
  tone: Tone.Lightning,
  type: SQUARE,
}));

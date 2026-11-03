import { Tone } from '@/core/Tone';
import type { ElementTone } from './Elements';
import type { PieceType } from '@/families/falling/pieces/PieceType';
import type { ElementPace, ScriptedPiece } from './SandGame';
import type { SandBed } from './SandBed';

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
/**
 * The practice opens on a bed of sand (1.33): the elements have something to
 * work on at once, and the pile starts high enough for the danger to show.
 */
export const PRACTICE_BED: SandBed = { rows: 4, variant: 2 };

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

/**
 * The Wyrm's fight (level 2-7 and its weekly challenge): from the start, the
 * elements that hurt it, lightning above all (1.33). Before, they came with
 * the game's levels, and lightning only after five links: too late, the sand
 * it throws up won first.
 */
export const WYRM_ELEMENTS: readonly ElementTone[] = [Tone.Lightning, Tone.Water, Tone.Fire];
export const WYRM_PACE: ElementPace = { after: 2, chance: 0.3 };

/**
 * The Wyrm of the training cracks the sand after this long (ms), whatever the
 * player does, and bursts out two seconds later: by 15 s (1.46; 25 s before,
 * and out by 30).
 */
export const HOOK_WYRM_MS = 12_000;

/**
 * The training's pieces fall at this level's pace (1.46): briskly, so that a
 * beginner sees the blaze before the Wyrm, and one who waits does not wait long.
 */
export const HOOK_LEVEL = 4;

/**
 * The training's pieces (1.33): a bolt first, over the water set on the bed,
 * so that it shocks the sand wherever it lands, and low over it, so that the
 * shock comes within moments even if the player does nothing (1.46); the
 * blaze, the fire right above the oil; then a bolt every other piece, so that
 * one is never far when the Wyrm comes out. The vine is left to the
 * campaign's first level (1.46): one step less before the Wyrm.
 */
export const HOOK_SCRIPT: readonly ScriptedPiece[] = [
  { at: 1, tone: Tone.Lightning, type: SQUARE, landsIn: 2 },
  { at: 3, tone: Tone.Oil, type: LONG },
  { at: 4, tone: Tone.Fire, type: SQUARE, above: true },
  ...Array.from({ length: 40 }, (_, k) => ({ at: 6 + k * 2, tone: Tone.Lightning, type: SQUARE })),
];

import type { RandomSource } from '@/core/Random';
import type { Tone } from '@/core/Tone';
import type { Shape } from '@/families/placement/engine/Shape';
import { WEIGHT, type ElementTone } from '@/families/sand/engine/Elements';
import { FEATURED_CHANCE, FEATURED_WEIGHT } from '@/families/sand/engine/SandDealer';
import { DUNES_TONES, type CellMap } from './DunesBoard';
import { DUNES_SHAPES, ELEMENT_SHAPES } from './DunesPieces';

/** A piece of the hand: sand of one colour, or an element. */
export interface OfferedSand {
  /** Unique in a game: a new piece in the hand is a new id. */
  readonly id: number;
  readonly shape: Shape;
  readonly tone: Tone;
}

/** What a hand may hold now: the level's elements, the week's, the one just brought. */
export interface DunesRoster {
  readonly elements: readonly ElementTone[];
  /** The week's element (a free game, 1.36): dealt from the start, and more often. */
  readonly featured: ElementTone | null;
  /** An element the level has just brought: the hand deals it, once. */
  readonly brought: ElementTone | null;
}

/** What a hand is dealt for: the board, what it may hold, how full the board is, the colour it wants. */
export interface DealTable {
  readonly board: CellMap;
  readonly roster: DunesRoster;
  /** The share of the board taken (0 to 1). */
  readonly pressure: number;
  /** The colour closest to linking the walls along the surface, or null. */
  readonly wanted: Tone | null;
  /** The level of the run (1 for D-1): the help fades and the pieces grow as it climbs. */
  readonly level: number;
  /** The colours of sand dealt now (the first of `DUNES_TONES`). */
  readonly colours: number;
}

/** Where the hands come from: the dealer, or a script (a test, a staged scene). */
export interface HandSource {
  hand(table: DealTable): OfferedSand[];
}

export const HAND_SIZE = 3;
/** A piece of sand, not of an element. */
const isSand = (tone: Tone) => DUNES_TONES.includes(tone);
/** The chance that a hand holds an element (never more than one), once there are elements. */
export const ELEMENT_HAND_CHANCE = 0.35;
/** Hands drawn at random before the dealer builds one around a piece that fits. */
const DRAWS = 12;
/**
 * The mercy of Dunes (lot 16's, without a clock): from this share of the
 * board taken, the small pieces come more often and the big ones less, and
 * the colour closest to linking comes more often.
 */
export const MERCY_FROM = 0.55;
/**
 * How often a piece of sand takes the wanted colour: fair randomness (a
 * useful colour, not a lottery), a little on a calm board, more near the top;
 * at D-1, and once the run has climbed (`RAMP_LEVELS`).
 */
export const WANTED_CHANCE = {
  first: { calm: 0.2, top: 0.6 },
  climbed: { calm: 0.1, top: 0.45 },
} as const;
/** The levels over which the help fades and the four-cell pieces come more often (half again). */
export const RAMP_LEVELS = 9;
const BIG_PIECES_GAIN = 0.5;

/** How far into the mercy the board is: 0 below `MERCY_FROM`, 1 when full. */
const mercyOf = (pressure: number) => Math.max(0, (pressure - MERCY_FROM) / (1 - MERCY_FROM));
/** How far the run has climbed: 0 at D-1, 1 from D-10. */
const rampOf = (level: number) => Math.min(1, Math.max(0, (level - 1) / RAMP_LEVELS));
const blend = (from: number, to: number, t: number) => from + (to - from) * t;

/**
 * Deals the hands of Dunes (1.37). Its promise: one piece of the three at
 * least fits the board as it is (whenever a single cell is free). A hand
 * drawn at random is kept when it keeps the promise; after a few misses the
 * dealer builds one around a piece that fits. Its own random source, so a
 * seed deals the same hands whatever the sand does between them.
 */
export class DunesDealer implements HandSource {
  private lastId = 0;

  constructor(private readonly random: RandomSource) {}

  hand(table: DealTable): OfferedSand[] {
    const weights = this.weights(table);
    for (let draw = 0; draw < DRAWS; draw++) {
      const hand = this.draw(table, weights);
      if (hand.some((piece) => table.board.fitsAnywhere(piece.shape))) return hand;
    }
    return this.around(table, weights);
  }

  /** A piece of sand of this shape: the wanted colour now and then, else one drawn at random. */
  private sand(shape: Shape, table: DealTable): OfferedSand {
    const ramp = rampOf(table.level);
    const calm = blend(WANTED_CHANCE.first.calm, WANTED_CHANCE.climbed.calm, ramp);
    const top = blend(WANTED_CHANCE.first.top, WANTED_CHANCE.climbed.top, ramp);
    const chance = blend(calm, top, mercyOf(table.pressure));
    const { wanted } = table;
    const tone =
      wanted !== null && this.random.next() < chance
        ? wanted
        : DUNES_TONES[this.random.nextInt(table.colours)]!;
    return { id: ++this.lastId, shape, tone };
  }

  private element(tone: ElementTone): OfferedSand {
    const shapes = ELEMENT_SHAPES[tone];
    return { id: ++this.lastId, shape: shapes[this.random.nextInt(shapes.length)]!, tone };
  }

  private draw(table: DealTable, weights: readonly number[]): OfferedSand[] {
    const element = this.drawElement(table.roster);
    const slot = element === null ? -1 : this.random.nextInt(HAND_SIZE);
    return Array.from({ length: HAND_SIZE }, (_, index) =>
      index === slot ? this.element(element!) : this.sand(this.shape(weights), table),
    );
  }

  /** The element of this hand, or null: the one just brought comes for sure. */
  private drawElement(roster: DunesRoster): ElementTone | null {
    if (roster.brought !== null) return roster.brought;
    const elements = roster.featured
      ? [...new Set([...roster.elements, roster.featured])]
      : roster.elements;
    if (elements.length === 0) return null;
    const chance = ELEMENT_HAND_CHANCE + (roster.featured === null ? 0 : FEATURED_CHANCE);
    if (this.random.next() >= chance) return null;
    const weightOf = (tone: ElementTone) =>
      WEIGHT[tone] * (tone === roster.featured ? FEATURED_WEIGHT : 1);
    let roll = this.random.next() * elements.reduce((sum, tone) => sum + weightOf(tone), 0);
    for (const tone of elements) {
      roll -= weightOf(tone);
      if (roll < 0) return tone;
    }
    return elements[elements.length - 1]!;
  }

  /** Each shape's weight: the big ones gain as the run climbs; near the top, the small ones gain. */
  private weights({ pressure, level }: DealTable): number[] {
    const mercy = mercyOf(pressure);
    const climb = 1 + BIG_PIECES_GAIN * rampOf(level);
    return DUNES_SHAPES.map(({ shape, weight }) => {
      if (shape.size <= 2) return weight * (1 + 2 * mercy);
      if (shape.size >= 4) return weight * climb * (1 - 0.6 * mercy);
      return weight;
    });
  }

  private shape(weights: readonly number[], allowed?: readonly number[]): Shape {
    const indices = allowed ?? DUNES_SHAPES.map((_, index) => index);
    let roll = this.random.next() * indices.reduce((sum, index) => sum + weights[index]!, 0);
    for (const index of indices) {
      roll -= weights[index]!;
      if (roll < 0) return DUNES_SHAPES[index]!.shape;
    }
    return DUNES_SHAPES[indices[indices.length - 1]!]!.shape;
  }

  /**
   * The promise kept by hand: a piece among those that fit, in a slot drawn
   * at random, the others as they come. When nothing fits (no cell free),
   * a hand as it comes: the game is over anyway.
   */
  private around(table: DealTable, weights: readonly number[]): OfferedSand[] {
    const fitting = DUNES_SHAPES.flatMap((entry, index) =>
      table.board.fitsAnywhere(entry.shape) ? [index] : [],
    );
    const hand = this.draw(table, weights);
    if (fitting.length === 0) return hand;
    // Never in the element's slot: an element just brought still comes.
    const slots = hand.flatMap((piece, index) => (isSand(piece.tone) ? [index] : []));
    const slot = slots[this.random.nextInt(slots.length)]!;
    hand[slot] = this.sand(this.shape(weights, fitting), table);
    return hand;
  }
}

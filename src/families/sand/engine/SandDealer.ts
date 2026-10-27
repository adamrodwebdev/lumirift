import type { RandomSource } from '@/core/Random';
import { Tone } from '@/core/Tone';
import { Bag } from '@/families/falling/pieces/Bag';
import type { PieceType } from '@/families/falling/pieces/PieceType';
import { elementsAt, isElement, WEIGHT, type ElementTone } from './Elements';
import { SAND_TONES } from './SandGrid';

/** At least this many sand pieces between two elements: never a streak of hazards. */
export const ELEMENT_GAP = 3;

/**
 * The week's element (1.36): dealt from the first level, this many times as
 * often as its usual weight, and elements a little more often overall.
 */
export const FEATURED_WEIGHT = 3;
export const FEATURED_CHANCE = 0.05;

export interface PieceSpec {
  readonly type: PieceType;
  readonly tone: Tone;
}

/** When the elements start coming, and the chance of each new piece being one. */
export interface ElementPace {
  /** Pieces dealt before the first element. */
  readonly after: number;
  readonly chance: number;
}

/** A piece the game deals at a given rank (1 = the first piece). */
export interface ScriptedPiece {
  readonly at: number;
  readonly tone: Tone;
  readonly type?: PieceType;
  /** Appears right above where the previous piece landed (so that the two meet). */
  readonly above?: boolean;
}

/** What a game of Sand deals: its elements (if any), their pace, its script, the fire's boost. */
export interface DealRules {
  /** Elements come at all (not in a calm game). */
  readonly hazards: boolean;
  readonly pace: ElementPace;
  /** The elements of this game; null: those of the level reached. */
  readonly elements: readonly ElementTone[] | null;
  /** Pieces dealt by rank, whatever chance says. */
  readonly script: ReadonlyMap<number, ScriptedPiece>;
  /** The ember upgrade: fire comes more often. */
  readonly fireBonus: number;
  /** The week's element (a free game, 1.36), or null. */
  readonly featured: ElementTone | null;
}

/**
 * The pieces of a game of Sand (1.28): shapes from a bag, a colour of sand
 * each, now and then an element (weighted, never two close together, fire
 * boosted by upgrades), or what the script deals at its rank. The queue is
 * filled as far as the preview looks; the game takes the next one.
 */
export class SandDealer {
  private readonly bag: Bag;
  private readonly upcoming: PieceSpec[] = [];
  private dealt = 0;
  /** Sand pieces dealt since the last element. */
  private sinceElement = 0;

  constructor(
    private readonly random: RandomSource,
    private readonly rules: DealRules,
    /** The level reached: it brings its elements. */
    private readonly level: () => number,
  ) {
    this.bag = new Bag(random);
  }

  /** The pieces coming, the next first. */
  preview(count: number): readonly PieceSpec[] {
    this.fill(count);
    return this.upcoming.slice(0, count);
  }

  /** The next piece, left in the queue. */
  peek(): PieceSpec {
    this.fill(1);
    return this.upcoming[0]!;
  }

  /** The next piece, taken off the queue. */
  next(): PieceSpec {
    this.fill(1);
    return this.upcoming.shift()!;
  }

  /** A piece given back (the second chance): it comes again, first. */
  giveBack(spec: PieceSpec): void {
    this.upcoming.unshift(spec);
  }

  /** Colour of each new piece: sand, now and then an element, or what the script says. */
  private fill(count: number): void {
    const { hazards, pace, script } = this.rules;
    while (this.upcoming.length < count) {
      let type = this.bag.next();
      this.dealt++;
      let tone: Tone = SAND_TONES[this.random.nextInt(SAND_TONES.length)]!;
      const scripted = script.get(this.dealt);
      if (scripted) {
        tone = scripted.tone;
        type = scripted.type ?? type;
      } else if (hazards && this.dealt > pace.after && this.sinceElement >= ELEMENT_GAP) {
        const element = this.drawElement();
        if (element !== null) tone = element;
      }
      this.sinceElement = isElement(tone) ? 0 : this.sinceElement + 1;
      this.upcoming.push({ type, tone });
    }
  }

  /**
   * An element now and then, weighted, among those of this level; fire
   * boosted by upgrades, the week's element dealt from the start and more often.
   */
  private drawElement(): ElementTone | null {
    const { pace, fireBonus, featured } = this.rules;
    const level = this.rules.elements ?? elementsAt(this.level());
    const roster = featured === null || level.includes(featured) ? level : [...level, featured];
    const chance = pace.chance + fireBonus + (featured === null ? 0 : FEATURED_CHANCE);
    if (roster.length === 0 || this.random.next() >= chance) return null;
    const weight = (tone: ElementTone) =>
      WEIGHT[tone] *
      (tone === Tone.Fire ? 1 + fireBonus * 10 : 1) *
      (tone === featured ? FEATURED_WEIGHT : 1);
    let roll = this.random.next() * roster.reduce((sum, tone) => sum + weight(tone), 0);
    for (const tone of roster) {
      roll -= weight(tone);
      if (roll < 0) return tone;
    }
    return roster[roster.length - 1]!;
  }
}

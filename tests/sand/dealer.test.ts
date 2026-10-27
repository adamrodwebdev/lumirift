import { describe, expect, it } from 'vitest';
import { SeededRandom } from '@/core/Random';
import { Tone } from '@/core/Tone';
import { isElement, WEIGHT, type ElementTone } from '@/families/sand/engine/Elements';
import { ELEMENT_GAP, SandDealer, type DealRules } from '@/families/sand/engine/SandDealer';

/** Water whenever the gap between two elements allows it. */
const RULES: DealRules = {
  hazards: true,
  pace: { after: 0, chance: 1 },
  elements: [Tone.Water],
  script: new Map(),
  fireBonus: 0,
  featured: null,
};

describe('SandDealer', () => {
  it('shows the next piece, deals it, and deals a piece given back first', () => {
    const dealer = new SandDealer(new SeededRandom(3), RULES, () => 1);
    const next = dealer.peek();
    expect(dealer.preview(3)[0]).toBe(next);
    expect(dealer.next()).toBe(next);
    const after = dealer.peek();
    // The second chance: the piece that could not come in comes again.
    dealer.giveBack(next);
    expect(dealer.next()).toBe(next);
    expect(dealer.next()).toBe(after);
  });

  it('deals what the script says at its rank, then sand before the next element', () => {
    const script = new Map([[1, { at: 1, tone: Tone.Fire, type: 'O' as const }]]);
    const dealer = new SandDealer(new SeededRandom(3), { ...RULES, script }, () => 1);
    const tones = dealer.preview(ELEMENT_GAP + 2).map(({ tone }) => tone);
    expect(dealer.peek()).toEqual({ type: 'O', tone: Tone.Fire });
    expect(tones.slice(1, -1).some(isElement)).toBe(false);
    expect(tones.at(-1)).toBe(Tone.Water);
  });

  it('deals the week’s element from the first level, three times as often as its weight says', () => {
    const free: DealRules = { ...RULES, pace: { after: 0, chance: 0.2 }, elements: null };
    const deal = (featured: ElementTone | null) => {
      const dealer = new SandDealer(new SeededRandom(11), { ...free, featured }, () => 1);
      return Array.from({ length: 6000 }, () => dealer.next().tone).filter(isElement);
    };
    const usual = deal(null);
    const week = deal(Tone.Lightning);
    // Lightning comes at level 2 in an ordinary game; the week's comes at once.
    expect(usual).not.toContain(Tone.Lightning);
    const share = week.filter((tone) => tone === Tone.Lightning).length / week.length;
    const weight = WEIGHT[Tone.Lightning] * 3;
    expect(share).toBeCloseTo(weight / (WEIGHT[Tone.Water] + WEIGHT[Tone.Fire] + weight), 1);
    // And elements come a little more often overall.
    expect(week.length).toBeGreaterThan(usual.length);
  });
});

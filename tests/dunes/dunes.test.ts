import { describe, expect, it } from 'vitest';
import { SeededRandom } from '@/core/Random';
import { CHROMA_TONES, Tone } from '@/core/Tone';
import { DunesSession } from '@/families/dunes';
import {
  CellMap,
  dunesGrid,
  DUNES_COLUMNS,
  DUNES_ROWS,
  DUNES_TONES,
} from '@/families/dunes/engine/DunesBoard';
import {
  DunesDealer,
  HAND_SIZE,
  type DunesRoster,
  type HandSource,
  type OfferedSand,
} from '@/families/dunes/engine/DunesDealer';
import {
  DunesGame,
  FIRST_SWAPS,
  MOST_SWAPS,
  type DealReason,
} from '@/families/dunes/engine/DunesGame';
import { dunesLevel, FIRST_WYRM_LEVEL } from '@/families/dunes/engine/DunesLevels';
import { PlacementStreak, STREAK_GRACE } from '@/families/dunes/engine/PlacementStreak';
import { Shape } from '@/families/placement/engine/Shape';
import { STEP_MS } from '@/families/sand/engine/SandGame';
import { GRAINS_PER_CELL, type SandGrid } from '@/families/sand/engine/SandGrid';
import type { ElementName } from '@/session/Elements';

const G = GRAINS_PER_CELL;
let ids = 0;
const piece = (text: string, tone: Tone = Tone.ChromaA): OfferedSand => ({
  id: ++ids,
  shape: Shape.parse(text),
  tone,
});
const singles = () => Array.from({ length: HAND_SIZE }, () => piece('#'));
/** Hands dealt in this order, then singles. */
const scripted = (...hands: OfferedSand[][]): HandSource => ({
  hand: () => hands.shift() ?? singles(),
});
/** Fills cells (cell coordinates, inclusive) with grains of a tone. */
function fill(grid: SandGrid, tone: Tone, [x0, x1]: [number, number], [y0, y1]: [number, number]) {
  for (let y = y0 * G; y < (y1 + 1) * G; y++) {
    for (let x = x0 * G; x < (x1 + 1) * G; x++) grid.put(x, y, tone, 0);
  }
}
/** Fills cells with sand in stripes a column wide, of two colours: no colour links the walls. */
function stripes(grid: SandGrid, [x0, x1]: [number, number], [y0, y1]: [number, number]) {
  for (let y = y0 * G; y < (y1 + 1) * G; y++) {
    for (let x = x0 * G; x < (x1 + 1) * G; x++) {
      grid.put(x, y, Math.floor(x / G) % 2 === 0 ? Tone.ChromaA : Tone.ChromaB, 0);
    }
  }
}
const play = (game: DunesGame, ms: number) => {
  for (let t = 0; t < ms; t += STEP_MS) game.update(STEP_MS);
};
/** A game past the opening (an empty board), with scripted hands. */
const game = (...hands: OfferedSand[][]) => {
  const dunes = new DunesGame({
    random: new SeededRandom(3),
    startLevel: 2,
    hands: scripted(...hands),
  });
  return dunes;
};

describe('the board of Dunes', () => {
  it('is 9 × 12 cells of 6 × 6 grains; a cell is free only when none of its grains holds anything', () => {
    const grid = dunesGrid();
    expect([grid.width, grid.height]).toEqual([DUNES_COLUMNS * G, DUNES_ROWS * G]);
    grid.put(2 * G + 5, 3 * G, Tone.ChromaB, 0);
    const board = new CellMap(grid);
    expect(board.isFree(2, 3)).toBe(false);
    expect(board.isFree(3, 3)).toBe(true);
    expect(board.fits(Shape.parse('##'), 1, 3)).toBe(false);
    expect(board.fits(Shape.parse('##'), 3, 3)).toBe(true);
    expect(board.freeCells).toBe(DUNES_COLUMNS * DUNES_ROWS - 1);
    expect(board.spots(Shape.parse('##########'))).toEqual([]);
  });
});

describe('the dealer of Dunes', () => {
  it('keeps its promise on 10,000 seeded hands: one piece at least fits whenever a cell is free', () => {
    let hands = 0;
    let filled = 0;
    for (let seed = 1; hands < 10_000; seed++) {
      const random = new SeededRandom(seed);
      const grid = dunesGrid();
      // A rough pile: each column to its own height, some cells left with a grain on top.
      for (let x = 0; x < DUNES_COLUMNS; x++) {
        const height = random.nextInt(DUNES_ROWS + 1);
        if (height > 0) fill(grid, Tone.Garbage, [x, x], [DUNES_ROWS - height, DUNES_ROWS - 1]);
        if (height < DUNES_ROWS && random.next() < 0.3)
          grid.put(x * G + 2, (DUNES_ROWS - height - 1) * G + 5, Tone.Garbage, 0);
      }
      const board = new CellMap(grid);
      const dealer = new DunesDealer(new SeededRandom(seed * 7919));
      const roster = { elements: [Tone.Water, Tone.Fire] as const, featured: null, brought: null };
      for (let k = 0; k < 5; k++, hands++) {
        const hand = dealer.hand({
          board,
          roster: { ...roster, elements: [...roster.elements] },
          pressure: board.filled,
          wanted: null,
          level: 1,
          colours: 3,
        });
        expect(hand).toHaveLength(HAND_SIZE);
        if (board.freeCells === 0) continue;
        filled++;
        expect(hand.some((offered) => board.fitsAnywhere(offered.shape))).toBe(true);
      }
    }
    // Most boards had room: the promise was put to the test.
    expect(filled).toBeGreaterThan(8000);
  });

  it('deals the element a level brings in its first hand, and the week’s element from the first level', () => {
    const board = new CellMap(dunesGrid());
    const dealer = new DunesDealer(new SeededRandom(11));
    const table = (roster: DunesRoster) => ({
      board,
      roster,
      pressure: 0,
      wanted: null,
      level: 1,
      colours: 3,
    });
    const brought = dealer.hand(table({ elements: [], featured: null, brought: Tone.Water }));
    expect(brought.filter((offered) => offered.tone === Tone.Water)).toHaveLength(1);
    let fire = 0;
    for (let k = 0; k < 200; k++) {
      const hand = dealer.hand(table({ elements: [], featured: Tone.Fire, brought: null }));
      fire += hand.filter((offered) => offered.tone === Tone.Fire).length;
      // Never two elements in one hand.
      expect(hand.filter((offered) => !CHROMA_TONES.includes(offered.tone)).length).toBeLessThan(2);
    }
    expect(fire).toBeGreaterThan(40);
  });

  it('deals three colours of sand, the one closest to linking more often near the top', () => {
    const board = new CellMap(dunesGrid());
    const share = (pressure: number) => {
      const dealer = new DunesDealer(new SeededRandom(17));
      const tones: Tone[] = [];
      for (let k = 0; k < 800; k++) {
        const roster = { elements: [], featured: null, brought: null };
        const hand = dealer.hand({
          board,
          roster,
          pressure,
          wanted: Tone.ChromaB,
          level: 1,
          colours: 3,
        });
        tones.push(...hand.map((offered) => offered.tone));
      }
      expect(tones.every((tone) => DUNES_TONES.slice(0, 3).includes(tone))).toBe(true);
      return tones.filter((tone) => tone === Tone.ChromaB).length / tones.length;
    };
    expect(share(0)).toBeGreaterThan(0.4);
    expect(share(0.95)).toBeGreaterThan(share(0) + 0.15);
  });

  it('deals smaller pieces near the top (the mercy)', () => {
    const board = new CellMap(dunesGrid());
    const average = (pressure: number) => {
      const dealer = new DunesDealer(new SeededRandom(5));
      let cells = 0;
      for (let k = 0; k < 600; k++) {
        const hand = dealer.hand({
          board,
          roster: { elements: [], featured: null, brought: null },
          pressure,
          wanted: null,
          level: 1,
          colours: 3,
        });
        cells += hand.reduce((sum, offered) => sum + offered.shape.size, 0);
      }
      return cells / 1800;
    };
    expect(average(0.95)).toBeLessThan(average(0) - 0.3);
  });
});

describe('a game of Dunes', () => {
  it('opens on a bed where the first piece, put on its mark, links the walls; the Wyrm shows itself', () => {
    for (const seed of [1, 2, 3]) {
      const dunes = new DunesGame({ random: new SeededRandom(seed) });
      const goals: number[] = [];
      let teased = false;
      dunes.events.on('goal', ({ level }) => goals.push(level));
      dunes.events.on('tease', () => (teased = true));
      dunes.start();
      const hint = dunes.hint!;
      expect(hint).not.toBeNull();
      expect(dunes.hand[hint.slot]!.shape.size).toBe(2);
      expect(dunes.place(hint.slot, hint.x, hint.y)).toBe(true);
      expect(dunes.hint).toBeNull();
      play(dunes, 3000);
      expect(dunes.clears).toBeGreaterThanOrEqual(1);
      expect(goals).toEqual([1]);
      expect(dunes.level.number).toBe(2);
      expect(dunes.swaps).toBe(FIRST_SWAPS + 1);
      expect(teased).toBe(true);
    }
  });

  it('crumbles a piece into its grains where it is put, and only where it fits', () => {
    const dunes = game([piece('#'), piece('##'), piece('###')]);
    dunes.start();
    expect(dunes.place(0, 0, 0)).toBe(true);
    expect(dunes.grid.grainCount()).toBe(G * G);
    expect(dunes.place(1, 0, 0)).toBe(false);
    expect(dunes.place(1, 8, 0)).toBe(false);
    expect(dunes.place(1, 7, 0)).toBe(true);
    expect(dunes.hand.filter((held) => held !== null)).toHaveLength(1);
  });

  it('deals the next hand once the three pieces are down and the sand has settled', () => {
    const second = [piece('##|##'), piece('#'), piece('##')];
    const dunes = game([piece('#'), piece('#'), piece('#')], second);
    dunes.start();
    dunes.place(0, 0, 0);
    dunes.place(1, 4, 0);
    dunes.place(2, 8, 0);
    expect(dunes.dealing).toBe(true);
    play(dunes, 1500);
    expect(dunes.dealing).toBe(false);
    expect(dunes.hand).toEqual(second);
  });

  it('deals again a hand that fits nowhere before any piece of it is down: the dealer’s promise', () => {
    const squares = [piece('##|##'), piece('##|##'), piece('##|##')];
    const dunes = game(squares);
    // A flat pile up to the top row: only pieces one cell high still fit.
    stripes(dunes.grid, [0, 8], [1, 11]);
    const reasons: DealReason[] = [];
    dunes.events.on('deal', ({ reason }) => reasons.push(reason));
    dunes.start();
    play(dunes, 200);
    expect(reasons).toEqual(['deal', 'promise']);
    expect(dunes.fitting().some(Boolean)).toBe(true);
    expect(dunes.state).toBe('running');
  });

  it('waits for a swap when no piece fits, and ends with none left; a continue blows the top away', () => {
    const dunes = game(
      [piece('####'), piece('##|##'), piece('##|##')],
      [piece('##|##'), piece('#'), piece('#')],
    );
    stripes(dunes.grid, [0, 8], [1, 11]);
    const session = new DunesSession('dunes', dunes);
    const reasons: string[] = [];
    session.events.on('over', ({ reason }) => reasons.push(reason));
    dunes.start();
    // One row left: the bar goes in, the squares fit nowhere, a swap is in hand.
    expect(dunes.place(0, 0, 0)).toBe(true);
    play(dunes, 500);
    expect(dunes.state).toBe('running');
    expect(dunes.board().freeCells).toBeGreaterThan(0);
    expect(dunes.swap()).toBe(true);
    expect(dunes.swaps).toBe(FIRST_SWAPS - 1);
    // The new hand: the singles go in, then its square fits nowhere and no swap is left.
    for (const slot of [1, 2]) {
      const [spot] = dunes.board().spots(dunes.hand[slot]!.shape);
      expect(dunes.place(slot, spot!.x, spot!.y)).toBe(true);
    }
    play(dunes, 500);
    expect(dunes.state).toBe('over');
    expect(reasons).toEqual(['noMoves']);
    expect(session.revivable).toBe(true);
    const before = dunes.grid.grainCount();
    session.revive();
    expect(dunes.state).toBe('running');
    expect(before - dunes.grid.grainCount()).toBeGreaterThanOrEqual(5 * DUNES_COLUMNS * G * G);
    expect(dunes.fitting().some(Boolean)).toBe(true);
  });

  it('fights the Wyrm at its level; defeated, it opens the next level and earns a swap', () => {
    const dunes = new DunesGame({
      random: new SeededRandom(9),
      startLevel: FIRST_WYRM_LEVEL,
      hands: scripted(),
    });
    dunes.start();
    const worm = dunes.worm!;
    expect(worm).not.toBeNull();
    expect(dunes.isShowing).toBe(false);
    while (worm.health > 0) worm.hit('boltHead');
    play(dunes, 50);
    expect(dunes.level.number).toBe(FIRST_WYRM_LEVEL + 1);
    expect(dunes.worm).toBeNull();
    expect(dunes.swaps).toBe(FIRST_SWAPS + 1);
  });

  it('never holds more than three swaps', () => {
    const dunes = game();
    dunes.start();
    // Regions cleared one after another: each goal reached earns a swap.
    for (let k = 0; k < 6; k++) {
      fill(dunes.grid, Tone.ChromaC, [0, 8], [11, 11]);
      play(dunes, 100);
    }
    expect(dunes.level.number).toBeGreaterThan(3);
    expect(dunes.swaps).toBe(MOST_SWAPS);
  });

  it('counts the elements’ deeds for the week’s goal, as in Sand: water poured, fire burning sand', () => {
    const dunes = game([piece('###', Tone.Water), piece('##', Tone.Fire), piece('#')]);
    fill(dunes.grid, Tone.ChromaB, [0, 3], [10, 11]);
    const session = new DunesSession('dunes', dunes);
    const deeds: ElementName[] = [];
    session.events.on('element', ({ element }) => deeds.push(element));
    dunes.start();
    dunes.place(0, 6, 0);
    const before = dunes.grid.grainCount();
    // Fire put over the band falls onto it and burns it.
    dunes.place(1, 1, 2);
    expect(dunes.grid.grainCount()).toBeLessThan(before);
    expect(deeds).toEqual(['water', 'fire']);
  });
});

describe('the levels of Dunes', () => {
  it('bring the elements in the Sand’s order, the Wyrm at D-5 and D-10, then every fifth level', () => {
    expect(dunesLevel(1)).toMatchObject({ goal: { kind: 'regions', target: 1 }, elements: [] });
    expect(dunesLevel(3).elements).toEqual([Tone.Water, Tone.Fire]);
    expect(dunesLevel(9).elements).toHaveLength(7);
    expect(FIRST_WYRM_LEVEL).toBe(5);
    expect(dunesLevel(10).goal.kind).toBe('wyrm');
    for (const n of [15, 20, 25]) expect(dunesLevel(n).goal.kind).toBe('wyrm');
    for (const n of [11, 12, 13, 14]) expect(dunesLevel(n).goal.kind).not.toBe('wyrm');
    expect(dunesLevel(40).elements).toHaveLength(7);
  });
});

describe('the chain of Dunes', () => {
  it('counts pieces, not seconds: a clear raises it, pieces without one use its grace', () => {
    const streak = new PlacementStreak();
    expect(streak.clear()).toBe(1);
    expect(streak.clear()).toBe(2);
    expect(streak.placed()).toBe(0);
    for (let k = 0; k < STREAK_GRACE; k++) expect(streak.placed()).toBe(0);
    expect(streak.fill).toBeCloseTo(1 / (STREAK_GRACE + 1));
    expect(streak.placed()).toBe(2);
    expect(streak.next).toBe(1);
  });
});

import { describe, expect, it, vi } from 'vitest';
import type { Indicator } from '@/session/GameSession';
import type { Game } from '@/families/falling/game/Game';
import { Piece } from '@/families/falling/pieces/Piece';
import { CHROMA_TONES, Tone } from '@/families/falling/pieces/PieceType';
import { ChromaMode } from '@/families/falling/modes/ChromaMode';
import { ClassicMode } from '@/families/falling/modes/ClassicMode';
import { FLIP_MAX_CHARGES, FlipMode } from '@/families/falling/modes/FlipMode';
import { MIRROR_WARNING_MS, MirrorMode } from '@/families/falling/modes/MirrorMode';
import {
  TIDE_DELAY_PER_LINE_MS,
  TIDE_INTERVAL_STEP_MS,
  TIDE_START_INTERVAL_MS,
  TideMode,
} from '@/families/falling/modes/TideMode';
import { startedGame } from './helpers';

const indicator = (game: Game, id: string): number | undefined =>
  game.mode.indicators(game).find((item: Indicator) => item.id === id)?.value;

/** Simulates a clear as the engine reports it (for rules that only listen to events). */
const reportClear = (game: Game, lines: number, cascade = false) =>
  game.events.emit('clear', {
    lines,
    pureLines: 0,
    points: 100 * lines,
    combo: 0,
    cascade,
    rows: [],
  });

const row = (pattern: string, count: number): string[] => Array<string>(count).fill(pattern);
/** Ten lines ready to clear in cascade with a single flip of the well. */
const TEN_LINES = [...row('.........#', 10), ...row('#########.', 10)];

describe('time limit (daily challenge)', () => {
  it('ends the game when the time is up and shows the time left', () => {
    const game = startedGame({ mode: new ClassicMode({ timeLimitMs: 2000 }) });
    game.update(1500);
    expect(indicator(game, 'timeLeft')).toBe(500);
    game.update(500);
    game.update(16);
    expect(game.state).toBe('over');
    expect(game.overReason).toBe('timeUp');
  });

  it('shows no timer in an endless game', () => {
    const game = startedGame();
    expect(indicator(game, 'timeLeft')).toBeUndefined();
  });
});

describe('TideMode', () => {
  it('raises a garbage row after ten seconds, then a little faster each time', () => {
    const game = startedGame({ mode: new TideMode() });
    game.update(TIDE_START_INTERVAL_MS - 1);
    expect(indicator(game, 'rowsRisen')).toBe(0);
    game.update(1);
    expect(indicator(game, 'rowsRisen')).toBe(1);
    expect(game.board.toRows().at(-1)?.replaceAll('#', '')).toHaveLength(1);
    expect(indicator(game, 'nextRise')).toBe(TIDE_START_INTERVAL_MS - TIDE_INTERVAL_STEP_MS);
  });

  it('delays the next rise by one second per cleared line', () => {
    const game = startedGame({ mode: new TideMode(), rows: ['###....###'] });
    game.hardDrop();
    expect(indicator(game, 'nextRise')).toBe(TIDE_START_INTERVAL_MS + TIDE_DELAY_PER_LINE_MS);
  });

  it('is ranked on the time survived', () => {
    const game = startedGame({ mode: new TideMode() });
    game.update(1234);
    expect(game.mode.result).toBe('time');
    expect(game.mode.resultValue(game)).toBe(1234);
  });

  it('ends when the stack reaches the top', () => {
    const game = startedGame({ mode: new TideMode() });
    for (let i = 0; i < 40 && game.state === 'running'; i++) game.update(10_000);
    expect(game.state).toBe('over');
    expect(game.overReason).toMatch(/topOut|blockOut|lockOut/);
  });
});

describe('FlipMode', () => {
  it('starts with one charge and spends it to flip the well', () => {
    const game = startedGame({ mode: new FlipMode(), rows: ['.........#', '#########.'] });
    expect(indicator(game, 'charges')).toBe(1);
    expect(game.useAbility()).toBe(true);
    expect(game.lines).toBe(1);
    expect(indicator(game, 'charges')).toBe(0);
    expect(game.useAbility()).toBe(false);
  });

  it('earns a charge every ten lines, up to the maximum', () => {
    const game = startedGame({ mode: new FlipMode() });
    const onNotice = vi.fn();
    game.events.on('notice', onNotice);
    reportClear(game, 4);
    expect(indicator(game, 'nextCharge')).toBe(6);
    reportClear(game, 4);
    reportClear(game, 4);
    expect(indicator(game, 'charges')).toBe(2);
    expect(onNotice).toHaveBeenCalledWith({ id: 'chargeGained', value: 2 });
    reportClear(game, 4);
    reportClear(game, 4);
    expect(indicator(game, 'charges')).toBe(FLIP_MAX_CHARGES);
  });

  it('does not refill charges with cascade lines', () => {
    const game = startedGame({ mode: new FlipMode() });
    reportClear(game, 10, true);
    expect(indicator(game, 'charges')).toBe(1);
  });

  it('exposes its ability', () => {
    expect(new FlipMode().ability).toBe('flip');
    expect(new ClassicMode().ability).toBeNull();
  });
});

describe('ChromaMode', () => {
  it('deals colours independently of shapes', () => {
    const game = startedGame({ mode: new ChromaMode() });
    expect(CHROMA_TONES).toContain(game.active?.tone);
  });

  it('scores a pure line four times', () => {
    // The constant test random always deals the last chroma colour.
    const tone = CHROMA_TONES.at(-1)!;
    const game = startedGame({ mode: new ChromaMode() });
    const onNotice = vi.fn();
    game.events.on('notice', onNotice);
    const bottom = game.board.height - 2; // the pieces' lower row on the floor
    game.board.lock(new Piece('L', tone, 0, bottom)); // bottom row: columns 0 to 2
    game.board.lock(new Piece('J', tone, 7, bottom)); // bottom row: columns 7 to 9
    game.hardDrop(); // the I fills columns 3 to 6
    expect(game.lines).toBe(1);
    // The I falls the well's height less one, two points a row.
    expect(game.score).toBe(2 * (game.board.height - game.board.hiddenRows - 1) + 400);
    expect(indicator(game, 'pureLines')).toBe(1);
    expect(onNotice).toHaveBeenCalledWith({ id: 'pureLine', value: 1 });
  });
});

describe('MirrorMode', () => {
  it('warns, then reflects the well after ten lines', () => {
    const game = startedGame({ mode: new MirrorMode(), rows: TEN_LINES });
    const onNotice = vi.fn();
    const onMirror = vi.fn();
    game.events.on('notice', onNotice);
    game.events.on('mirror', onMirror);
    game.moveLeft(); // the I now spans columns 2 to 5
    game.flipWell(); // ten lines at once
    expect(onNotice).toHaveBeenCalledWith({ id: 'mirrorSoon', value: MIRROR_WARNING_MS });
    expect(indicator(game, 'mirrorIn')).toBe(MIRROR_WARNING_MS);

    game.update(MIRROR_WARNING_MS);
    expect(onMirror).toHaveBeenCalledOnce();
    expect(game.active?.x).toBe(4); // columns 4 to 7
    expect(indicator(game, 'nextMirror')).toBe(10);
  });

  it('doubles the points of lines cleared just after a reflection', () => {
    const game = startedGame({ mode: new MirrorMode(), rows: TEN_LINES });
    game.flipWell();
    game.update(MIRROR_WARNING_MS);
    const before = game.score;
    reportClear(game, 1);
    expect(game.score - before).toBe(100);
    expect(indicator(game, 'reflex')).toBeGreaterThan(0);
  });

  it('gives no bonus outside the reflex window', () => {
    const game = startedGame({ mode: new MirrorMode() });
    reportClear(game, 1);
    expect(game.score).toBe(0);
  });
});

describe('Piece.mirrored', () => {
  it('turns each piece into its mirror twin, cell for cell', () => {
    for (const type of ['I', 'O', 'T', 'S', 'Z', 'J', 'L'] as const) {
      for (const rotation of [0, 1, 2, 3] as const) {
        const piece = new Piece(type, Tone[type], 2, 5, rotation);
        const mirrored = piece.mirrored(10);
        const expected = piece
          .cells()
          .map(({ x, y }) => `${9 - x},${y}`)
          .sort();
        expect(
          mirrored
            .cells()
            .map(({ x, y }) => `${x},${y}`)
            .sort(),
        ).toEqual(expected);
      }
    }
  });

  it('swaps S and Z, J and L, and their shape colours', () => {
    const s = new Piece('S', Tone.S, 0, 0).mirrored(10);
    expect(s.type).toBe('Z');
    expect(s.tone).toBe(Tone.Z);
    const chromaJ = new Piece('J', Tone.ChromaB, 0, 0).mirrored(10);
    expect(chromaJ.type).toBe('L');
    expect(chromaJ.tone).toBe(Tone.ChromaB);
  });
});

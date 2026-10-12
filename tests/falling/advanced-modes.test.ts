import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { Game } from '@/families/falling/game/Game';
import { FusionMode, FUSION_GROUP } from '@/families/falling/modes/FusionMode';
import {
  RHYTHM_BASE_BPM,
  RHYTHM_BPM_PER_LEVEL,
  RHYTHM_MAX_GROOVE,
  RhythmMode,
} from '@/families/falling/modes/RhythmMode';
import {
  SILHOUETTE_OUTSIDE_POINTS,
  SILHOUETTE_PERFECT_BONUS,
  SilhouetteMode,
} from '@/families/falling/modes/SilhouetteMode';
import { SILHOUETTES, silhouetteArea, silhouetteOfDay } from '@/families/falling/modes/silhouettes';
import { TILT_WARNING_MS, TILT_WELL, TiltMode } from '@/families/falling/modes/TiltMode';
import type { Piece } from '@/families/falling/pieces/Piece';
import { Tone } from '@/families/falling/pieces/PieceType';
import { ConstantRandom, startedGame } from './helpers';

/** Direct access to the cells, to set up a well quickly. */
const cellsOf = (game: Game) => (game.board as unknown as { cells: Uint8Array }).cells;

const indicator = (game: Game, id: string) =>
  game.mode.indicators(game).find((item) => item.id === id)?.value;

describe('FusionMode', () => {
  it('needs more blocks than a single piece holds', () => {
    expect(FUSION_GROUP).toBeGreaterThan(4);
  });

  it('fuses two touching pieces of one colour', () => {
    // The constant random deals every piece in the same colour.
    const game = startedGame({ mode: new FusionMode() });
    const onFusion = vi.fn();
    game.events.on('fusion', onFusion);
    game.hardDrop(); // I: four blocks, no fusion
    expect(onFusion).not.toHaveBeenCalled();
    game.hardDrop(); // O lands on the I: eight blocks of one colour
    expect(onFusion).toHaveBeenCalledWith(expect.objectContaining({ chain: 1, points: 80 }));
    expect(game.board.blockCount()).toBe(0);
    expect(indicator(game, 'fused')).toBe(8);
  });

  it('chains reactions: the blocks that fall form a new group', () => {
    const game = startedGame({ mode: new FusionMode() });
    const cells = cellsOf(game);
    const W = game.board.width;
    const put = (x: number, y: number, tone: number) => (cells[y * W + x] = tone);
    for (let x = 0; x < 4; x++) put(x, 21, Tone.ChromaA); // four A on the floor
    for (let x = 0; x < 6; x++) put(x, 20, Tone.ChromaB); // six B: the first fusion
    put(0, 19, Tone.ChromaA); // two A that fall onto the floor ones: the second
    put(1, 19, Tone.ChromaA);
    const chains: number[] = [];
    const onNotice = vi.fn();
    game.events.on('fusion', ({ chain }) => chains.push(chain));
    game.events.on('notice', onNotice);
    game.moveRight();
    game.moveRight();
    game.moveRight();
    game.hardDrop(); // any lock starts the resolution
    expect(chains).toEqual([1, 2]);
    expect(indicator(game, 'bestChain')).toBe(2);
    expect(onNotice).toHaveBeenCalledWith({ id: 'chain', value: 2 });
  });
});

describe('TiltMode', () => {
  it('plays in a square well', () => {
    const game = startedGame({ mode: new TiltMode() });
    expect(game.board.width).toBe(TILT_WELL.width);
    expect(game.board.height - game.board.hiddenRows).toBe(TILT_WELL.height);
  });

  it('turns the well left: the left wall becomes the floor and clears', () => {
    const game = startedGame({ mode: new TiltMode() });
    const cells = cellsOf(game);
    const { width, height, hiddenRows } = game.board;
    for (let y = hiddenRows; y < height; y++) cells[y * width] = Tone.Garbage;
    const before = game.active?.type;
    const onTilt = vi.fn();
    game.events.on('tilt', onTilt);
    game.tiltWell();
    expect(onTilt).toHaveBeenCalledWith({ lines: 1 });
    expect(game.board.blockCount()).toBe(0);
    expect(game.active?.type).toBe(before); // the falling piece is dealt again
  });

  it('warns three seconds before turning, every ten lines', () => {
    const game = startedGame({ mode: new TiltMode() });
    const cells = cellsOf(game);
    const { width, height } = game.board;
    // Ten full rows: the next resolution clears them all at once.
    for (let y = height - 10; y < height; y++)
      for (let x = 0; x < width; x++) cells[y * width + x] = 1;
    const onNotice = vi.fn();
    const onTilt = vi.fn();
    game.events.on('notice', onNotice);
    game.events.on('tilt', onTilt);
    game.flipWell();
    expect(onNotice).toHaveBeenCalledWith({ id: 'tiltSoon', value: TILT_WARNING_MS });
    expect(indicator(game, 'tiltIn')).toBe(TILT_WARNING_MS);
    game.update(TILT_WARNING_MS);
    expect(onTilt).toHaveBeenCalledOnce();
    expect(indicator(game, 'nextTilt')).toBe(10);
  });
});

describe('SilhouetteMode', () => {
  const setup = () => {
    const mode = new SilhouetteMode({ today: new Date(2026, 9, 12) });
    const game = new Game(mode, { random: new ConstantRandom() });
    game.start();
    return { mode, game };
  };

  /** A fake piece covering the given board cells. */
  const pieceOn = (cells: { x: number; y: number }[]) =>
    ({ cells: () => cells }) as unknown as Piece;

  it('places the silhouette of the day at the bottom of the well', () => {
    const { mode, game } = setup();
    expect(mode.silhouette).toBe(silhouetteOfDay(new Date(2026, 9, 12)));
    expect(mode.target.size).toBe(mode.area);
    expect(Math.max(...mode.target) / game.board.width).toBeGreaterThan(game.board.height - 1);
    expect(mode.subtitleKey()).toBe(`silhouettes.${mode.silhouette.id}`);
  });

  it('never clears rows and gives no points for drops', () => {
    const { game } = setup();
    expect(game.mode.clearsLines).toBe(false);
    expect(game.mode.scoresDrops).toBe(false);
  });

  it('rewards blocks inside the shape and charges blocks outside', () => {
    const { mode, game } = setup();
    const inside = [...mode.target].slice(0, 4).map((i) => ({ x: i % 10, y: Math.floor(i / 10) }));
    game.events.emit('lock', { piece: pieceOn(inside) });
    expect(game.score).toBe(40);
    game.events.emit('lock', { piece: pieceOn([{ x: 0, y: 2 }]) });
    expect(game.score).toBe(40 + SILHOUETTE_OUTSIDE_POINTS);
    expect(indicator(game, 'outside')).toBe(1);
  });

  it('ends when the pieces run out', () => {
    const { mode, game } = setup();
    for (let i = 0; i < mode.pieceLimit; i++) game.events.emit('lock', { piece: pieceOn([]) });
    mode.afterLock(game);
    expect(game.overReason).toBe('outOfPieces');
  });

  it('ends with a bonus on a perfect fill', () => {
    const { mode, game } = setup();
    const all = [...mode.target].map((i) => ({ x: i % 10, y: Math.floor(i / 10) }));
    game.events.emit('lock', { piece: pieceOn(all) });
    mode.afterLock(game);
    expect(game.overReason).toBe('shapeComplete');
    expect(game.score).toBe(mode.area * 10 + SILHOUETTE_PERFECT_BONUS);
  });
});

describe('Silhouette library', () => {
  it('holds at least 30 well-formed, distinct shapes', () => {
    expect(SILHOUETTES.length).toBeGreaterThanOrEqual(30);
    expect(new Set(SILHOUETTES.map((s) => s.id)).size).toBe(SILHOUETTES.length);
    for (const silhouette of SILHOUETTES) {
      expect(silhouette.rows.length, silhouette.id).toBeLessThanOrEqual(12);
      for (const row of silhouette.rows) expect(row, silhouette.id).toMatch(/^[#.]{1,10}$/);
      expect(silhouetteArea(silhouette), silhouette.id).toBeGreaterThanOrEqual(20);
    }
  });

  it('names every silhouette in every language', () => {
    for (const locale of ['fr', 'en', 'id']) {
      const messages = JSON.parse(
        readFileSync(new URL(`../../src/i18n/locales/${locale}.json`, import.meta.url), 'utf8'),
      ) as { silhouettes: Record<string, string> };
      for (const { id } of SILHOUETTES)
        expect(messages.silhouettes[id], `${locale} ${id}`).toBeTruthy();
    }
  });

  it('changes every day and is the same all day', () => {
    expect(silhouetteOfDay(new Date(2026, 9, 12, 1))).toBe(
      silhouetteOfDay(new Date(2026, 9, 12, 23)),
    );
    expect(silhouetteOfDay(new Date(2026, 9, 12))).not.toBe(silhouetteOfDay(new Date(2026, 9, 13)));
  });
});

describe('RhythmMode', () => {
  it('beats at 100 per minute, faster with each level', () => {
    const game = startedGame({ mode: new RhythmMode() });
    const beats: number[] = [];
    game.events.on('beat', ({ count }) => beats.push(count));
    game.update(600);
    game.update(600);
    expect(beats).toEqual([1, 2]);
    expect(indicator(game, 'bpm')).toBe(RHYTHM_BASE_BPM);
    expect(RHYTHM_BPM_PER_LEVEL).toBeGreaterThan(0);
  });

  it('raises the groove on the beat and multiplies the line points', () => {
    const game = startedGame({ mode: new RhythmMode(), rows: ['###....###'] });
    const onGroove = vi.fn();
    game.events.on('groove', onGroove);
    game.update(600); // exactly on a beat
    game.hardDrop();
    expect(onGroove).toHaveBeenCalledWith({ level: 2, onBeat: true });
    expect(game.score).toBe(38 + 100 * 2);
  });

  it('resets the groove off the beat', () => {
    const game = startedGame({ mode: new RhythmMode() });
    game.update(600);
    game.hardDrop();
    game.update(300); // half-way between two beats
    game.hardDrop();
    expect(indicator(game, 'groove')).toBe(1);
  });

  it('announces the maximum groove once', () => {
    const game = startedGame({ mode: new RhythmMode() });
    const onNotice = vi.fn();
    game.events.on('notice', onNotice);
    for (let i = 0; i < RHYTHM_MAX_GROOVE + 1; i++) {
      game.update(600);
      game.hardDrop();
    }
    expect(indicator(game, 'groove')).toBe(RHYTHM_MAX_GROOVE);
    expect(onNotice).toHaveBeenCalledTimes(1);
    expect(onNotice).toHaveBeenCalledWith({ id: 'grooveMax', value: RHYTHM_MAX_GROOVE });
  });
});

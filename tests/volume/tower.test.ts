import { describe, expect, it } from 'vitest';
import { SeededRandom } from '@/core/Random';
import { Board } from '@/families/falling/board/Board';
import { FallingSession } from '@/families/falling/FallingSession';
import { Game } from '@/families/falling/game/Game';
import { ClassicMode } from '@/families/falling/modes/ClassicMode';
import { Piece } from '@/families/falling/pieces/Piece';
import { Tone } from '@/families/falling/pieces/PieceType';
import { CylinderProjection } from '@/families/volume/camera/CylinderProjection';
import { TowerCamera } from '@/families/volume/camera/TowerCamera';
import { createVolumeSession } from '@/families/volume';
import { TOWER_WELL, TowerMode } from '@/families/volume/TowerMode';
import { ConstantRandom } from '../falling/helpers';

const ring = () => new Board(20, 16, Board.HIDDEN_ROWS, true);

describe('Board that wraps around', () => {
  it('has no side walls: a piece fits across the seam', () => {
    const board = ring();
    const piece = new Piece('I', Tone.I, 18, 10);
    expect(board.fits(piece)).toBe(true);
    expect(board.fits(piece, -40)).toBe(true);
    expect(new Board(20, 16).fits(piece)).toBe(false);
  });

  it('locks the cells beyond the last column into the first ones', () => {
    const board = ring();
    const piece = new Piece('I', Tone.I, 18, 10);
    board.lock(piece);
    const y = piece.cells()[0]!.y;
    expect([18, 19, 0, 1].map((x) => board.get(x, y))).toEqual([Tone.I, Tone.I, Tone.I, Tone.I]);
    expect(board.get(2, y)).toBe(Tone.Empty);
    // A piece across the seam now collides with them.
    expect(board.isFree(-1, y)).toBe(false);
    expect(board.isFree(21, y)).toBe(false);
  });

  it('clears a full ring of 20 cells, and keeps wrapping when cloned', () => {
    const board = ring();
    const y = board.height - 1;
    for (let x = 0; x < 20; x += 4) board.lock(new Piece('I', Tone.I, x - 1, y - 1));
    const filled = [...Array(20).keys()].every((x) => board.get(x, y) !== Tone.Empty);
    expect(filled).toBe(true);
    expect(board.clearFullRows()).toHaveLength(1);
    expect(board.blockCount()).toBe(0);
    expect(board.clone().wraps).toBe(true);
  });

  it('reports the column of any position', () => {
    const board = ring();
    expect(board.column(-1)).toBe(19);
    expect(board.column(20)).toBe(0);
    expect(board.column(-41)).toBe(19);
    expect(new Board().column(-1)).toBe(-1);
  });
});

describe('TowerMode', () => {
  it('plays the falling engine on a 20 × 16 cylinder', () => {
    const game = new Game(new TowerMode(), { random: new ConstantRandom() });
    game.start();
    expect(game.board.width).toBe(TOWER_WELL.width);
    expect(game.board.height - game.board.hiddenRows).toBe(16);
    expect(game.board.wraps).toBe(true);
    // No wall stops the piece: it goes round and round.
    for (let i = 0; i < 30; i++) expect(game.moveLeft()).toBe(true);
  });

  it('brings the next piece above the place the last one landed, not back to the start', () => {
    const game = new Game(new TowerMode(), { random: new ConstantRandom() });
    game.start();
    const start = game.active!.centre;
    for (let i = 0; i < 7; i++) game.moveLeft();
    const landed = game.board.column(Math.floor(game.active!.centre)) + 0.5;
    game.hardDrop();
    const next = game.active!;
    expect(Math.abs(next.centre - landed)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(next.centre - start)).toBeGreaterThan(5);
  });

  it('keeps spawning in the middle of a well with walls', () => {
    const game = new Game(new ClassicMode(), { random: new ConstantRandom() });
    game.start();
    for (let i = 0; i < 3; i++) game.moveLeft();
    game.hardDrop();
    const next = game.active!;
    expect(next.x).toBe(Piece.spawn(next.type, next.tone, game.board.width).x);
  });

  it('is created by the volume family as a falling session of the volume family', () => {
    const session = createVolumeSession('tower', {
      random: new SeededRandom(3),
      timeLimitMs: null,
    });
    expect(session).toBeInstanceOf(FallingSession);
    expect(session.family).toBe('volume');
    expect(session.modeId).toBe('tower');
    expect(() =>
      createVolumeSession('classic', { random: new SeededRandom(3), timeLimitMs: null }),
    ).toThrow();
  });
});

describe('TowerCamera', () => {
  it('eases towards the piece, and jumps there without motion', () => {
    const camera = new TowerCamera(20, 10);
    camera.follow(14);
    camera.update(16, true);
    expect(camera.position).toBeGreaterThan(10);
    expect(camera.position).toBeLessThan(14);
    camera.update(16, false);
    expect(camera.position).toBeCloseTo(14);
  });

  it('turns the short way round', () => {
    const camera = new TowerCamera(20, 1);
    camera.follow(19);
    camera.update(16, true);
    // From 1 to 19 the short way is backwards, through 0.
    expect(camera.position).toBeLessThan(1);
    camera.update(1000, true);
    expect(camera.position).toBeCloseTo(19, 1);
    camera.follow(-39); // the same column, many turns away
    camera.update(1000, true);
    expect(camera.position).toBeCloseTo(1, 1);
  });

  it('turns by hand until the next piece', () => {
    const camera = new TowerCamera(20, 10);
    camera.follow(10);
    camera.turn(5);
    camera.update(0, false);
    expect(camera.position).toBeCloseTo(15);
    camera.recentre();
    camera.update(0, false);
    expect(camera.position).toBeCloseTo(10);
  });
});

describe('CylinderProjection', () => {
  const projection = new CylinderProjection(20, 16);
  projection.layout(100);
  projection.camera = 5;

  it('shows the camera column face on, in the middle, and hides the opposite one', () => {
    expect(projection.screenX(5)).toBeCloseTo(100);
    expect(projection.depth(5)).toBeCloseTo(1);
    expect(projection.depth(15)).toBeCloseTo(-1);
    expect(projection.depth(10)).toBeCloseTo(0);
    // Columns shrink towards the edges.
    const width = (x: number) => projection.screenX(x + 1) - projection.screenX(x);
    expect(width(5)).toBeGreaterThan(width(8));
  });

  it('is periodic: a position and the same one a turn away look the same', () => {
    expect(projection.screenX(27)).toBeCloseTo(projection.screenX(7));
    expect(projection.screenY(-13, 4)).toBeCloseTo(projection.screenY(7, 4));
  });

  it('maps the unit square onto a face', () => {
    const [a, b, c, d, e, f] = projection.face(4, 2, 1);
    expect(e).toBeCloseTo(projection.screenX(4));
    expect(f).toBeCloseTo(projection.screenY(4, 2));
    expect(e + a).toBeCloseTo(projection.screenX(5));
    expect(f + b).toBeCloseTo(projection.screenY(5, 2));
    expect(c).toBe(0);
    expect(d).toBeCloseTo(projection.rowHeight);
  });

  it('fits the whole tower in the box it is given', () => {
    const radius = CylinderProjection.fit(20, 16, 400, 900);
    const size = CylinderProjection.size(20, 16, radius);
    expect(size.width).toBeLessThanOrEqual(400.001);
    expect(size.height).toBeLessThanOrEqual(900.001);
  });
});

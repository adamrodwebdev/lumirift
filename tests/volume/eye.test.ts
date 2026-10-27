import { describe, expect, it, vi } from 'vitest';
import { SeededRandom } from '@/core/Random';
import { Tone } from '@/core/Tone';
import { Board } from '@/families/falling/board/Board';
import type { FallingSession } from '@/families/falling/FallingSession';
import { Game } from '@/families/falling/game/Game';
import { createVolumeSession } from '@/families/volume';
import {
  BLIND_DAMAGE,
  BLIND_MS,
  BOMB_DAMAGE,
  ringDamage,
  TowerEye,
} from '@/families/volume/TowerEye';
import { TowerMode } from '@/families/volume/TowerMode';
import { GUARDIAN_HEALTH } from '@/session/GuardianHealth';
import { MemoryStorage } from '@/services/KeyValueStorage';
import { ProfileService } from '@/services/ProfileService';
import type { ModeId } from '@/session/ModeId';

const STEP = 16;

/** Runs the Eye until it does something of this type; returns the events seen. */
function until(eye: TowerEye, type: string, limitMs = 30_000) {
  const seen: { type: string }[] = [];
  for (let t = 0; t < limitMs; t += STEP) {
    const events = eye.update(STEP);
    seen.push(...events);
    if (events.some((event) => event.type === type)) return seen;
  }
  throw new Error(`never did ${type}`);
}

describe('The Eye of the Tower', () => {
  it('turns while it watches, charges, then strikes every column of its gaze', () => {
    const eye = new TowerEye(20, new SeededRandom(1), { start: 10, firstWatchMs: 1000 });
    expect(eye.gaze()).toEqual([10, 9, 11, 8, 12]);
    const charge = until(eye, 'charge');
    expect(eye.state).toBe('charge');
    expect(eye.centre).toBeGreaterThan(10);
    expect(charge.at(-1)).toMatchObject({ reach: 2 });
    const centre = eye.centre;
    const strike = until(eye, 'strike').at(-1) as unknown as { columns: number[]; rubble: boolean };
    expect(eye.centre).toBe(centre);
    expect(strike.columns).toHaveLength(5);
    expect(strike.rubble).toBe(false);
    expect(eye.state).toBe('watch');
  });

  it('is blinded by a bomb in its gaze: a heavy blow, no strike, then it opens', () => {
    const eye = new TowerEye(20, new SeededRandom(1), { start: 10, firstWatchMs: 0 });
    eye.update(STEP);
    expect(eye.state).toBe('charge');
    eye.bombAt(12);
    expect(eye.state).toBe('blind');
    expect(eye.health).toBe(GUARDIAN_HEALTH - BLIND_DAMAGE);
    const seen = until(eye, 'open', BLIND_MS + 100).map((event) => event.type);
    expect(seen).not.toContain('strike');
    expect(eye.state).toBe('watch');
  });

  it('sees round the tower, and a bomb out of its gaze only hurts it a little', () => {
    const eye = new TowerEye(20, new SeededRandom(1), { start: 0.4, firstWatchMs: 60_000 });
    expect(eye.sees(19)).toBe(true);
    expect(eye.sees(2)).toBe(true);
    expect(eye.sees(10)).toBe(false);
    eye.bombAt(10);
    expect(eye.state).toBe('watch');
    expect(eye.health).toBe(GUARDIAN_HEALTH - BOMB_DAMAGE);
  });

  it('is hurt by the rings cleared, widens its gaze by phase, and falls at 0', () => {
    expect([1, 2, 3, 4].map(ringDamage)).toEqual([5, 13, 21, 29]);
    const eye = new TowerEye(20, new SeededRandom(1), { start: 10 });
    const seen: string[] = [];
    while (!eye.defeated) {
      eye.ringsCleared(1);
      seen.push(...eye.drain().map((event) => event.type));
      if (eye.phase === 2) expect(eye.gaze()).toHaveLength(7);
    }
    expect(seen.filter((type) => type === 'phase')).toHaveLength(2);
    expect(seen.at(-1)).toBe('defeated');
    expect(eye.state).toBe('dead');
  });
});

describe('Stones on the Tower', () => {
  it('land on top of each column, and a ring they complete clears', () => {
    const board = new Board(4, 6, 2, true);
    const game = new Game(new TowerMode(), { random: new SeededRandom(1), board });
    for (const x of [0, 1, 2]) board.dropOn(x, Tone.I, () => false);
    board.dropOn(1, Tone.I, () => false);
    const onClear = vi.fn();
    game.events.on('clear', onClear);
    game.start();
    game.dropStones([1, 3], Tone.Stone);
    expect(onClear).toHaveBeenCalledWith(expect.objectContaining({ lines: 1, cascade: true }));
    // The bottom ring cleared; column 1 came down a row, its stone on top.
    expect(board.get(1, board.height - 1)).toBe(Tone.I);
    expect(board.get(1, board.height - 2)).toBe(Tone.Stone);
    expect(board.blockCount()).toBe(2);
  });
});

describe('A boss level of the Tower', () => {
  const boss = () =>
    createVolumeSession('tower', {
      random: new SeededRandom(3),
      timeLimitMs: null,
      boss: 'towerEye',
    }) as FallingSession;

  it('reports the Eye to the game screen, and only on its level', () => {
    expect(boss().boss()).toEqual({
      id: 'towerEye',
      health: GUARDIAN_HEALTH,
      maxHealth: GUARDIAN_HEALTH,
    });
    const plain = createVolumeSession('tower', { random: new SeededRandom(3), timeLimitMs: null });
    expect(plain.boss?.()).toBeNull();
  });

  it('drops the stones of a strike on the tower, and ends in victory when the Eye falls', () => {
    const session = boss();
    const mode = session.view.mode as TowerMode;
    const onStones = vi.fn();
    session.onGame('stones', onStones);
    session.start();
    for (let t = 0; t < 12_000 && onStones.mock.calls.length === 0; t += STEP) session.update(STEP);
    expect(onStones).toHaveBeenCalled();
    const onOver = vi.fn();
    session.events.on('over', onOver);
    const eye = mode.eye!;
    while (!eye.defeated) eye.ringsCleared(4);
    session.update(STEP);
    expect(onOver).toHaveBeenCalledWith({ reason: 'victory' });
  });

  it('deals bombs sooner and more often than the plain Tower', () => {
    const count = (mode: TowerMode) => {
      const random = new SeededRandom(5);
      return Array.from({ length: 200 }, (_, rank) => mode.bombFor(random, rank)).filter(
        (bomb) => bomb !== null,
      ).length;
    };
    expect(count(new TowerMode({ boss: 'towerEye' }))).toBeGreaterThan(count(new TowerMode()));
  });

  it('gives its Iris shards to the player who defeats it', () => {
    const modes: readonly ModeId[] = ['tower'];
    const service = new ProfileService(new MemoryStorage(), () => modes);
    const progress = service.recordGame(
      {
        modeId: 'tower',
        daily: false,
        variant: null,
        reason: 'victory',
        durationMs: 120_000,
        clears: 8,
        lines: 9,
        bestAtOnce: 2,
        bestCombo: 2,
        boss: 'towerEye',
      },
      '20261021',
    );
    expect(progress.unlocked.map((c) => c.id)).toContain('iris');
  });
});

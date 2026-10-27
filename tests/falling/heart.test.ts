import { describe, expect, it, vi } from 'vitest';
import { SeededRandom } from '@/core/Random';
import { Tone } from '@/core/Tone';
import { createSoloSession } from '@/families/falling';
import { Board } from '@/families/falling/board/Board';
import {
  HOLD_PER_LINE_MS,
  lineDamage,
  RiftHeart,
  SHARD_DAMAGE,
  SWELL_MS,
  type HeartEvent,
} from '@/families/falling/modes/RiftHeart';
import { RiftHeartMode } from '@/families/falling/modes/RiftHeartMode';
import { GUARDIAN_HEALTH } from '@/session/GuardianHealth';
import { MemoryStorage } from '@/services/KeyValueStorage';
import { ProfileService } from '@/services/ProfileService';
import type { ModeId } from '@/session/ModeId';

const STEP = 16;

/** Runs the Heart until it does something of this type; returns that event. */
function until<T extends HeartEvent['type']>(heart: RiftHeart, type: T, limitMs = 30_000) {
  for (let t = 0; t < limitMs; t += STEP) {
    const found = heart.update(STEP).find((event) => event.type === type);
    if (found) return found as Extract<HeartEvent, { type: T }>;
  }
  throw new Error(`never did ${type}`);
}

describe('The Heart of the Rift', () => {
  it('swells before it beats, showing the holes, then pushes its rows of rubble', () => {
    const heart = new RiftHeart(10, new SeededRandom(2), { firstBeatMs: 3000 });
    const swell = until(heart, 'swell');
    expect(heart.nextBeatMs).toBeLessThanOrEqual(SWELL_MS);
    expect(swell.rows).toHaveLength(1);
    const [row] = swell.rows;
    expect(row!.shard).not.toBe(row!.hole);
    const beat = until(heart, 'beat');
    expect(beat.rows).toEqual(swell.rows);
    expect(beat.mirror).toBe(false);
    expect(heart.coming).toEqual([]);
  });

  it('beats faster and harder at the end: two rows sharing their hole, the well mirrored', () => {
    const heart = new RiftHeart(10, new SeededRandom(2), { firstBeatMs: 1000 });
    while (heart.phase < 3) heart.cleared(1, 1);
    heart.drain();
    const beat = until(heart, 'beat');
    expect(beat.rows).toHaveLength(2);
    expect(beat.rows[0]!.hole).toBe(beat.rows[1]!.hole);
    expect(beat.mirror).toBe(true);
  });

  it('is held back by lines cleared, but not once it swells', () => {
    const heart = new RiftHeart(10, new SeededRandom(2), { firstBeatMs: 5000 });
    heart.update(1000);
    heart.cleared(2, 0);
    expect(heart.nextBeatMs).toBe(4000 + 2 * HOLD_PER_LINE_MS);
    until(heart, 'swell');
    const before = heart.nextBeatMs;
    heart.cleared(4, 0);
    expect(heart.nextBeatMs).toBe(before);
  });

  it('is wounded deeply by its shards, a little by lines, and falls at 0', () => {
    expect([1, 2, 3, 4].map(lineDamage)).toEqual([2, 4, 7, 12]);
    const heart = new RiftHeart(10, new SeededRandom(2));
    heart.cleared(1, 1);
    expect(heart.health).toBe(GUARDIAN_HEALTH - lineDamage(1) - SHARD_DAMAGE);
    const seen: string[] = [];
    while (!heart.defeated) {
      heart.cleared(4, 1);
      seen.push(...heart.drain().map((event) => event.type));
    }
    expect(seen.at(-1)).toBe('defeated');
    expect(heart.coming).toEqual([]);
  });
});

describe('Shards in the well', () => {
  it('rise with their row, turn with the well, and are reported when their row clears', () => {
    const board = new Board(4, 4);
    board.pushGarbageRow(0, 2);
    const bottom = board.height - 1;
    expect(board.hasBomb(2, bottom)).toBe(true);
    board.mirror();
    expect(board.hasBomb(1, bottom)).toBe(true);
    expect(board.hasBomb(2, bottom)).toBe(false);
    // The hole is now on the right: fill it and clear the row.
    board.dropOn(3, Tone.I, () => false);
    const [row] = board.clearFullRows();
    expect(row!.bombs).toEqual([1]);
    expect(board.bombCount()).toBe(0);
  });
});

describe('A boss level of the classic well', () => {
  const boss = () =>
    createSoloSession('classic', {
      random: new SeededRandom(4),
      timeLimitMs: null,
      boss: 'riftHeart',
    });

  it('plays the classic well with the Heart under it, and only on its level', () => {
    const session = boss();
    expect(session.view.mode).toBeInstanceOf(RiftHeartMode);
    expect(session.boss()).toEqual({
      id: 'riftHeart',
      health: GUARDIAN_HEALTH,
      maxHealth: GUARDIAN_HEALTH,
    });
    const plain = createSoloSession('classic', { random: new SeededRandom(4), timeLimitMs: null });
    expect(plain.boss()).toBeNull();
  });

  it('raises a row with a shard at each beat, and ends in victory when the Heart falls', () => {
    const session = boss();
    const onGarbage = vi.fn();
    session.onGame('garbage', onGarbage);
    session.start();
    for (let t = 0; t < 12_000 && onGarbage.mock.calls.length === 0; t += STEP) {
      session.update(STEP);
    }
    expect(onGarbage).toHaveBeenCalled();
    expect(session.view.board.bombCount()).toBe(1);
    const onOver = vi.fn();
    session.events.on('over', onOver);
    const heart = (session.view.mode as RiftHeartMode).heart!;
    while (!heart.defeated) heart.cleared(4, 1);
    session.update(STEP);
    expect(onOver).toHaveBeenCalledWith({ reason: 'victory' });
  });

  it('gives the Rift ambiance to the player who defeats it', () => {
    const modes: readonly ModeId[] = ['classic'];
    const service = new ProfileService(new MemoryStorage(), () => ({ modes, daily: true }));
    const progress = service.recordGame(
      {
        modeId: 'classic',
        daily: false,
        variant: null,
        reason: 'victory',
        durationMs: 120_000,
        clears: 20,
        lines: 30,
        bestAtOnce: 4,
        bestCombo: 3,
        boss: 'riftHeart',
      },
      '20261021',
    );
    expect(progress.unlocked.map((c) => c.id)).toContain('rift');
  });
});

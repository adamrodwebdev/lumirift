import { describe, expect, it, vi } from 'vitest';
import { SeededRandom } from '@/core/Random';
import { Tone } from '@/core/Tone';
import { DuneWorm, HIT_DAMAGE, WORM_HEALTH } from '@/families/sand/engine/DuneWorm';
import { SandGame, STEP_MS } from '@/families/sand/engine/SandGame';
import { SAND_TONES, SandGrid } from '@/families/sand/engine/SandGrid';
import { SandPiece } from '@/families/sand/engine/SandPiece';
import { GOAL_RULES } from '@/campaign/Goals';
import { MemoryStorage } from '@/services/KeyValueStorage';
import { ProfileService } from '@/services/ProfileService';
import type { ModeId } from '@/session/ModeId';

/** A well half full of sand, for the worm to swim in. */
function arena() {
  const grid = new SandGrid();
  for (let y = grid.height - 40; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) grid.put(x, y, SAND_TONES[((x / 10) | 0) % 4]!, 0);
  }
  return grid;
}

/** Runs the worm until a state, or fails after `limitMs`. */
function until(worm: DuneWorm, state: DuneWorm['state'], limitMs = 20_000) {
  const seen: string[] = [];
  for (let t = 0; t < limitMs; t += STEP_MS) {
    for (const event of worm.update(STEP_MS)) seen.push(event.type);
    if (worm.state === state) return seen;
  }
  throw new Error(`never reached ${state}`);
}

describe('The Dune Wyrm', () => {
  it('roams, warns where it will come up, bursts out throwing sand, stays out, then dives', () => {
    const grid = arena();
    const worm = new DuneWorm(grid, new SeededRandom(3), { firstSurgeMs: 1000 });
    const grains = grid.grainCount();
    expect(until(worm, 'warn')).toContain('warn');
    expect(worm.warnAt).not.toBeNull();
    const seen = until(worm, 'exposed');
    expect(seen).toContain('surge');
    expect(worm.exposed).toBe(true);
    expect(grid.grainCount()).toBeGreaterThan(grains);
    expect(until(worm, 'dive')).toContain('dive');
    until(worm, 'roam');
    expect(worm.out).toBe(false);
  });

  it('takes damage by kind, goes through its phases, and is defeated at 0', () => {
    const worm = new DuneWorm(arena(), new SeededRandom(3));
    expect(worm.hit('boltHead')).toBe(HIT_DAMAGE.boltHead);
    expect(worm.health).toBe(WORM_HEALTH - HIT_DAMAGE.boltHead);
    const events: string[] = [];
    for (let k = 0; k < 20 && worm.state !== 'dead'; k++) {
      worm.hit('boltHead');
      events.push(...worm.drain().map((event) => event.type));
    }
    expect(events.filter((type) => type === 'phase')).toHaveLength(2);
    expect(events).toContain('defeated');
    expect(worm.health).toBe(0);
    expect(worm.hit('link')).toBe(0);
  });

  it('is stunned by a shock, and does not take the same hit twice in a moment', () => {
    const worm = new DuneWorm(arena(), new SeededRandom(3));
    worm.hit('shock');
    expect(worm.stunned).toBe(true);
    expect(worm.hit('shock')).toBe(0);
    const head = [worm.headX, worm.headY];
    worm.update(STEP_MS);
    expect([worm.headX, worm.headY]).toEqual(head);
  });

  it('swallows surface sand in its second phase', () => {
    const grid = arena();
    const worm = new DuneWorm(grid, new SeededRandom(5), { firstSurgeMs: 500 });
    while (worm.phase === 1) worm.hit('boltHead');
    worm.drain();
    const seen = until(worm, 'exposed');
    expect(seen).toContain('swallow');
  });
});

describe('A boss level of Sand', () => {
  it('lets lightning on the bare head hurt the worm instead of the sand', () => {
    const game = new SandGame({ random: new SeededRandom(3), hazards: false, boss: 'duneWorm' });
    game.start();
    const worm = game.worm!;
    for (let t = 0; t < 30_000 && !worm.exposed; t += STEP_MS) game.update(STEP_MS);
    expect(worm.exposed).toBe(true);
    const onStrike = vi.fn();
    game.events.on('strike', onStrike);
    const piece = new SandPiece('O', Tone.Lightning, 0, 0);
    const left = Math.round(worm.headX) - 6;
    (game as unknown as { _active: SandPiece })._active = piece.moved(left, 0);
    game.hardDrop();
    expect(onStrike.mock.calls[0]![0].kind).toBe('boss');
    expect(worm.health).toBe(WORM_HEALTH - HIT_DAMAGE.boltHead);
  });

  it('ends in victory when the worm falls, which the boss goal counts as won', () => {
    const game = new SandGame({ random: new SeededRandom(3), hazards: false, boss: 'duneWorm' });
    game.start();
    const onOver = vi.fn();
    game.events.on('over', onOver);
    const worm = game.worm!;
    while (worm.state !== 'dead') worm.hit('boltHead');
    game.update(STEP_MS);
    expect(onOver).toHaveBeenCalledWith({ reason: 'victory' });
    const goal = { kind: 'boss' as const, target: WORM_HEALTH };
    const state = { lines: 0, clears: 0, bestAtOnce: 0, score: 0, durationMs: 1, bossDamage: 40 };
    expect(GOAL_RULES.boss.progress(state, goal)).toBe(40);
    expect(GOAL_RULES.boss.wonAtEnd('victory', state, goal)).toBe(true);
    expect(GOAL_RULES.boss.wonAtEnd('blockOut', state, goal)).toBe(false);
  });

  it('remembers the defeated Guardian and gives its cosmetic', () => {
    const modes: readonly ModeId[] = ['sand'];
    const service = new ProfileService(new MemoryStorage(), () => modes);
    const progress = service.recordGame(
      {
        modeId: 'sand',
        daily: false,
        variant: null,
        reason: 'victory',
        durationMs: 120_000,
        clears: 3,
        lines: 3,
        bestAtOnce: 1,
        bestCombo: 1,
        boss: 'duneWorm',
      },
      '20261021',
    );
    expect(progress.unlocked.map((c) => c.id)).toContain('dunes');
    expect(service.current.bosses).toEqual(['duneWorm']);
  });
});

import { describe, expect, it } from 'vitest';
import { SeededRandom } from '@/core/Random';
import { Tone } from '@/core/Tone';
import { createSandSession, type SandSession } from '@/families/sand';
import { GRAINS_PER_CELL } from '@/families/sand/engine/SandGrid';
import type { TrainingStage } from '@/session/GameSession';

const G = GRAINS_PER_CELL;
const STEP = 16;
/** Minutes of play simulated frame by frame: a slower machine (the CI) needs more than 5 s. */
const SIMULATION_TIMEOUT_MS = 30_000;

/** A training step's session, started. */
function training(stage: TrainingStage, seed = 1): SandSession {
  const session = createSandSession('sand', {
    random: new SeededRandom(seed),
    timeLimitMs: null,
    training: stage,
  }) as SandSession;
  session.start();
  return session;
}

/** A beginner: each piece dropped two seconds after it appears, where it appears. */
function beginner(session: SandSession) {
  let dropAt = 0;
  let now = 0;
  session.onGame('spawn', () => (dropAt = now + 2000));
  return (ms: number) => {
    for (let t = 0; t < ms && session.state === 'running'; t += STEP) {
      if (session.view.active && now >= dropAt) session.execute({ type: 'hardDrop' });
      session.update(STEP);
      now += STEP;
    }
  };
}

describe('The portals’ training in the Sand (1.29)', () => {
  it('stages the elements: a prepared well, the pairs first, no clock, no level to climb', () => {
    const session = training('elements');
    expect(session.view.grid.sandHeight()).toBeGreaterThan(0.3 * session.view.grid.height);
    expect(session.view.active?.tone).toBe(Tone.Water);
    session.execute({ type: 'hardDrop' });
    expect(session.view.active?.tone).toBe(Tone.Lightning);
    const ids = session.indicators().map((indicator) => indicator.id);
    expect(ids).not.toContain('timeLeft');
    expect(ids).not.toContain('level');
  });

  it(
    'shows a beginner the shock, the blaze and the vine in twenty seconds, then two zones linked',
    () => {
      for (const seed of [1, 2, 3, 4]) {
        const session = training('elements', seed);
        const seen = new Set<string>();
        session.onGame('strike', ({ kind }) => seen.add(kind));
        session.onGame('react', ({ kind }) => seen.add(kind));
        let regions = 0;
        session.onGame('clear', (event) => (regions += event.regions));
        const play = beginner(session);
        play(20_000);
        expect([...seen]).toEqual(expect.arrayContaining(['shock', 'blaze', 'sprout']));
        for (let t = 20_000; t < 90_000 && regions < 2; t += 1000) play(1000);
        expect(regions).toBeGreaterThanOrEqual(2);
      }
    },
    SIMULATION_TIMEOUT_MS,
  );

  it(
    'is never lost: whenever a piece cannot come in, the bottom of the sand empties',
    () => {
      const session = training('elements');
      let rescues = 0;
      let warned = false;
      let pressure = 0;
      let highest = 0;
      session.onGame('rescue', () => rescues++);
      for (let t = 0; t < 120_000; t += STEP) {
        if (session.view.active) session.execute({ type: 'hardDrop' });
        session.update(STEP);
        warned ||= session.view.spawnWarning() !== null;
        pressure = Math.max(pressure, session.pressure());
        highest = Math.max(highest, session.view.grid.sandHeight());
      }
      expect(session.state).toBe('running');
      expect(rescues).toBeGreaterThan(0);
      // No alarm in a game that cannot be lost: no red vignette, no heartbeat, no red piece.
      expect(highest).toBeGreaterThan(0.7 * session.view.grid.height);
      expect(pressure).toBe(0);
      expect(warned).toBe(false);
    },
    SIMULATION_TIMEOUT_MS,
  );

  it('lets the Dune Wyrm be struck only once it has come out, soon, even by a player who does not aim', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const session = training('wyrm', seed);
      const moves: string[] = [];
      session.onGame('boss', ({ event }) => moves.push(event.type));
      const play = beginner(session);
      for (let t = 0; t < 40_000 && !moves.includes('hurt'); t += 500) play(500);
      expect(moves).toContain('hurt');
      expect(moves.indexOf('surge')).toBeGreaterThanOrEqual(0);
      expect(moves.indexOf('surge')).toBeLessThan(moves.indexOf('hurt'));
    }
  });

  it('lets a player who follows the guide strike its head as it comes out', () => {
    const session = training('wyrm');
    const hits: string[] = [];
    session.onGame('boss', ({ event }) => {
      if (event.type === 'hurt') hits.push(event.hit);
    });
    for (let t = 0; t < 10_000 && hits.length === 0; t += STEP) {
      const bolt = session.view.active;
      const worm = session.view.worm!;
      const target = worm.warnAt ?? (worm.exposed ? Math.round(worm.headX) : null);
      if (bolt?.tone === Tone.Lightning && target !== null) {
        const cells = Math.round((target - (bolt.x + G)) / G);
        for (let k = 0; k < Math.abs(cells); k++) {
          session.execute({ type: 'move', direction: cells < 0 ? -1 : 1 });
        }
        if (worm.exposed) session.execute({ type: 'hardDrop' });
      }
      session.update(STEP);
    }
    expect(hits).toEqual(['boltHead']);
  });

  it('sends the struck Wyrm away for good when the step is won', () => {
    const session = training('wyrm');
    const play = beginner(session);
    const moves: string[] = [];
    session.onGame('boss', ({ event }) => moves.push(event.type));
    for (let t = 0; t < 40_000 && !moves.includes('hurt'); t += 500) play(500);
    expect(session.tease('duneWorm')).toBeGreaterThan(0);
    const after: string[] = [];
    session.onGame('boss', ({ event }) => after.push(event.type));
    for (let t = 0; t < 15_000; t += STEP) session.update(STEP);
    expect(session.view.worm!.out).toBe(false);
    expect(after).not.toContain('warn');
    expect(session.view.active).toBeNull();
  });

  it('guides each piece of the elements, and each move of the Wyrm', () => {
    const elements = training('elements');
    const lines: string[] = [];
    for (let rank = 1; rank <= 9; rank++) {
      lines.push(`${elements.guide()?.text}:${elements.guide()?.action}`);
      elements.execute({ type: 'hardDrop' });
      for (let t = 0; t < 1500; t += STEP) elements.update(STEP);
    }
    expect(lines.slice(0, 2)).toEqual([
      'training.guide.placeWater:move',
      'training.guide.dropLightning:drop',
    ]);
    expect(lines[2]).toBe('training.guide.link:move');
    expect(lines.slice(3, 5)).toEqual([
      'training.guide.placeOil:move',
      'training.guide.dropFire:drop',
    ]);
    expect(lines.slice(6, 8)).toEqual([
      'training.guide.placeSeed:move',
      'training.guide.dropWater:drop',
    ]);

    const wyrm = training('wyrm');
    const said = new Set<string>();
    const play = beginner(wyrm);
    const moves: string[] = [];
    wyrm.onGame('boss', ({ event }) => moves.push(event.type));
    for (let t = 0; t < 40_000 && !moves.includes('hurt'); t += STEP) {
      said.add(wyrm.guide()?.text ?? 'none');
      play(STEP);
    }
    expect([...said]).toEqual(
      expect.arrayContaining([
        'training.guide.roam',
        'training.guide.warn',
        'training.guide.exposed',
      ]),
    );
    wyrm.tease('duneWorm');
    expect(wyrm.guide()?.text).toBe('training.guide.hit');
    // Outside the training, no guide.
    const free = createSandSession('sand', { random: new SeededRandom(1), timeLimitMs: null });
    expect(free.guide?.()).toBeNull();
  });

  it('keeps the fight’s words for the fights: the guide alone speaks in the training', () => {
    const session = training('wyrm');
    const notices: string[] = [];
    session.events.on('notice', ({ id }) => notices.push(id));
    beginner(session)(15_000);
    expect(notices.filter((id) => id.startsWith('boss.'))).toEqual([]);
  });
});

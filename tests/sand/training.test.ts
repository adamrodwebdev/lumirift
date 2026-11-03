import { describe, expect, it } from 'vitest';
import { SeededRandom } from '@/core/Random';
import { Tone } from '@/core/Tone';
import { createSandSession, type SandSession } from '@/families/sand';
import { HOOK_WYRM_MS } from '@/families/sand/engine/Showcase';
import { GRAINS_PER_CELL } from '@/families/sand/engine/SandGrid';

const G = GRAINS_PER_CELL;
const STEP = 16;
/** Minutes of play simulated frame by frame: a slower machine (the CI) needs more than 5 s. */
const SIMULATION_TIMEOUT_MS = 30_000;
/** The first bolt breaks the soaked slab: more than one band of sand at once. */
const SHOCK_GRAINS = 600;

/** The training's game, started. */
function training(seed = 1): SandSession {
  const session = createSandSession('sand', {
    random: new SeededRandom(seed),
    timeLimitMs: null,
    training: 'hook',
  }) as SandSession;
  session.start();
  return session;
}

/** A beginner: each piece dropped two seconds after it appears, where it appears. */
function beginner(session: SandSession) {
  let dropAt = 2000;
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

/** Slides the piece in play `cells` to a side, as far as it goes. */
function slide(session: SandSession, cells: number): void {
  for (let k = 0; k < Math.abs(cells); k++) {
    if (!session.execute({ type: 'move', direction: cells < 0 ? -1 : 1 })) return;
  }
}

describe('The portals’ training in the Sand (1.29, one game since 1.33)', () => {
  it('stages the hook: a soaked bed, a bolt first, no clock, no level to climb', () => {
    const session = training();
    expect(session.view.grid.sandHeight()).toBeGreaterThan(0.3 * session.view.grid.height);
    expect(session.view.active?.tone).toBe(Tone.Lightning);
    const ids = session.indicators().map((indicator) => indicator.id);
    expect(ids).not.toContain('timeLeft');
    expect(ids).not.toContain('level');
  });

  it('brings the first bolt in low, two cells over the water it will shock (1.46)', () => {
    const session = training();
    expect(session.view.active!.y).toBeGreaterThan(0);
    expect(session.view.dropDistance()).toBe(2 * G);
  });

  it('shocks the bed within two seconds when the player does nothing (1.46; 8.8 s before)', () => {
    const session = training();
    const shocks: number[] = [];
    let now = 0;
    session.onGame('strike', ({ kind }) => kind === 'shock' && shocks.push(now));
    for (; now < 5000 && shocks.length === 0; now += STEP) session.update(STEP);
    expect(shocks).toHaveLength(1);
    expect(shocks[0]).toBeLessThan(2000);
  });

  it('shocks the bed with the first bolt, wherever it lands and however long it waits', () => {
    for (let cells = -5; cells <= 5; cells++) {
      for (const drops of [true, false]) {
        const session = training();
        const strikes: { kind: string; grains: number }[] = [];
        session.onGame('strike', ({ kind, grains }) => strikes.push({ kind, grains }));
        slide(session, cells);
        if (drops) session.execute({ type: 'hardDrop' });
        for (let t = 0; t < 20_000 && strikes.length === 0; t += STEP) session.update(STEP);
        expect(strikes[0]?.kind).toBe('shock');
        expect(strikes[0]!.grains).toBeGreaterThan(SHOCK_GRAINS);
      }
    }
  });

  it(
    'shows a beginner the shock, then the blaze, before the Wyrm bursts out (1.46: the vine is the campaign’s)',
    () => {
      for (const seed of [1, 2, 3, 4]) {
        const session = training(seed);
        const seen: string[] = [];
        session.onGame('strike', ({ kind }) => seen.push(kind));
        session.onGame('react', ({ kind }) => seen.push(kind));
        session.onGame('boss', ({ event }) => event.type === 'surge' && seen.push('surge'));
        beginner(session)(16_000);
        expect(seen[0], seen.join()).toBe('shock');
        expect(seen.indexOf('blaze'), seen.join()).toBeGreaterThan(0);
        expect(seen.indexOf('blaze'), seen.join()).toBeLessThan(seen.indexOf('surge'));
        expect(seen).not.toContain('sprout');
      }
    },
    SIMULATION_TIMEOUT_MS,
  );

  it(
    'is never lost: whenever a piece cannot come in, the bottom of the sand empties',
    () => {
      const session = training();
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

  it(
    'brings the Dune Wyrm out on its own clock, by fifteen seconds (1.46), then lets it be struck',
    () => {
      for (const seed of [1, 2, 3]) {
        const session = training(seed);
        const moves: { type: string; at: number }[] = [];
        let now = 0;
        session.onGame('boss', ({ event }) => moves.push({ type: event.type, at: now }));
        const play = beginner(session);
        for (; now < 60_000 && !moves.some((move) => move.type === 'hurt'); now += 500) {
          play(500);
        }
        const surge = moves.find((move) => move.type === 'surge')!;
        expect(surge.at).toBeGreaterThan(HOOK_WYRM_MS);
        expect(surge.at).toBeLessThan(16_000);
        const hurt = moves.find((move) => move.type === 'hurt')!;
        expect(hurt.at).toBeGreaterThan(surge.at);
      }
    },
    SIMULATION_TIMEOUT_MS,
  );

  it(
    'lets a player who follows the guide strike its head as it comes out',
    () => {
      const session = training();
      const hits: string[] = [];
      session.onGame('boss', ({ event }) => {
        if (event.type === 'hurt') hits.push(event.hit);
      });
      for (let t = 0; t < 40_000 && hits.length === 0; t += STEP) {
        const bolt = session.view.active;
        const worm = session.view.worm!;
        const target = worm.warnAt ?? (worm.exposed ? Math.round(worm.headX) : null);
        if (bolt?.tone === Tone.Lightning && target !== null) {
          slide(session, Math.round((target - (bolt.x + G)) / G));
          if (worm.exposed) session.execute({ type: 'hardDrop' });
        } else if (bolt && bolt.tone !== Tone.Lightning) {
          session.execute({ type: 'hardDrop' });
        }
        session.update(STEP);
      }
      expect(hits).toEqual(['boltHead']);
    },
    SIMULATION_TIMEOUT_MS,
  );

  it(
    'sends the struck Wyrm away for good when the training is won',
    () => {
      const session = training();
      const play = beginner(session);
      const moves: string[] = [];
      session.onGame('boss', ({ event }) => moves.push(event.type));
      for (let t = 0; t < 60_000 && !moves.includes('hurt'); t += 500) play(500);
      expect(session.tease('duneWorm')).toBeGreaterThan(0);
      const after: string[] = [];
      session.onGame('boss', ({ event }) => after.push(event.type));
      for (let t = 0; t < 15_000; t += STEP) session.update(STEP);
      expect(session.view.worm!.out).toBe(false);
      expect(after).not.toContain('warn');
      expect(session.view.active).toBeNull();
    },
    SIMULATION_TIMEOUT_MS,
  );

  it(
    'guides each piece of the elements, then each move of the Wyrm',
    () => {
      const session = training();
      const lines: string[] = [];
      for (let rank = 1; rank <= 7; rank++) {
        lines.push(`${session.guide()?.text}:${session.guide()?.action}`);
        session.execute({ type: 'hardDrop' });
        for (let t = 0; t < 1500; t += STEP) session.update(STEP);
      }
      expect(lines).toEqual([
        'training.guide.dropLightning:drop',
        'training.guide.link:move',
        'training.guide.placeOil:move',
        'training.guide.dropFire:drop',
        'training.guide.link:move',
        // A bolt every other piece from there: one is never far when the Wyrm comes out.
        'training.guide.dropLightning:drop',
        'training.guide.link:move',
      ]);

      const said = new Set<string>();
      const play = beginner(session);
      const moves: string[] = [];
      session.onGame('boss', ({ event }) => moves.push(event.type));
      for (let t = 0; t < 60_000 && !moves.includes('hurt'); t += STEP) {
        said.add(session.guide()?.text ?? 'none');
        play(STEP);
      }
      expect([...said]).toEqual(
        expect.arrayContaining(['training.guide.warn', 'training.guide.exposed']),
      );
      session.tease('duneWorm');
      expect(session.guide()?.text).toBe('training.guide.hit');
      // Outside the training, no guide.
      const free = createSandSession('sand', { random: new SeededRandom(1), timeLimitMs: null });
      expect(free.guide?.()).toBeNull();
    },
    SIMULATION_TIMEOUT_MS,
  );

  it(
    'leaves the elements’ words to the guide (1.46), and tells the deeds',
    () => {
      const session = training();
      const notices: string[] = [];
      session.events.on('notice', ({ id }) => notices.push(id));
      beginner(session)(10_000);
      expect(notices.filter((id) => id.startsWith('element'))).toEqual([]);
      expect(notices).toContain('strike.shock');
    },
    SIMULATION_TIMEOUT_MS,
  );

  it(
    'brings its goal into view with the Wyrm’s first cracks, and says where its piece stands (1.46)',
    () => {
      const session = training();
      // The first bolt, in the middle of the well, low over the water.
      const at = session.guideAt()!;
      expect(at.x).toBeCloseTo(0.5, 2);
      expect(at.y).toBeGreaterThan(0.3);
      expect(at.y).toBeLessThan(0.55);
      const play = beginner(session);
      play(HOOK_WYRM_MS - 500);
      expect(session.goalInView()).toBe(false);
      play(1000);
      expect(session.goalInView()).toBe(true);
      // Outside the training, a goal is there from the start, and no piece is guided.
      const free = createSandSession('sand', {
        random: new SeededRandom(1),
        timeLimitMs: null,
      }) as SandSession;
      free.start();
      expect(free.goalInView()).toBe(true);
      expect(free.guideAt()).toBeNull();
    },
    SIMULATION_TIMEOUT_MS,
  );

  it(
    'keeps the fight’s words for the fights: the guide alone speaks in the training',
    () => {
      const session = training();
      const notices: string[] = [];
      session.events.on('notice', ({ id }) => notices.push(id));
      beginner(session)(40_000);
      expect(notices.filter((id) => id.startsWith('boss.'))).toEqual([]);
    },
    SIMULATION_TIMEOUT_MS,
  );
});

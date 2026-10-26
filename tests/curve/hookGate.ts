import { SeededRandom } from '@/core/Random';
import { createSandSession, type SandSession } from '@/families/sand';

const STEP = 16;
/** The Wyrm must come out before this, from the training's first frame (the lot's gate). */
export const WYRM_BEFORE_MS = 50_000;
/** The first bolt breaks the soaked slab: more than a band of sand at once. */
export const SHOCK_GRAINS = 600;
/** A quarter of the thousand games: half a minute of sand each. */
export const GATE_TIMEOUT_MS = 300_000;

/**
 * One game of the training, the player's first move chosen by the seed (a
 * slide of up to five cells either way, dropped at once or left to fall),
 * then a beginner's: each piece dropped two seconds after it appears. What
 * went wrong, or null when the first bolt shocked the bed and the Wyrm came
 * out in time.
 */
export function hookProblem(seed: number): string | null {
  const session = createSandSession('sand', {
    random: new SeededRandom(seed),
    timeLimitMs: null,
    training: 'hook',
  }) as SandSession;
  session.start();
  const choice = new SeededRandom(seed ^ 0x5bd1e995);
  const slide = choice.nextInt(11) - 5;
  const dropsAtOnce = choice.next() < 0.5;
  const seen: { first: { kind: string; grains: number } | null; surgedAt: number | null } = {
    first: null,
    surgedAt: null,
  };
  const surged = () => seen.surgedAt !== null;
  let now = 0;
  session.onGame('strike', ({ kind, grains }) => (seen.first ??= { kind, grains }));
  session.onGame('boss', ({ event }) => {
    if (event.type === 'surge') seen.surgedAt ??= now;
  });
  for (let k = 0; k < Math.abs(slide); k++) {
    if (!session.execute({ type: 'move', direction: slide < 0 ? -1 : 1 })) break;
  }
  if (dropsAtOnce) session.execute({ type: 'hardDrop' });
  let dropAt = Number.POSITIVE_INFINITY;
  session.onGame('spawn', () => (dropAt = now + 2000));
  while (now < WYRM_BEFORE_MS && !surged()) {
    if (session.view.active && now >= dropAt) session.execute({ type: 'hardDrop' });
    session.update(STEP);
    now += STEP;
  }
  session.dispose();
  const shock = seen.first;
  if (shock?.kind !== 'shock' || shock.grains <= SHOCK_GRAINS) {
    const struck = shock ? `${shock.kind}, ${shock.grains} grains` : 'nothing';
    return `seed ${seed}: the first bolt struck ${struck}`;
  }
  return surged() ? null : `seed ${seed}: no Wyrm within ${WYRM_BEFORE_MS / 1000} s`;
}

/** The problems of a run of seeds. */
export function hookProblems(from: number, to: number): readonly string[] {
  const problems: string[] = [];
  for (let seed = from; seed <= to; seed++) {
    const problem = hookProblem(seed);
    if (problem) problems.push(problem);
  }
  return problems;
}

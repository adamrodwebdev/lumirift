import type { BeatChart, BeatRole } from '../BeatCharts';
import type { CampaignLevel } from '../Levels';
import type { PlayerSkill } from './CurvePlayer';
import { intensityOf, phasePressures, PHASES, type CurveReport } from './CurveReport';

/** The games the bot plays for each player in each level. */
export const CURVE_SEEDS = 6;

/**
 * The fewest wins out of six, for each part of the rhythm and each player
 * (1.33): no level is a coin toss for an expert, a regular gets through the
 * lessons and the calm, and the peaks with a few tries. The finale is for
 * those who mastered the game.
 */
export const LEAST_WINS: Readonly<Record<BeatRole, Partial<Record<PlayerSkill, number>>>> = {
  show: { newcomer: 5, regular: 5, expert: 6 },
  teach: { regular: 5, expert: 6 },
  twist: { regular: 5, expert: 6 },
  breather: { regular: 5, expert: 6 },
  test: { regular: 3, expert: 5 },
  spike: { regular: 1, expert: 5 },
  duel: { regular: 1, expert: 5 },
  boss: { regular: 1, expert: 5 },
  finale: { expert: 4 },
};

/** The first levels are made for a newcomer, the player of the first minutes (1-1 to 1-4). */
export const NEWCOMER_LEVELS: ReadonlySet<string> = new Set(['1-1', '1-2', '1-3', '1-4']);
/** The newcomer's fewest wins there: the show and the lessons nearly always, the twist one game in two. */
const NEWCOMER_WINS: Readonly<Partial<Record<BeatRole, number>>> = { show: 5, teach: 5, twist: 3 };

/** A third's measured intensity may stray this far from its chart. */
export const INTENSITY_SLACK = 2;
/** Time with nothing to act on, at most, as a share of a game. */
export const MOST_DEAD_TIME = 0.2;

/** The player a level is made for: the newcomer first, the expert in the finale, else the regular. */
export function referenceOf(level: CampaignLevel, chart: BeatChart): PlayerSkill {
  if (NEWCOMER_LEVELS.has(level.id)) return 'newcomer';
  return chart.role === 'finale' ? 'expert' : 'regular';
}

/** The mean intensity of each third of these games. */
export function measuredIntensity(reports: readonly CurveReport[]): readonly number[] {
  return Array.from({ length: PHASES }, (_, phase) => {
    const sum = reports.reduce((total, report) => total + phasePressures(report)[phase]!, 0);
    return intensityOf(sum / Math.max(1, reports.length));
  });
}

/**
 * How far a level strays from its band, in words (none when it is in it):
 * each player's wins, its reference player's intensity third by third, near
 * misses and danger cues where its chart asks for them, and dead time.
 */
export function judgeLevel(
  level: CampaignLevel,
  chart: BeatChart,
  reports: readonly CurveReport[],
): readonly string[] {
  const problems: string[] = [];
  const of = (skill: PlayerSkill) => reports.filter((report) => report.skill === skill);
  const newcomer = NEWCOMER_LEVELS.has(level.id) ? NEWCOMER_WINS[chart.role] : undefined;
  const least: Partial<Record<PlayerSkill, number>> = {
    ...LEAST_WINS[chart.role],
    ...(newcomer === undefined ? {} : { newcomer }),
  };
  for (const [skill, wins] of Object.entries(least) as [PlayerSkill, number][]) {
    const won = of(skill).filter((report) => report.won).length;
    if (won < wins) {
      problems.push(`${level.id}: the ${skill} wins ${won} of ${of(skill).length}, ${wins} asked`);
    }
  }
  const reference = referenceOf(level, chart);
  const games = of(reference);
  measuredIntensity(games).forEach((measured, phase) => {
    const meant = chart.intensity[phase]!;
    if (Math.abs(measured - meant) > INTENSITY_SLACK) {
      problems.push(
        `${level.id}: third ${phase + 1} plays at ${measured} for the ${reference}, ${meant} charted`,
      );
    }
  });
  const near = games.filter((report) => report.nearMisses > 0).length;
  if (chart.nearMisses !== undefined && near < chart.nearMisses) {
    problems.push(
      `${level.id}: the ${reference} nearly loses in ${near} games, ${chart.nearMisses} asked`,
    );
  }
  const heard = games.filter((report) => report.dangerAtMs !== null).length;
  if (chart.cues !== undefined && heard < chart.cues) {
    problems.push(
      `${level.id}: the ${reference} hears the danger in ${heard} games, ${chart.cues} asked`,
    );
  }
  for (const report of reports) {
    if (report.deadMs > MOST_DEAD_TIME * report.durationMs) {
      const share = Math.round((100 * report.deadMs) / report.durationMs);
      problems.push(
        `${level.id}: game ${report.seed} of the ${report.skill} waits ${share} % of it`,
      );
    }
  }
  return problems;
}

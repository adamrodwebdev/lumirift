import { BEAT_CHARTS, type BeatChart } from '@/campaign/BeatCharts';
import { judgeLevel, measuredIntensity, referenceOf } from '@/campaign/curve/CurveBands';
import { curveBot } from '@/campaign/curve/CurveBot';
import { PLAYER_SKILLS } from '@/campaign/curve/CurvePlayer';
import { SELECTION_SEEDS, type LevelVerdict } from '@/campaign/generator/PackSearch';
import type { CampaignLevel } from '@/campaign/Levels';

/** Six games of a level for each player are seconds of simulation: room for a slow CI. */
export const CURVE_TIMEOUT_MS = 120_000;

/** The first day the bot plays (each seed a day later: the silhouette of the day changes). */
const FIRST_DAY = new Date(2026, 9, 26);

/** What the bot finds of a level on these games, for each player (the generator's judge, 1.38). */
export function verdictOf(
  level: CampaignLevel,
  chart: BeatChart,
  seeds: readonly number[],
): LevelVerdict {
  const bot = curveBot(FIRST_DAY);
  const reports = PLAYER_SKILLS.flatMap((skill) =>
    seeds.map((seed) => bot.play({ level, skill, seed })),
  );
  const winsOf = (skill: string) =>
    reports.filter((report) => report.skill === skill && report.won).length;
  const reference = referenceOf(level, chart);
  return {
    problems: judgeLevel(level, chart, reports),
    wins: { newcomer: winsOf('newcomer'), regular: winsOf('regular'), expert: winsOf('expert') },
    intensity: measuredIntensity(reports.filter((report) => report.skill === reference)),
  };
}

/** How far a level strays from its band, after six games for each player (none when it is in it). */
export function bandProblems(level: CampaignLevel): readonly string[] {
  return verdictOf(level, BEAT_CHARTS[level.id]!, SELECTION_SEEDS).problems;
}

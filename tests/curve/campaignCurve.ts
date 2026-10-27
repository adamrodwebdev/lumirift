import { BEAT_CHARTS } from '@/campaign/BeatCharts';
import { CURVE_SEEDS, judgeLevel } from '@/campaign/curve/CurveBands';
import { curveBot } from '@/campaign/curve/CurveBot';
import { PLAYER_SKILLS } from '@/campaign/curve/CurvePlayer';
import type { CampaignLevel } from '@/campaign/Levels';

/** Six games of a level for each player are seconds of simulation: room for a slow CI. */
export const CURVE_TIMEOUT_MS = 120_000;

/** The first day the bot plays (each seed a day later: the silhouette of the day changes). */
const FIRST_DAY = new Date(2026, 9, 26);

/** How far a level strays from its band, after six games for each player (none when it is in it). */
export function bandProblems(level: CampaignLevel): readonly string[] {
  const bot = curveBot(FIRST_DAY);
  const reports = PLAYER_SKILLS.flatMap((skill) =>
    Array.from({ length: CURVE_SEEDS }, (_, k) => bot.play({ level, skill, seed: k + 1 })),
  );
  return judgeLevel(level, BEAT_CHARTS[level.id]!, reports);
}

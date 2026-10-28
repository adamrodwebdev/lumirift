import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { format, resolveConfig } from 'prettier';
import { GENERATED_CHAPTERS, slotsOf } from '@/campaign/generator/ChapterPlan';
import { PackSearch, type KeptLevel, type LevelVerdict } from '@/campaign/generator/PackSearch';
import type { CampaignLevel } from '@/campaign/Levels';
import { parseLevelPack } from '@/campaign/packs/LevelPack';
import { verdictOf } from '../curve/campaignCurve';

/** A chapter's search may try many candidates, each a few dozen games. */
export const GENERATION_TIMEOUT_MS = 45 * 60_000;

const packFile = (chapter: number, suffix = '') =>
  fileURLToPath(
    new URL(`../../src/campaign/packs/chapter-${chapter}${suffix}.json`, import.meta.url),
  );

/** Writes JSON as the project's formatter would, so that the format check passes. */
async function writeJson(file: string, data: unknown): Promise<void> {
  const options = (await resolveConfig(file)) ?? {};
  writeFileSync(file, await format(JSON.stringify(data), { ...options, filepath: file }));
}

/** The levels the chapters before this one keep, as their packs stand on disk. */
function levelsBefore(chapter: number): CampaignLevel[] {
  return GENERATED_CHAPTERS.filter((each) => each < chapter).flatMap((earlier) =>
    parseLevelPack(JSON.parse(readFileSync(packFile(earlier), 'utf8'))).levels.map(
      ({ level }) => level,
    ),
  );
}

const summary = ({ wins, intensity }: LevelVerdict) => ({ wins, intensity });
const rounded = (value: number) => Math.round(value * 100) / 100;

/**
 * Generates a chapter (1.38): each slot's level the bot keeps, like none
 * kept before it, the pack the game loads (`chapter-N.json`)
 * and the search's report beside it (`chapter-N.report.json`: what each kept
 * level did, the other candidates in band, what was turned down and why). A
 * slot that finds no level fails the run, its rejections shown.
 */
export async function generateChapter(chapter: number): Promise<void> {
  const search = new PackSearch(verdictOf);
  const taken = levelsBefore(chapter);
  const kept: KeptLevel[] = [];
  const failures: string[] = [];
  for (const slot of slotsOf(chapter)) {
    try {
      const level = search.level(slot, taken);
      kept.push(level);
      taken.push(level.level);
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error));
    }
  }
  if (failures.length > 0) throw new Error(failures.join('\n\n'));
  await writeJson(packFile(chapter), {
    chapter,
    levels: kept.map(({ seed, level }) => ({ seed, level })),
  });
  await writeJson(packFile(chapter, '.report'), {
    chapter,
    levels: kept.map((each) => ({
      id: each.level.id,
      seed: each.seed,
      idea: each.idea,
      distance: rounded(each.distance),
      selection: summary(each.selection),
      validation: summary(each.validation),
      alternatives: each.alternatives.map(({ seed, idea, distance }) => ({
        seed,
        idea,
        distance: rounded(distance),
      })),
      rejected: each.rejected,
    })),
  });
}

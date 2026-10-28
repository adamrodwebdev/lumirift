import chapter6 from './chapter-6.json';
import chapter7 from './chapter-7.json';
import chapter8 from './chapter-8.json';
import chapter9 from './chapter-9.json';
import chapter10 from './chapter-10.json';
import { parseLevelPack, type LevelPack } from './LevelPack';

export type { LevelPack, PackedLevel } from './LevelPack';

/**
 * The generated chapters (1.38), as the generator wrote them
 * (`npm run generate:levels`): each level kept because the curve bot found
 * it in its band, on two sets of games.
 */
export const LEVEL_PACKS: readonly LevelPack[] = [
  chapter6,
  chapter7,
  chapter8,
  chapter9,
  chapter10,
].map(parseLevelPack);

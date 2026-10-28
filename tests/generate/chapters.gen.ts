import { describe, it } from 'vitest';
import { GENERATED_CHAPTERS } from '@/campaign/generator/ChapterPlan';
import { generateChapter, GENERATION_TIMEOUT_MS } from './levelPacks';

/*
 * The generated chapters, in order (1.38): each one avoids levels like those
 * of the chapters before it, as their packs stand on disk, so that one chapter can
 * be written again alone (`-t "chapter 8"`) and give what a full run gives.
 */
describe('The generated chapters', () => {
  for (const chapter of GENERATED_CHAPTERS) {
    it(`generates chapter ${chapter}`, () => generateChapter(chapter), GENERATION_TIMEOUT_MS);
  }
});

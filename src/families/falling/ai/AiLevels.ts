/** From a beginner to a top player, by the speeds of real players (pieces per second). */
export const AI_LEVELS = ['rookie', 'easy', 'normal', 'hard', 'expert'] as const;
export type AiLevel = (typeof AI_LEVELS)[number];

export const isAiLevel = (value: unknown): value is AiLevel =>
  typeof value === 'string' && (AI_LEVELS as readonly string[]).includes(value);

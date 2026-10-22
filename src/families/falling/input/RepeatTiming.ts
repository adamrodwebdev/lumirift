/**
 * A held move repeats: once at the press, again after a delay (DAS, delayed
 * auto shift), then at a steady interval (ARR, auto repeat rate). An
 * interval of 0 slides the piece to the wall at once. The player sets both.
 */
export interface RepeatTiming {
  readonly das: number;
  readonly arr: number;
}

export const DEFAULT_REPEAT: RepeatTiming = { das: 170, arr: 50 };

/** The settings' bounds and steps (ms). */
export const DAS_RANGE = { min: 50, max: 300, step: 10 } as const;
export const ARR_RANGE = { min: 0, max: 100, step: 5 } as const;

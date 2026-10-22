/** The player's record beside the score: null value when there is none yet. */
export interface BestLine {
  readonly value: number | null;
  /** Beaten during this game: the line becomes the new record. */
  readonly beaten: boolean;
}

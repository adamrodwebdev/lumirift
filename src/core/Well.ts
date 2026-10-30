/** A well's size, in cells. */
export interface WellCells {
  readonly columns: number;
  readonly rows: number;
}

/**
 * Lumirift's well (1.43): ten columns, like the genre's, and 18 rows, not the
 * genre's standard 20, which the Tetris v. Xio court held to be protected
 * expression (IP review, 30 Oct 2026; CAHIER § 9 quinquies). The falling
 * family's board and the Sand's grid both take it.
 */
export const WELL: WellCells = { columns: 10, rows: 18 };

/**
 * Every key the game saves (settings, records, progression, campaign, season):
 * what a portal's cloud save reads at start, in one request. A key missing here
 * is written but never read back on the portals (a test scans the code for them).
 */
export const SAVED_KEYS: readonly string[] = [
  'stackrift:settings',
  'stackrift:records',
  'stackrift:profile',
  'stackrift:campaign',
  'stackrift:season',
];

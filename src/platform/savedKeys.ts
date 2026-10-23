/**
 * Every key the game saves (settings, records, progression, campaign): what a
 * portal's cloud save reads at start, in one request.
 */
export const SAVED_KEYS: readonly string[] = [
  'stackrift:settings',
  'stackrift:records',
  'stackrift:profile',
  'stackrift:campaign',
];

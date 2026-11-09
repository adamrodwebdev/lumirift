/*
 * How much the game accepts from outside (the user's rule of 9 Nov 2026), in
 * one place: every text, save and list read at a door has its limit here. A
 * value over its limit is refused, never cut, and falls back as any value the
 * game cannot read. The game never writes more than it would read back.
 */

/** The longest text read at a door, in characters once cleaned (see `readText`). */
export const TEXT_LIMITS = {
  /** A language tag from the browser or a portal (`pt-BR`): 35 at most in practice (BCP 47). */
  languageTag: 35,
  /** A key's place on the keyboard (`KeyboardEvent.code`): the longest, `NumpadMemorySubtract`, has 20. */
  keyCode: 32,
  /** A record's name: a mode (`silhouette`), or a challenge and its day (`guardian:20261109`). */
  recordName: 32,
  /** A day's key, YYYYMMDD. */
  dayKey: 8,
} as const;

/**
 * The longest save read back from the browser's storage or a portal's, in
 * UTF-16 units of its JSON, checked before it is parsed. Measured on 9 Nov
 * 2026 with everything earned: settings 564, profile 2,184, campaign 700,
 * season 174; the records grow by about 12,100 a year of daily challenges,
 * so theirs holds some twenty years.
 */
export const SAVE_LIMITS = {
  settings: 8_192,
  profile: 65_536,
  campaign: 32_768,
  season: 8_192,
  records: 262_144,
} as const;

/** The most items read from a list or a map of a save: what the game writes, many times over. */
export const LIST_LIMITS = {
  /** Looks seen or given (`kind.id`): 37 exist on 9 Nov 2026. */
  cosmetics: 512,
  /** The Guardians defeated: four exist. */
  bosses: 16,
  /** The day's objectives: three. */
  objectives: 16,
  /** A season's tiers claimed: 30 at most on a track. */
  seasonTiers: 100,
  /** The records, a mode or a day each: about 480 a year of daily challenges. */
  records: 20_000,
} as const;

/** A count kept in a save (experience, games, points, time played): a whole number arithmetic keeps exact. */
export const COUNT = { min: 0, max: Number.MAX_SAFE_INTEGER, integer: true } as const;

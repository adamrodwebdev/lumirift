import { describe, expect, it } from 'vitest';
import { LIST_LIMITS, SAVE_LIMITS } from '@/core/limits';
import { DEFAULT_KEYS } from '@/families/falling/input/KeyBindings';
import { DEFAULT_REPEAT } from '@/families/falling/input/RepeatTiming';
import type { GameReport } from '@/progression/GameReport';
import { CAMPAIGN_KEY, CampaignService } from '@/services/CampaignService';
import { MemoryStorage } from '@/services/KeyValueStorage';
import { PROFILE_KEY, ProfileService } from '@/services/ProfileService';
import { SCORES_KEY, ScoreBoard } from '@/services/ScoreBoard';
import { SEASON_KEY, SeasonService } from '@/services/SeasonService';
import { SETTINGS_KEY, SettingsService, type Settings } from '@/services/SettingsService';

/*
 * Every save read back at the door (9 Nov 2026): tampered fields fall back
 * to their defaults one by one, the rest of the save stays; what the game
 * ever wrote still loads; a save the game cannot read is kept until the
 * player's progress replaces it.
 */

const DEFAULTS: Settings = {
  locale: 'fr',
  ghost: true,
  effects: 'full',
  shake: true,
  haptics: true,
  hapticsChosen: false,
  volume: 0.7,
  musicVolume: 0.5,
  controls: 'gestures',
  dragSpeed: 1,
  tapSides: true,
  leftHanded: false,
  muted: false,
  keys: DEFAULT_KEYS,
  ...DEFAULT_REPEAT,
};

/** A storage holding this text under the key. */
function storedText(key: string, text: string): MemoryStorage {
  const storage = new MemoryStorage();
  storage.set(key, text);
  return storage;
}

const PLACE = () => ({ modes: ['classic' as const], daily: true });
const settingsFrom = (text: string) =>
  new SettingsService(storedText(SETTINGS_KEY, text), DEFAULTS);
const profileFrom = (text: string) =>
  new ProfileService(storedText(PROFILE_KEY, text), PLACE).current;
const campaignFrom = (text: string) => new CampaignService(storedText(CAMPAIGN_KEY, text)).current;
const recordsFrom = (text: string) => new ScoreBoard(storedText(SCORES_KEY, text));
const noRewards = { receive: () => undefined };
const DECEMBER = () => new Date(Date.UTC(2026, 11, 16, 18));
const seasonFrom = (storage: MemoryStorage) => new SeasonService(storage, noRewards, DECEMBER);

const game: GameReport = {
  modeId: 'classic',
  daily: false,
  variant: null,
  reason: 'topOut',
  durationMs: 60_000,
  clears: 4,
  lines: 6,
  bestAtOnce: 3,
  bestCombo: 2,
};

/** JSON that outside hands could put where a count goes. */
const NOT_COUNTS = [
  { name: 'a number as text', json: '"12"' },
  { name: 'a number past any other', json: '1e999' },
  { name: 'a negative number', json: '-1' },
  { name: 'a fraction', json: '12.5' },
  { name: 'two to the 53rd', json: '9007199254740992' },
  { name: 'a list', json: '[12]' },
  { name: 'an object', json: '{}' },
  { name: 'null', json: 'null' },
  { name: 'a boolean', json: 'true' },
];

/** JSON that is not a day's key as the saves write it. */
const NOT_DAYS = [
  { name: 'a month that does not exist', json: '"20261399"' },
  { name: 'a day that does not exist', json: '"20260230"' },
  { name: 'a date with dashes', json: '"2026-11-09"' },
  { name: 'a number', json: '20261109' },
  { name: 'full-width digits', json: '"２０２６１１０９"' },
  { name: 'nine digits', json: '"202611090"' },
];

describe('the settings save, field by field', () => {
  it.each([
    { field: 'locale', json: '"FR"' },
    { field: 'locale', json: '"__proto__"' },
    { field: 'locale', json: '"toString"' },
    { field: 'locale', json: '["fr"]' },
    { field: 'locale', json: '"fr\\u200b"' },
    { field: 'ghost', json: '"false"' },
    { field: 'ghost', json: '0' },
    { field: 'effects', json: '"OFF"' },
    { field: 'effects', json: '"none"' },
    { field: 'volume', json: '"0.5"' },
    { field: 'volume', json: '1.5' },
    { field: 'volume', json: '-0.1' },
    { field: 'volume', json: '1e999' },
    { field: 'musicVolume', json: '[0.2]' },
    { field: 'controls', json: '"joystick"' },
    { field: 'controls', json: '"constructor"' },
    { field: 'dragSpeed', json: '"1.2"' },
    { field: 'dragSpeed', json: '0.79' },
    { field: 'dragSpeed', json: '1.61' },
    { field: 'das', json: '"170"' },
    { field: 'das', json: '49' },
    { field: 'das', json: '301' },
    { field: 'arr', json: '-1' },
    { field: 'arr', json: '101' },
    { field: 'arr', json: '1e999' },
    { field: 'tapSides', json: '"no"' },
    { field: 'muted', json: '1' },
  ] as const)('keeps the default $field for $json, and the rest of the save', ({ field, json }) => {
    const settings = settingsFrom(`{"${field}":${json},"leftHanded":true}`).current;
    expect(settings[field]).toEqual(DEFAULTS[field]);
    expect(settings.leftHanded).toBe(true);
  });

  it.each([
    { name: 'markup', json: '"<img src=x onerror=alert(1)>"' },
    { name: 'a name one character over its limit', json: `"K${'e'.repeat(32)}"` },
    { name: 'a space inside', json: '"Key A"' },
    { name: 'the prototype key', json: '"__proto__"' },
    { name: 'a number', json: '65' },
  ])('empties a key slot saved as $name, and keeps its other slot', ({ json }) => {
    const settings = settingsFrom(`{"keys":{"left":[${json},"KeyJ"]}}`).current;
    expect(settings.keys.left).toEqual([null, 'KeyJ']);
  });

  it('keeps a key whose name is exactly as long as its limit', () => {
    const settings = settingsFrom(`{"keys":{"left":["K${'e'.repeat(31)}",null]}}`).current;
    expect(settings.keys.left).toEqual([`K${'e'.repeat(31)}`, null]);
  });

  it.each([
    { name: 'a text', json: '"KeyA"' },
    { name: 'a list', json: '["KeyA"]' },
    { name: 'null', json: 'null' },
  ])('gives every action its default keys when the keys are $name', ({ json }) => {
    expect(settingsFrom(`{"keys":${json}}`).current.keys).toEqual(DEFAULT_KEYS);
  });
});

describe('the profile save, field by field', () => {
  it.each(
    ['xp', 'games', 'objectivesDone', 'playedMs'].flatMap((field) =>
      NOT_COUNTS.map((value) => ({ field, ...value })),
    ),
  )('counts no $field for $name, and keeps the rest', ({ field, json }) => {
    const profile = profileFrom(`{"${field}":${json},"trained":true}`);
    expect(profile).toMatchObject({ [field]: 0, trained: true });
  });

  it.each(NOT_COUNTS)('counts no streak for $name, and keeps its best', ({ json }) => {
    const profile = profileFrom(`{"streak":{"count":${json},"best":4,"lastDay":"20261108"}}`);
    expect(profile.streak).toEqual({ count: 0, best: 4, lastDay: '20261108' });
  });

  it.each(
    ['lastVisit', 'guardianDay', 'objectivesDay'].flatMap((field) =>
      NOT_DAYS.map((value) => ({ field, ...value })),
    ),
  )('keeps no $field for $name', ({ field, json }) => {
    const profile = profileFrom(`{"${field}":${json},"trained":true}`);
    expect(profile).toMatchObject({ [field]: null, trained: true });
  });

  it('keeps a day that is one', () => {
    expect(profileFrom('{"lastVisit":"20240229"}').lastVisit).toBe('20240229');
  });

  it.each([
    {
      name: 'a target past any number',
      objective: '{"kind":"lines","tier":"hard","target":1e999}',
    },
    { name: 'a negative target', objective: '{"kind":"lines","tier":"hard","target":-1}' },
    { name: 'a fractional target', objective: '{"kind":"lines","tier":"hard","target":2.5}' },
    { name: 'a target as text', objective: '{"kind":"lines","tier":"hard","target":"60"}' },
    {
      name: 'a mode the game does not have',
      objective: '{"kind":"playMode","tier":"easy","target":1,"mode":"nope"}',
    },
    {
      name: 'the prototype key as its mode',
      objective: '{"kind":"playMode","tier":"easy","target":1,"mode":"__proto__"}',
    },
    {
      name: 'a size past any number',
      objective: '{"kind":"bigClear","tier":"hard","target":1,"size":1e999}',
    },
    {
      name: 'an inherited name as its kind',
      objective: '{"kind":"toString","tier":"hard","target":1}',
    },
    { name: 'a tier in capitals', objective: '{"kind":"lines","tier":"HARD","target":60}' },
    { name: 'a list', objective: '[1]' },
  ])('leaves out an objective with $name, and keeps the others', ({ objective }) => {
    const kept = '{"objective":{"kind":"play","tier":"easy","target":3},"progress":1,"done":false}';
    const profile = profileFrom(`{"objectives":[{"objective":${objective},"progress":0},${kept}]}`);
    expect(profile.objectives).toEqual([
      { objective: { kind: 'play', tier: 'easy', target: 3 }, progress: 1, done: false },
    ]);
  });

  it.each([
    { name: 'past its target', json: '4' },
    { name: 'negative', json: '-1' },
    { name: 'a fraction', json: '1.5' },
  ])('starts the progress of an objective from zero when it is $name', ({ json }) => {
    const entry = `{"objective":{"kind":"play","tier":"easy","target":3},"progress":${json}}`;
    expect(profileFrom(`{"objectives":[${entry}]}`).objectives[0]?.progress).toBe(0);
  });

  it.each([
    {
      name: 'the prototype key as its material',
      equipment: '{"material":"__proto__","ambiance":"aurora","shatter":"confetti"}',
      worn: { material: 'crystal', ambiance: 'aurora', shatter: 'confetti' },
    },
    {
      name: 'an inherited name as its ambiance',
      equipment: '{"material":"neon","ambiance":"toString","shatter":"confetti"}',
      worn: { material: 'neon', ambiance: 'night', shatter: 'confetti' },
    },
    {
      name: 'a number as its burst',
      equipment: '{"material":"neon","ambiance":"aurora","shatter":42}',
      worn: { material: 'neon', ambiance: 'aurora', shatter: 'shards' },
    },
  ])('wears the default look for $name, and the rest of the look', ({ equipment, worn }) => {
    expect(profileFrom(`{"equipment":${equipment}}`).equipment).toEqual(worn);
  });

  it.each([
    { name: 'past the last day of the cycle', json: '7' },
    { name: 'negative', json: '-1' },
    { name: 'as text', json: '"3"' },
    { name: 'a fraction', json: '1.5' },
  ])('starts the gift cycle over when its next day is $name', ({ json }) => {
    expect(profileFrom(`{"gifts":{"next":${json}}}`).gifts.next).toBe(0);
  });

  it('keeps the gift cycle’s last day', () => {
    expect(profileFrom('{"gifts":{"next":6}}').gifts.next).toBe(6);
  });
});

/** A list of `count` copies of one item, as JSON. */
const listOf = (count: number, item: string) =>
  `[${Array.from({ length: count }, () => item).join(',')}]`;
const AN_OBJECTIVE = '{"objective":{"kind":"play","tier":"easy","target":3},"progress":0}';

describe('the lists of a profile, at most so many items', () => {
  it('reads the looks given up to their limit, none past it', () => {
    const at = `{"gifted":${listOf(LIST_LIMITS.cosmetics, '"ambiance.aurora"')}}`;
    const over = `{"gifted":${listOf(LIST_LIMITS.cosmetics + 1, '"ambiance.aurora"')}}`;
    expect(profileFrom(at).gifted).toEqual(['ambiance.aurora']);
    expect(profileFrom(over).gifted).toEqual([]);
  });

  it('reads the Guardians defeated up to their limit, none past it', () => {
    const at = `{"bosses":${listOf(LIST_LIMITS.bosses, '"duneWorm"')}}`;
    const over = `{"bosses":${listOf(LIST_LIMITS.bosses + 1, '"duneWorm"')}}`;
    expect(profileFrom(at).bosses).toEqual(['duneWorm']);
    expect(profileFrom(over).bosses).toEqual([]);
  });

  it('reads the day’s objectives up to their limit, none past it', () => {
    const at = `{"objectives":${listOf(LIST_LIMITS.objectives, AN_OBJECTIVE)}}`;
    const over = `{"objectives":${listOf(LIST_LIMITS.objectives + 1, AN_OBJECTIVE)}}`;
    expect(profileFrom(at).objectives).toHaveLength(LIST_LIMITS.objectives);
    expect(profileFrom(over).objectives).toEqual([]);
  });

  it('counts what was earned as seen when the seen list is one over its limit', () => {
    const at = `{"xp":2000,"seen":${listOf(LIST_LIMITS.cosmetics, '"material.neon"')}}`;
    const over = `{"xp":2000,"seen":${listOf(LIST_LIMITS.cosmetics + 1, '"material.neon"')}}`;
    expect(profileFrom(at).seen).toEqual(['material.neon']);
    expect(profileFrom(over).seen).toContain('material.paper');
  });
});

describe('the campaign save, level by level', () => {
  it.each([
    { name: 'stars as text', json: '"3"' },
    { name: 'a fraction of a star', json: '2.5' },
    { name: 'four stars', json: '4' },
    { name: 'no star', json: '0' },
    { name: 'stars past any number', json: '1e999' },
    { name: 'a list', json: '[3]' },
  ])('gives no stars to a level saved with $name, and keeps the others', ({ json }) => {
    expect(campaignFrom(`{"stars":{"1-1":${json},"1-2":2}}`).stars).toEqual({ '1-2': 2 });
  });

  it('reads only the levels the game has, never an inherited name', () => {
    const text = '{"stars":{"__proto__":3,"constructor":3,"1-2":2}}';
    expect(campaignFrom(text).stars).toEqual({ '1-2': 2 });
  });

  it.each([
    { name: 'a rank as text', json: '"1"' },
    { name: 'a fraction of a rank', json: '1.5' },
    { name: 'no rank', json: '0' },
    { name: 'a rank past the top', json: '4' },
  ])('buys nothing with $name, and keeps the other ranks', ({ json }) => {
    const text = `{"stars":{"1-1":3,"1-2":3},"ranks":{"phoenix":${json},"prism":1}}`;
    expect(campaignFrom(text).ranks).toEqual({ prism: 1 });
  });
});

describe('the season save, field by field', () => {
  it.each(NOT_COUNTS)(
    'counts no season points for $name, and keeps the tiers claimed',
    ({ json }) => {
      const { view } = seasonFrom(
        storedText(SEASON_KEY, `{"season":"embers","points":${json},"claimed":[1]}`),
      );
      expect(view.points).toBe(0);
      expect(view.tiers[0]?.state).toBe('claimed');
    },
  );

  it.each([
    { name: 'the prototype key', json: '"__proto__"' },
    { name: 'an inherited name', json: '"toString"' },
    { name: 'a number', json: '42' },
  ])('belongs to no season when its season is $name', ({ json }) => {
    const storage = storedText(SEASON_KEY, `{"season":${json},"points":900}`);
    expect(seasonFrom(storage).view.points).toBe(0);
  });

  it('claims no tier from a list one over its limit, and reads one at its limit', () => {
    const over = `{"season":"embers","points":900,"claimed":${listOf(LIST_LIMITS.seasonTiers + 1, '1')}}`;
    const at = `{"season":"embers","points":900,"claimed":${listOf(LIST_LIMITS.seasonTiers, '1')}}`;
    expect(seasonFrom(storedText(SEASON_KEY, over)).view.tiers[0]?.state).toBe('ready');
    expect(seasonFrom(storedText(SEASON_KEY, at)).view.tiers[0]?.state).toBe('claimed');
  });
});

describe('the records, name by name', () => {
  it.each([
    { name: 'the prototype key', record: '"__proto__":5' },
    { name: 'markup', record: '"<img src=x>":5' },
    { name: 'a name one character over its limit', record: `"${'m'.repeat(33)}":5` },
    { name: 'a hidden character', record: '"classic\\u200b":5' },
    { name: 'a space', record: '" classic":5' },
    { name: 'a day of seven digits', record: '"daily:2026110":5' },
    { name: 'an empty name', record: '"":5' },
  ])('leaves out a record named with $name, and keeps the others', ({ record }) => {
    const records = recordsFrom(`{${record},"tide":7}`);
    expect(records.best('tide')).toBe(7);
    expect(records.best('classic')).toBeNull();
  });

  it('keeps a record whose name is exactly as long as its limit', () => {
    expect(recordsFrom(`{"${'m'.repeat(32)}":5}`).best('m'.repeat(32))).toBe(5);
  });

  it.each(NOT_COUNTS)('leaves out a score of $name, and keeps the others', ({ json }) => {
    const records = recordsFrom(`{"classic":${json},"tide":7}`);
    expect(records.best('classic')).toBeNull();
    expect(records.best('tide')).toBe(7);
  });

  it('reads a book of as many records as its limit, and none of one more', () => {
    expect(recordsFrom(bookOf(LIST_LIMITS.records)).best('m0')).toBe(1);
    expect(recordsFrom(bookOf(LIST_LIMITS.records + 1)).best('m0')).toBeNull();
  });
});

/** A record book of `count` short names (`m0`, `m1`…), each a score of 1. */
function bookOf(count: number): string {
  return JSON.stringify(Object.fromEntries(Array.from({ length: count }, (_, i) => [`m${i}`, 1])));
}

/** A save's text padded to exactly `length` characters with a field the game ignores. */
const padded = (fields: object, length: number): string => {
  const bare = JSON.stringify({ ...fields, pad: '' });
  return JSON.stringify({ ...fields, pad: 'x'.repeat(length - bare.length) });
};

describe('each save, at most its own size', () => {
  it.each([
    { save: 'settings', read: (text: string) => settingsFrom(text).current.leftHanded },
    { save: 'profile', read: (text: string) => profileFrom(text).trained },
  ] as const)('reads the $save exactly as long as its limit, none one over', ({ save, read }) => {
    const fields = { leftHanded: true, trained: true };
    expect(read(padded(fields, SAVE_LIMITS[save]))).toBe(true);
    expect(read(padded(fields, SAVE_LIMITS[save] + 1))).toBe(false);
  });

  it('reads the campaign exactly as long as its limit, none one over', () => {
    const fields = { stars: { '1-1': 3 } };
    expect(campaignFrom(padded(fields, SAVE_LIMITS.campaign)).stars).toEqual({ '1-1': 3 });
    expect(campaignFrom(padded(fields, SAVE_LIMITS.campaign + 1)).stars).toEqual({});
  });

  it('reads the season exactly as long as its limit, none one over', () => {
    const fields = { season: 'embers', points: 900 };
    expect(seasonFrom(storedText(SEASON_KEY, padded(fields, SAVE_LIMITS.season))).view.points).toBe(
      900,
    );
    expect(
      seasonFrom(storedText(SEASON_KEY, padded(fields, SAVE_LIMITS.season + 1))).view.points,
    ).toBe(0);
  });

  it('reads the records exactly as long as their limit, none one over', () => {
    const fields = { classic: 12 };
    expect(recordsFrom(padded(fields, SAVE_LIMITS.records)).best('classic')).toBe(12);
    expect(recordsFrom(padded(fields, SAVE_LIMITS.records + 1)).best('classic')).toBeNull();
  });
});

describe('what the game ever saved still loads', () => {
  it('reads a profile of the first progression (0.9, 12 Oct 2026) whole', () => {
    const profile = profileFrom(
      JSON.stringify({
        xp: 2000,
        games: 12,
        objectivesDone: 5,
        streak: { count: 2, best: 3, lastDay: '20261012' },
        objectivesDay: '20261012',
        objectives: [
          {
            objective: { kind: 'playMode', tier: 'easy', target: 1, mode: 'tide' },
            progress: 0,
            done: false,
          },
          { objective: { kind: 'lines', tier: 'medium', target: 25 }, progress: 12, done: false },
          {
            objective: { kind: 'bigClear', tier: 'hard', target: 1, size: 3 },
            progress: 1,
            done: true,
          },
        ],
        equipment: { material: 'neon', ambiance: 'night', shatter: 'confetti' },
      }),
    );
    expect(profile).toMatchObject({
      xp: 2000,
      games: 12,
      objectivesDone: 5,
      streak: { count: 2, best: 3, lastDay: '20261012' },
      objectivesDay: '20261012',
      equipment: { material: 'neon', ambiance: 'night', shatter: 'confetti' },
    });
    expect(profile.objectives).toHaveLength(3);
    // Saved before the Atelier marked its new looks: what was earned then is not new.
    expect(profile.seen).toContain('material.neon');
  });

  it('reads a profile of the gift calendar (1.35) and the seasons (1.36) whole', () => {
    const saved = {
      xp: 900,
      games: 9,
      objectivesDone: 2,
      streak: { count: 3, best: 3, lastDay: '20261026' },
      objectivesDay: '20261026',
      objectives: [],
      equipment: { material: 'crystal', ambiance: 'aurora', shatter: 'shards' },
      seen: ['material.crystal', 'ambiance.night', 'shatter.shards', 'ambiance.aurora'],
      bosses: ['duneWorm'],
      guardianDay: '20261026',
      trained: true,
      playedMs: 540_000,
      gifts: { next: 2, lastDay: '20261026', shownDay: '20261026' },
      gifted: ['ambiance.aurora'],
      lastVisit: '20261026',
      welcomeBack: false,
      graceFromMs: 0,
    };
    expect(profileFrom(JSON.stringify(saved))).toEqual(saved);
  });

  it('reads the first settings (0.1: a theme the game no longer keeps)', () => {
    const settings = settingsFrom('{"locale":"id","theme":"dark","ghost":false}').current;
    expect(settings).toEqual({ ...DEFAULTS, locale: 'id', ghost: false });
  });

  it('reads the keys of 1.22, before the surge had its own', () => {
    const keys = {
      left: ['KeyJ', null],
      right: ['ArrowRight', 'KeyD'],
      softDrop: ['ArrowDown', 'KeyS'],
      rotateCw: ['ArrowUp', 'KeyX'],
      rotateCcw: ['KeyZ', null],
      hardDrop: ['Space', null],
      hold: ['KeyC', 'ShiftLeft'],
      ability: ['KeyF', null],
      turnLeft: ['KeyQ', null],
      turnRight: ['KeyE', null],
      pause: ['KeyP', null],
    };
    const settings = settingsFrom(JSON.stringify({ keys, das: 120, arr: 0 })).current;
    expect(settings.keys).toEqual({ ...keys, surge: ['KeyV', null] });
    expect([settings.das, settings.arr]).toEqual([120, 0]);
  });

  it('reads a campaign of 1.1 whole', () => {
    const campaign = { stars: { '1-1': 3, '1-2': 2 }, ranks: { phoenix: 1 } };
    expect(campaignFrom(JSON.stringify(campaign))).toEqual(campaign);
  });

  it('reads a season of 1.36 whole', () => {
    const { view } = seasonFrom(
      storedText(
        SEASON_KEY,
        '{"season":"embers","points":960,"claimed":[1,2],"week":"20261214","deeds":20,"done":true}',
      ),
    );
    expect(view.points).toBe(960);
    expect(view.tiers[1]?.state).toBe('claimed');
    expect(view.tiers[2]?.state).toBe('ready');
  });

  it('reads the records of every kind the game has kept', () => {
    const records = recordsFrom(
      '{"classic":1200,"daily:20261012":900,"guardian:20261019":4000,"race":30000,"race:20261026":28000}',
    );
    expect([
      records.best('classic'),
      records.best('daily:20261012'),
      records.best('guardian:20261019'),
      records.best('race'),
      records.best('race:20261026'),
    ]).toEqual([1200, 900, 4000, 30_000, 28_000]);
  });
});

describe('a save the game cannot read is kept', () => {
  it('keeps the profile through a visit, the day’s objectives and the calendar, until a game', () => {
    const storage = storedText(PROFILE_KEY, '{"xp":120,');
    const profiles = new ProfileService(storage, PLACE);
    profiles.visit('20261109');
    profiles.objectivesFor('20261109');
    profiles.markGiftShown('20261109');
    expect(storage.get(PROFILE_KEY)).toBe('{"xp":120,');
    profiles.recordGame(game, '20261109');
    expect(storage.get(PROFILE_KEY)).toContain('"games":1');
  });

  it('keeps the settings through the portal’s language, until the player changes one', () => {
    const storage = storedText(SETTINGS_KEY, '{"locale":');
    const settings = new SettingsService(storage, DEFAULTS);
    settings.followLocale('en');
    expect(storage.get(SETTINGS_KEY)).toBe('{"locale":');
    settings.chooseLocale('ru');
    expect(storage.get(SETTINGS_KEY)).toContain('"locale":"ru"');
  });

  it('keeps the season through the calendar’s catching up, until a game', () => {
    const storage = storedText(SEASON_KEY, padded({ points: 900 }, SAVE_LIMITS.season + 1));
    const seasons = seasonFrom(storage);
    seasons.catchUp();
    expect(storage.get(SEASON_KEY)).toHaveLength(SAVE_LIMITS.season + 1);
    seasons.recordGame(game, 40);
    expect(storage.get(SEASON_KEY)).toContain('"points":40');
  });
});

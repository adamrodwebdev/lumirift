import type { ElementName } from '@/session/Elements';

/*
 * The seasons, as data (1.36): a season change is a data release, not a code
 * change. Each runs whole weeks from a Monday at midnight UTC, the same week
 * on every device; each week features an element of the Sand. Season points
 * from play climb a free track of tiers: experience on most, a look on some.
 * A season's looks form a set: gathered (on the track, or from the day-7
 * gift once the season is over), they bring the season's crown. The looks
 * themselves are data too: an ambiance's lights, a shatter's colours, the
 * pattern and colours of a season's glass blocks.
 */

/** Two colours, from the first to the second. */
type Pair = readonly [string, string];

/** An ambiance a season brings: its two lights (light and dark theme) and its defeat. */
export interface SeasonAmbianceData {
  readonly kind: 'ambiance';
  readonly id: string;
  readonly glow: { readonly light: Pair; readonly dark: Pair };
  /** The matter the stack breaks into (two colours) and its two lights, at a defeat. */
  readonly defeat: {
    readonly matter: Pair;
    readonly light: Pair;
    readonly style: {
      readonly matter: 'dust' | 'ribbon' | 'bubble' | 'ember' | 'mote' | 'petal' | 'shard';
      readonly burst:
        'rise' | 'sweep' | 'bubble' | 'ember' | 'spiral' | 'petal' | 'burst' | 'drift';
      readonly drift:
        'rise' | 'sweep' | 'bubble' | 'ember' | 'spiral' | 'petal' | 'burst' | 'drift';
      readonly opensVoid: boolean;
    };
  };
}

/** A shatter a season brings: the colours its shards take, how they spin and fly. */
export interface SeasonShatterData {
  readonly kind: 'shatter';
  readonly id: string;
  readonly colours: readonly string[];
  readonly spin: number;
  readonly lift: number;
}

/** Blocks of season glass: dark glass, a pattern lit in the piece's colour, a gleam of its own. */
export interface SeasonMaterialData {
  readonly kind: 'material';
  readonly id: string;
  readonly pattern: 'embers' | 'ripples' | 'bolts';
  /** The light the pattern's brightest strokes take (mixed with the piece's colour). */
  readonly gleam: string;
  /** How much of the gleam goes into the piece's colour, 0 to 1. */
  readonly gleamShare: number;
}

export type SeasonLookData = SeasonAmbianceData | SeasonShatterData | SeasonMaterialData;

/** A season's track: its tiers, what each costs, the experience they give, the looks some give. */
export interface SeasonTrackData {
  readonly tiers: number;
  readonly pointsPerTier: number;
  /** Experience of the first and the last tier; those between climb evenly. */
  readonly xp: readonly [number, number];
  /** The tiers that give a look instead (tier → `kind.id`). */
  readonly looks: Readonly<Record<number, string>>;
}

export interface SeasonData {
  readonly id: string;
  /** 0 for the preseason. */
  readonly number: number;
  /** Its first Monday, UTC (YYYYMMDD). */
  readonly start: string;
  /** The element each week features, in order: as many weeks as the season lasts. */
  readonly weeks: readonly ElementName[];
  readonly track: SeasonTrackData;
  /** The looks the season brings: the track's, and the crown. */
  readonly looks: readonly SeasonLookData[];
  /** The look its set brings once every track look is the player's (`kind.id`), or null. */
  readonly crown: string | null;
}

/** The seasons, in order, with no gap between them. */
export const SEASONS = [
  {
    id: 'preseason',
    number: 0,
    start: '20261026',
    weeks: ['lightning', 'fire', 'water', 'seed', 'ice', 'oil', 'acid'],
    track: { tiers: 10, pointsPerTier: 250, xp: [100, 200], looks: { 10: 'shatter.riftspark' } },
    looks: [
      {
        kind: 'shatter',
        id: 'riftspark',
        colours: ['#c9a6ff', '#8b6cff', '#ffd98f', '#fff3d6'],
        spin: 1.6,
        lift: 1.3,
      },
    ],
    crown: null,
  },
  {
    id: 'embers',
    number: 1,
    start: '20261214',
    weeks: ['fire', 'water', 'oil', 'lightning', 'seed', 'fire'],
    track: {
      tiers: 30,
      pointsPerTier: 300,
      xp: [100, 300],
      looks: { 5: 'shatter.ember', 15: 'ambiance.embers', 30: 'material.cinder' },
    },
    looks: [
      {
        kind: 'shatter',
        id: 'ember',
        colours: ['#ffe8a3', '#ffb03a', '#ff6a2a', '#c2361c'],
        spin: 0.8,
        lift: 1.45,
      },
      {
        kind: 'ambiance',
        id: 'embers',
        glow: {
          light: ['rgb(235 100 40 / 0.15)', 'rgb(150 40 60 / 0.12)'],
          dark: ['rgb(255 110 40 / 0.22)', 'rgb(190 40 70 / 0.18)'],
        },
        defeat: {
          matter: ['#ffd27a', '#ff6a2a'],
          light: ['rgb(255 110 40 / 0.48)', 'rgb(190 40 70 / 0.38)'],
          style: { matter: 'ember', burst: 'ember', drift: 'rise', opensVoid: false },
        },
      },
      { kind: 'material', id: 'cinder', pattern: 'embers', gleam: '#ffb03a', gleamShare: 0.45 },
      { kind: 'material', id: 'phoenix', pattern: 'embers', gleam: '#fff3d6', gleamShare: 0.7 },
    ],
    crown: 'material.phoenix',
  },
  {
    id: 'tides',
    number: 2,
    start: '20270125',
    weeks: ['water', 'ice', 'seed', 'lightning', 'acid', 'water'],
    track: {
      tiers: 30,
      pointsPerTier: 300,
      xp: [100, 300],
      looks: { 5: 'shatter.ripple', 15: 'ambiance.lagoon', 30: 'material.tideglass' },
    },
    looks: [
      {
        kind: 'shatter',
        id: 'ripple',
        colours: ['#e0fbff', '#7fe3ff', '#2ab8e6', '#1f6fd6'],
        spin: 0.6,
        lift: 0.9,
      },
      {
        kind: 'ambiance',
        id: 'lagoon',
        glow: {
          light: ['rgb(30 160 190 / 0.15)', 'rgb(40 110 210 / 0.12)'],
          dark: ['rgb(40 210 230 / 0.2)', 'rgb(50 120 255 / 0.18)'],
        },
        defeat: {
          matter: ['#bff6ff', '#2ab8e6'],
          light: ['rgb(40 210 230 / 0.44)', 'rgb(50 120 255 / 0.36)'],
          style: { matter: 'bubble', burst: 'bubble', drift: 'bubble', opensVoid: false },
        },
      },
      { kind: 'material', id: 'tideglass', pattern: 'ripples', gleam: '#bff6ff', gleamShare: 0.4 },
      { kind: 'material', id: 'pearl', pattern: 'ripples', gleam: '#fff8fb', gleamShare: 0.72 },
    ],
    crown: 'material.pearl',
  },
  {
    id: 'storm',
    number: 3,
    start: '20270308',
    weeks: ['lightning', 'fire', 'ice', 'oil', 'water', 'lightning'],
    track: {
      tiers: 30,
      pointsPerTier: 300,
      xp: [100, 300],
      looks: { 5: 'shatter.static', 15: 'ambiance.thunderhead', 30: 'material.stormglass' },
    },
    looks: [
      {
        kind: 'shatter',
        id: 'static',
        colours: ['#f4f1ff', '#c9a6ff', '#7f8cff', '#3de0ff'],
        spin: 2.2,
        lift: 1.15,
      },
      {
        kind: 'ambiance',
        id: 'thunderhead',
        glow: {
          light: ['rgb(90 80 200 / 0.15)', 'rgb(40 170 220 / 0.12)'],
          dark: ['rgb(120 100 255 / 0.22)', 'rgb(60 210 255 / 0.18)'],
        },
        defeat: {
          matter: ['#e6dcff', '#3de0ff'],
          light: ['rgb(120 100 255 / 0.46)', 'rgb(60 210 255 / 0.38)'],
          style: { matter: 'shard', burst: 'burst', drift: 'spiral', opensVoid: true },
        },
      },
      { kind: 'material', id: 'stormglass', pattern: 'bolts', gleam: '#e6dcff', gleamShare: 0.45 },
      { kind: 'material', id: 'tempest', pattern: 'bolts', gleam: '#7fffd4', gleamShare: 0.62 },
    ],
    crown: 'material.tempest',
  },
] as const satisfies readonly SeasonData[];

export type SeasonId = (typeof SEASONS)[number]['id'];

type AllLooks = (typeof SEASONS)[number]['looks'][number];
/** The ids of the looks the seasons bring, by kind (they join the Atelier's). */
export type SeasonAmbianceId = Extract<AllLooks, { kind: 'ambiance' }>['id'];
export type SeasonShatterId = Extract<AllLooks, { kind: 'shatter' }>['id'];
export type SeasonMaterialId = Extract<AllLooks, { kind: 'material' }>['id'];

const looksOf = <K extends SeasonLookData['kind']>(kind: K) =>
  SEASONS.flatMap((season) => season.looks as readonly SeasonLookData[]).filter(
    (look): look is Extract<SeasonLookData, { kind: K }> => look.kind === kind,
  );

export const SEASON_AMBIANCES = looksOf('ambiance') as readonly (SeasonAmbianceData & {
  readonly id: SeasonAmbianceId;
})[];
export const SEASON_SHATTERS = looksOf('shatter') as readonly (SeasonShatterData & {
  readonly id: SeasonShatterId;
})[];
export const SEASON_MATERIALS = looksOf('material') as readonly (SeasonMaterialData & {
  readonly id: SeasonMaterialId;
})[];

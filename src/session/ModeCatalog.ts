import type { GameSession, ResultKind, SessionOptions } from './GameSession';
import type { FamilyId, ModeId } from './ModeId';

/** Creates a session of one family; each family module exports one. */
export type SessionFactory = (modeId: ModeId, options: SessionOptions) => GameSession;
export type FamilyLoader = () => Promise<SessionFactory>;

export interface ModeDescriptor {
  readonly id: ModeId;
  readonly family: FamilyId;
  readonly result: ResultKind;
  /** Can be drawn as the mode of the daily challenge. */
  readonly dailyEligible: boolean;
  /** Variants to choose from before playing (AI levels of the duel). */
  readonly variants?: readonly string[];
  /** The variant offered first. */
  readonly defaultVariant?: string;
}

/** Modes in menu order. */
const DESCRIPTORS: readonly ModeDescriptor[] = [
  { id: 'classic', family: 'falling', result: 'score', dailyEligible: true },
  { id: 'tide', family: 'falling', result: 'time', dailyEligible: false },
  { id: 'flip', family: 'falling', result: 'score', dailyEligible: false },
  { id: 'chroma', family: 'falling', result: 'score', dailyEligible: true },
  { id: 'mirror', family: 'falling', result: 'score', dailyEligible: true },
  { id: 'fusion', family: 'falling', result: 'score', dailyEligible: true },
  { id: 'tilt', family: 'falling', result: 'score', dailyEligible: false },
  { id: 'silhouette', family: 'falling', result: 'score', dailyEligible: false },
  { id: 'rhythm', family: 'falling', result: 'score', dailyEligible: true },
  {
    id: 'duel',
    family: 'falling',
    result: 'score',
    dailyEligible: false,
    variants: ['easy', 'normal', 'expert'],
    defaultVariant: 'normal',
  },
  { id: 'mosaic', family: 'placement', result: 'score', dailyEligible: true },
];

/** Each family is a separate chunk, downloaded the first time one of its modes is played. */
const LOADERS = new Map<FamilyId, FamilyLoader>([
  ['falling', () => import('@/families/falling').then((family) => family.createFallingSession)],
  [
    'placement',
    () => import('@/families/placement').then((family) => family.createPlacementSession),
  ],
]);

/**
 * Every playable mode, and the single place that turns a mode id into a
 * running session.
 */
export class ModeCatalog {
  constructor(
    private readonly descriptors: readonly ModeDescriptor[] = DESCRIPTORS,
    private readonly loaders: ReadonlyMap<FamilyId, FamilyLoader> = LOADERS,
  ) {}

  list(): readonly ModeDescriptor[] {
    return this.descriptors;
  }

  get(id: ModeId): ModeDescriptor {
    const descriptor = this.descriptors.find((mode) => mode.id === id);
    if (!descriptor) throw new Error(`Unknown mode "${id}"`);
    return descriptor;
  }

  dailyEligible(): readonly ModeId[] {
    return this.descriptors.filter((mode) => mode.dailyEligible).map((mode) => mode.id);
  }

  async create(id: ModeId, options: SessionOptions): Promise<GameSession> {
    const { family } = this.get(id);
    const load = this.loaders.get(family);
    if (!load) throw new Error(`Family "${family}" is not available`);
    const factory = await load();
    return factory(id, options);
  }
}

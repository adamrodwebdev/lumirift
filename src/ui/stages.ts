import { defineAsyncComponent, type AsyncComponentLoader, type Component } from 'vue';
import type { ModeDescriptor } from '@/session/ModeCatalog';
import type { FamilyId, ModeId } from '@/session/ModeId';
import { isTouchScreen } from './useOrientation';

/*
 * The play area of each family (well, previews, controls), loaded with the
 * family itself; a mode may bring its own (the duel shows two wells). Every
 * stage receives the same props: `session`, `clock`, `active` (accepts
 * input) and `ghost`, and emits `pause`.
 */
type StageLoader = AsyncComponentLoader<Component>;

const FAMILY_STAGES: Readonly<Partial<Record<FamilyId, StageLoader>>> = {
  falling: () => import('@/families/falling/ui/FallingStage.vue'),
  sand: () => import('@/families/sand/ui/SandStage.vue'),
  placement: () => import('@/families/placement/ui/MosaicStage.vue'),
  volume: () => import('@/families/volume/ui/TowerStage.vue'),
  // The race (1.34) swaps the stages of its worlds: `familyStage`.
  rift: () => import('@/families/race/ui/RaceStage.vue'),
  // Dunes (1.37): the Sand's grains, the Mosaic's hand.
  dunes: () => import('@/families/dunes/ui/DunesStage.vue'),
};

/** The families whose stages a family plays inside its own: the race's worlds. */
const INNER_FAMILIES: Readonly<Partial<Record<FamilyId, readonly FamilyId[]>>> = {
  rift: ['falling', 'sand', 'volume'],
};

const MODE_STAGES: Readonly<Partial<Record<ModeId, StageLoader>>> = {
  duel: () => import('@/families/falling/ui/DuelStage.vue'),
};

const loaderFor = ({ id, family }: ModeDescriptor): StageLoader => {
  const load = MODE_STAGES[id] ?? FAMILY_STAGES[family];
  if (!load) throw new Error(`No stage for mode "${id}"`);
  return load;
};

const components = new Map<StageLoader, Component>();

const componentOf = (load: StageLoader): Component => {
  let stage = components.get(load);
  if (!stage) {
    stage = defineAsyncComponent(load);
    components.set(load, stage);
  }
  return stage;
};

export function stageFor(mode: ModeDescriptor): Component {
  return componentOf(loaderFor(mode));
}

/** The stage of a family's board (a world of the race). */
export function familyStage(family: FamilyId): Component {
  const load = FAMILY_STAGES[family];
  if (!load) throw new Error(`No stage for family "${family}"`);
  return componentOf(load);
}

/** The families played with the phone gestures (the Mosaic is dragged). */
const GESTURE_FAMILIES: ReadonlySet<FamilyId> = new Set(['falling', 'sand', 'volume', 'rift']);

/**
 * Downloads a mode's stage ahead of time (while the screen changes), the
 * stages it plays inside (the race's worlds), and on a touch screen its
 * gestures, so that the first touch already plays.
 */
export async function preloadStage(mode: ModeDescriptor): Promise<void> {
  const gestures =
    GESTURE_FAMILIES.has(mode.family) && isTouchScreen()
      ? import('@/families/falling/input/phone/PhoneGestures')
      : null;
  const inner = (INNER_FAMILIES[mode.family] ?? []).map((family) => FAMILY_STAGES[family]?.());
  await Promise.all([loaderFor(mode)(), gestures, ...inner]);
}

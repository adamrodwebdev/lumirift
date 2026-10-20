import { defineAsyncComponent, type AsyncComponentLoader, type Component } from 'vue';
import type { ModeDescriptor } from '@/session/ModeCatalog';
import type { FamilyId, ModeId } from '@/session/ModeId';

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

export function stageFor(mode: ModeDescriptor): Component {
  const load = loaderFor(mode);
  let stage = components.get(load);
  if (!stage) {
    stage = defineAsyncComponent(load);
    components.set(load, stage);
  }
  return stage;
}

/** Downloads a mode's stage ahead of time (while the screen changes). */
export async function preloadStage(mode: ModeDescriptor): Promise<void> {
  await loaderFor(mode)();
}

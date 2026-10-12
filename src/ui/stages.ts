import { defineAsyncComponent, type Component } from 'vue';
import type { ModeDescriptor } from '@/session/ModeCatalog';
import type { FamilyId, ModeId } from '@/session/ModeId';

/*
 * The play area of each family (well, previews, controls), loaded with the
 * family itself; a mode may bring its own (the duel shows two wells). Every
 * stage receives the same props: `session`, `clock`, `active` (accepts
 * input) and `ghost`, and emits `pause`.
 */
const FAMILY_STAGES: Readonly<Partial<Record<FamilyId, Component>>> = {
  falling: defineAsyncComponent(() => import('@/families/falling/ui/FallingStage.vue')),
  sand: defineAsyncComponent(() => import('@/families/sand/ui/SandStage.vue')),
  placement: defineAsyncComponent(() => import('@/families/placement/ui/MosaicStage.vue')),
  volume: defineAsyncComponent(() => import('@/families/volume/ui/TowerStage.vue')),
};

const MODE_STAGES: Readonly<Partial<Record<ModeId, Component>>> = {
  duel: defineAsyncComponent(() => import('@/families/falling/ui/DuelStage.vue')),
};

export function stageFor({ id, family }: ModeDescriptor): Component {
  const stage = MODE_STAGES[id] ?? FAMILY_STAGES[family];
  if (!stage) throw new Error(`No stage for mode "${id}"`);
  return stage;
}

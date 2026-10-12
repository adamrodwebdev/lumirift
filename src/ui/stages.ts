import { defineAsyncComponent, type Component } from 'vue';
import type { FamilyId } from '@/session/ModeId';

/**
 * The play area of each family (well, previews, controls), loaded with the
 * family itself. Every stage receives the same props: `session`, `clock`,
 * `active` (accepts input) and `ghost`, and emits `pause`.
 */
const STAGES: Readonly<Partial<Record<FamilyId, Component>>> = {
  falling: defineAsyncComponent(() => import('@/families/falling/ui/FallingStage.vue')),
};

export function stageFor(family: FamilyId): Component {
  const stage = STAGES[family];
  if (!stage) throw new Error(`No stage for family "${family}"`);
  return stage;
}

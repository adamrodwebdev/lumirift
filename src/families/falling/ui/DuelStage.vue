<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { FrameClock } from '@/app/FrameClock';
import type { GameSession } from '@/session/GameSession';
import { DuelSession } from '../DuelSession';
import FallingStage from './FallingStage.vue';
import OpponentWell from './OpponentWell.vue';

/** A duel: the player's usual stage, with the opponent's well beside the hold piece. */
const props = defineProps<{
  session: GameSession;
  clock: FrameClock;
  active: boolean;
  ghost: boolean;
}>();
const emit = defineEmits<{ pause: [] }>();

if (!(props.session instanceof DuelSession)) throw new Error('DuelStage needs a DuelSession');
const duel: DuelSession = props.session;

const { t } = useI18n();
const label = computed(() => t(`variants.duel.${duel.level}`));
</script>

<template>
  <FallingStage
    :session="duel.player"
    :clock="clock"
    :active="active"
    :ghost="ghost"
    @pause="emit('pause')"
  >
    <template #side>
      <OpponentWell :session="duel.opponent" :clock="clock" :label="label" />
    </template>
  </FallingStage>
</template>

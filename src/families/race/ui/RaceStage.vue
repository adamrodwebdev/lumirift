<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useServices } from '@/app/AppServices';
import type { FrameClock } from '@/app/FrameClock';
import { useFormat } from '@/app/useFormat';
import { bonus, levelUp, riftTear, warning as warningSound, wellBreak } from '@/fx/sounds';
import type { GameSession } from '@/session/GameSession';
import { familyStage } from '@/ui/stages';
import { RaceSession } from '../RaceSession';
import { WORLD_GAMES } from '../RaceWorlds';
import { CLOCK } from '../rules/RaceTuning';
import RaceClock from './RaceClock.vue';
import RaceGuardianCard from './RaceGuardianCard.vue';
import RaceMoments from './RaceMoments.vue';
import RaceWorlds from './RaceWorlds.vue';
import { useRace } from './useRace';

/**
 * The Rift Race (1.34): the stage of the world played now (the well, the
 * Sand, the Tower), a fresh one at every shift, and around it the race's
 * parts, each in its area of the game screen's grid: the clock, the worlds
 * and the phase, the Guardian, the moments over the well. The world's stage
 * takes input only while the race plays it (never during a wipe).
 */
const props = defineProps<{
  session: GameSession;
  clock: FrameClock;
  active: boolean;
  ghost: boolean;
}>();
const emit = defineEmits<{ pause: [] }>();

if (!(props.session instanceof RaceSession)) throw new Error('RaceStage needs a RaceSession');
const race: RaceSession = props.session;

const { t } = useI18n();
const format = useFormat();
const { audio, haptics } = useServices();
const state = useRace(race, props.clock);
const { board, boardKey, world, stage, warning, leftMs, shiftInS, phaseShare } = state;
const { guardian, gains, wipes, hurrah } = state;

const worldStage = computed(() => familyStage(WORLD_GAMES[world.value].family));
/** The rules in a word: what an overflow costs. */
const note = {
  cost: format.number(CLOCK.overflowCostMs / 1000),
  floor: format.number(CLOCK.overflowFloorMs / 1000),
};
const playing = computed(() => props.active && stage.value === 'play');

/** What screen readers hear of the race: the shifts, the Guardians, the end. */
const said = ref('');
const offs = [
  race.race.on('warning', (next) => {
    audio.play(warningSound);
    said.value = [
      t('race.announce', { world: t(`race.world.${next.next}`) }),
      ...(next.speedUp ? [t('race.speedUp')] : []),
      ...(next.guardian ? [t(`race.guardian.joins.${next.guardian}`)] : []),
    ].join(' ');
  }),
  race.race.on('wipe', () => audio.play(riftTear)),
  race.race.on('shift', ({ guardian: joining }) => {
    if (joining) audio.play(levelUp);
  }),
  race.race.on('time', ({ reason }) => {
    if (reason === 'overflow') {
      audio.play(wellBreak);
      haptics.pulse([60, 40, 60]);
    } else if (reason === 'defeat') audio.play(bonus);
  }),
  race.race.on('guardian', ({ boss, change }) => {
    if (change === 'beaten') said.value = t(`race.guardian.beaten.${boss}`);
    else if (change === 'left') said.value = t(`race.guardian.gone.${boss}`);
  }),
  race.race.on('hurrah', ({ points }) => {
    audio.play(bonus);
    said.value = `${t('race.hurrah')} ${t('race.hurrahPoints', { n: format.number(points) })}`;
  }),
];
onBeforeUnmount(() => offs.forEach((off) => off()));
</script>

<template>
  <div class="stage race" :data-race-world="world">
    <component
      :is="worldStage"
      :key="boardKey"
      :session="board"
      :clock="clock"
      :active="playing"
      :ghost="ghost"
      @pause="emit('pause')"
    />

    <RaceClock class="race__clock" :left-ms="leftMs" :cap-ms="CLOCK.capMs" :gains="gains" />
    <RaceWorlds
      class="race__worlds"
      :world="world"
      :shift-in-s="shiftInS"
      :phase-share="phaseShare"
    />
    <RaceGuardianCard v-if="guardian" class="race__guardian" :guardian="guardian" />
    <p class="race__note">{{ t('race.note', note) }}</p>
    <RaceMoments
      :stage="stage"
      :warning="warning"
      :shift-in-s="shiftInS"
      :wipes="wipes"
      :hurrah="hurrah"
    />
    <p class="sr-only" aria-live="polite" aria-atomic="true">{{ said }}</p>
  </div>
</template>

<style scoped>
.race__clock {
  grid-area: clock;
  justify-self: center;
  align-self: center;
}

.race__worlds {
  grid-area: worlds;
  min-width: 0;
}

/* Portrait: in the counters' row, over them (the game screen hides them meanwhile). */
.race__guardian {
  grid-area: stats;
  align-self: stretch;
  z-index: 1;
}

.race__note {
  display: none;
}

@media (orientation: landscape) {
  .race__clock,
  .race__worlds {
    justify-self: end;
    width: min(100%, 15em);
    font-size: var(--hud-size);
  }

  .race__guardian {
    justify-self: end;
    width: min(100%, 15em);
  }

  /* The rules in a word, beside the well, where a tall screen has room for them. */
  .race__note {
    grid-area: note;
    align-self: end;
    justify-self: start;
    width: min(100%, 15em);
    margin: 0;
    padding: 0.8em 1em;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--glass);
    color: var(--text-muted);
    font-size: calc(var(--hud-size) * 0.875);
    line-height: 1.5;
  }
}

/* With room, the Guardian's card stands atop the next pieces (it takes the counters' place otherwise). */
@media (orientation: landscape) and (height >= 30rem) {
  .race__guardian {
    grid-area: guardian;
    justify-self: start;
    align-self: start;
  }
}

@media (orientation: landscape) and (height >= 40rem) {
  .race__note {
    display: block;
  }
}
</style>

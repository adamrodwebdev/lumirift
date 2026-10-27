import { onBeforeUnmount, ref, shallowRef } from 'vue';
import type { FrameClock } from '@/app/FrameClock';
import type { BossId, GameSession } from '@/session/GameSession';
import type { RaceEventMap, RaceSession, RaceStage, RaceWarning, TimeReason } from '../RaceSession';
import { CLOCK } from '../rules/RaceTuning';
import type { RaceWorld } from '../rules/ShiftSchedule';

/** A gain (or a loss) of time, floating by the clock for a moment. */
export interface TimeGain {
  readonly id: number;
  readonly ms: number;
  readonly reason: TimeReason;
  readonly combo: number;
  /** Points paid for the seconds spilled over the cap. */
  readonly points: number;
}

/** The Guardian in the world, as its card shows it. */
export interface GuardianView {
  readonly boss: BossId;
  /** Whole seconds before it leaves. */
  readonly leftS: number;
  /** Its health left, from 1 to 0. */
  readonly health: number;
}

/** How long a gain floats by the clock (ms); the three last ones show. */
const GAIN_MS = 1600;
const GAINS_SHOWN = 3;
/** The clock's arc moves by tenths of a second: smooth enough, without a render each frame. */
const ARC_STEP_MS = 100;
/** The final seconds: the clock turns red. */
export const URGENT_MS = 10_000;

/**
 * The race as its stage shows it (1.34): the world's game played now, the
 * clock, the phase, the warning, the Guardian, the gains. The race's events
 * say what happens; the frames refresh what runs (the clock, the phase), each
 * value only when it changes on screen.
 */
export function useRace(race: RaceSession, clock: FrameClock) {
  /** The world's game on screen, and a key that changes with each fresh board. */
  const board = shallowRef<GameSession>(race.current);
  const boardKey = ref(0);
  const world = ref<RaceWorld>(race.world);
  const stage = ref<RaceStage>(race.stage);
  const warning = shallowRef<RaceWarning | null>(race.warning);
  /** The clock (ms), by tenths of a second. */
  const leftMs = ref(race.timeLeftMs);
  /** Whole seconds before the shift. */
  const shiftInS = ref(Math.ceil(race.shiftInMs / 1000));
  /** The share of the world's phase played (0 to 1), by half percents. */
  const phaseShare = ref(race.phaseShare);
  const guardian = shallowRef<GuardianView | null>(null);
  const gains = shallowRef<readonly TimeGain[]>([]);
  /** Counts the wipes: each one plays the tear again. */
  const wipes = ref(0);
  const hurrah = shallowRef<RaceEventMap['hurrah'] | null>(null);
  let gainId = 0;
  const timers = new Set<ReturnType<typeof setTimeout>>();

  const float = (event: RaceEventMap['time']) => {
    const gain: TimeGain = { id: ++gainId, ...event };
    gains.value = [...gains.value.slice(1 - GAINS_SHOWN), gain];
    const timer = setTimeout(() => {
      timers.delete(timer);
      gains.value = gains.value.filter((shown) => shown !== gain);
    }, GAIN_MS);
    timers.add(timer);
  };

  const refresh = () => {
    if (stage.value !== race.stage) stage.value = race.stage;
    const left = Math.ceil(race.timeLeftMs / ARC_STEP_MS) * ARC_STEP_MS;
    if (left !== leftMs.value) leftMs.value = left;
    const shiftIn = Math.ceil(race.shiftInMs / 1000);
    if (shiftIn !== shiftInS.value) shiftInS.value = shiftIn;
    const share = Math.round(race.phaseShare * 200) / 200;
    if (share !== phaseShare.value) phaseShare.value = share;
    const encounter = race.guardian;
    const status = race.boss();
    const next: GuardianView | null = encounter
      ? {
          boss: encounter.boss,
          leftS: Math.ceil(encounter.leftMs / 1000),
          health: status ? Math.round((status.health / status.maxHealth) * 100) / 100 : 1,
        }
      : null;
    const shown = guardian.value;
    if (
      next?.boss !== shown?.boss ||
      next?.leftS !== shown?.leftS ||
      next?.health !== shown?.health
    ) {
      guardian.value = next;
    }
  };

  const offs = [
    clock.subscribe(refresh),
    race.race.on('time', float),
    race.race.on('warning', (event) => (warning.value = event)),
    race.race.on('wipe', () => {
      wipes.value++;
      refresh();
    }),
    race.race.on('shift', ({ world: next }) => {
      board.value = race.current;
      boardKey.value++;
      world.value = next;
      warning.value = null;
    }),
    race.race.on('hurrah', (scored) => {
      hurrah.value = scored;
      refresh();
    }),
  ];
  refresh();

  onBeforeUnmount(() => {
    offs.forEach((off) => off());
    timers.forEach((timer) => clearTimeout(timer));
  });

  return {
    board,
    boardKey,
    world,
    stage,
    warning,
    leftMs,
    capMs: CLOCK.capMs,
    shiftInS,
    phaseShare,
    guardian,
    gains,
    wipes,
    hurrah,
  };
}

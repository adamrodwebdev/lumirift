import { onBeforeUnmount, ref } from 'vue';
import type { FrameClock } from '@/app/FrameClock';
import { surgeIn, surgeOut, surgeReady } from '@/fx/sounds';
import { pointsOf, type GameSession } from '@/session/GameSession';
import type { FamilyId } from '@/session/ModeId';
import { RiftSurge } from '@/session/RiftSurge';
import { SURGE_PACE, surgeTuningFor } from '@/session/SurgeTuning';
import type { AudioEngine } from '@/services/audio/AudioEngine';
import type { Haptics } from '@/services/Haptics';
import type { SurgeControl } from '../surgeControl';

export interface SurgeOptions {
  readonly audio: AudioEngine;
  readonly haptics: Haptics;
  readonly clock: FrameClock;
  /** The gauge just filled: the screen says so (with the player's key). */
  readonly onReady?: () => void;
}

/**
 * The rift surge of a game (1.25), for the game screen: the game's clears
 * fill its gauge; triggered, it slows the clock to a third for eight seconds
 * of real time, sinks the music, then hands the game the exit bonus the
 * surge reckons (the points scored meanwhile, multiplied), with a shock wave. The stage gets its gauge and the
 * player's call (`control`); the screen draws the surge over the well.
 */
export function useSurge(options: SurgeOptions) {
  const { audio, haptics, clock } = options;
  let surge: RiftSurge | null = null;
  let session: GameSession | null = null;
  let off: (() => void) | null = null;

  const enabled = ref(false);
  const fill = ref(0);
  const ready = ref(false);
  const active = ref(false);
  /** Bumped at each surge's end: the shock wave. */
  const shock = ref(0);

  const sync = () => {
    const shown = surge ? Math.round(surge.fill * 100) / 100 : 0;
    if (shown !== fill.value) fill.value = shown;
    ready.value = surge?.ready ?? false;
    active.value = surge?.active ?? false;
    enabled.value = surge !== null;
  };

  /** Time back to its pace, the music back up. */
  const calm = () => {
    clock.setPace(1);
    audio.setSurge(0);
  };

  /** A new game: its own surge, if its mode has one. */
  const attach = (current: GameSession, family: FamilyId, modeId: string) => {
    detach();
    const tuning = surgeTuningFor(family, modeId);
    if (!tuning) return;
    const own = new RiftSurge(tuning, () => pointsOf(current.result()));
    surge = own;
    session = current;
    const offs = [
      current.events.on('clear', ({ lines }) => own.cleared(lines)),
      own.events.on('ready', () => {
        audio.play(surgeReady);
        haptics.pulse([10, 30, 10]);
        options.onReady?.();
      }),
      own.events.on('start', () => {
        clock.setPace(SURGE_PACE);
        audio.setSurge(1);
        audio.play(surgeIn);
        haptics.pulse(30);
      }),
      own.events.on('end', ({ factor, bonus }) => {
        calm();
        if (bonus > 0) session?.awardBonus?.(bonus, 'surge');
        audio.play(surgeOut(factor));
        haptics.pulse([20, 30, 60]);
        shock.value++;
      }),
    ];
    off = () => offs.forEach((stop) => stop());
    sync();
  };

  /** Every frame: the surge counts real time while the game runs. */
  const update = (realMs: number, running: boolean) => {
    if (!surge) return;
    if (running) surge.update(realMs);
    sync();
  };

  const trigger = () => {
    if (session?.state !== 'running') return;
    surge?.trigger();
    sync();
  };

  /** The game is over: a running surge stops where it is, without its bonus. */
  const end = () => {
    if (surge?.active) calm();
    surge?.reset();
    sync();
  };

  const detach = () => {
    end();
    off?.();
    off = null;
    surge = null;
    session = null;
    sync();
  };

  onBeforeUnmount(detach);

  const control: SurgeControl = { enabled, fill, ready, active, trigger };
  return { control, attach, update, end, detach, active, shock };
}

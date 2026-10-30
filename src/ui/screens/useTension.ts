import { onBeforeUnmount, ref, shallowRef, type Ref } from 'vue';
import type { FrameClock } from '@/app/FrameClock';
import type { EffectsLevel } from '@/fx/EffectsProfile';
import { FlashLimiter } from '@/fx/FlashLimiter';
import { closeCall as closeCallSound, countdown, hurry, wellBreak } from '@/fx/sounds';
import { FinalSeconds } from '@/session/FinalSeconds';
import type { GameSession, Indicator } from '@/session/GameSession';
import { Tension } from '@/session/Tension';
import type { AudioEngine } from '@/services/audio/AudioEngine';
import { CALM_BPM } from '@/services/audio/Music';
import type { Haptics } from '@/services/Haptics';

/** The music's tempo by danger: calm, then quicker, as the genre's classics hurry up. */
export const TEMPO = { calm: CALM_BPM, danger: 96, critical: 108 } as const;
/** Music intensity: a pause or the end of a game calms it, the danger drives it. */
export const MUSIC_PLAYING = 0.42;
export const MUSIC_DANGER = 0.58;
const MUSIC_CALM = 0.12;
/** A close call: time at a third of its pace for a moment (real ms). */
const CLOSE_CALL_SLOW = { scale: 0.3, ms: 420 } as const;
/** A defeat: half a second of slow motion while the well breaks. */
const DEFEAT_SLOW = { scale: 0.25, ms: 600 } as const;
/** How a game ends overwhelmed by its stack (or its tray): the well breaks. */
const OVERWHELMED: ReadonlySet<string> = new Set([
  'blockOut',
  'lockOut',
  'topOut',
  'noMoves',
  'defeat',
]);

export interface TensionOptions {
  readonly audio: AudioEngine;
  readonly haptics: Haptics;
  readonly clock: FrameClock;
  /** The player's effect level, read when it matters. */
  readonly level: () => EffectsLevel;
  /** The game screen: the well's canvas is found in it. */
  readonly root: Ref<HTMLElement | null>;
}

/**
 * The tension of a game (1.19), for the game screen: follows the danger
 * frame by frame and plays it — the music's tempo, heartbeat and muffled pad,
 * the relief, the final seconds of a timed game, the close call's slow motion
 * and flash, the broken well of a defeat — and exposes what the danger layer
 * and the clock draw.
 */
export function useTension(options: TensionOptions) {
  const { audio, haptics, clock } = options;
  const tension = new Tension();
  const final = new FinalSeconds();
  const flashes = new FlashLimiter();
  let elapsed = 0;

  /** How much danger to show (0 to 1). */
  const amount = ref(0);
  /** The final seconds run: the clock is shown in red. */
  const urgent = ref(false);
  const flash = ref(0);
  const relief = ref(0);
  const broken = ref(false);
  /** The well's canvas, found once its stage is on screen. */
  const well = shallowRef<HTMLElement | null>(null);

  tension.events.on('relief', () => {
    audio.relief();
    haptics.pulse([10, 40, 10]);
    relief.value++;
  });
  final.events.on('hurry', () => audio.play(hurry));
  final.events.on('tick', ({ second }) => audio.play(countdown(second <= 3)));

  /**
   * Every frame, after the game's own update. `playing` while the game is
   * played: not paused, not decided (a Guardian's show after the goal keeps
   * the world moving, not the danger).
   */
  const update = (
    current: GameSession | null,
    deltaMs: number,
    indicators: readonly Indicator[],
    playing: boolean,
  ) => {
    elapsed += deltaMs;
    // Found again once its stage is replaced (the race's worlds).
    if (!well.value?.isConnected) {
      well.value = options.root.value?.querySelector<HTMLElement>('.stage__well canvas') ?? null;
    }
    const running = playing && current?.state === 'running';
    // A pause freezes the danger (no relief for a game merely paused).
    if (running) tension.update(current.pressure(), deltaMs);
    final.update(
      running ? (indicators.find((item) => item.id === 'timeLeft')?.value ?? null) : null,
    );
    urgent.value = final.urgent;
    const shown = running || broken.value ? Math.round(tension.amount * 200) / 200 : 0;
    if (shown !== amount.value) amount.value = shown;
    audio.setIntensity(running ? MUSIC_PLAYING + MUSIC_DANGER * current.pressure() : MUSIC_CALM);
    audio.setDanger(running ? tension.amount : 0);
    // A game with its own pulse (the Rhythm mode) sets the tempo; the music follows its beats.
    const pulse = indicators.find((item) => item.id === 'bpm')?.value;
    audio.setTempo(
      !running
        ? TEMPO.calm
        : pulse !== undefined
          ? pulse
          : final.urgent || tension.stage === 'critical'
            ? TEMPO.critical
            : tension.stage === 'danger'
              ? TEMPO.danger
              : TEMPO.calm,
    );
  };

  /**
   * The game is paused: its clock stops, so no frame will calm what shows the
   * danger; it rests at once (no vignette, no heartbeat, the calm tempo) and
   * comes back with the game. The danger itself is kept: no relief for a game
   * merely paused.
   */
  const rest = () => {
    if (!broken.value) amount.value = 0;
    audio.setIntensity(MUSIC_CALM);
    audio.setDanger(0);
    audio.setTempo(TEMPO.calm);
  };

  /** A clear made in danger: a golden rush, and with every effect on, time slows down. */
  const closeCall = () => {
    audio.play(closeCallSound);
    haptics.pulse([15, 30, 15]);
    if (options.level() !== 'full') return;
    clock.slow(CLOSE_CALL_SLOW.scale, CLOSE_CALL_SLOW.ms);
    if (flashes.tryFlash(elapsed)) flash.value++;
  };

  /** The game ended: overwhelmed, the rift breaks the well. */
  const end = (reason: string) => {
    final.reset();
    urgent.value = false;
    if (!OVERWHELMED.has(reason)) {
      tension.reset();
      return;
    }
    broken.value = true;
    audio.play(wellBreak);
    if (options.level() === 'full') clock.slow(DEFEAT_SLOW.scale, DEFEAT_SLOW.ms);
  };

  /**
   * A lost game continues (1.31): the glass is whole again and the danger
   * goes on from where it stood; the freed board will bring its relief.
   */
  const revive = () => {
    broken.value = false;
  };

  /** A new game: calm, a new well to find. */
  const reset = () => {
    tension.reset();
    final.reset();
    broken.value = false;
    urgent.value = false;
    amount.value = 0;
    well.value = null;
  };

  onBeforeUnmount(() => {
    audio.setIntensity(MUSIC_CALM);
    audio.setDanger(0);
    audio.setTempo(TEMPO.calm);
  });

  return {
    amount,
    urgent,
    flash,
    relief,
    broken,
    well,
    update,
    rest,
    closeCall,
    end,
    revive,
    reset,
  };
}

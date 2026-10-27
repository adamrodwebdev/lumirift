import { Tone } from '@/core/Tone';
import { PlayerVoice } from '@/fx/PlayerVoice';
import * as sounds from '@/fx/sounds';
import type { AudioEngine, SoundRecipe } from '@/services/audio/AudioEngine';
import type { SandEventSource } from '../engine/SandGame';
import type { ReactionKind } from '../engine/SandReactions';
import type { Haptics } from '@/services/Haptics';

const REACTION_SOUNDS: Readonly<Partial<Record<ReactionKind, SoundRecipe>>> = {
  blaze: sounds.blaze,
  scorch: sounds.crackle,
  melt: sounds.hiss,
  freeze: sounds.freeze,
  fuse: sounds.blaze,
  dilute: sounds.splash,
  dissolve: sounds.fizz,
  sprout: sounds.sprout,
};

/** Sounds and vibrations of the sand well; the player's gestures play along with the music. */
export class SandSoundscape {
  private lastQuiet = 0;
  private readonly voice = new PlayerVoice();

  constructor(
    private readonly audio: AudioEngine,
    private readonly haptics: Haptics,
  ) {}

  attach(session: SandEventSource): () => void {
    const { audio, haptics } = this;
    const offs = [
      session.onGame('move', () => audio.play(this.voice.move())),
      session.onGame('rotate', () => audio.play(this.voice.rotate())),
      session.onGame('hardDrop', () => haptics.pulse(10)),
      session.onGame('lock', ({ piece }) => {
        if (piece.tone === Tone.Lightning) return;
        const liquid =
          piece.tone === Tone.Water || piece.tone === Tone.Oil || piece.tone === Tone.Acid;
        audio.play(liquid ? sounds.splash : piece.tone === Tone.Ice ? sounds.freeze : sounds.pour);
        audio.play(sounds.settle);
      }),
      session.onGame('strike', ({ kind }) => {
        audio.play(sounds.zap(kind === 'shock'));
        haptics.pulse(kind === 'shock' ? [40, 30, 90] : 40);
      }),
      session.onGame('react', ({ kind }) => this.react(kind)),
      // The next Guardian passing under the sand: a deep rumble, the pad shaking.
      session.onGame('tease', () => {
        audio.play(sounds.rumble);
        haptics.pulse([40, 60, 40, 60, 40]);
      }),
      session.onGame('boss', ({ event }) => {
        if (event.type === 'warn') audio.play(sounds.rumble);
        else if (event.type === 'surge') {
          audio.play(sounds.roar);
          haptics.pulse([60, 30, 60]);
        } else if (event.type === 'hurt') audio.play(sounds.bossHit(event.hit === 'boltHead'));
        else if (event.type === 'phase') audio.play(sounds.roar);
        else if (event.type === 'defeated') {
          audio.play(sounds.newRecord);
          haptics.pulse([40, 30, 40, 30, 160]);
        }
      }),
      session.onGame('clear', ({ regions, multiplier }) => {
        audio.play(sounds.sweep(regions, multiplier));
        haptics.pulse(regions > 1 ? [30, 40, 70] : 30);
      }),
      session.onGame('comboEnd', () => audio.play(sounds.comboLost)),
      session.onGame('quench', () => audio.play(sounds.hiss)),
      session.onGame('burn', () => {
        audio.play(sounds.crackle);
        haptics.pulse([20, 20, 40]);
      }),
      session.onGame('wind', ({ phase }) => {
        if (phase === 'soon') audio.play(sounds.warning);
        if (phase === 'start') audio.play(sounds.gust);
      }),
      session.onGame('levelUp', () => audio.play(sounds.levelUp)),
      session.onGame('over', () => {
        audio.play(sounds.gameOver);
        haptics.pulse([60, 40, 120]);
      }),
    ];
    return () => offs.forEach((off) => off());
  }

  /** Each reaction is heard; frequent ones (a blaze eating sand, acid) are throttled. */
  private react(kind: ReactionKind): void {
    const now = performance.now();
    const quiet = kind === 'scorch' || kind === 'dissolve' || kind === 'freeze';
    if (quiet && now - this.lastQuiet < 180) return;
    if (quiet) this.lastQuiet = now;
    const sound = REACTION_SOUNDS[kind];
    if (sound) this.audio.play(sound);
    if (kind === 'blaze') this.haptics.pulse([20, 20, 50]);
  }
}

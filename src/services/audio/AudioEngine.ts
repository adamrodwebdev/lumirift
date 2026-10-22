import type { Groove } from '@/fx/harmony';
import { CALM_BPM, Music } from './Music';
import { createNoiseBuffer, Synth } from './Synth';

/**
 * A sound: a few scheduled notes and noise bursts. It knows where the music
 * is (`groove`), so that a gesture can play along: a note of the chord
 * playing, stronger on the beat.
 */
export type SoundRecipe = (synth: Synth, groove: Groove) => void;

type ContextFactory = () => AudioContext;

/** How much of each bus goes through the shared room. */
const SFX_REVERB = 0.16;
const MUSIC_REVERB = 0.35;

/**
 * Owns the audio context. Browsers only allow sound after a user gesture, so
 * the context is created on `unlock()` (first tap or key press); sounds asked
 * for before that are simply skipped.
 *
 * Two buses, effects and music, with their own volumes, share one master
 * (mute, suspension) and one room: a short reverb generated in code, so that
 * every sound seems to come from the same place.
 */
export class AudioEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfx: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private synth: Synth | null = null;
  private music: Music | null = null;
  private volume = 0.7;
  private musicVolume = 0.5;
  private muted = false;
  private intensity = 0.15;
  private tempo = CALM_BPM;
  private danger = 0;
  private surge = 0;

  constructor(private readonly createContext: ContextFactory | null) {}

  static browser(): AudioEngine {
    const Context = typeof window === 'undefined' ? undefined : window.AudioContext;
    return new AudioEngine(Context ? () => new Context() : null);
  }

  get ready(): boolean {
    return this.synth !== null;
  }

  unlock(): void {
    if (!this.createContext) return;
    if (!this.context) {
      const context = this.createContext();
      this.context = context;
      this.master = context.createGain();
      this.master.connect(context.destination);
      const room = context.createConvolver();
      room.buffer = createRoom(context);
      room.connect(this.master);
      this.sfx = this.bus(SFX_REVERB, room);
      this.musicBus = this.bus(MUSIC_REVERB, room);
      const noise = createNoiseBuffer(context);
      this.synth = new Synth(context, this.sfx, noise);
      this.music = new Music(context, this.musicBus, noise);
      this.music.setIntensity(this.intensity);
      this.music.setTempo(this.tempo);
      this.music.setDanger(this.danger);
      this.music.setSurge(this.surge);
      this.music.start();
      this.applyVolume();
    }
    if (this.context.state === 'suspended') void this.context.resume();
  }

  setVolume(volume: number): void {
    this.volume = clamp(volume);
    this.applyVolume();
  }

  setMusicVolume(volume: number): void {
    this.musicVolume = clamp(volume);
    this.applyVolume();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.applyVolume();
  }

  /** How intense the music is: calm menus (low) to a game about to be lost (1). */
  setIntensity(intensity: number): void {
    this.intensity = clamp(intensity);
    this.music?.setIntensity(this.intensity);
  }

  /** The music's tempo, in beats a minute (it changes on the next bar). */
  setTempo(bpm: number): void {
    this.tempo = bpm;
    this.music?.setTempo(bpm);
  }

  /** How close the game is to being lost (0 to 1): a heartbeat under the music, a muffled pad. */
  setDanger(danger: number): void {
    this.danger = clamp(danger);
    this.music?.setDanger(this.danger);
  }

  /**
   * A game with its own pulse (the Rhythm mode): its beat `count` (1 the
   * first, a bar every four) falls now, and the music's beats follow it.
   */
  pulse(count: number): void {
    if (this.context?.state !== 'running') return;
    this.music?.follow(count);
  }

  /** A rift surge running (1) or not (0): the music sinks while time slows. */
  setSurge(surge: number): void {
    this.surge = clamp(surge);
    this.music?.setSurge(this.surge);
  }

  /** The player got out of danger: the music opens and resolves. */
  relief(): void {
    this.danger = 0;
    if (this.context?.state !== 'running') return;
    this.music?.relief();
  }

  /** Stops the audio clock while the page is hidden. */
  suspend(): void {
    if (this.context?.state === 'running') void this.context.suspend();
  }

  resume(): void {
    if (this.context?.state === 'suspended') void this.context.resume();
  }

  play(recipe: SoundRecipe): void {
    if (!this.synth || !this.music || this.muted || this.volume === 0) return;
    if (this.context?.state !== 'running') return;
    recipe(this.synth, this.music.groove());
  }

  /** A bus: straight to the master, plus a share sent to the room. */
  private bus(reverb: number, room: AudioNode): GainNode {
    const context = this.context!;
    const bus = context.createGain();
    bus.connect(this.master!);
    const send = context.createGain();
    send.gain.value = reverb;
    bus.connect(send).connect(room);
    return bus;
  }

  private applyVolume(): void {
    if (!this.master || !this.context) return;
    // Perceived loudness is logarithmic: square the slider values.
    const now = this.context.currentTime;
    this.master.gain.setTargetAtTime(this.muted ? 0 : 1, now, 0.02);
    this.sfx?.gain.setTargetAtTime(this.volume * this.volume, now, 0.02);
    this.musicBus?.gain.setTargetAtTime(this.musicVolume * this.musicVolume, now, 0.05);
  }
}

const clamp = (value: number) => Math.min(1, Math.max(0, value));

/** A small, dark room: 1.6 s of decaying stereo noise. */
function createRoom(context: BaseAudioContext): AudioBuffer {
  const length = Math.round(context.sampleRate * 1.6);
  const buffer = context.createBuffer(2, length, context.sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const data = buffer.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      const decay = (1 - i / length) ** 3;
      data[i] = (Math.random() * 2 - 1) * decay;
    }
  }
  return buffer;
}

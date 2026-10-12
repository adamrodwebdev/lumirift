import { createNoiseBuffer, Synth } from './Synth';

/** A sound: a few scheduled notes and noise bursts. */
export type SoundRecipe = (synth: Synth) => void;

type ContextFactory = () => AudioContext;

/**
 * Owns the audio context. Browsers only allow sound after a user gesture, so
 * the context is created on `unlock()` (first tap or key press); sounds asked
 * for before that are simply skipped.
 */
export class AudioEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private synth: Synth | null = null;
  private volume = 0.7;
  private muted = false;

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
      this.context = this.createContext();
      this.master = this.context.createGain();
      this.master.connect(this.context.destination);
      this.synth = new Synth(this.context, this.master, createNoiseBuffer(this.context));
      this.applyVolume();
    }
    if (this.context.state === 'suspended') void this.context.resume();
  }

  setVolume(volume: number): void {
    this.volume = Math.min(1, Math.max(0, volume));
    this.applyVolume();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.applyVolume();
  }

  /** Stops the audio clock while the page is hidden. */
  suspend(): void {
    if (this.context?.state === 'running') void this.context.suspend();
  }

  resume(): void {
    if (this.context?.state === 'suspended') void this.context.resume();
  }

  play(recipe: SoundRecipe): void {
    if (!this.synth || this.muted || this.volume === 0) return;
    if (this.context?.state !== 'running') return;
    recipe(this.synth);
  }

  private applyVolume(): void {
    if (!this.master || !this.context) return;
    // Perceived loudness is logarithmic: square the slider value.
    const gain = this.muted ? 0 : this.volume * this.volume;
    this.master.gain.setTargetAtTime(gain, this.context.currentTime, 0.02);
  }
}

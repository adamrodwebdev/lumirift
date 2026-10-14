import { degree, PROGRESSION, ROOT, semitone } from '@/fx/harmony';

/** 84 beats a minute: calm enough for menus, steady under play. */
const BPM = 84;
const BEAT = 60 / BPM;
/** Each chord lasts two bars of four beats. */
const BEATS_PER_CHORD = 8;
/** The scheduler looks this far ahead, on the audio clock. */
const LOOKAHEAD_S = 0.4;
const TICK_MS = 120;
/** How fast the music follows a change of intensity (per scheduler tick). */
const SMOOTHING = 0.08;

/**
 * Stackrift's music, generated live in the game's key (D minor pentatonic):
 * a pad on the progression i – VI – III – VII, then, as the intensity rises,
 * a pulsing bass, a crystal arpeggio and a light beat. The intensity follows
 * the game (calm in menus, tense when the stack is high). Notes are scheduled
 * ahead on the audio clock, so a slow frame never makes it stutter.
 */
export class Music {
  private intensity = 0.15;
  private target = 0.15;
  private beat = 0;
  private nextTime = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly noise: AudioBuffer;

  constructor(
    private readonly context: BaseAudioContext,
    private readonly output: AudioNode,
    noise: AudioBuffer,
  ) {
    this.noise = noise;
  }

  start(): void {
    if (this.timer !== null) return;
    this.nextTime = this.context.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), TICK_MS);
    this.schedule();
  }

  stop(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
  }

  /** 0 (a quiet pad) to 1 (everything, brighter). */
  setIntensity(value: number): void {
    this.target = Math.min(1, Math.max(0, value));
  }

  private schedule(): void {
    this.intensity += (this.target - this.intensity) * SMOOTHING;
    // A suspended context (hidden page, an ad) stands still: nothing to catch up.
    if (this.nextTime < this.context.currentTime) this.nextTime = this.context.currentTime + 0.05;
    while (this.nextTime < this.context.currentTime + LOOKAHEAD_S) {
      this.playBeat(this.beat, this.nextTime);
      this.beat++;
      this.nextTime += BEAT;
    }
  }

  private playBeat(beat: number, time: number): void {
    const chord = PROGRESSION[Math.floor(beat / BEATS_PER_CHORD) % PROGRESSION.length]!;
    const inBar = beat % 4;
    const level = this.intensity;
    if (beat % BEATS_PER_CHORD === 0) this.pad(chord, time, level);
    if (level > 0.3 && (inBar === 0 || inBar === 2)) this.bass(chord[0]!, time, level);
    if (level > 0.5) {
      this.arp(beat, time, level);
      this.arp(beat + 0.5, time + BEAT / 2, level);
    }
    if (level > 0.72) {
      if (inBar === 0 || inBar === 2) this.kick(time, level);
      this.hat(time + BEAT / 2, level);
    }
  }

  /** The chord, held for two bars: detuned voices through a soft filter. */
  private pad(chord: readonly number[], time: number, level: number): void {
    const length = BEAT * BEATS_PER_CHORD;
    const filter = this.context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 500 + level * 1600;
    filter.Q.value = 0.7;
    const gain = this.envelope(time, 1.6, length + 1.8, 0.045 + level * 0.02);
    filter.connect(gain);
    for (const step of chord) {
      for (const detune of [-7, 7]) {
        const osc = this.context.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = semitone(ROOT, step);
        osc.detune.value = detune;
        osc.connect(filter);
        osc.start(time);
        osc.stop(time + length + 2);
      }
    }
  }

  private bass(step: number, time: number, level: number): void {
    const osc = this.context.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = semitone(ROOT, step - 12);
    osc.connect(this.envelope(time, 0.01, BEAT * 0.9, 0.09 + level * 0.06));
    osc.start(time);
    osc.stop(time + BEAT);
  }

  /** Crystal notes of the scale, more of them as the game heats up. */
  private arp(beat: number, time: number, level: number): void {
    if (Math.random() > 0.35 + level * 0.55) return;
    const step = 10 + Math.floor(Math.random() * 7);
    const osc = this.context.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = degree(step);
    const accent = beat % 2 === 0 ? 1 : 0.7;
    osc.connect(this.envelope(time, 0.005, 0.45, 0.025 * accent));
    osc.start(time);
    osc.stop(time + 0.5);
  }

  private kick(time: number, level: number): void {
    const osc = this.context.createOscillator();
    osc.frequency.setValueAtTime(110, time);
    osc.frequency.exponentialRampToValueAtTime(42, time + 0.18);
    osc.connect(this.envelope(time, 0.003, 0.2, 0.1 * level));
    osc.start(time);
    osc.stop(time + 0.25);
  }

  private hat(time: number, level: number): void {
    const source = this.context.createBufferSource();
    source.buffer = this.noise;
    const filter = this.context.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 7500;
    source.connect(filter).connect(this.envelope(time, 0.002, 0.05, 0.025 * level));
    source.start(time, Math.random() * 0.5);
    source.stop(time + 0.08);
  }

  private envelope(time: number, attack: number, length: number, peak: number): GainNode {
    const gain = this.context.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), time + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + length);
    gain.connect(this.output);
    return gain;
  }
}

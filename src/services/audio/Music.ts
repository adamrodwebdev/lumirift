import { degree, PROGRESSION, ROOT, semitone } from '@/fx/harmony';

/** 84 beats a minute: calm enough for menus, steady under play. */
export const CALM_BPM = 84;
/** Each chord lasts two bars of four beats. */
const BEATS_PER_CHORD = 8;
/** The scheduler looks this far ahead, on the audio clock. */
const LOOKAHEAD_S = 0.4;
const TICK_MS = 120;
/** How fast the music follows a change of intensity, and of danger (per scheduler tick). */
const SMOOTHING = 0.08;
const DANGER_SMOOTHING = 0.18;
/** The pad's filter: wide open when all is well, closed in at the edge of defeat (Hz). */
const OPEN_HZ = 12_000;
const MUFFLED_HZ = 650;
/** No heartbeat under this much danger. */
const HEART_FROM = 0.04;

/**
 * Lumirift's music, generated live in the game's key (D minor pentatonic):
 * a pad on the progression i – VI – III – VII, then, as the intensity rises,
 * a pulsing bass, a crystal arpeggio and a light beat. The intensity follows
 * the game (calm in menus, tense when the stack is high); in danger the
 * tempo quickens, a heartbeat rises under it and the pad closes in, until
 * the relief opens it again on a major chord. Notes are scheduled ahead on
 * the audio clock, so a slow frame never makes it stutter.
 */
export class Music {
  private intensity = 0.15;
  private target = 0.15;
  private danger = 0;
  private dangerTarget = 0;
  private beat = 0;
  private nextTime = 0;
  private beatS = 60 / CALM_BPM;
  private nextBpm = CALM_BPM;
  /** Until then, the pad's filter belongs to the relief. */
  private reliefUntil = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly noise: AudioBuffer;
  /** Every pad goes through it: the danger muffles them. */
  private readonly padBus: BiquadFilterNode;

  constructor(
    private readonly context: BaseAudioContext,
    private readonly output: AudioNode,
    noise: AudioBuffer,
  ) {
    this.noise = noise;
    this.padBus = context.createBiquadFilter();
    this.padBus.type = 'lowpass';
    this.padBus.frequency.value = OPEN_HZ;
    this.padBus.Q.value = 0.8;
    this.padBus.connect(output);
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
    this.target = clamp(value);
  }

  /** Beats a minute; a new tempo starts on the next bar, so the rhythm never stumbles. */
  setTempo(bpm: number): void {
    this.nextBpm = Math.min(200, Math.max(40, bpm));
  }

  /** How close the game is to being lost (0 to 1): the heartbeat, the muffled pad. */
  setDanger(value: number): void {
    this.dangerTarget = clamp(value);
  }

  /** Out of danger: the pad opens wide and a major chord resolves the tension, on a breath. */
  relief(): void {
    const now = this.context.currentTime + 0.02;
    const cutoff = this.padBus.frequency;
    cutoff.cancelScheduledValues(now);
    cutoff.setValueAtTime(Math.max(MUFFLED_HZ, cutoff.value), now);
    cutoff.exponentialRampToValueAtTime(OPEN_HZ, now + 0.35);
    this.reliefUntil = now + 1.4;
    this.danger = 0;
    this.dangerTarget = 0;
    // The tonic chord with its third raised: D major over the minor key.
    [0, 4, 7, 12].forEach((step, i) => {
      const start = now + i * 0.045;
      const osc = this.context.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = semitone(ROOT * 2, step);
      osc.connect(this.envelope(start, 0.03, 2.2, 0.045, this.output));
      osc.start(start);
      osc.stop(start + 2.4);
    });
    const breath = this.context.createBufferSource();
    breath.buffer = this.noise;
    breath.loop = true;
    const band = this.context.createBiquadFilter();
    band.type = 'bandpass';
    band.Q.value = 0.7;
    band.frequency.setValueAtTime(500, now);
    band.frequency.exponentialRampToValueAtTime(1800, now + 0.6);
    breath.connect(band).connect(this.envelope(now, 0.35, 1.3, 0.05, this.output));
    breath.start(now, Math.random() * 0.5);
    breath.stop(now + 1.4);
  }

  private schedule(): void {
    this.intensity += (this.target - this.intensity) * SMOOTHING;
    this.danger += (this.dangerTarget - this.danger) * DANGER_SMOOTHING;
    const now = this.context.currentTime;
    if (now >= this.reliefUntil) {
      this.padBus.frequency.setTargetAtTime(
        OPEN_HZ * (MUFFLED_HZ / OPEN_HZ) ** this.danger,
        now,
        0.3,
      );
    }
    // A suspended context (hidden page, an ad) stands still: nothing to catch up.
    if (this.nextTime < now) this.nextTime = now + 0.05;
    while (this.nextTime < now + LOOKAHEAD_S) {
      if (this.beat % 4 === 0) this.beatS = 60 / this.nextBpm;
      this.playBeat(this.beat, this.nextTime);
      this.beat++;
      this.nextTime += this.beatS;
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
      this.arp(beat + 0.5, time + this.beatS / 2, level);
    }
    if (level > 0.72) {
      if (inBar === 0 || inBar === 2) this.kick(time, level);
      this.hat(time + this.beatS / 2, level);
    }
    if (this.danger > HEART_FROM) this.heart(time, this.danger);
  }

  /** The chord, held for two bars: detuned voices through a soft filter. */
  private pad(chord: readonly number[], time: number, level: number): void {
    const length = this.beatS * BEATS_PER_CHORD;
    const filter = this.context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 500 + level * 1600;
    filter.Q.value = 0.7;
    const gain = this.envelope(time, 1.6, length + 1.8, 0.045 + level * 0.02, this.padBus);
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
    osc.connect(this.envelope(time, 0.01, this.beatS * 0.9, 0.09 + level * 0.06));
    osc.start(time);
    osc.stop(time + this.beatS);
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

  /**
   * Lub-dub, on every beat: two low thumps under the music, louder as the
   * danger grows (a body an octave up, so that small speakers carry it).
   */
  private heart(time: number, level: number): void {
    for (const [offset, weight] of [
      [0, 1],
      [0.17, 0.65],
    ] as const) {
      const start = time + offset;
      for (const [from, to, share] of [
        [64, 38, 1],
        [128, 76, 0.35],
      ] as const) {
        const osc = this.context.createOscillator();
        osc.frequency.setValueAtTime(from, start);
        osc.frequency.exponentialRampToValueAtTime(to, start + 0.14);
        osc.connect(this.envelope(start, 0.006, 0.18, 0.24 * level * weight * share));
        osc.start(start);
        osc.stop(start + 0.22);
      }
    }
  }

  private envelope(
    time: number,
    attack: number,
    length: number,
    peak: number,
    destination: AudioNode = this.output,
  ): GainNode {
    const gain = this.context.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), time + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + length);
    gain.connect(destination);
    return gain;
  }
}

const clamp = (value: number) => Math.min(1, Math.max(0, value));

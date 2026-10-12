export interface ToneOptions {
  readonly type?: OscillatorType;
  readonly frequency: number;
  /** Frequency reached at the end (glide). */
  readonly to?: number;
  readonly duration: number;
  readonly gain: number;
  /** Delay from now, in seconds. */
  readonly start?: number;
  readonly attack?: number;
}

export interface NoiseOptions {
  readonly filter: BiquadFilterType;
  readonly frequency: number;
  readonly to?: number;
  readonly q?: number;
  readonly duration: number;
  readonly gain: number;
  readonly start?: number;
  readonly attack?: number;
}

const SILENCE = 0.0001;

/**
 * Builds short sounds from oscillators and filtered noise. Every node is
 * scheduled and stopped at once, so nothing needs cleaning up afterwards.
 */
export class Synth {
  constructor(
    private readonly context: BaseAudioContext,
    private readonly output: AudioNode,
    private readonly noiseBuffer: AudioBuffer,
  ) {}

  tone({
    type = 'sine',
    frequency,
    to,
    duration,
    gain,
    start = 0,
    attack = 0.004,
  }: ToneOptions): void {
    const t = this.context.currentTime + start;
    const oscillator = this.context.createOscillator();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, t);
    if (to !== undefined)
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + duration);
    const envelope = this.envelope(t, attack, duration, gain);
    oscillator.connect(envelope);
    oscillator.start(t);
    oscillator.stop(t + duration + 0.05);
  }

  noise({
    filter,
    frequency,
    to,
    q = 1,
    duration,
    gain,
    start = 0,
    attack = 0.002,
  }: NoiseOptions): void {
    const t = this.context.currentTime + start;
    const source = this.context.createBufferSource();
    source.buffer = this.noiseBuffer;
    source.loop = true;
    const shaping = this.context.createBiquadFilter();
    shaping.type = filter;
    shaping.Q.value = q;
    shaping.frequency.setValueAtTime(frequency, t);
    if (to !== undefined)
      shaping.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + duration);
    const envelope = this.envelope(t, attack, duration, gain);
    source.connect(shaping).connect(envelope);
    // A random offset in the buffer: two bursts never sound exactly alike.
    source.start(t, Math.random() * Math.max(0, this.noiseBuffer.duration - duration - 0.1));
    source.stop(t + duration + 0.05);
  }

  private envelope(t: number, attack: number, duration: number, gain: number): GainNode {
    const node = this.context.createGain();
    node.gain.setValueAtTime(SILENCE, t);
    node.gain.exponentialRampToValueAtTime(Math.max(SILENCE, gain), t + attack);
    node.gain.exponentialRampToValueAtTime(SILENCE, t + duration);
    node.connect(this.output);
    return node;
  }
}

/** One second of white noise, generated once. */
export function createNoiseBuffer(context: BaseAudioContext): AudioBuffer {
  const buffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

/** Strength lost per second: a kick fades in about a quarter of a second. */
const DECAY_PER_SECOND = 0.0004;

/** Below this amplitude (in the scene's unit, cells for a well) the shake stops. */
const REST = 0.005;

/** A decaying random jolt of the whole scene; amplitudes are in the scene's own unit. */
export class ScreenShake {
  private amplitude = 0;
  x = 0;
  y = 0;

  constructor(private readonly random: () => number = Math.random) {}

  /** Adds a jolt; strong kicks do not stack beyond the strongest one. */
  kick(amplitude: number): void {
    this.amplitude = Math.max(this.amplitude, amplitude);
  }

  update(deltaMs: number): void {
    this.amplitude *= DECAY_PER_SECOND ** (deltaMs / 1000);
    if (this.amplitude < REST) this.amplitude = 0;
    this.x = (this.random() * 2 - 1) * this.amplitude;
    this.y = (this.random() * 2 - 1) * this.amplitude;
  }

  get active(): boolean {
    return this.amplitude > 0;
  }
}

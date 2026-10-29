/**
 * The camera's feel (1.41): the shake is trauma squared (S. Eiserloh, « Juicing
 * Your Cameras With Math », GDC 2016) and fades by 1.6 a second; the biggest
 * moments tilt the scene by 0.6° at most; a dip peaks at 22 ms and is gone
 * within 160 ms, without a bounce.
 */
export const CAMERA = {
  traumaPerSecond: 1.6,
  maxTilt: (0.6 * Math.PI) / 180,
  dipPeakMs: 22,
  dipEndMs: 200,
} as const;

/** Below this offset (in the scene's unit) a dip is over. */
const REST = 0.001;

/**
 * Smooth noise in [-1, 1], a function of time alone: the same picture at 60
 * and at 144 frames a second. Three waves of unrelated frequencies per axis.
 */
function noise(seconds: number, axis: number): number {
  const phase = axis * 2.1;
  return (
    (Math.sin(2 * Math.PI * 17 * seconds + phase) +
      0.6 * Math.sin(2 * Math.PI * 29 * seconds + phase * 1.7) +
      0.3 * Math.sin(2 * Math.PI * 43 * seconds + phase * 2.9)) /
    1.9
  );
}

/**
 * The camera of a scene (1.41, in place of the shake of 1.0): it shakes with
 * trauma, dips under a weight and springs back, tilts on the biggest moments.
 * It runs on real time, so a hit-stop does not freeze it. Amounts are in the
 * scene's own unit (cells for a well, grains for Sand); `maxShift` is the
 * offset of a full trauma.
 */
export class Camera {
  /** The offset of the scene this frame, in its unit (y down), and its tilt (radians). */
  x = 0;
  y = 0;
  angle = 0;
  private trauma = 0;
  private tiltTrauma = 0;
  private seconds = 0;
  private dipDepth = 0;
  private dipAge: number = CAMERA.dipEndMs;

  constructor(private readonly maxShift: number) {}

  /** A jolt of `amplitude` at first (the shake of 1.0's kicks): the trauma that gives it. */
  kick(amplitude: number): void {
    this.shake(Math.sqrt(Math.max(0, amplitude) / this.maxShift));
  }

  /** Adds trauma (1 at most); `tilt`: the scene tilts as well. */
  shake(trauma: number, tilt = false): void {
    this.trauma = Math.min(1, this.trauma + trauma);
    if (tilt) this.tiltTrauma = Math.min(1, this.tiltTrauma + trauma);
  }

  /** The scene dips by `depth` (its unit, down) and comes back; the deeper dip wins. */
  dip(depth: number): void {
    if (depth <= this.dipNow()) return;
    this.dipDepth = depth;
    this.dipAge = 0;
  }

  update(realMs: number): void {
    this.seconds += realMs / 1000;
    const fade = (CAMERA.traumaPerSecond * realMs) / 1000;
    this.trauma = Math.max(0, this.trauma - fade);
    this.tiltTrauma = Math.max(0, this.tiltTrauma - fade);
    this.dipAge += realMs;
    const shift = this.trauma ** 2 * this.maxShift;
    this.x = shift * noise(this.seconds, 0);
    this.y = shift * noise(this.seconds, 1) + this.dipNow();
    this.angle = this.tiltTrauma ** 2 * CAMERA.maxTilt * noise(this.seconds, 2);
  }

  /** True while the camera is off its rest. */
  get active(): boolean {
    return this.trauma > 0 || this.tiltTrauma > 0 || this.dipNow() > REST;
  }

  /** The dip now: up to its depth at 22 ms, then back down, none after 200 ms. */
  private dipNow(): number {
    if (this.dipAge >= CAMERA.dipEndMs) return 0;
    const t = this.dipAge / CAMERA.dipPeakMs;
    return this.dipDepth * t * Math.exp(1 - t);
  }
}

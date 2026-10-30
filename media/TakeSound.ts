import { AudioEngine } from '@/services/audio/AudioEngine';
import { MUSIC_TICK_MS } from '@/services/audio/Music';
import { Tension } from '@/session/Tension';
import { MUSIC_DANGER, MUSIC_PLAYING, TEMPO } from '@/ui/screens/useTension';

/** The clips' sound: 48 kHz stereo, as the apps play it. */
const SAMPLE_RATE = 48_000;

/**
 * The sound of a take on the clip set (1.39): the game's own audio engine on
 * an offline context, moved frame by frame with the picture, so each frame's
 * sounds start at that frame's time, exactly. The music follows the danger as
 * a game plays it (useTension): its intensity, heartbeat, tempo and relief.
 */
export class TakeSound {
  readonly engine: AudioEngine;
  private readonly context: OfflineAudioContext;
  private readonly rendering: Promise<AudioBuffer>;
  private readonly tension = new Tension();
  private frames = 0;
  /** When the music next schedules its notes (ms of audio time), as its timer does in a game. */
  private tickAt = 0;
  /** The render has reached the coming frame's time, and waits there for the frame. */
  private reached: Promise<void>;

  constructor(
    durationMs: number,
    private readonly fps: number,
  ) {
    this.context = new OfflineAudioContext({
      numberOfChannels: 2,
      length: Math.ceil((durationMs / 1000) * SAMPLE_RATE),
      sampleRate: SAMPLE_RATE,
    });
    this.engine = AudioEngine.offline(this.context);
    this.tension.events.on('relief', () => this.engine.relief());
    this.reached = this.context.suspend(1 / fps);
    this.rendering = this.context.startRendering();
  }

  /** Resolves once the sound is at the coming frame's time: that frame's sounds start there. */
  ready(): Promise<void> {
    return this.reached;
  }

  /** The frame was played: the music follows its danger, and the sound moves on to the next frame. */
  played(pressure: number, deltaMs: number): void {
    this.frames++;
    this.tension.update(pressure, deltaMs);
    this.engine.setIntensity(MUSIC_PLAYING + MUSIC_DANGER * pressure);
    this.engine.setDanger(this.tension.amount);
    this.engine.setTempo(
      this.tension.stage === 'critical'
        ? TEMPO.critical
        : this.tension.stage === 'danger'
          ? TEMPO.danger
          : TEMPO.calm,
    );
    const elapsed = (this.frames * 1000) / this.fps;
    for (; this.tickAt <= elapsed; this.tickAt += MUSIC_TICK_MS) this.engine.tick();
    const next = (this.frames + 1) / this.fps;
    this.reached =
      next < this.context.length / SAMPLE_RATE ? this.context.suspend(next) : Promise.resolve();
    this.context.resume().catch(() => undefined);
  }

  /** The take's whole sound: the render runs to its end, then each channel's samples. */
  async samples(): Promise<Float32Array[]> {
    await this.reached;
    this.context.resume().catch(() => undefined);
    const buffer = await this.rendering;
    return [0, 1].map((channel) => buffer.getChannelData(channel));
  }
}

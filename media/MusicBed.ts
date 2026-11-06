import type { Groove } from '@/fx/harmony';
import { AudioEngine } from '@/services/audio/AudioEngine';
import { MUSIC_TICK_MS } from '@/services/audio/Music';
import { BEATS_PER_BAR, barSamples, foldTail } from './loopSound';

/** The clips' sound: 48 kHz stereo, as the apps play it. */
const SAMPLE_RATE = 48_000;
/**
 * The bars the music plays before the ones kept: its intensity climbs from
 * the menus' 0.15 to the bed's and holds there long before, and the window
 * starts on the progression's first chord again (Dm, every eight bars).
 */
const LEAD_BARS = 8;
/** What rings on after the window's last note (s): a pad's last two seconds, the room's 1.6, a margin. */
const RING_S = 4;
/** Room for the music's first beat, which comes a little after its start (s). */
const START_S = 1;
/** The last stretch of the render that must be silent: the ring ended within it (ms). */
const QUIET_END_MS = 50;

/** What the bed is played at. */
export interface BedOptions {
  readonly bpm: number;
  readonly bars: number;
  readonly intensity: number;
  /** Seeds Math.random: called before each render, so that both draw the same notes. */
  readonly reseed: () => void;
}

/** The bed, a loop of whole bars that starts on its first downbeat, and how clean its making was. */
export interface MusicBedSound {
  readonly channels: Float32Array[];
  readonly sampleRate: number;
  /** Its loudest sample. */
  readonly peak: number;
  /** The largest difference of the two renders before the window (dB under the bed's peak): they played the same notes. */
  readonly beforeDb: number;
  /** The largest sample of the window's own notes at the end of the render (dB under the bed's peak): their ring had ended. */
  readonly ringDb: number;
}

/** A render of the music, and where its first beat fell (samples). */
interface Played {
  readonly channels: Float32Array[];
  readonly firstBeat: number;
}

/** The game's music on an offline context, at a tempo and an intensity, its beats handed over up to `last`. */
async function played(length: number, options: BedOptions, last: number): Promise<Played> {
  options.reseed();
  const context = new OfflineAudioContext({
    numberOfChannels: 2,
    length,
    sampleRate: SAMPLE_RATE,
  });
  const engine = new AudioEngine(() => context, true);
  // Set before the music starts: its first beat already at the bed's tempo and intensity.
  engine.setTempo(options.bpm);
  engine.setIntensity(options.intensity);
  engine.setDanger(0);
  engine.unlock();
  // Where the music's first beat fell, read at its first tick, after that beat, the way a sound
  // reads the music: before it, the music says "beat 0" (it never says a beat below zero).
  const grid: { firstBeatS?: number; lastBeatS: number; error?: Error } = {
    lastBeatS: Infinity,
  };
  const ticks = Math.floor((length / SAMPLE_RATE / MUSIC_TICK_MS) * 1000);
  for (let tick = 1; tick < ticks; tick++) {
    const at = (tick * MUSIC_TICK_MS) / 1000;
    void context.suspend(at).then(() => {
      try {
        if (grid.firstBeatS === undefined) {
          const groove = grooveOf(engine);
          grid.firstBeatS = at - groove.beat * groove.beatS;
          grid.lastBeatS = grid.firstBeatS + last * groove.beatS;
        }
        // The music hands each beat to the audio clock a little ahead (its look-ahead, under a
        // beat and over a tick): ticking only before beat `last` plays, it hands over `last`
        // and no later.
        if (at < grid.lastBeatS) engine.tick();
      } catch (error) {
        // A render left suspended would never end: the error waits for the render's end.
        grid.error ??=
          error instanceof Error ? error : new Error('The music bed failed as it played');
      }
      return context.resume();
    });
  }
  const buffer = await context.startRendering();
  if (grid.error) throw grid.error;
  const beatOne = (grid.firstBeatS ?? NaN) * SAMPLE_RATE;
  const firstBeat = Math.round(beatOne);
  if (!(Math.abs(beatOne - firstBeat) < 1e-6)) {
    throw new Error(`The music's first beat falls between two samples (${beatOne})`);
  }
  return { channels: [0, 1].map((channel) => buffer.getChannelData(channel)), firstBeat };
}

/** Where the music is now, read the way a sound reads it (AudioEngine.play hands it the groove). */
function grooveOf(engine: AudioEngine): Groove {
  const heard: { groove?: Groove } = {};
  engine.play((_, groove) => {
    heard.groove = groove;
  });
  if (!heard.groove) throw new Error('The music bed found no music to play');
  if (heard.groove.beat <= 0) throw new Error('The music bed read the music before its first beat');
  return heard.groove;
}

/** How far `level` is under `peak` (dB). */
const under = (level: number, peak: number) =>
  level === 0 ? -Infinity : 20 * Math.log10(level / peak);

const largest = (channels: readonly Float32Array[], from: number, to: number) => {
  let top = 0;
  for (const samples of channels) {
    for (let i = from; i < to; i++) top = Math.max(top, Math.abs(samples[i] ?? 0));
  }
  return top;
};

/**
 * The clips' music bed (1.46.3): `bars` bars of the game's own score, played
 * alone on its own engine (its music bus, its room), settled from their first
 * sample, as a loop. The music plays eight bars first, then the window; a
 * second render, the same notes up to the window and none of its own, is
 * taken from the first, which leaves the window's notes alone, with all that
 * rings on after them; that ring is folded onto the bed's head, as the loop
 * plays it after its end. The bed's first sample is the window's first
 * downbeat. Two calls with the same seed give the same bed.
 */
export async function renderMusicBed(options: BedOptions): Promise<MusicBedSound> {
  const bedLength = barSamples(options.bars, options.bpm, SAMPLE_RATE);
  const lead = barSamples(LEAD_BARS, options.bpm, SAMPLE_RATE);
  const first = LEAD_BARS * BEATS_PER_BAR;
  const last = first + options.bars * BEATS_PER_BAR - 1;
  const length = (START_S + RING_S) * SAMPLE_RATE + lead + bedLength;
  const all = await played(length, options, last);
  const before = await played(length, options, first - 1);
  if (all.firstBeat !== before.firstBeat) throw new Error('The two renders of the bed disagree');
  const start = all.firstBeat + lead;
  const own = all.channels.map((samples, channel) =>
    samples.map((value, i) => value - (before.channels[channel]?.[i] ?? 0)),
  );
  const channels = own.map((samples) => foldTail(samples, start, bedLength));
  const peak = largest(channels, 0, bedLength);
  const quiet = Math.round((QUIET_END_MS / 1000) * SAMPLE_RATE);
  return {
    channels,
    sampleRate: SAMPLE_RATE,
    peak,
    beforeDb: under(largest(own, 0, start), peak),
    ringDb: under(largest(own, length - quiet, length), peak),
  };
}

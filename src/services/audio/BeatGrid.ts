import type { Groove } from '@/fx/harmony';

/** A game's own pulse this close to the music's beat is already in time (s). */
const IN_TIME_S = 0.03;

/**
 * The music's beats on the audio clock: which one comes next, and when. The
 * tempo changes at the next bar, so the rhythm never stumbles. A game with
 * its own pulse (the Rhythm mode) can lead: the next beats move onto it.
 */
export class BeatGrid {
  /** The next beat to play. */
  private beat = 0;
  /** When it plays, on the audio clock (s). */
  private time = 0;
  private beatS: number;
  private bpm: number;

  constructor(bpm: number) {
    this.bpm = bpm;
    this.beatS = 60 / bpm;
  }

  /** The first beat, shortly after `now`. */
  start(now: number): void {
    this.time = now + 0.1;
  }

  /** Beats a minute, from the next bar. */
  setTempo(bpm: number): void {
    this.bpm = Math.min(200, Math.max(40, bpm));
  }

  /** Hands every beat due before `until` to `play`, with its time and length. */
  advance(now: number, until: number, play: (beat: number, time: number, beatS: number) => void) {
    // A suspended clock (hidden page, an ad) stood still: nothing to catch up.
    if (this.time < now) this.time = now + 0.05;
    while (this.time < until) {
      if (this.beat % 4 === 0) this.beatS = 60 / this.bpm;
      play(this.beat, this.time, this.beatS);
      this.beat++;
      this.time += this.beatS;
    }
  }

  /** Where the music is at `now`. */
  at(now: number): Groove {
    return { beat: Math.max(0, this.beat - (this.time - now) / this.beatS), beatS: this.beatS };
  }

  /**
   * A game's pulse: its beat `count` (1 the first, a bar every four) falls at
   * `now`. Out of time, the beats not yet played move onto it, at its tempo,
   * its first beat of four becoming the music's first; those already handed
   * to the audio clock stay. Returns true when the grid moved.
   */
  follow(now: number, count: number): boolean {
    const position = this.beat - (this.time - now) / this.beatS;
    const nearest = Math.round(position);
    // The beat that falls now starts the same place in the bar as the game's.
    let shift = (((count - 1 - nearest) % 4) + 4) % 4;
    if (shift > 2) shift -= 4;
    const target = nearest + shift;
    const tempo = 60 / this.bpm;
    if (Math.abs(position - target) * this.beatS <= IN_TIME_S && tempo === this.beatS) return false;
    // The first free place: half a beat after the last beat already scheduled.
    const scheduled = this.time - this.beatS;
    const steps = Math.max(1, Math.ceil((scheduled + tempo / 2 - now) / tempo));
    // Never a beat played twice (a chord would start again): a bar later, same place in it.
    let next = target + steps;
    while (next < this.beat) next += 4;
    this.beatS = tempo;
    this.beat = next;
    this.time = now + steps * tempo;
    return true;
  }
}

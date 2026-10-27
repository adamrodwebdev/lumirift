import { CRITICAL_FROM, DANGER_FROM, SAFE_BELOW } from '@/session/Tension';
import type { PlayerSkill } from './CurvePlayer';

/** Time under pressure counts from half the well: half of what loses the game. */
export const PRESSURE_FROM = 0.5;
/** The pressure is noted once a second, for the level's phases. */
export const TRACE_MS = 1000;

/** One simulated game of a level: who played it, and how it ended. */
export interface CurveGame {
  readonly levelId: string;
  readonly skill: PlayerSkill;
  readonly seed: number;
}

export interface CurveOutcome {
  readonly won: boolean;
  /** `goal` when the level's goal was met, else why the game ended (`timeUp`, `topOut`…). */
  readonly reason: string;
  /** How much of the goal was reached (0 to 1; a duel's win counts all or nothing). */
  readonly progress: number;
}

/** What a simulated game of a level lived through (1.33). */
export interface CurveReport extends CurveGame, CurveOutcome {
  readonly durationMs: number;
  /** Time with the pressure at half the well or more. */
  readonly pressureMs: number;
  /** Time with nothing to act on: the game between two pieces. */
  readonly deadMs: number;
  /** Dangers survived: the pressure critical, then safe again (or the level won). */
  readonly nearMisses: number;
  /** The highest pressure. */
  readonly peak: number;
  /** When the danger cues first fired (music, cracks, vignette), or null. */
  readonly dangerAtMs: number | null;
  /** The pressure each second. */
  readonly trace: readonly number[];
}

/**
 * Measures how a game feels, frame by frame, from its pressure: the time
 * spent under pressure, the dead time, the near misses (a critical danger
 * survived, as `Tension` would end it with a relief) and the peak.
 */
export class CurveMeter {
  private elapsedMs = 0;
  private pressureMs = 0;
  private deadMs = 0;
  private nearMisses = 0;
  private peak = 0;
  private dangerAtMs: number | null = null;
  /** In a critical danger not yet survived. */
  private critical = false;
  private readonly trace: number[] = [];

  /** Time measured so far. */
  get durationMs(): number {
    return this.elapsedMs;
  }

  /** A frame of play: the game's pressure, and whether the player had anything to act on. */
  frame(pressure: number, idle: boolean, deltaMs: number): void {
    // Noted at 0 s, 1 s, 2 s…
    if (this.trace.length * TRACE_MS <= this.elapsedMs) this.trace.push(pressure);
    this.elapsedMs += deltaMs;
    if (pressure >= PRESSURE_FROM) this.pressureMs += deltaMs;
    if (idle) this.deadMs += deltaMs;
    this.peak = Math.max(this.peak, pressure);
    if (this.dangerAtMs === null && pressure >= DANGER_FROM) this.dangerAtMs = this.elapsedMs;
    if (pressure >= CRITICAL_FROM) this.critical = true;
    else if (this.critical && pressure < SAFE_BELOW) {
      this.critical = false;
      this.nearMisses++;
    }
  }

  /** The report of the game, once it ended. */
  report(game: CurveGame, outcome: CurveOutcome): CurveReport {
    return {
      ...game,
      ...outcome,
      durationMs: this.elapsedMs,
      pressureMs: this.pressureMs,
      deadMs: this.deadMs,
      // A level won in a critical danger was a near miss too: the closest kind.
      nearMisses: this.nearMisses + (outcome.won && this.critical ? 1 : 0),
      peak: this.peak,
      dangerAtMs: this.dangerAtMs,
      trace: [...this.trace],
    };
  }
}

/** A game's three phases: its opening, middle and end thirds. */
export const PHASES = 3;

/** The mean pressure of each third of a game, from its trace. */
export function phasePressures(report: Pick<CurveReport, 'trace'>): readonly number[] {
  const { trace } = report;
  return Array.from({ length: PHASES }, (_, phase) => {
    const from = Math.floor((phase * trace.length) / PHASES);
    const to = Math.max(from + 1, Math.floor(((phase + 1) * trace.length) / PHASES));
    const part = trace.slice(from, to);
    return part.length === 0 ? 0 : part.reduce((sum, value) => sum + value, 0) / part.length;
  });
}

/** An intensity from 1 to 10 for a mean pressure: 1 for an empty well, 10 at nine tenths. */
export const intensityOf = (pressure: number): number =>
  1 + Math.round(9 * Math.min(1, Math.max(0, pressure / 0.9)));

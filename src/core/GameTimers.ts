interface Planned {
  left: number;
  readonly run: () => void;
}

/**
 * Calls planned in game time: they wait with the game, through its pauses,
 * its slow motions and the rift surge, so a sound stays in step with the
 * picture it goes with (a timer of the browser runs on the wall clock).
 */
export class GameTimers {
  private readonly planned: Planned[] = [];

  /** Runs `run` now, or once `delayMs` of game time has gone by. */
  after(delayMs: number, run: () => void): void {
    if (delayMs <= 0) run();
    else this.planned.push({ left: delayMs, run });
  }

  /** Game time goes by: the calls due run, the earliest first. */
  update(deltaMs: number): void {
    if (this.planned.length === 0 || deltaMs <= 0) return;
    for (const call of this.planned) call.left -= deltaMs;
    if (!this.planned.some((call) => call.left <= 0)) return;
    const due = this.planned.filter((call) => call.left <= 0).sort((a, b) => a.left - b.left);
    for (let i = this.planned.length - 1; i >= 0; i--)
      if (this.planned[i]!.left <= 0) this.planned.splice(i, 1);
    for (const call of due) call.run();
  }

  /** Forgets every call still waiting. */
  clear(): void {
    this.planned.length = 0;
  }
}

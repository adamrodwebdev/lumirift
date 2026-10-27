import type { RaceSession } from '@/families/race';
import type { GameSession } from '@/session/GameSession';
import type { CurvePlayer } from './CurvePlayer';

/**
 * The race's player (1.34): the player of each world in turn, seated again
 * on every fresh board, and idle while the Rift wipes the board or cheers.
 */
export class RaceCurvePlayer implements CurvePlayer {
  private player: CurvePlayer;
  private readonly off: () => void;

  constructor(
    private readonly race: RaceSession,
    private readonly seat: (world: GameSession) => CurvePlayer,
  ) {
    this.player = seat(race.current);
    this.off = race.race.on('shift', () => this.reseat());
  }

  get idle(): boolean {
    return this.race.stage !== 'play' || this.player.idle;
  }

  update(deltaMs: number): void {
    if (this.race.stage === 'play') this.player.update(deltaMs);
  }

  dispose(): void {
    this.off();
    this.player.dispose();
  }

  private reseat(): void {
    this.player.dispose();
    this.player = this.seat(this.race.current);
  }
}
